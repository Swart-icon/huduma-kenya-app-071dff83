import { useEffect, useRef, useState, RefObject } from "react";

interface Options {
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  maxPull?: number;
  enabled?: boolean;
}

/**
 * Pull-to-refresh that COEXISTS with a snap-scroll vertical feed.
 *
 * Design rules (matches the TikTok-style video feed):
 *  - Only engages when the user starts a touch with the container at scrollTop === 0
 *    (i.e. on the FIRST video). Anywhere else the gesture is a no-op so vertical
 *    swipes always navigate videos.
 *  - Only engages when the first few pixels of movement are clearly DOWNWARD and
 *    mostly vertical (cancels on horizontal/upward intent), so an upward swipe to
 *    advance to the next video is never mistaken for a refresh attempt.
 *  - Stable touch listeners — internal state lives in refs so we don't tear
 *    down/re-bind handlers mid-gesture (which caused jitter & dropped events).
 */
export function usePullToRefresh<T extends HTMLElement>(
  ref: RefObject<T>,
  { onRefresh, threshold = 70, maxPull = 120, enabled = true }: Options
) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Mutable state — keep listeners stable across renders.
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);
  const startY = useRef<number | null>(null);
  const startX = useRef<number | null>(null);
  const engaged = useRef(false); // we have committed to a pull-to-refresh gesture
  const decided = useRef(false); // direction has been determined for this touch
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  // Pixels of movement before we decide whether this gesture is a pull or a scroll.
  const ENGAGE_DISTANCE = 8;

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    const reset = () => {
      startY.current = null;
      startX.current = null;
      engaged.current = false;
      decided.current = false;
      if (pullRef.current !== 0) {
        pullRef.current = 0;
        setPull(0);
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (refreshingRef.current) return;
      // Only consider engaging if we're already at the top of the feed.
      if (el.scrollTop > 0) {
        reset();
        return;
      }
      startY.current = e.touches[0].clientY;
      startX.current = e.touches[0].clientX;
      engaged.current = false;
      decided.current = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (refreshingRef.current || startY.current == null) return;

      const dy = e.touches[0].clientY - startY.current;
      const dx = e.touches[0].clientX - (startX.current ?? 0);

      // Decide gesture intent once we've moved enough to tell.
      if (!decided.current) {
        if (Math.abs(dy) < ENGAGE_DISTANCE && Math.abs(dx) < ENGAGE_DISTANCE) return;
        decided.current = true;
        // Engage only if movement is clearly downward and primarily vertical.
        // Anything else (upward swipe to next video, horizontal swipe) → release.
        if (dy <= ENGAGE_DISTANCE || Math.abs(dx) > Math.abs(dy)) {
          engaged.current = false;
          startY.current = null; // don't process further moves for this touch
          return;
        }
        engaged.current = true;
      }

      if (!engaged.current) return;

      // Once engaged, if user reverses upward past the start, release back to scroll.
      if (dy <= 0) {
        engaged.current = false;
        startY.current = null;
        if (pullRef.current !== 0) {
          pullRef.current = 0;
          setPull(0);
        }
        return;
      }
      // Defensive: if container scrolled (e.g. focus jump), bail.
      if (el.scrollTop > 0) {
        reset();
        return;
      }

      const eased = Math.min(maxPull, dy * 0.5);
      pullRef.current = eased;
      setPull(eased);
      if (e.cancelable) e.preventDefault();
    };

    const finish = async () => {
      const wasEngaged = engaged.current;
      const finalPull = pullRef.current;
      startY.current = null;
      startX.current = null;
      engaged.current = false;
      decided.current = false;

      if (!wasEngaged) {
        if (pullRef.current !== 0) {
          pullRef.current = 0;
          setPull(0);
        }
        return;
      }

      if (finalPull >= threshold && !refreshingRef.current) {
        refreshingRef.current = true;
        setRefreshing(true);
        pullRef.current = threshold;
        setPull(threshold);
        try {
          await onRefreshRef.current();
        } finally {
          refreshingRef.current = false;
          setRefreshing(false);
          pullRef.current = 0;
          setPull(0);
          // Keep user at the top after a refresh — don't jump them mid-feed.
          el.scrollTo({ top: 0 });
        }
      } else {
        pullRef.current = 0;
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
  }, [ref, enabled, threshold, maxPull]);

  return { pull, refreshing, progress: Math.min(1, pull / threshold) };
}
