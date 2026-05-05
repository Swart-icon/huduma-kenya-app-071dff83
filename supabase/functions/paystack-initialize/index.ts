// Paystack payment initializer.
// Creates a pending transaction record server-side, then asks Paystack to
// initialize a transaction and returns the authorization_url + reference.
// The frontend opens the authorization_url; activation happens ONLY in
// paystack-webhook after server-side verification.
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

// Video boost packages (KSh → up-to impressions, runs for 7 days max)
const VIDEO_BOOST_PACKAGES: Record<string, { price: number; impressions: number }> = {
  starter: { price: 50, impressions: 500 },
  pro: { price: 100, impressions: 1000 },
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function genRef(prefix: string) {
  return `${prefix}_${Date.now()}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");

    if (!PAYSTACK_SECRET_KEY) return json({ error: "Paystack not configured" }, 500);

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const { purpose, email: providedEmail, callbackUrl, phone } = body as {
      purpose?: string;
      email?: string;
      callbackUrl?: string;
      phone?: string;
    };

    const email = (providedEmail || user.email || "").trim();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return json({ error: "A valid email is required for Paystack" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    let amount = 0;
    let externalRef = "";
    let purposeLabel = "payment";
    let subscriptionId: string | null = null;
    let boostId: string | null = null;

    let videoBoostId: string | null = null;

    if (purpose === "video_boost") {
      const { videoId, packageType } = body as { videoId?: string; packageType?: string };
      const pkg = packageType ? VIDEO_BOOST_PACKAGES[packageType] : undefined;
      if (!pkg) return json({ error: "Invalid video boost package" }, 400);
      if (!videoId) return json({ error: "videoId required" }, 400);

      // Verify caller owns the video
      const { data: vid, error: vErr } = await admin
        .from("videos").select("user_id").eq("id", videoId).maybeSingle();
      if (vErr || !vid) return json({ error: "Video not found" }, 404);
      if (vid.user_id !== user.id) return json({ error: "You can only boost your own videos" }, 403);

      // Anti-spam: max 1 active or pending boost per video
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
          payment_provider: "paystack",
          payment_status: "pending",
          campaign_status: "inactive",
          expires_at: expiresAt.toISOString(),
        })
        .select().single();
      if (bErr || !boost) {
        console.error("video_boost insert error:", bErr);
        return json({ error: "Could not create boost campaign" }, 500);
      }
      videoBoostId = boost.id;
      externalRef = genRef("ps_vb");
      purposeLabel = "video_boost";
    } else if (purpose === "boost") {
      const { statusId, tier } = body as { statusId?: string; tier?: string };
      const tierConf = tier ? BOOST_TIERS[tier] : undefined;
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
          payment_method: "paystack",
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
      boostId = boost.id;
      externalRef = genRef("ps_boost");
      purposeLabel = "status_boost";
    } else {
      const roleType = (body as any).roleType;
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
          payment_method: "paystack",
        })
        .select()
        .single();
      if (subErr || !sub) {
        console.error("subscription insert error:", subErr);
        return json({ error: "Could not create subscription" }, 500);
      }
      subscriptionId = sub.id;
      externalRef = genRef("ps_sub");
      purposeLabel = `${roleType}_subscription`;
    }

    // Insert pending transaction BEFORE calling Paystack so the webhook can
    // always find a matching row.
    const { data: txRow, error: txErr } = await admin
      .from("mpesa_transactions")
      .insert({
        user_id: user.id,
        provider: "paystack",
        subscription_id: subscriptionId,
        boost_id: boostId,
        video_boost_id: videoBoostId,
        external_reference: externalRef,
        paystack_reference: externalRef,
        purpose: purposeLabel,
        amount_kes: amount,
        currency: "KES",
        email,
        phone_number: phone ? String(phone) : null,
        status: "initiated",
      })
      .select("id")
      .single();

    if (txErr || !txRow) {
      console.error("tx insert error:", txErr);
      if (subscriptionId) {
        await admin.from("premium_subscriptions").update({ status: "failed" }).eq("id", subscriptionId);
      }
      if (boostId) {
        await admin.from("status_boosts").update({ payment_status: "failed" }).eq("id", boostId);
      }
      if (videoBoostId) {
        await admin.from("video_boosts").update({ payment_status: "failed", campaign_status: "cancelled" }).eq("id", videoBoostId);
      }
      return json({ error: "Could not record transaction" }, 500);
    }

    // Paystack expects amount in the smallest unit (kobo / cents). For KES
    // Paystack uses kobo-style minor units (×100).
    const psResp = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: Math.round(amount * 100),
        currency: "KES",
        reference: externalRef,
        callback_url: callbackUrl || undefined,
        metadata: {
          user_id: user.id,
          purpose: purposeLabel,
          subscription_id: subscriptionId,
          boost_id: boostId,
          video_boost_id: videoBoostId,
          tx_id: txRow.id,
        },
      }),
    });

    const psData = await psResp.json().catch(() => ({}));
    console.log("Paystack init response:", psResp.status, JSON.stringify(psData));

    if (!psResp.ok || psData?.status === false) {
      await admin
        .from("mpesa_transactions")
        .update({
          status: "failed",
          result_desc: psData?.message || `Paystack HTTP ${psResp.status}`,
        })
        .eq("id", txRow.id);
      if (subscriptionId) {
        await admin.from("premium_subscriptions").update({ status: "failed" }).eq("id", subscriptionId);
      }
      if (boostId) {
        await admin.from("status_boosts").update({ payment_status: "failed" }).eq("id", boostId);
      }
      return json({ error: psData?.message || "Paystack initialization failed" }, 502);
    }

    return json({
      success: true,
      reference: externalRef,
      authorization_url: psData?.data?.authorization_url,
      access_code: psData?.data?.access_code,
    });
  } catch (e) {
    console.error("paystack-initialize error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
