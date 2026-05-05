import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, Check, Crown, Loader2, CheckCircle2, ShieldCheck, RefreshCw,
  Lock, CreditCard, Building2, Smartphone, Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useIsPremium, SUBSCRIPTION_PRICES, type RoleType } from "@/hooks/useSubscription";
import { useQueryClient } from "@tanstack/react-query";
import { PaymentMethodSelector, type PaymentProvider } from "@/components/payments/PaymentMethodSelector";

const BENEFITS: Record<RoleType, { title: string; tagline: string; bullets: string[] }> = {
  provider: {
    title: "Service Provider Premium",
    tagline: "Start earning from real customers",
    bullets: [
      "Publish unlimited services in the marketplace",
      "Receive bookings & messages from clients",
      "Appear in nearby search & map results",
      "Post 24-hour story updates with boosting",
      "Verified badge eligibility",
    ],
  },
  job_seeker: {
    title: "Job Seeker Premium",
    tagline: "Apply to unlimited jobs",
    bullets: [
      "Apply to any job posting on the platform",
      "Direct messaging with employers",
      "Save jobs & track all applications",
      "Priority placement in employer searches",
      "Upload videos to showcase your skills",
    ],
  },
};

const Upgrade = () => {
  const { user, role, loading: authLoading } = useAuth();
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { toast } = useToast();
  const qc = useQueryClient();

  const requestedRole = (params.get("role") as RoleType) || (role as RoleType);
  const roleType: RoleType = useMemo(
    () => (requestedRole === "provider" || requestedRole === "job_seeker" ? requestedRole : "provider"),
    [requestedRole]
  );

  const { isPremium, expiresAt, loading: subLoading } = useIsPremium(roleType);
  const benefits = BENEFITS[roleType];
  const price = SUBSCRIPTION_PRICES[roleType];

  const [provider, setProvider] = useState<PaymentProvider>("mpesa");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [submitting, setSubmitting] = useState(false);
  const [polling, setPolling] = useState(false);
  const [paid, setPaid] = useState(false);
  const pollKey = useRef<{ kind: "checkout" | "reference"; value: string } | null>(null);

  // Auto-fill from authenticated profile
  useEffect(() => { if (user?.email && !email) setEmail(user.email); }, [user?.email]);
  useEffect(() => {
    const p = (profile as any)?.phone;
    if (p && !phone) setPhone(p);
  }, [profile]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/welcome");
  }, [authLoading, user, navigate]);

  // Poll for activation
  useEffect(() => {
    if (!polling || !pollKey.current) return;
    const key = pollKey.current;
    let count = 0;
    const interval = setInterval(async () => {
      count++;
      const col = key.kind === "checkout" ? "checkout_request_id" : "paystack_reference";
      const { data } = await supabase
        .from("mpesa_transactions")
        .select("status, result_desc")
        .eq(col, key.value)
        .maybeSingle();

      if (data?.status === "success") {
        clearInterval(interval);
        setPolling(false);
        setPaid(true);
        await qc.invalidateQueries({ queryKey: ["subscription"] });
        await qc.refetchQueries({ queryKey: ["subscription"] });
        toast({ title: "Payment successful! 🎉", description: "Premium unlocked." });
      } else if (data?.status === "failed") {
        clearInterval(interval);
        setPolling(false);
        toast({ title: "Payment failed", description: data.result_desc || "Please try again.", variant: "destructive" });
      } else if (count > 40) {
        clearInterval(interval);
        setPolling(false);
        toast({ title: "Payment processing…", description: "Tap Refresh Status once you've completed payment." });
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [polling, qc, toast]);

  const handlePayMpesa = async () => {
    if (!/^(?:\+?254|0)?7\d{8}$/.test(phone.replace(/\s/g, ""))) {
      toast({ title: "Invalid phone", description: "Use Safaricom format: 07XXXXXXXX", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("mpesa-stk-push", { body: { roleType, phone } });
    setSubmitting(false);
    if (error || (data && data.error)) {
      toast({ title: "Could not start payment", description: (data && data.error) || error?.message || "Failed", variant: "destructive" });
      return;
    }
    pollKey.current = { kind: "checkout", value: data.checkoutRequestId };
    setPolling(true);
    toast({ title: "Check your phone 📱", description: "Enter your M-Pesa PIN to complete." });
  };

  const handlePayPaystack = async () => {
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      toast({ title: "Email required", description: "Enter the email for your receipt.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("paystack-initialize", {
      body: { roleType, email, phone, callbackUrl: window.location.href },
    });
    setSubmitting(false);
    if (error || (data && data.error)) {
      toast({ title: "Could not start payment", description: (data && data.error) || error?.message || "Failed", variant: "destructive" });
      return;
    }
    pollKey.current = { kind: "reference", value: data.reference };
    setPolling(true);
    window.open(data.authorization_url, "_blank");
    toast({ title: "Secure checkout opened", description: "Complete payment in the new tab — we'll detect it automatically." });
  };

  const handlePay = () => (provider === "mpesa" ? handlePayMpesa() : handlePayPaystack());

  if (authLoading || subLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isPremium || paid) {
    return (
      <div className="min-h-screen bg-background px-6 py-6 pb-24 flex items-center justify-center">
        <div className="max-w-sm w-full">
          <div className="text-center animate-in zoom-in-95 fade-in duration-500">
            <div className="relative w-24 h-24 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
              <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center mx-auto shadow-lg shadow-primary/30">
                <CheckCircle2 className="w-12 h-12 text-primary-foreground" />
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold mb-3">
              <Sparkles className="w-3 h-3" /> Subscription activated
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground mb-2">You're all set! 🎉</h1>
            <p className="text-muted-foreground mb-2">
              Your {roleType === "provider" ? "Provider" : "Job Seeker"} Premium is active.
            </p>
            {expiresAt && (
              <p className="text-xs text-muted-foreground mb-6">
                Renews on <strong>{new Date(expiresAt).toLocaleDateString()}</strong>
              </p>
            )}
            <Card className="text-left mb-6 border-primary/20 bg-primary/5">
              <CardContent className="p-4 space-y-2">
                <p className="text-xs font-semibold text-foreground mb-2">What's unlocked:</p>
                {benefits.bullets.slice(0, 3).map((b) => (
                  <div key={b} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-xs text-foreground">{b}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Button onClick={() => navigate("/dashboard")} className="w-full h-12 rounded-xl font-bold">
              Go to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-sm mx-auto px-5 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 -ml-1.5 rounded-lg hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-display text-base font-semibold flex-1">Checkout</h1>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="w-3 h-3" /> Secure
          </div>
        </div>
      </div>

      <div className="max-w-sm mx-auto px-5 pt-5 space-y-5">
        {/* STEP 1 — Purchase summary */}
        <Card className="overflow-hidden border-2 border-primary/15">
          <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-5">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shrink-0 shadow-md shadow-primary/20">
                <Crown className="w-6 h-6 text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Order summary</p>
                <h2 className="font-display text-base font-bold text-foreground leading-tight">{benefits.title}</h2>
                <p className="text-xs text-muted-foreground">{benefits.tagline}</p>
              </div>
            </div>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total due</p>
                <p className="font-display text-3xl font-bold text-foreground leading-none">
                  KSh {price.toLocaleString()}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">Monthly subscription · Cancel anytime</p>
              </div>
            </div>
          </div>
          <CardContent className="p-4 bg-card space-y-2">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold">Includes</p>
            {benefits.bullets.slice(0, 3).map((b) => (
              <div key={b} className="flex items-start gap-2">
                <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3 h-3 text-primary" />
                </div>
                <p className="text-xs text-foreground">{b}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* STEP 2 — Payment method */}
        <div>
          <p className="text-xs font-bold text-foreground mb-2.5 uppercase tracking-wider">
            Payment method
          </p>
          <PaymentMethodSelector value={provider} onChange={setProvider} disabled={submitting || polling} />
        </div>

        {/* STEP 3 — Compact checkout card */}
        {provider === "paystack" ? (
          <Card className="border-2 border-[#00C3F7]/20 overflow-hidden">
            <div className="bg-gradient-to-r from-[#00C3F7]/10 to-transparent px-4 py-3 flex items-center gap-2 border-b border-border">
              <div className="w-8 h-8 rounded-lg bg-[#00C3F7]/15 flex items-center justify-center">
                <Lock className="w-4 h-4 text-[#0098C8]" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Secure Checkout</p>
                <p className="text-[10px] text-muted-foreground">Powered by Paystack</p>
              </div>
              <ShieldCheck className="w-4 h-4 text-[#0098C8]" />
            </div>
            <CardContent className="p-4 space-y-3">
              <div>
                <Label htmlFor="email" className="text-xs font-semibold text-muted-foreground">
                  Email for receipt
                </Label>
                <Input
                  id="email" type="email" placeholder="you@example.com" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting || polling}
                  className="h-11 rounded-xl mt-1 bg-background"
                />
              </div>
              <div>
                <Label htmlFor="phone-ps" className="text-xs font-semibold text-muted-foreground">
                  Phone <span className="font-normal">(optional)</span>
                </Label>
                <Input
                  id="phone-ps" type="tel" placeholder="07XXXXXXXX" value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={submitting || polling}
                  className="h-11 rounded-xl mt-1 bg-background"
                />
              </div>
              <div className="pt-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1.5">
                  Supported methods
                </p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { icon: <CreditCard className="w-3 h-3" />, label: "Card" },
                    { icon: <Building2 className="w-3 h-3" />, label: "Bank" },
                    { icon: <Smartphone className="w-3 h-3" />, label: "Mobile money" },
                  ].map((m) => (
                    <span key={m.label} className="inline-flex items-center gap-1 text-[11px] bg-muted text-foreground px-2 py-1 rounded-md">
                      {m.icon} {m.label}
                    </span>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-2 border-[#4CAF50]/20 overflow-hidden">
            <div className="bg-gradient-to-r from-[#4CAF50]/10 to-transparent px-4 py-3 flex items-center gap-2 border-b border-border">
              <div className="w-8 h-8 rounded-lg bg-[#4CAF50]/15 flex items-center justify-center">
                <Smartphone className="w-4 h-4 text-[#2E7D32]" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">M-Pesa STK Push</p>
                <p className="text-[10px] text-muted-foreground">Approve prompt on your phone</p>
              </div>
              <ShieldCheck className="w-4 h-4 text-[#2E7D32]" />
            </div>
            <CardContent className="p-4">
              <Label htmlFor="phone" className="text-xs font-semibold text-muted-foreground">
                M-Pesa phone number
              </Label>
              <Input
                id="phone" type="tel" placeholder="07XXXXXXXX" value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={submitting || polling}
                className="h-11 rounded-xl mt-1 bg-background"
              />
            </CardContent>
          </Card>
        )}

        {/* Trust indicators */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <Lock className="w-3 h-3" />
          <span>
            {provider === "paystack"
              ? "Your payment is securely processed by Paystack"
              : "Encrypted, server-verified payment"}
          </span>
        </div>

        {/* CTA */}
        <Button
          onClick={handlePay}
          disabled={submitting || polling || (provider === "mpesa" ? !phone : !email)}
          className="w-full h-14 text-base font-bold rounded-2xl shadow-lg shadow-primary/20"
        >
          {submitting ? (
            <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Starting payment…</>
          ) : polling ? (
            <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Waiting for payment…</>
          ) : provider === "paystack" ? (
            <><Lock className="w-4 h-4 mr-2" /> Continue to Secure Checkout</>
          ) : (
            <>Pay KSh {price.toLocaleString()}</>
          )}
        </Button>

        {polling && (
          <Button
            variant="outline"
            onClick={async () => {
              await qc.invalidateQueries({ queryKey: ["subscription"] });
              await qc.refetchQueries({ queryKey: ["subscription"] });
              toast({ title: "Status refreshed" });
            }}
            className="w-full h-11 rounded-xl"
          >
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh Status
          </Button>
        )}

        <p className="text-[10px] text-center text-muted-foreground">
          By continuing, you agree to our Terms of Service. Cancel anytime.
        </p>
      </div>
    </div>
  );
};

export default Upgrade;
