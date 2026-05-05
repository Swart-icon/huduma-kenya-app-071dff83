import { Smartphone, CreditCard, Check, Building2, Wallet } from "lucide-react";
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
    badge?: string;
    methods: { icon: React.ReactNode; label: string }[];
  }[] = [
    {
      id: "mpesa",
      label: "M-Pesa",
      desc: "Pay instantly via STK push",
      icon: <Smartphone className="w-6 h-6" />,
      accent: "bg-[#4CAF50]/10 text-[#2E7D32]",
      badge: "Popular",
      methods: [{ icon: <Smartphone className="w-3 h-3" />, label: "Mobile" }],
    },
    {
      id: "paystack",
      label: "Paystack",
      desc: "Card, Bank or Mobile Money",
      icon: <CreditCard className="w-6 h-6" />,
      accent: "bg-[#00C3F7]/10 text-[#0098C8]",
      methods: [
        { icon: <CreditCard className="w-3 h-3" />, label: "Card" },
        { icon: <Building2 className="w-3 h-3" />, label: "Bank" },
        { icon: <Wallet className="w-3 h-3" />, label: "Wallet" },
      ],
    },
  ];

  return (
    <div className="grid gap-2.5">
      {options.map((opt) => {
        const selected = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.id)}
            className={cn(
              "relative w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 text-left transition-all",
              selected
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border hover:border-primary/40 active:scale-[0.99]",
              disabled && "opacity-60 cursor-not-allowed"
            )}
          >
            <div
              className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                opt.accent
              )}
            >
              {opt.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-foreground text-sm">{opt.label}</p>
                {opt.badge && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                    {opt.badge}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-1">{opt.desc}</p>
              <div className="flex items-center gap-1 flex-wrap">
                {opt.methods.map((m) => (
                  <span
                    key={m.label}
                    className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded"
                  >
                    {m.icon} {m.label}
                  </span>
                ))}
              </div>
            </div>
            <div
              className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                selected ? "border-primary bg-primary" : "border-muted-foreground/30"
              )}
            >
              {selected && <Check className="w-3 h-3 text-primary-foreground" />}
            </div>
          </button>
        );
      })}
    </div>
  );
};
