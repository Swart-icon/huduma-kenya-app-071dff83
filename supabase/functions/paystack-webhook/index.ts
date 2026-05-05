// Paystack webhook receiver. Public endpoint (verify_jwt = false).
//
// SECURITY MODEL
// --------------
// This is the ONLY path that can mark a Paystack premium_subscription "active"
// or a status_boost completed. We:
//   1. Verify HMAC SHA512 signature using PAYSTACK_SECRET_KEY (rejects fake calls).
//   2. Re-verify the transaction by calling Paystack's /transaction/verify
//      endpoint server-side (rejects spoofed payload bodies).
//   3. Locate the originating mpesa_transactions row by reference.
//   4. Reject duplicate / replayed callbacks (idempotent).
//   5. Reject mismatched amounts / currencies.
//   6. Only on full success do we activate the subscription/boost.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createHmac } from "node:crypto";

function ok() {
  return new Response("OK", { status: 200 });
}

Deno.serve(async (req) => {
  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) {
      console.error("PAYSTACK_SECRET_KEY missing");
      return ok();
    }

    const rawBody = await req.text();
    const signature = req.headers.get("x-paystack-signature") || "";
    const expected = createHmac("sha512", PAYSTACK_SECRET_KEY).update(rawBody).digest("hex");

    if (!signature || signature !== expected) {
      console.warn("Paystack signature mismatch — rejecting");
      return new Response("Invalid signature", { status: 401 });
    }

    const event = JSON.parse(rawBody);
    console.log("Paystack webhook:", event?.event, event?.data?.reference);

    const eventType: string = event?.event || "";
    const reference: string | undefined = event?.data?.reference;
    if (!reference) return ok();

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Locate originating tx
    const { data: tx } = await admin
      .from("mpesa_transactions")
      .select("*")
      .or(`paystack_reference.eq.${reference},external_reference.eq.${reference}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!tx) {
      console.warn("No matching tx for paystack reference:", reference);
      return ok();
    }

    // Replay protection
    if (tx.status === "success") {
      console.log("Tx already processed:", tx.id);
      return ok();
    }

    // Re-verify with Paystack server-side (don't trust webhook payload alone)
    const verifyResp = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
    );
    const verifyJson = await verifyResp.json().catch(() => ({}));
    const vData = verifyJson?.data || {};
    const vStatus: string = vData?.status || "";
    const vAmountMinor: number = Number(vData?.amount ?? 0); // kobo
    const vCurrency: string = (vData?.currency || "").toUpperCase();
    const vChannel: string | null = vData?.channel ?? null;
    const vEmail: string | null = vData?.customer?.email ?? null;

    let verified =
      eventType === "charge.success" && vStatus === "success" && verifyResp.ok;
    let reason: string | null = null;

    if (verified) {
      const expectedMinor = Math.round(Number(tx.amount_kes) * 100);
      if (Math.abs(vAmountMinor - expectedMinor) > 100) {
        verified = false;
        reason = `Amount mismatch: expected ${expectedMinor}, got ${vAmountMinor}`;
      }
      if (verified && vCurrency && vCurrency !== (tx.currency || "KES").toUpperCase()) {
        verified = false;
        reason = `Currency mismatch: expected ${tx.currency}, got ${vCurrency}`;
      }
      if (
        verified &&
        tx.email &&
        vEmail &&
        vEmail.toLowerCase() !== String(tx.email).toLowerCase()
      ) {
        verified = false;
        reason = `Email mismatch: expected ${tx.email}, got ${vEmail}`;
      }
    } else if (!reason) {
      reason = vData?.gateway_response || `Paystack status: ${vStatus || "unknown"}`;
    }

    await admin
      .from("mpesa_transactions")
      .update({
        status: verified ? "success" : "failed",
        result_code: verified ? 0 : 1,
        result_desc: verified ? "Success" : reason,
        mpesa_receipt: vData?.reference ?? reference,
        payment_channel: vChannel,
        raw_callback: event,
      })
      .eq("id", tx.id);

    if (tx.subscription_id) {
      const { data: existing } = await admin
        .from("premium_subscriptions")
        .select("status")
        .eq("id", tx.subscription_id)
        .maybeSingle();
      if (existing?.status === "active") {
        console.log("Subscription already active:", tx.subscription_id);
      } else if (verified) {
        const startedAt = new Date();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        await admin
          .from("premium_subscriptions")
          .update({
            status: "active",
            started_at: startedAt.toISOString(),
            expires_at: expiresAt.toISOString(),
            mpesa_receipt: vData?.reference ?? reference,
            payment_reference: reference,
          })
          .eq("id", tx.subscription_id);
        console.log("Subscription activated via Paystack:", tx.subscription_id);
      } else {
        await admin
          .from("premium_subscriptions")
          .update({ status: "failed" })
          .eq("id", tx.subscription_id);
      }
    }

    if (tx.boost_id) {
      const { data: existingBoost } = await admin
        .from("status_boosts")
        .select("payment_status")
        .eq("id", tx.boost_id)
        .maybeSingle();
      if (existingBoost?.payment_status === "completed") {
        console.log("Boost already completed:", tx.boost_id);
      } else if (verified) {
        await admin
          .from("status_boosts")
          .update({
            payment_status: "completed",
            is_active: true,
            payment_reference: reference,
          })
          .eq("id", tx.boost_id);
      } else {
        await admin
          .from("status_boosts")
          .update({ payment_status: "failed", is_active: false })
          .eq("id", tx.boost_id);
      }
    }

    if (tx.video_boost_id) {
      const { data: existingVb } = await admin
        .from("video_boosts").select("payment_status, campaign_status")
        .eq("id", tx.video_boost_id).maybeSingle();
      if (existingVb?.payment_status === "completed") {
        console.log("Video boost already completed:", tx.video_boost_id);
      } else if (verified) {
        await admin.from("video_boosts").update({
          payment_status: "completed",
          campaign_status: "active",
          activated_at: new Date().toISOString(),
          payment_reference: reference,
        }).eq("id", tx.video_boost_id);
        // Notify creator
        const { data: vb } = await admin.from("video_boosts").select("user_id").eq("id", tx.video_boost_id).maybeSingle();
        if (vb?.user_id) {
          await admin.from("notifications").insert({
            user_id: vb.user_id, type: "video_boost",
            title: "Boost activated 🚀",
            body: "Your video boost is now live and being delivered.",
            reference_id: tx.video_boost_id,
          });
        }
      } else {
        await admin.from("video_boosts").update({
          payment_status: "failed", campaign_status: "cancelled",
        }).eq("id", tx.video_boost_id);
      }
    }

    return ok();
  } catch (e) {
    console.error("paystack-webhook error:", e);
    return ok();
  }
});
