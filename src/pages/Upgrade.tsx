import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Check, Crown, Loader2, CheckCircle2, ShieldCheck, RefreshCw } from "lucide-react";
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
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { toast } = useToast();
  const qc = useQueryClient();

  const requestedRole = (params.get("role") as RoleType) || (role as RoleType);
  const roleType: RoleType = useMemo(() => {
    return requestedRole === "provider" || requestedRole === "job_seeker"
      ? requestedRole
      : "provider";
  }, [requestedRole]);

  const { isPremium, expiresAt, loading: subLoading } = useIsPremium(roleType);
  const benefits = BENEFITS[roleType];
  const price = SUBSCRIPTION_PRICES[roleType];

  const [provider, setProvider] = useState<PaymentProvider>("mpesa");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [submitting, setSubmitting] = useState(false);
  const [polling, setPolling] = useState(false);
  const pollKey = useRef<{ kind: "checkout" | "reference"; value: string } | null>(null);

  useEffect(() => { if (user?.email) setEmail(user.email); }, [user?.email]);
  useEffect(() => {
    if (!authLoading && !user) navigate("/welcome");
  }, [authLoading, user, navigate]);

  // Poll for activation (M-Pesa via checkout_request_id, Paystack via paystack_reference)
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
        await qc.invalidateQueries({ queryKey: ["subscription"] });
        await qc.refetchQueries({ queryKey: ["subscription"] });
        toast({ title: "Payment successful! 🎉", description: "Premium unlocked." });
      } else if (data?.status === "failed") {
        clearInterval(interval);
        setPolling(false);
        toast({
          title: "Payment failed",
          description: data.result_desc || "Please try again.",
          variant: "destructive",
        });
      } else if (count > 40) {
        clearInterval(interval);
        setPolling(false);
        toast({
          title: "Payment processing…",
          description: "Tap Refresh Status once you've completed payment.",
        });
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
    const { data, error } = await supabase.functions.invoke("mpesa-stk-push", {
      body: { roleType, phone },
    });
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
      toast({ title: "Email required", description: "Enter the email for your Paystack receipt.", variant: "destructive" });
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
    // Open the Paystack checkout in a new tab/window
    window.open(data.authorization_url, "_blank");
    toast({ title: "Complete payment in the new tab", description: "We'll detect it automatically." });
  };

  const handlePay = () => (provider === "mpesa" ? handlePayMpesa() : handlePayPaystack());

  if (authLoading || subLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isPremium) {
    return (
      <div className="min-h-screen bg-background px-6 py-6 pb-24">
        <div className="max-w-sm mx-auto">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground mb-6">
            <ArrowLeft className="w-5 h-5" /> <span>Back</span>
          </button>
          <div className="text-center mt-12">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-primary" />
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground mb-2">Premium Active</h1>
            <p className="text-muted-foreground mb-6">
              Your {roleType === "provider" ? "provider" : "job seeker"} premium is active until{" "}
              <strong>{expiresAt ? new Date(expiresAt).toLocaleDateString() : "—"}</strong>.
            </p>
            <Button onClick={() => navigate("/dashboard")} className="w-full h-12 rounded-xl">Go to Dashboard</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-6 py-6 pb-24">
      <div className="max-w-sm mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground mb-6">
          <ArrowLeft className="w-5 h-5" /> <span>Back</span>
        </button>

        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mx-auto mb-4">
            <Crown className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground mb-1">{benefits.title}</h1>
          <p className="text-muted-foreground">{benefits.tagline}</p>
        </div>

        <Card className="mb-6 border-2 border-primary/20 bg-primary/5">
          <CardContent className="p-5 text-center">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Monthly subscription</p>
            <p className="font-display text-4xl font-bold text-foreground">
              KSh {price.toLocaleString()}
              <span className="text-base font-normal text-muted-foreground">/month</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">Renews every 30 days</p>
          </CardContent>
        </Card>

        <div className="space-y-3 mb-6">
          {benefits.bullets.map((b) => (
            <div key={b} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Check className="w-4 h-4 text-primary" />
              </div>
              <p className="text-sm text-foreground">{b}</p>
            </div>
          ))}
        </div>

        <Card className="mb-4">
          <CardContent className="p-4 space-y-4">
            <div>
              <p className="font-semibold text-foreground mb-2 text-sm">Choose payment method</p>
              <PaymentMethodSelector value={provider} onChange={setProvider} disabled={submitting || polling} />
            </div>

            {provider === "mpesa" ? (
              <div>
                <Label htmlFor="phone" className="text-sm font-semibold">M-Pesa phone number</Label>
                <Input
                  id="phone" type="tel" placeholder="07XXXXXXXX" value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={submitting || polling}
                  className="h-12 rounded-xl mt-1.5"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="email" className="text-sm font-semibold">Email for receipt</Label>
                  <Input
                    id="email" type="email" placeholder="you@example.com" value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={submitting || polling}
                    className="h-12 rounded-xl mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="phone-ps" className="text-sm font-semibold">Phone (optional)</Label>
                  <Input
                    id="phone-ps" type="tel" placeholder="07XXXXXXXX" value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={submitting || polling}
                    className="h-12 rounded-xl mt-1.5"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4 justify-center">
          <ShieldCheck className="w-4 h-4" />
          <span>Secure server-verified payment</span>
        </div>

        <Button
          onClick={handlePay}
          disabled={submitting || polling || (provider === "mpesa" ? !phone : !email)}
          className="w-full h-14 text-lg font-bold rounded-xl"
        >
          {submitting ? (
            <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Sending request…</>
          ) : polling ? (
            <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Waiting for payment…</>
          ) : (
            `Pay KSh ${price.toLocaleString()}`
          )}
        </Button>

        <Button
          variant="outline"
          onClick={async () => {
            await qc.invalidateQueries({ queryKey: ["subscription"] });
            await qc.refetchQueries({ queryKey: ["subscription"] });
            toast({ title: "Status refreshed" });
          }}
          className="w-full h-11 rounded-xl mt-3"
        >
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh Status
        </Button>

        <p className="text-xs text-center text-muted-foreground mt-4">
          By paying, you agree to our Terms of Service. Cancel anytime.
        </p>
      </div>
    </div>
  );
};

export default Upgrade;
