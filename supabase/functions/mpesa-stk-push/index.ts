// PayHero STK push for premium subscriptions and status boosts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUBSCRIPTION_PRICES: Record<string, number> = {
  provider: 200,
  job_seeker: 200,
};

const BOOST_TIERS: Record<string, { price: number; durationHours: number }> = {
  moderate: { price: 50, durationHours: 24 },
  high: { price: 100, durationHours: 48 },
};

const VIDEO_BOOST_PACKAGES: Record<string, { price: number; impressions: number }> = {
  starter: { price: 50, impressions: 500 },
  pro: { price: 100, impressions: 1000 },
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

    const body = await req.json();
    const { purpose, phone } = body;
    const msisdn = normalizePhone(String(phone || ""));
    if (!msisdn) return json({ error: "Invalid phone number" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    let amount = 0;
    let externalRef = "";

    let videoBoostId: string | null = null;

    if (purpose === "video_boost") {
      const { videoId, packageType } = body;
      const pkg = VIDEO_BOOST_PACKAGES[packageType];
      if (!pkg) return json({ error: "Invalid video boost package" }, 400);
      if (!videoId) return json({ error: "videoId required" }, 400);

      const { data: vid, error: vErr } = await admin
        .from("videos").select("user_id").eq("id", videoId).maybeSingle();
      if (vErr || !vid) return json({ error: "Video not found" }, 404);
      if (vid.user_id !== user.id) return json({ error: "You can only boost your own videos" }, 403);

      const { data: existing } = await admin
        .from("video_boosts").select("id")
        .eq("video_id", videoId)
        .in("campaign_status", ["inactive", "active"])
        .limit(1);
      if (existing && existing.length > 0) {
        return json({ error: "This video already has an active boost" }, 409);
      }

      amount = pkg.price;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { data: boost, error: bErr } = await admin
        .from("video_boosts")
        .insert({
          user_id: user.id,
          video_id: videoId,
          package_type: packageType,
          amount_kes: amount,
          target_impressions: pkg.impressions,
          remaining_impressions: pkg.impressions,
          payment_provider: "mpesa",
          payment_status: "pending",
          campaign_status: "inactive",
          expires_at: expiresAt.toISOString(),
        })
        .select().single();
      if (bErr || !boost) {
        console.error("video_boost insert error:", bErr);
        return json({ error: "Could not create boost" }, 500);
      }
      videoBoostId = boost.id;
      externalRef = `vboost_${boost.id}`;
    } else if (purpose === "boost") {
      const { statusId, tier } = body;
      const tierConf = BOOST_TIERS[tier];
      if (!tierConf) return json({ error: "Invalid boost tier" }, 400);
      if (!statusId) return json({ error: "statusId required" }, 400);

      amount = tierConf.price;
      const boostEnd = new Date();
      boostEnd.setHours(boostEnd.getHours() + tierConf.durationHours);

      const { data: boost, error: bErr } = await admin
        .from("status_boosts")
        .insert({
          status_id: statusId,
          user_id: user.id,
          boost_tier: tier,
          amount_kes: amount,
          payment_method: "mpesa",
          payment_status: "pending",
          boost_start: new Date().toISOString(),
          boost_end: boostEnd.toISOString(),
          is_active: false,
        })
        .select()
        .single();
      if (bErr || !boost) {
        console.error("boost insert error:", bErr);
        return json({ error: "Could not create boost" }, 500);
      }
      externalRef = `boost_${boost.id}`;
    } else {
      // subscription (default)
      const roleType = body.roleType;
      if (roleType !== "provider" && roleType !== "job_seeker") {
        return json({ error: "Invalid roleType" }, 400);
      }
      amount = SUBSCRIPTION_PRICES[roleType];

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
      externalRef = `sub_${sub.id}`;
    }

    const callbackUrl = `${SUPABASE_URL}/functions/v1/mpesa-callback`;

    // CRITICAL: Insert the transaction record BEFORE calling PayHero.
    // If PayHero callback arrives before we record the transaction, the
    // callback handler will reject the payment as "No matching transaction
    // found" and the user's payment becomes orphaned even though it succeeded.
    const purposeLabel = purpose === "video_boost"
      ? "video_boost"
      : purpose === "boost"
        ? "status_boost"
        : `${body.roleType}_subscription`;

    const { data: txRow, error: txInsertErr } = await admin
      .from("mpesa_transactions")
      .insert({
        user_id: user.id,
        subscription_id: externalRef.startsWith("sub_") ? externalRef.slice(4) : null,
        boost_id: externalRef.startsWith("boost_") ? externalRef.slice(6) : null,
        video_boost_id: videoBoostId,
        external_reference: externalRef,
        purpose: purposeLabel,
        amount_kes: amount,
        phone_number: msisdn,
        status: "initiated",
      })
      .select("id")
      .single();

    if (txInsertErr || !txRow) {
      console.error("mpesa_transactions insert error:", txInsertErr);
      if (externalRef.startsWith("sub_")) {
        await admin.from("premium_subscriptions").update({ status: "failed" }).eq("id", externalRef.slice(4));
      } else if (externalRef.startsWith("boost_")) {
        await admin.from("status_boosts").update({ payment_status: "failed" }).eq("id", externalRef.slice(6));
      } else if (videoBoostId) {
        await admin.from("video_boosts").update({ payment_status: "failed", campaign_status: "cancelled" }).eq("id", videoBoostId);
      }
      return json({ error: "Could not record transaction" }, 500);
    }

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
      // Mark transaction + subscription/boost as failed
      await admin
        .from("mpesa_transactions")
        .update({
          status: "failed",
          result_desc: phData?.error_message || phData?.message || `PayHero HTTP ${phResp.status}`,
        })
        .eq("id", txRow.id);
      if (externalRef.startsWith("sub_")) {
        await admin.from("premium_subscriptions").update({ status: "failed" }).eq("id", externalRef.slice(4));
      } else if (externalRef.startsWith("boost_")) {
        await admin.from("status_boosts").update({ payment_status: "failed" }).eq("id", externalRef.slice(6));
      }
      return json(
        { error: phData?.error_message || phData?.message || "PayHero request failed" },
        502
      );
    }

    const checkoutRequestId =
      phData?.CheckoutRequestID ?? phData?.reference ?? phData?.transaction_reference ?? externalRef;

    // Update the existing tx row with the IDs returned by PayHero so the
    // callback handler can locate it by checkout_request_id.
    await admin
      .from("mpesa_transactions")
      .update({
        checkout_request_id: checkoutRequestId,
        merchant_request_id: phData?.MerchantRequestID ?? null,
      })
      .eq("id", txRow.id);

    return json({ checkoutRequestId, externalRef, success: true });
  } catch (e) {
    console.error("mpesa-stk-push error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
