import { Smartphone, CreditCard, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type PaymentProvider = "mpesa" | "paystack";

interface Props {
  value: PaymentProvider;
  onChange: (provider: PaymentProvider) => void;
  disabled?: boolean;
}

export const PaymentMethodSelector = ({ value, onChange, disabled }: Props) => {
  const options: {
    id: PaymentProvider;
    label: string;
    desc: string;
    icon: React.ReactNode;
    accent: string;
  }[] = [
    {
      id: "mpesa",
      label: "M-Pesa",
      desc: "STK push to your phone",
      icon: <Smartphone className="w-5 h-5" />,
      accent: "text-[#4CAF50]",
    },
    {
      id: "paystack",
      label: "Paystack",
      desc: "Card, bank, mobile money",
      icon: <CreditCard className="w-5 h-5" />,
      accent: "text-[#00C3F7]",
    },
  ];

  return (
    <div className="space-y-2">
      {options.map((opt) => {
        const selected = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.id)}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-colors",
              selected
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/40",
              disabled && "opacity-60 cursor-not-allowed"
            )}
          >
            <div
              className={cn(
                "w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0",
                opt.accent
              )}
            >
              {opt.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground text-sm">{opt.label}</p>
              <p className="text-xs text-muted-foreground">{opt.desc}</p>
            </div>
            {selected && <Check className="w-5 h-5 text-primary shrink-0" />}
          </button>
        );
      })}
    </div>
  );
};
