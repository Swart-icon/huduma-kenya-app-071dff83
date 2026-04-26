import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, Check, Loader2, Phone, Sparkles, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const boostTiers = [
  {
    id: "moderate",
    label: "Moderate Boost",
    price: 50,
    currency: "KES",
    duration: "24 hours",
    durationHours: 24,
    description: "Your status appears higher in feeds",
    icon: <Zap className="w-5 h-5" />,
    color: "bg-accent/15 text-accent-foreground border-accent/30",
    selectedColor: "bg-accent text-accent-foreground border-accent",
  },
  {
    id: "high",
    label: "High Boost",
    price: 100,
    currency: "KES",
    duration: "48 hours",
    durationHours: 48,
    description: "Top priority — appears first in all feeds",
    icon: <Sparkles className="w-5 h-5" />,
    color: "bg-primary/10 text-primary border-primary/30",
    selectedColor: "bg-primary text-primary-foreground border-primary",
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
  const [phoneNumber, setPhoneNumber] = useState("");
  const [processing, setProcessing] = useState(false);

  const tier = boostTiers.find((t) => t.id === selectedTier)!;

  const handlePay = async () => {
    if (!phoneNumber.trim() || phoneNumber.replace(/\D/g, "").length < 9) {
      toast({ title: "Enter a valid M-Pesa phone number", variant: "destructive" });
      return;
    }

    setStep("processing");
    setProcessing(true);

    const { data, error } = await supabase.functions.invoke("mpesa-stk-push", {
      body: {
        purpose: "boost",
        statusId,
        tier: selectedTier,
        phone: phoneNumber.trim(),
      },
    });

    setProcessing(false);

    if (error || (data as any)?.error) {
      toast({
        title: "Payment failed",
        description: (data as any)?.error || error?.message || "Could not initiate STK push",
        variant: "destructive",
      });
      setStep("payment");
      return;
    }

    toast({
      title: "STK push sent",
      description: "Approve the M-Pesa prompt on your phone to activate the boost.",
    });
    setStep("success");
    onBoosted();
  };

  const resetAndClose = () => {
    setStep("select");
    setPhoneNumber("");
    setSelectedTier("moderate");
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={resetAndClose} />
      <div className="relative w-full max-w-sm mx-4 bg-card rounded-2xl p-6 shadow-lg animate-in zoom-in-95 fade-in">
        {/* Header */}
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
                      isSelected ? t.selectedColor : t.color
                    }`}
                    onClick={() => setSelectedTier(t.id)}
                  >
                    <CardContent className="flex items-center gap-3 p-4">
                      <div className="shrink-0">{t.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm">{t.label}</span>
                          {isSelected && <Check className="w-4 h-4" />}
                        </div>
                        <p className={`text-xs ${isSelected ? "opacity-80" : "text-muted-foreground"}`}>
                          {t.description}
                        </p>
                        <p className={`text-xs mt-1 ${isSelected ? "opacity-70" : "text-muted-foreground"}`}>
                          Duration: {t.duration}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-bold">{t.currency} {t.price}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Button
              onClick={() => setStep("payment")}
              className="w-full h-12 rounded-xl font-bold"
            >
              Continue — {tier.currency} {tier.price}
            </Button>
          </div>
        )}

        {step === "payment" && (
          <div className="space-y-4">
            <div className="text-center py-2">
              <Badge className="bg-primary/10 text-primary mb-2">{tier.label}</Badge>
              <p className="text-2xl font-bold text-foreground">KES {tier.price}</p>
              <p className="text-xs text-muted-foreground">{tier.duration} boost</p>
            </div>

            <div className="bg-[#4CAF50]/10 rounded-xl p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Phone className="w-5 h-5 text-[#4CAF50]" />
                <span className="font-bold text-[#4CAF50]">M-Pesa</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Enter your M-Pesa number. You'll receive an STK push to confirm payment.
              </p>
              <Input
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="0712345678"
                className="rounded-xl text-center text-lg font-mono h-12"
                maxLength={13}
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep("select")}
                className="flex-1 rounded-xl"
              >
                Back
              </Button>
              <Button
                onClick={handlePay}
                className="flex-1 rounded-xl font-bold bg-[#4CAF50] hover:bg-[#43A047]"
              >
                Pay KES {tier.price}
              </Button>
            </div>
          </div>
        )}

        {step === "processing" && (
          <div className="py-8 text-center space-y-4">
            <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
            <div>
              <p className="font-bold text-foreground">Processing Payment</p>
              <p className="text-sm text-muted-foreground mt-1">
                Check your phone for the M-Pesa prompt...
              </p>
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-[#4CAF50]/10 flex items-center justify-center mx-auto">
              <Check className="w-8 h-8 text-[#4CAF50]" />
            </div>
            <div>
              <p className="font-bold text-foreground text-lg">Boost Active! 🚀</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your status is now boosted for {tier.duration}
              </p>
            </div>
            <Button onClick={resetAndClose} className="rounded-xl">
              Done
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
