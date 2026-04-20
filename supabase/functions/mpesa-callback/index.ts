// M-Pesa Daraja callback receiver (no JWT verification — Safaricom calls this)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    console.log("M-Pesa callback:", JSON.stringify(body));

    const stk = body?.Body?.stkCallback;
    if (!stk) return new Response("OK", { status: 200 });

    const checkoutRequestId = stk.CheckoutRequestID;
    const resultCode = stk.ResultCode;
    const resultDesc = stk.ResultDesc;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find transaction
    const { data: tx } = await admin
      .from("mpesa_transactions")
      .select("*")
      .eq("checkout_request_id", checkoutRequestId)
      .maybeSingle();

    if (!tx) {
      console.warn("No transaction found for", checkoutRequestId);
      return new Response("OK", { status: 200 });
    }

    let mpesaReceipt: string | null = null;
    if (resultCode === 0) {
      const items = stk.CallbackMetadata?.Item ?? [];
      mpesaReceipt = items.find((i: any) => i.Name === "MpesaReceiptNumber")?.Value ?? null;
    }

    // Update transaction
    await admin.from("mpesa_transactions").update({
      result_code: resultCode,
      result_desc: resultDesc,
      mpesa_receipt: mpesaReceipt,
      status: resultCode === 0 ? "success" : "failed",
      raw_callback: body,
    }).eq("id", tx.id);

    // Activate subscription on success
    if (resultCode === 0 && tx.subscription_id) {
      const startedAt = new Date();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      await admin.from("premium_subscriptions").update({
        status: "active",
        started_at: startedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        mpesa_receipt: mpesaReceipt,
        payment_reference: checkoutRequestId,
      }).eq("id", tx.subscription_id);
    } else if (tx.subscription_id) {
      await admin.from("premium_subscriptions").update({
        status: "failed",
      }).eq("id", tx.subscription_id);
    }

    return new Response("OK", { status: 200 });
  } catch (e) {
    console.error("Callback error:", e);
    return new Response("OK", { status: 200 });
  }
});
