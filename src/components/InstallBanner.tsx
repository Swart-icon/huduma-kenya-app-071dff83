import { useState, useEffect } from "react";
import { X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export const InstallBanner = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    // Check if previously dismissed (expire after 24h)
    const dismissedAt = localStorage.getItem("pwa-dismiss");
    if (dismissedAt && Date.now() - Number(dismissedAt) < 86400000) {
      setDismissed(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("pwa-dismiss", String(Date.now()));
  };

  // Don't show if installed, dismissed, or no prompt available
  if (isInstalled || dismissed || !deferredPrompt) return null;

  return (
    <div className="sticky top-0 z-50 bg-primary text-primary-foreground px-4 py-2.5 flex items-center gap-3 shadow-md">
      <Download className="w-5 h-5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold leading-tight">Install Huduma</p>
        <p className="text-[10px] opacity-80 leading-tight">Get the full app experience</p>
      </div>
      <Button
        onClick={handleInstall}
        size="sm"
        className="h-8 px-3 rounded-lg bg-primary-foreground text-primary hover:bg-primary-foreground/90 text-xs font-bold shrink-0"
      >
        Install
      </Button>
      <button onClick={handleDismiss} className="p-1 opacity-60 hover:opacity-100 shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
