import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Rocket, Check, Loader2, Flame, X, Lock, ShieldCheck, CreditCard, Building2, Smartphone, TrendingUp,
} from "lucide-react";
import { PaymentMethodSelector, type PaymentProvider } from "@/components/payments/PaymentMethodSelector";

const VIDEO_BOOST_PACKAGES = [
  {
    id: "starter",
    label: "Starter Boost",
    price: 50,
    impressions: 500,
    description: "Reach up to 500 additional targeted users",
    icon: <Flame className="w-5 h-5" />,
  },
  {
    id: "pro",
    label: "Pro Boost",
    price: 100,
    impressions: 1000,
    description: "Reach up to 1,000 additional targeted users",
    icon: <Rocket className="w-5 h-5" />,
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
  videoId: string;
  videoTitle?: string | null;
  videoThumbnail?: string | null;
}

export const BoostVideoDialog = ({ open, onClose, videoId, videoTitle, videoThumbnail }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selected, setSelected] = useState<string>("starter");
  const [step, setStep] = useState<"select" | "payment" | "processing" | "success">("select");
  const [provider, setProvider] = useState<PaymentProvider>("mpesa");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [processing, setProcessing] = useState(false);
  const pollKey = useRef<{ kind: "checkout" | "reference"; value: string } | null>(null);

  useEffect(() => { if (user?.email) setEmail(user.email); }, [user?.email]);

  const pkg = VIDEO_BOOST_PACKAGES.find((p) => p.id === selected)!;

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
      } else if (data?.status === "failed") {
        clearInterval(interval);
        toast({ title: "Payment failed", description: data.result_desc || "Try again", variant: "destructive" });
        setStep("payment");
      } else if (count > 40) {
        clearInterval(interval);
        toast({ title: "Payment processing…", description: "Boost will activate when verified." });
        setStep("payment");
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [step, toast]);

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
        ? { purpose: "video_boost", videoId, packageType: selected, phone }
        : { purpose: "video_boost", videoId, packageType: selected, email, phone };

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

  const reset = () => {
    setStep("select");
    setPhone("");
    setSelected("starter");
    pollKey.current = null;
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={reset} />
      <div className="relative w-full max-w-sm mx-4 bg-card rounded-2xl p-6 shadow-lg animate-in zoom-in-95 fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" /> Boost Your Video
          </h2>
          <button onClick={reset} className="rounded-sm opacity-70 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === "select" && (
          <div className="space-y-4">
            {/* Video preview */}
            <Card className="overflow-hidden border border-border">
              <div className="flex gap-3 p-3">
                {videoThumbnail ? (
                  <img src={videoThumbnail} className="w-16 h-20 rounded-lg object-cover bg-muted" alt="" />
                ) : (
                  <div className="w-16 h-20 rounded-lg bg-muted flex items-center justify-center">
                    <Rocket className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Promoting</p>
                  <p className="text-sm font-semibold text-foreground line-clamp-2">{videoTitle || "Your video"}</p>
                </div>
              </div>
            </Card>

            <p className="text-xs text-muted-foreground">
              Boosted videos appear more often in the feed for relevant viewers. Impressions count only when the video plays for at least 2.5s.
            </p>

            <div className="space-y-3">
              {VIDEO_BOOST_PACKAGES.map((p) => {
                const isSelected = selected === p.id;
                return (
                  <Card
                    key={p.id}
                    className={`cursor-pointer transition-all border-2 rounded-xl ${
                      isSelected ? "border-primary bg-primary/5" : "border-border"
                    }`}
                    onClick={() => setSelected(p.id)}
                  >
                    <CardContent className="flex items-center gap-3 p-4">
                      <div className="shrink-0 text-primary">{p.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm">{p.label}</span>
                          {isSelected && <Check className="w-4 h-4 text-primary" />}
                        </div>
                        <p className="text-xs text-muted-foreground">{p.description}</p>
                        <p className="text-[11px] mt-1 text-muted-foreground">Up to {p.impressions.toLocaleString()} impressions</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-bold">KSh {p.price}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <Button onClick={() => setStep("payment")} className="w-full h-12 rounded-xl font-bold">
              Continue — KSh {pkg.price}
            </Button>
          </div>
        )}

        {step === "payment" && (
          <div className="space-y-4">
            <Card className="overflow-hidden border-2 border-primary/15">
              <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shrink-0 shadow-md shadow-primary/20">
                    {pkg.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Order summary</p>
                    <h3 className="font-display text-sm font-bold text-foreground leading-tight">{pkg.label}</h3>
                    <p className="text-[11px] text-muted-foreground">Up to {pkg.impressions.toLocaleString()} impressions</p>
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total due</p>
                  <p className="font-display text-2xl font-bold text-foreground leading-none">KSh {pkg.price}</p>
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
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com" className="rounded-xl h-11 mt-1 bg-background" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Phone <span className="font-normal">(optional)</span></Label>
                    <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                      placeholder="07XXXXXXXX" className="rounded-xl h-11 mt-1 bg-background" />
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
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)}
                    placeholder="07XXXXXXXX" className="rounded-xl h-11 mt-1 bg-background" maxLength={13} />
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
                {provider === "paystack" ? <><Lock className="w-4 h-4 mr-1.5" /> Checkout</> : <>Pay KSh {pkg.price}</>}
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
                {provider === "mpesa" ? "Approve the M-Pesa prompt on your phone." : "Complete the Paystack checkout in the new tab."}
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
              <p className="text-sm text-muted-foreground mt-1">Your video will reach up to {pkg.impressions.toLocaleString()} additional viewers.</p>
            </div>
            <Button onClick={reset} className="rounded-xl">Done</Button>
          </div>
        )}
      </div>
    </div>
  );
};
