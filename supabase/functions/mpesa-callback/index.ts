// PayHero callback receiver (no JWT verification — PayHero calls this)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    console.log("PayHero callback:", JSON.stringify(body));

    // PayHero v2 callback shape: { response: { Status, MpesaReceiptNumber, ResultCode, ResultDesc, ExternalReference, CheckoutRequestID, ... } }
    const resp = body?.response ?? body;
    const externalRef: string | undefined = resp?.ExternalReference ?? resp?.external_reference;
    const checkoutRequestId: string | undefined =
      resp?.CheckoutRequestID ?? resp?.checkout_request_id ?? resp?.reference;
    const resultCode: number | undefined = resp?.ResultCode ?? resp?.result_code;
    const resultDesc: string | undefined = resp?.ResultDesc ?? resp?.result_desc ?? resp?.Status;
    const mpesaReceipt: string | null =
      resp?.MpesaReceiptNumber ?? resp?.mpesa_receipt_number ?? null;
    const status: string | undefined = (resp?.Status ?? "").toString().toLowerCase();

    const isSuccess =
      resultCode === 0 || status === "success" || status === "completed";

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Locate transaction by checkoutRequestId
    let tx: any = null;
    if (checkoutRequestId) {
      const { data } = await admin
        .from("mpesa_transactions")
        .select("*")
        .eq("checkout_request_id", checkoutRequestId)
        .maybeSingle();
      tx = data;
    }
    if (!tx && externalRef?.startsWith("sub_")) {
      const subId = externalRef.slice(4);
      const { data } = await admin
        .from("mpesa_transactions")
        .select("*")
        .eq("subscription_id", subId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      tx = data;
    }

    if (tx) {
      await admin.from("mpesa_transactions").update({
        result_code: resultCode ?? (isSuccess ? 0 : 1),
        result_desc: resultDesc ?? null,
        mpesa_receipt: mpesaReceipt,
        status: isSuccess ? "success" : "failed",
        raw_callback: body,
      }).eq("id", tx.id);
    }

    // Activate / fail subscription
    if (tx?.subscription_id) {
      if (isSuccess) {
        const startedAt = new Date();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        await admin.from("premium_subscriptions").update({
          status: "active",
          started_at: startedAt.toISOString(),
          expires_at: expiresAt.toISOString(),
          mpesa_receipt: mpesaReceipt,
          payment_reference: checkoutRequestId ?? externalRef ?? null,
        }).eq("id", tx.subscription_id);
      } else {
        await admin.from("premium_subscriptions").update({
          status: "failed",
        }).eq("id", tx.subscription_id);
      }
    }

    // Activate / fail boost
    if (externalRef?.startsWith("boost_")) {
      const boostId = externalRef.slice(6);
      if (isSuccess) {
        await admin.from("status_boosts").update({
          payment_status: "completed",
          is_active: true,
          payment_reference: checkoutRequestId ?? externalRef ?? null,
        }).eq("id", boostId);
      } else {
        await admin.from("status_boosts").update({
          payment_status: "failed",
          is_active: false,
        }).eq("id", boostId);
      }
    }

    if (!tx && !externalRef?.startsWith("boost_")) {
      console.warn("No transaction/boost found for", checkoutRequestId, externalRef);
    }

    return new Response("OK", { status: 200 });
  } catch (e) {
    console.error("Callback error:", e);
    return new Response("OK", { status: 200 });
  }
});
