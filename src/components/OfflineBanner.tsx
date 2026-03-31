import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { WifiOff, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";

export const OfflineBanner = () => {
  const { isOnline, isOffline } = useNetworkStatus();
  const [showReconnected, setShowReconnected] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (isOffline) {
      setWasOffline(true);
    }
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
      <div className="sticky top-0 z-[60] bg-destructive text-destructive-foreground px-4 py-2.5 flex items-center gap-3 shadow-md animate-in slide-in-from-top-2">
        <WifiOff className="w-4 h-4 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold leading-tight">You're offline</p>
          <p className="text-[10px] opacity-80 leading-tight">Some features may be limited</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-1 text-[11px] font-semibold opacity-80 hover:opacity-100 shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
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
