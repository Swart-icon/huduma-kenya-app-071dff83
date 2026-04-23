import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import offlineIllustration from "@/assets/offline-illustration.png";

export const OfflineBanner = () => {
  const { isOnline, isOffline } = useNetworkStatus();
  const [showReconnected, setShowReconnected] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (isOffline) setWasOffline(true);
    if (isOnline && wasOffline) {
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
        setWasOffline(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, isOffline, wasOffline]);

  if (isOffline) {
    return (
      <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center px-6 text-center">
        <img
          src={offlineIllustration}
          alt="No internet connection"
          width={280}
          height={280}
          className="w-64 h-64 object-contain mb-6 select-none pointer-events-none"
          draggable={false}
        />
        <h2 className="text-xl font-bold text-foreground mb-2">
          No internet connection
        </h2>
        <p className="text-sm text-muted-foreground mb-6 max-w-xs">
          Check your connection, then refresh the page.
        </p>
        <Button
          onClick={() => window.location.reload()}
          variant="outline"
          className="rounded-full px-8 h-11 font-semibold border-2 border-primary text-primary hover:bg-primary/10"
        >
          Refresh
        </Button>
      </div>
    );
  }

  if (showReconnected) {
    return (
      <div className="sticky top-0 z-[60] bg-green-600 text-white px-4 py-2 flex items-center gap-3 shadow-md animate-in slide-in-from-top-2">
        <div className="w-2 h-2 rounded-full bg-white animate-pulse shrink-0" />
        <p className="text-xs font-bold">Back online — syncing data...</p>
      </div>
    );
  }

  return null;
};
