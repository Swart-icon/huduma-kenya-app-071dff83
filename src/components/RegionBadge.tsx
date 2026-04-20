import { Badge } from "@/components/ui/badge";
import { MapPin, Globe } from "lucide-react";

type Props = { rank: number | null | undefined; className?: string };

/**
 * Tiny chip showing how a content card matches the user's region.
 *  0 → "In your city"
 *  1 → "Same county"
 *  2 → "Nationwide"
 */
export const RegionBadge = ({ rank, className = "" }: Props) => {
  if (rank === null || rank === undefined) return null;

  if (rank === 0)
    return (
      <Badge variant="secondary" className={`gap-1 text-[10px] bg-primary/10 text-primary font-medium ${className}`}>
        <MapPin className="w-2.5 h-2.5" /> In your city
      </Badge>
    );
  if (rank === 1)
    return (
      <Badge variant="secondary" className={`gap-1 text-[10px] bg-accent/40 text-foreground font-medium ${className}`}>
        <MapPin className="w-2.5 h-2.5" /> Same county
      </Badge>
    );
  return (
    <Badge variant="outline" className={`gap-1 text-[10px] text-muted-foreground ${className}`}>
      <Globe className="w-2.5 h-2.5" /> Nationwide
    </Badge>
  );
};
