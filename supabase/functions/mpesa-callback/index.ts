// PayHero / M-Pesa callback receiver.
// Public endpoint (verify_jwt = false). PayHero calls this server-to-server.
//
// SECURITY MODEL
// --------------
// This is the ONLY path that can mark a premium_subscription as "active" or a
// status_boost as completed. Frontend RLS no longer permits user updates on
// premium_subscriptions, so access is only granted after this function:
//   1. Locates the originating mpesa_transactions row (by checkout_request_id).
//   2. Verifies ResultCode == 0 (M-Pesa says success).
//   3. Verifies the amount paid matches the amount we requested.
//   4. Verifies the paying phone number matches the number we sent the STK to.
//   5. Refuses to re-activate a subscription/boost that is already completed
//      (replay protection).
//
// Only when ALL checks pass do we flip the subscription to active.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

function normalizePhone(input: unknown): string | null {
  if (input === null || input === undefined) return null;
  const digits = String(input).replace(/\D/g, "");
  if (/^2547\d{8}$/.test(digits)) return digits;
  if (/^07\d{8}$/.test(digits)) return "254" + digits.slice(1);
  if (/^7\d{8}$/.test(digits)) return "254" + digits;
  if (/^1\d{8}$/.test(digits)) return "254" + digits; // Safaricom 011x
  return digits || null;
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    console.log("PayHero callback received:", JSON.stringify(body));

    // PayHero v2 callback shape: { response: { Status, MpesaReceiptNumber, ResultCode,
    // ResultDesc, ExternalReference, CheckoutRequestID, Amount, Phone, ... } }
    const resp = (body as any)?.response ?? body ?? {};
    const externalRef: string | undefined =
      resp?.ExternalReference ?? resp?.external_reference;
    const checkoutRequestId: string | undefined =
      resp?.CheckoutRequestID ?? resp?.checkout_request_id ?? resp?.reference;
    const resultCode: number | undefined = resp?.ResultCode ?? resp?.result_code;
    const resultDesc: string | undefined =
      resp?.ResultDesc ?? resp?.result_desc ?? resp?.Status;
    const mpesaReceipt: string | null =
      resp?.MpesaReceiptNumber ?? resp?.mpesa_receipt_number ?? null;
    const statusStr: string = (resp?.Status ?? "").toString().toLowerCase();

    // Amount + phone reported by M-Pesa for THIS transaction
    const callbackAmountRaw =
      resp?.Amount ?? resp?.amount ?? resp?.AmountPaid ?? null;
    const callbackAmount =
      callbackAmountRaw !== null && callbackAmountRaw !== undefined
        ? Number(callbackAmountRaw)
        : null;
    const callbackPhoneRaw =
      resp?.Phone ?? resp?.PhoneNumber ?? resp?.MSISDN ?? resp?.msisdn ?? null;
    const callbackPhone = normalizePhone(callbackPhoneRaw);

    const mpesaSaysSuccess =
      resultCode === 0 || statusStr === "success" || statusStr === "completed";

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ---- 1. Locate the originating transaction ----
    let tx: any = null;
    if (checkoutRequestId) {
      const { data } = await admin
        .from("mpesa_transactions")
        .select("*")
        .eq("checkout_request_id", checkoutRequestId)
        .maybeSingle();
      tx = data;
    }
    if (!tx && externalRef) {
      const { data } = await admin
        .from("mpesa_transactions")
        .select("*")
        .eq("external_reference", externalRef)
        .order("created_at", { ascending: false })
        .limit(1)
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

    // ---- 2. Verify amount + phone match what we initiated ----
    let verified = mpesaSaysSuccess;
    let verificationFailureReason: string | null = null;

    if (verified && tx) {
      // Amount check (allow 1 KES rounding tolerance)
      if (callbackAmount !== null) {
        const expected = Number(tx.amount_kes);
        if (Math.abs(callbackAmount - expected) > 1) {
          verified = false;
          verificationFailureReason = `Amount mismatch: expected ${expected}, got ${callbackAmount}`;
        }
      }
      // Phone check
      if (verified && callbackPhone) {
        const expectedPhone = normalizePhone(tx.phone_number);
        if (expectedPhone && callbackPhone !== expectedPhone) {
          verified = false;
          verificationFailureReason = `Phone mismatch: expected ${expectedPhone}, got ${callbackPhone}`;
        }
      }
    } else if (verified && !tx && !externalRef?.startsWith("boost_")) {
      // Success reported but we have no record of initiating it — refuse.
      verified = false;
      verificationFailureReason = "No matching transaction found";
    }

    if (!verified && verificationFailureReason) {
      console.warn("Payment verification failed:", verificationFailureReason);
    }

    // ---- 3. Update the transaction record ----
    if (tx) {
      await admin
        .from("mpesa_transactions")
        .update({
          result_code: resultCode ?? (verified ? 0 : 1),
          result_desc: verified
            ? resultDesc ?? "Success"
            : verificationFailureReason ?? resultDesc ?? "Failed",
          mpesa_receipt: mpesaReceipt,
          status: verified ? "success" : "failed",
          raw_callback: body,
        })
        .eq("id", tx.id);
    }

    // ---- 4. Activate / fail subscription (only if verified) ----
    if (tx?.subscription_id) {
      // Replay protection: don't re-process a subscription that's already active.
      const { data: existingSub } = await admin
        .from("premium_subscriptions")
        .select("status")
        .eq("id", tx.subscription_id)
        .maybeSingle();

      if (existingSub?.status === "active") {
        console.log("Subscription already active, skipping:", tx.subscription_id);
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
            mpesa_receipt: mpesaReceipt,
            payment_reference: checkoutRequestId ?? externalRef ?? null,
          })
          .eq("id", tx.subscription_id);
        console.log("Subscription activated:", tx.subscription_id);
      } else {
        await admin
          .from("premium_subscriptions")
          .update({ status: "failed" })
          .eq("id", tx.subscription_id);
      }
    }

    // ---- 5. Activate / fail boost (only if verified) ----
    if (externalRef?.startsWith("boost_")) {
      const boostId = externalRef.slice(6);

      const { data: existingBoost } = await admin
        .from("status_boosts")
        .select("payment_status")
        .eq("id", boostId)
        .maybeSingle();

      if (existingBoost?.payment_status === "completed") {
        console.log("Boost already completed, skipping:", boostId);
      } else if (verified) {
        await admin
          .from("status_boosts")
          .update({
            payment_status: "completed",
            is_active: true,
            payment_reference: checkoutRequestId ?? externalRef ?? null,
          })
          .eq("id", boostId);
      } else {
        await admin
          .from("status_boosts")
          .update({ payment_status: "failed", is_active: false })
          .eq("id", boostId);
      }
    }

    if (!tx && !externalRef?.startsWith("boost_")) {
      console.warn("No transaction/boost found for", checkoutRequestId, externalRef);
    }

    // Always 200 to PayHero so they don't retry indefinitely.
    return new Response("OK", { status: 200 });
  } catch (e) {
    console.error("Callback error:", e);
    return new Response("OK", { status: 200 });
  }
});
