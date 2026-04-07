import React, { createContext, useContext, useState, useCallback } from "react";
import { useGeolocation, type UserLocation, type GeolocationStatus } from "@/hooks/useGeolocation";

type LocationContextType = {
  location: UserLocation | null;
  status: GeolocationStatus;
  error: string | null;
  requestLocation: () => void;
  clearLocation: () => void;
  setManualLocation: (location: UserLocation) => void;
  isManual: boolean;
};

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const geo = useGeolocation(false);
  const [manualLocation, setManualLoc] = useState<UserLocation | null>(null);
  const [isManual, setIsManual] = useState(false);

  const setManualLocation = useCallback((loc: UserLocation) => {
    setManualLoc(loc);
    setIsManual(true);
  }, []);

  const location = isManual ? manualLocation : geo.location;
  const status = isManual ? "granted" : geo.status;

  const clearLocation = useCallback(() => {
    setManualLoc(null);
    setIsManual(false);
    geo.clearLocation();
  }, [geo]);

  return (
    <LocationContext.Provider
      value={{
        location,
        status,
        error: isManual ? null : geo.error,
        requestLocation: geo.requestLocation,
        clearLocation,
        setManualLocation,
        isManual,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocation must be used within LocationProvider");
  return ctx;
};
