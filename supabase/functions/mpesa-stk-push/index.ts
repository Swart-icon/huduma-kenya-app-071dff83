// M-Pesa Daraja STK Push initiator
// Returns 503 with a clear message if Daraja credentials are not configured yet.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRICES = { provider: 500, job_seeker: 200 } as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { roleType, phone } = await req.json();
    if (!["provider", "job_seeker"].includes(roleType)) {
      return json({ error: "Invalid role type" }, 400);
    }
    if (!phone || !/^(?:\+?254|0)?7\d{8}$/.test(String(phone).replace(/\s/g, ""))) {
      return json({ error: "Invalid phone number. Use 07XXXXXXXX format" }, 400);
    }

    const amount = PRICES[roleType as keyof typeof PRICES];

    // Normalise phone to 254XXXXXXXXX
    let normalised = String(phone).replace(/\s|\+/g, "");
    if (normalised.startsWith("0")) normalised = "254" + normalised.slice(1);
    if (!normalised.startsWith("254")) normalised = "254" + normalised;

    // Create pending subscription
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    const { data: sub, error: subErr } = await admin
      .from("premium_subscriptions")
      .insert({
        user_id: user.id,
        role_type: roleType,
        amount_kes: amount,
        status: "pending",
        payment_method: "mpesa",
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();
    if (subErr) return json({ error: subErr.message }, 500);

    // Daraja credentials check
    const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET");
    const shortcode = Deno.env.get("MPESA_SHORTCODE");
    const passkey = Deno.env.get("MPESA_PASSKEY");

    if (!consumerKey || !consumerSecret || !shortcode || !passkey) {
      // Log a placeholder transaction so admins can see the attempt
      await admin.from("mpesa_transactions").insert({
        user_id: user.id,
        subscription_id: sub.id,
        phone_number: normalised,
        amount_kes: amount,
        status: "failed",
        result_desc: "Daraja credentials not configured",
      });
      return json({
        error: "M-Pesa is not yet configured. Please contact support.",
        configured: false,
        subscriptionId: sub.id,
      }, 503);
    }

    // === Daraja STK Push ===
    // 1. OAuth token
    const tokenRes = await fetch(
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      { headers: { Authorization: "Basic " + btoa(`${consumerKey}:${consumerSecret}`) } }
    );
    const { access_token } = await tokenRes.json();
    if (!access_token) return json({ error: "M-Pesa auth failed" }, 502);

    // 2. STK Push
    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, "").slice(0, 14);
    const password = btoa(`${shortcode}${passkey}${timestamp}`);
    const callbackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/mpesa-callback`;

    const stkRes = await fetch(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          BusinessShortCode: shortcode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: "CustomerPayBillOnline",
          Amount: amount,
          PartyA: normalised,
          PartyB: shortcode,
          PhoneNumber: normalised,
          CallBackURL: callbackUrl,
          AccountReference: `HUDUMA-${roleType.toUpperCase()}`,
          TransactionDesc: `Premium ${roleType} activation`,
        }),
      }
    );
    const stkData = await stkRes.json();

    await admin.from("mpesa_transactions").insert({
      user_id: user.id,
      subscription_id: sub.id,
      phone_number: normalised,
      amount_kes: amount,
      checkout_request_id: stkData.CheckoutRequestID,
      merchant_request_id: stkData.MerchantRequestID,
      status: stkData.ResponseCode === "0" ? "initiated" : "failed",
      result_desc: stkData.ResponseDescription || stkData.errorMessage,
    });

    if (stkData.ResponseCode !== "0") {
      return json({ error: stkData.errorMessage || "STK push failed" }, 502);
    }

    return json({
      success: true,
      subscriptionId: sub.id,
      checkoutRequestId: stkData.CheckoutRequestID,
      message: "Check your phone to complete payment",
    });
  } catch (e) {
    console.error("STK push error:", e);
    return json({ error: e instanceof Error ? e.message : "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
