import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, Check, Loader2, Sparkles, X, Lock, ShieldCheck, CreditCard, Building2, Smartphone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { PaymentMethodSelector, type PaymentProvider } from "@/components/payments/PaymentMethodSelector";

const boostTiers = [
  {
    id: "moderate",
    label: "Moderate Boost",
    price: 50,
    duration: "24 hours",
    description: "Your status appears higher in feeds",
    icon: <Zap className="w-5 h-5" />,
  },
  {
    id: "high",
    label: "High Boost",
    price: 100,
    duration: "48 hours",
    description: "Top priority — appears first in all feeds",
    icon: <Sparkles className="w-5 h-5" />,
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
  statusId: string;
  onBoosted: () => void;
}

export const BoostStatusDialog = ({ open, onClose, statusId, onBoosted }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedTier, setSelectedTier] = useState<string>("moderate");
  const [step, setStep] = useState<"select" | "payment" | "processing" | "success">("select");
  const [provider, setProvider] = useState<PaymentProvider>("mpesa");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [processing, setProcessing] = useState(false);
  const pollKey = useRef<{ kind: "checkout" | "reference"; value: string } | null>(null);

  useEffect(() => { if (user?.email) setEmail(user.email); }, [user?.email]);

  const tier = boostTiers.find((t) => t.id === selectedTier)!;

  // Poll until success/fail when processing
  useEffect(() => {
    if (step !== "processing" || !pollKey.current) return;
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
        setStep("success");
        onBoosted();
      } else if (data?.status === "failed") {
        clearInterval(interval);
        toast({ title: "Payment failed", description: data.result_desc || "Try again", variant: "destructive" });
        setStep("payment");
      } else if (count > 40) {
        clearInterval(interval);
        toast({ title: "Payment processing…", description: "Will activate when verified." });
        setStep("payment");
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [step, onBoosted, toast]);

  const handlePay = async () => {
    if (provider === "mpesa") {
      if (!phone || phone.replace(/\D/g, "").length < 9) {
        toast({ title: "Enter a valid M-Pesa phone number", variant: "destructive" });
        return;
      }
    } else {
      if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        toast({ title: "Enter a valid email", variant: "destructive" });
        return;
      }
    }

    setStep("processing");
    setProcessing(true);

    const fn = provider === "mpesa" ? "mpesa-stk-push" : "paystack-initialize";
    const body =
      provider === "mpesa"
        ? { purpose: "boost", statusId, tier: selectedTier, phone }
        : { purpose: "boost", statusId, tier: selectedTier, email, phone };

    const { data, error } = await supabase.functions.invoke(fn, { body });
    setProcessing(false);

    if (error || (data as any)?.error) {
      toast({
        title: "Payment failed",
        description: (data as any)?.error || error?.message || "Could not start payment",
        variant: "destructive",
      });
      setStep("payment");
      return;
    }

    if (provider === "mpesa") {
      pollKey.current = { kind: "checkout", value: (data as any).checkoutRequestId };
      toast({ title: "STK push sent", description: "Approve the M-Pesa prompt." });
    } else {
      pollKey.current = { kind: "reference", value: (data as any).reference };
      window.open((data as any).authorization_url, "_blank");
      toast({ title: "Complete payment in the new tab" });
    }
  };

  const resetAndClose = () => {
    setStep("select");
    setPhone("");
    setSelectedTier("moderate");
    pollKey.current = null;
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={resetAndClose} />
      <div className="relative w-full max-w-sm mx-4 bg-card rounded-2xl p-6 shadow-lg animate-in zoom-in-95 fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" /> Boost Status
          </h2>
          <button onClick={resetAndClose} className="rounded-sm opacity-70 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === "select" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Boost your status to reach more clients and appear first in feeds.
            </p>
            <div className="space-y-3">
              {boostTiers.map((t) => {
                const isSelected = selectedTier === t.id;
                return (
                  <Card
                    key={t.id}
                    className={`cursor-pointer transition-all border-2 rounded-xl ${
                      isSelected ? "border-primary bg-primary/5" : "border-border"
                    }`}
                    onClick={() => setSelectedTier(t.id)}
                  >
                    <CardContent className="flex items-center gap-3 p-4">
                      <div className="shrink-0 text-primary">{t.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm">{t.label}</span>
                          {isSelected && <Check className="w-4 h-4 text-primary" />}
                        </div>
                        <p className="text-xs text-muted-foreground">{t.description}</p>
                        <p className="text-xs mt-1 text-muted-foreground">Duration: {t.duration}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-bold">KES {t.price}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <Button onClick={() => setStep("payment")} className="w-full h-12 rounded-xl font-bold">
              Continue — KES {tier.price}
            </Button>
          </div>
        )}

        {step === "payment" && (
          <div className="space-y-4">
            {/* Order summary */}
            <Card className="overflow-hidden border-2 border-primary/15">
              <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shrink-0 shadow-md shadow-primary/20">
                    {tier.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Order summary</p>
                    <h3 className="font-display text-sm font-bold text-foreground leading-tight">{tier.label}</h3>
                    <p className="text-[11px] text-muted-foreground">{tier.duration} boost</p>
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total due</p>
                  <p className="font-display text-2xl font-bold text-foreground leading-none">KSh {tier.price}</p>
                </div>
              </div>
            </Card>

            <div>
              <p className="text-xs font-bold text-foreground mb-2 uppercase tracking-wider">Payment method</p>
              <PaymentMethodSelector value={provider} onChange={setProvider} disabled={processing} />
            </div>

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
                    <Label className="text-xs font-semibold text-muted-foreground">Email for receipt</Label>
                    <Input
                      type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com" className="rounded-xl h-11 mt-1 bg-background"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Phone <span className="font-normal">(optional)</span></Label>
                    <Input
                      type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                      placeholder="07XXXXXXXX" className="rounded-xl h-11 mt-1 bg-background"
                    />
                  </div>
                  <div className="pt-1">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1.5">Supported methods</p>
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
                  <Label className="text-xs font-semibold text-muted-foreground">M-Pesa phone number</Label>
                  <Input
                    value={phone} onChange={(e) => setPhone(e.target.value)}
                    placeholder="07XXXXXXXX" className="rounded-xl h-11 mt-1 bg-background" maxLength={13}
                  />
                </CardContent>
              </Card>
            )}

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
              <Lock className="w-3 h-3" />
              <span>{provider === "paystack" ? "Securely processed by Paystack" : "Encrypted, server-verified payment"}</span>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("select")} disabled={processing} className="flex-1 rounded-xl">Back</Button>
              <Button onClick={handlePay} disabled={processing} className="flex-1 rounded-xl font-bold">
                {provider === "paystack" ? <><Lock className="w-4 h-4 mr-1.5" /> Checkout</> : <>Pay KSh {tier.price}</>}
              </Button>
            </div>
          </div>
        )}

        {step === "processing" && (
          <div className="py-8 text-center space-y-4">
            <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
            <div>
              <p className="font-bold text-foreground">Waiting for payment…</p>
              <p className="text-sm text-muted-foreground mt-1">
                {provider === "mpesa"
                  ? "Approve the M-Pesa prompt on your phone."
                  : "Complete the Paystack checkout in the new tab."}
              </p>
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Check className="w-8 h-8 text-primary" />
            </div>
            <div>
              <p className="font-bold text-foreground text-lg">Boost activated 🚀</p>
              <p className="text-sm text-muted-foreground mt-1">Your status is boosted for {tier.duration}.</p>
            </div>
            <Button onClick={resetAndClose} className="rounded-xl">Done</Button>
          </div>
        )}
      </div>
    </div>
  );
};
