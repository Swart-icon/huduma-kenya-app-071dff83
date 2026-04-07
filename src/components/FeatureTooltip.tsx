import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Position = "top" | "bottom" | "left" | "right";

interface FeatureTooltipProps {
  id: string;
  message: string;
  position?: Position;
  children: React.ReactNode;
  className?: string;
}

const STORAGE_KEY = "huduma-tooltips-seen";

function getSeenTooltips(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function markSeen(id: string) {
  const seen = getSeenTooltips();
  if (!seen.includes(id)) {
    seen.push(id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
  }
}

const arrowClasses: Record<Position, string> = {
  bottom: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  top: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "left-full top-1/2 -translate-y-1/2 ml-2",
  right: "right-full top-1/2 -translate-y-1/2 mr-2",
};

const caretClasses: Record<Position, string> = {
  bottom: "top-full left-1/2 -translate-x-1/2 border-t-primary border-x-transparent border-b-transparent",
  top: "bottom-full left-1/2 -translate-x-1/2 border-b-primary border-x-transparent border-t-transparent",
  left: "right-full top-1/2 -translate-y-1/2 border-r-primary border-y-transparent border-l-transparent",
  right: "left-full top-1/2 -translate-y-1/2 border-l-primary border-y-transparent border-r-transparent",
};

export const FeatureTooltip = ({ id, message, position = "bottom", children, className }: FeatureTooltipProps) => {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const seen = getSeenTooltips();
    if (!seen.includes(id)) {
      timerRef.current = setTimeout(() => setVisible(true), 600);
    }
    return () => clearTimeout(timerRef.current);
  }, [id]);

  const dismiss = () => {
    setVisible(false);
    markSeen(id);
  };

  return (
    <div className={cn("relative inline-flex", className)}>
      {children}
      {visible && (
        <div
          className={cn(
            "absolute z-50 animate-in fade-in slide-in-from-bottom-1 duration-300",
            arrowClasses[position]
          )}
        >
          <div className="relative bg-primary text-primary-foreground rounded-lg px-3 py-2 shadow-lg max-w-[200px]">
            <p className="text-xs font-medium pr-4 leading-snug">{message}</p>
            <button
              onClick={(e) => { e.stopPropagation(); dismiss(); }}
              className="absolute top-1 right-1 p-0.5 rounded-full hover:bg-primary-foreground/20 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
            <div className={cn("absolute w-0 h-0 border-[6px]", caretClasses[position])} />
          </div>
        </div>
      )}
    </div>
  );
};

export const resetTooltips = () => localStorage.removeItem(STORAGE_KEY);
