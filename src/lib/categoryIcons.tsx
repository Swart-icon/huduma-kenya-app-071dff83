import {
  HardHat, Car, Cpu, Monitor, Home, Briefcase,
  GraduationCap, HeartPulse, UtensilsCrossed, ShieldCheck,
  Wheat, Sparkles, Clapperboard, Truck, ShoppingCart, Wrench,
} from "lucide-react";

export const categoryIcons: Record<string, React.ReactNode> = {
  construction: <HardHat className="w-5 h-5 text-primary" />,
  automotive: <Car className="w-5 h-5 text-primary" />,
  electronics: <Cpu className="w-5 h-5 text-primary" />,
  "it-services": <Monitor className="w-5 h-5 text-primary" />,
  "home-services": <Home className="w-5 h-5 text-primary" />,
  "business-services": <Briefcase className="w-5 h-5 text-primary" />,
  education: <GraduationCap className="w-5 h-5 text-primary" />,
  "health-wellness": <HeartPulse className="w-5 h-5 text-primary" />,
  hospitality: <UtensilsCrossed className="w-5 h-5 text-primary" />,
  "security-logistics": <ShieldCheck className="w-5 h-5 text-primary" />,
  agriculture: <Wheat className="w-5 h-5 text-primary" />,
  "beauty-lifestyle": <Sparkles className="w-5 h-5 text-primary" />,
  "media-creative": <Clapperboard className="w-5 h-5 text-primary" />,
  transport: <Truck className="w-5 h-5 text-primary" />,
  "retail-trade": <ShoppingCart className="w-5 h-5 text-primary" />,
};

export const getCategoryIcon = (slug: string) =>
  categoryIcons[slug] || <Wrench className="w-5 h-5 text-primary" />;
