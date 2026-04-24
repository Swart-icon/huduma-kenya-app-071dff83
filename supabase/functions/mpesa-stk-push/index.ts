// PayHero STK push for premium subscriptions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUBSCRIPTION_PRICES: Record<string, number> = {
  provider: 500,
  job_seeker: 200,
};

function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (/^2547\d{8}$/.test(digits)) return digits;
  if (/^07\d{8}$/.test(digits)) return "254" + digits.slice(1);
  if (/^7\d{8}$/.test(digits)) return "254" + digits;
  return null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const PAYHERO_BASIC_AUTH = Deno.env.get("PAYHERO_BASIC_AUTH");
    const PAYHERO_CHANNEL_ID = Deno.env.get("PAYHERO_CHANNEL_ID");

    if (!PAYHERO_BASIC_AUTH || !PAYHERO_CHANNEL_ID) {
      return json({ error: "PayHero credentials not configured" }, 500);
    }

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const { roleType, phone } = await req.json();
    if (roleType !== "provider" && roleType !== "job_seeker") {
      return json({ error: "Invalid roleType" }, 400);
    }
    const msisdn = normalizePhone(String(phone || ""));
    if (!msisdn) return json({ error: "Invalid phone number" }, 400);

    const amount = SUBSCRIPTION_PRICES[roleType];
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: sub, error: subErr } = await admin
      .from("premium_subscriptions")
      .insert({
        user_id: user.id,
        role_type: roleType,
        amount_kes: amount,
        status: "pending",
        payment_method: "mpesa",
      })
      .select()
      .single();
    if (subErr || !sub) {
      console.error("subscription insert error:", subErr);
      return json({ error: "Could not create subscription" }, 500);
    }

    const callbackUrl = `${SUPABASE_URL}/functions/v1/mpesa-callback`;
    const externalRef = `sub_${sub.id}`;

    const phResp = await fetch("https://backend.payhero.co.ke/api/v2/payments", {
      method: "POST",
      headers: {
        Authorization: `Basic ${PAYHERO_BASIC_AUTH}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount,
        phone_number: msisdn,
        channel_id: Number(PAYHERO_CHANNEL_ID),
        provider: "m-pesa",
        external_reference: externalRef,
        customer_name: user.email ?? "Customer",
        callback_url: callbackUrl,
      }),
    });

    const phData = await phResp.json().catch(() => ({}));
    console.log("PayHero response:", phResp.status, JSON.stringify(phData));

    if (!phResp.ok || phData?.success === false) {
      await admin.from("premium_subscriptions").update({ status: "failed" }).eq("id", sub.id);
      return json(
        { error: phData?.error_message || phData?.message || "PayHero request failed" },
        502
      );
    }

    const checkoutRequestId =
      phData?.CheckoutRequestID ?? phData?.reference ?? phData?.transaction_reference ?? externalRef;

    await admin.from("mpesa_transactions").insert({
      user_id: user.id,
      subscription_id: sub.id,
      amount_kes: amount,
      phone_number: msisdn,
      checkout_request_id: checkoutRequestId,
      merchant_request_id: phData?.MerchantRequestID ?? null,
      status: "pending",
    });

    return json({ checkoutRequestId, success: true });
  } catch (e) {
    console.error("mpesa-stk-push error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
