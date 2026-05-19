import { useState, useCallback, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";


export type GeolocationStatus = "idle" | "requesting" | "granted" | "denied" | "unavailable" | "error";

export type UserLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

type UseGeolocationReturn = {
  location: UserLocation | null;
  status: GeolocationStatus;
  error: string | null;
  requestLocation: () => void;
  clearLocation: () => void;
};

const LOCATION_STORAGE_KEY = "servio_user_location";
const LOCATION_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

const getSavedLocation = (): UserLocation | null => {
  try {
    const saved = sessionStorage.getItem(LOCATION_STORAGE_KEY);
    if (!saved) return null;
    const { location, timestamp } = JSON.parse(saved);
    if (Date.now() - timestamp > LOCATION_EXPIRY_MS) {
      sessionStorage.removeItem(LOCATION_STORAGE_KEY);
      return null;
    }
    return location;
  } catch {
    return null;
  }
};

const saveLocation = (location: UserLocation) => {
  try {
    sessionStorage.setItem(
      LOCATION_STORAGE_KEY,
      JSON.stringify({ location, timestamp: Date.now() })
    );
  } catch {
    // silently fail
  }
};

export const useGeolocation = (autoRequest = false): UseGeolocationReturn => {
  const [location, setLocation] = useState<UserLocation | null>(getSavedLocation);
  const [status, setStatus] = useState<GeolocationStatus>(
    getSavedLocation() ? "granted" : "idle"
  );
  const [error, setError] = useState<string | null>(null);

  const requestLocation = useCallback(async () => {
    setStatus("requesting");
    setError(null);

    // Use Capacitor Geolocation on native platforms (Android/iOS)
    if (Capacitor.isNativePlatform()) {
      try {
        const perm = await Geolocation.requestPermissions();
        if (perm.location !== "granted" && perm.coarseLocation !== "granted") {
          setStatus("denied");
          setError("Location permission was denied");
          return;
        }
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000,
        });
        const loc: UserLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        setLocation(loc);
        saveLocation(loc);
        setStatus("granted");
      } catch (err: any) {
        setStatus("error");
        setError(err?.message || "Could not detect your location");
      }
      return;
    }

    if (!navigator.geolocation) {
      setStatus("unavailable");
      setError("Geolocation is not supported by your device");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const loc: UserLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        setLocation(loc);
        saveLocation(loc);
        setStatus("granted");
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setStatus("denied");
            setError("Location permission was denied");
            break;
          case err.POSITION_UNAVAILABLE:
            setStatus("unavailable");
            setError("Location information is unavailable");
            break;
          case err.TIMEOUT:
            setStatus("error");
            setError("Location request timed out");
            break;
          default:
            setStatus("error");
            setError("An unknown error occurred");
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000,
      }
    );
  }, []);


  const clearLocation = useCallback(() => {
    setLocation(null);
    setStatus("idle");
    setError(null);
    sessionStorage.removeItem(LOCATION_STORAGE_KEY);
  }, []);

  useEffect(() => {
    if (autoRequest && status === "idle") {
      requestLocation();
    }
  }, [autoRequest, status, requestLocation]);

  return { location, status, error, requestLocation, clearLocation };
};

/** Calculate distance between two points in km (Haversine formula) */
export const getDistanceKm = (
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
