import { useRef, useState, useEffect, ReactNode } from "react";
import { Loader2, ArrowDown } from "lucide-react";

interface Props {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
  /** Distance in px the user must pull to trigger refresh. */
  threshold?: number;
  /** Max pull distance before clamping. */
  maxPull?: number;
  className?: string;
  /** Optional inline style passed to the scroll container. */
  style?: React.CSSProperties;
  /** Tint of the indicator: "light" for dark backgrounds, "dark" otherwise. */
  tone?: "light" | "dark";
  scrollRef?: React.RefObject<HTMLDivElement>;
}

/**
 * Mobile-friendly pull-to-refresh wrapper. Only activates when the inner
 * scroll container is scrolled to the very top.
 */
export const PullToRefresh = ({
  onRefresh,
  children,
  threshold = 70,
  maxPull = 120,
  className = "",
  style,
  tone = "light",
  scrollRef,
}: Props) => {
  const internalRef = useRef<HTMLDivElement>(null);
  const ref = scrollRef ?? internalRef;
  const startY = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (refreshing) return;
      if (el.scrollTop > 0) { startY.current = null; return; }
      startY.current = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (startY.current == null || refreshing) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta <= 0) { setPull(0); return; }
      // Only intercept when at top
      if (el.scrollTop > 0) { setPull(0); return; }
      // Resistance curve
      const eased = Math.min(maxPull, delta * 0.55);
      setPull(eased);
      if (eased > 4 && e.cancelable) e.preventDefault();
    };
    const onTouchEnd = async () => {
      if (startY.current == null) return;
      startY.current = null;
      if (pull >= threshold && !refreshing) {
        setRefreshing(true);
        setPull(threshold);
        try { await onRefresh(); } finally {
          setRefreshing(false);
          setPull(0);
        }
      } else {
        setPull(0);
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [pull, refreshing, threshold, maxPull, onRefresh, ref]);

  const progress = Math.min(1, pull / threshold);
  const indicatorColor = tone === "light" ? "text-white" : "text-foreground";
  const bgColor = tone === "light" ? "bg-white/15" : "bg-muted";

  return (
    <div className={`relative ${className}`} style={style}>
      {/* Pull indicator */}
      <div
        className="absolute left-0 right-0 flex justify-center pointer-events-none z-50 transition-opacity"
        style={{
          top: 0,
          transform: `translateY(${Math.max(0, pull - 40)}px)`,
          opacity: pull > 4 ? 1 : 0,
        }}
      >
        <div
          className={`mt-2 w-9 h-9 rounded-full ${bgColor} backdrop-blur-md flex items-center justify-center shadow-lg`}
          style={{ transform: `rotate(${progress * 180}deg)` }}
        >
          {refreshing ? (
            <Loader2 className={`w-4 h-4 animate-spin ${indicatorColor}`} />
          ) : (
            <ArrowDown className={`w-4 h-4 ${indicatorColor}`} />
          )}
        </div>
      </div>

      {/* Scroll container — receives ref + transform while pulling */}
      <div
        ref={ref}
        className="w-full h-full overflow-y-scroll scrollbar-hide"
        style={{
          ...style,
          transform: pull > 0 ? `translateY(${pull}px)` : undefined,
          transition: startY.current == null ? "transform 220ms ease-out" : "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {children}
      </div>
    </div>
  );
};
