import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

const STORAGE_KEY = "huduma_rate_prompt";
const MIN_ACTIONS = 5;
const COOLDOWN_DAYS = 14;

interface RateState {
  hasRated: boolean;
  dismissedAt: number | null;
  actionCount: number;
  lastPromptAt: number | null;
}

const getState = (): RateState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { hasRated: false, dismissedAt: null, actionCount: 0, lastPromptAt: null };
};

const saveState = (s: RateState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
};

export const useRatePrompt = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<RateState>(getState);

  const trackAction = useCallback(() => {
    setState((prev) => {
      const next = { ...prev, actionCount: prev.actionCount + 1 };
      saveState(next);
      return next;
    });
  }, []);

  // Check if we should show the prompt
  useEffect(() => {
    if (!user) return;
    const s = getState();
    if (s.hasRated) return;
    if (s.actionCount < MIN_ACTIONS) return;
    if (s.lastPromptAt) {
      const daysSince = (Date.now() - s.lastPromptAt) / (1000 * 60 * 60 * 24);
      if (daysSince < COOLDOWN_DAYS) return;
    }
    if (s.dismissedAt) {
      const daysSince = (Date.now() - s.dismissedAt) / (1000 * 60 * 60 * 24);
      if (daysSince < COOLDOWN_DAYS) return;
    }
    // Delay showing to not interrupt page load
    const timer = setTimeout(() => setOpen(true), 3000);
    return () => clearTimeout(timer);
  }, [user, state.actionCount]);

  const dismiss = useCallback(() => {
    setOpen(false);
    setState((prev) => {
      const next = { ...prev, dismissedAt: Date.now(), lastPromptAt: Date.now() };
      saveState(next);
      return next;
    });
  }, []);

  const markRated = useCallback(() => {
    setState((prev) => {
      const next = { ...prev, hasRated: true, lastPromptAt: Date.now() };
      saveState(next);
      return next;
    });
    setOpen(false);
  }, []);

  return { open, setOpen, trackAction, dismiss, markRated };
};
