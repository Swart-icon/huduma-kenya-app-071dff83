import { useEffect, useRef, useState, RefObject } from "react";

interface Options {
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  maxPull?: number;
  enabled?: boolean;
}

/**
 * Attach pull-to-refresh gesture to an existing scrollable element.
 * Returns the current pull distance (px) and whether a refresh is running,
 * so the caller can render its own indicator.
 */
export function usePullToRefresh<T extends HTMLElement>(
  ref: RefObject<T>,
  { onRefresh, threshold = 70, maxPull = 120, enabled = true }: Options
) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const activeRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    const onTouchStart = (e: TouchEvent) => {
      if (refreshing) return;
      if (el.scrollTop > 0) { startY.current = null; activeRef.current = false; return; }
      startY.current = e.touches[0].clientY;
      activeRef.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (startY.current == null || refreshing) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta <= 0) { setPull(0); return; }
      if (el.scrollTop > 0) { setPull(0); return; }
      const eased = Math.min(maxPull, delta * 0.5);
      setPull(eased);
      if (eased > 6 && e.cancelable) e.preventDefault();
    };

    const finish = async () => {
      if (!activeRef.current) return;
      activeRef.current = false;
      const reached = pull >= threshold;
      startY.current = null;
      if (reached && !refreshing) {
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
    el.addEventListener("touchend", finish, { passive: true });
    el.addEventListener("touchcancel", finish, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", finish);
      el.removeEventListener("touchcancel", finish);
    };
  }, [ref, enabled, pull, refreshing, threshold, maxPull, onRefresh]);

  return { pull, refreshing, progress: Math.min(1, pull / threshold) };
}
