import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";

// Routes considered "main/home" — pressing back here triggers the exit prompt
const HOME_ROUTES = new Set(["/", "/videos", "/dashboard", "/welcome"]);

/**
 * Handles the Android hardware back button:
 *  1. If a Radix modal/dialog/sheet/popover is open → close it
 *  2. If a video is playing anywhere on the page → pause it
 *  3. If on a home route → prompt "Press again to exit"
 *  4. Otherwise → navigate back in history
 */
export const useAndroidBackButton = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const exitPromptedAt = useRef<number>(0);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handler = App.addListener("backButton", () => {
      // 1. Close any open Radix overlay (Dialog, Sheet, AlertDialog, Popover, DropdownMenu)
      const openOverlay = document.querySelector(
        '[data-state="open"][role="dialog"], [data-state="open"][role="alertdialog"], [data-radix-popper-content-wrapper] [data-state="open"]'
      );
      if (openOverlay) {
        // Prefer clicking the explicit close button, fall back to Escape
        const closeBtn = openOverlay.querySelector<HTMLButtonElement>(
          '[data-radix-collection-item][aria-label="Close"], button[aria-label="Close"]'
        );
        if (closeBtn) {
          closeBtn.click();
        } else {
          document.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
          );
        }
        return;
      }

      // 2. Pause any playing <video> on the page before navigating
      const playingVideos = Array.from(
        document.querySelectorAll("video")
      ).filter((v) => !v.paused);
      playingVideos.forEach((v) => v.pause());

      // 3. Home/root route → exit prompt
      if (HOME_ROUTES.has(location.pathname)) {
        const now = Date.now();
        if (now - exitPromptedAt.current < 2000) {
          App.exitApp();
        } else {
          exitPromptedAt.current = now;
          toast("Press back again to exit", { duration: 2000 });
        }
        return;
      }

      // 4. Default: go to previous screen
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate("/", { replace: true });
      }
    });

    return () => {
      handler.then((h) => h.remove());
    };
  }, [navigate, location.pathname]);
};
