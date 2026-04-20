import { useMemo } from "react";
import { useLocation } from "@/contexts/LocationContext";
import { useProfile } from "@/hooks/useProfile";
import { KENYAN_LOCATIONS } from "@/lib/kenyanLocations";

const haversine = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

export type UserRegion = {
  city: string | null;
  county: string | null;
  source: "gps" | "profile" | "none";
};

/**
 * Resolves the user's city/county for region-based content ranking.
 * Priority:
 *   1. GPS → nearest city in KENYAN_LOCATIONS
 *   2. profiles.location text (matched against city or county)
 *   3. null (national fallback)
 */
export const useUserRegion = (): UserRegion => {
  const { location } = useLocation();
  const { data: profile } = useProfile();

  return useMemo(() => {
    // 1. GPS reverse-lookup
    if (location) {
      let best = KENYAN_LOCATIONS[0];
      let bestDist = Infinity;
      for (const loc of KENYAN_LOCATIONS) {
        const d = haversine(location.latitude, location.longitude, loc.lat, loc.lng);
        if (d < bestDist) {
          bestDist = d;
          best = loc;
        }
      }
      return { city: best.name, county: best.county, source: "gps" };
    }

    // 2. Profile text fallback
    const txt = profile?.location?.trim().toLowerCase();
    if (txt) {
      const cityMatch = KENYAN_LOCATIONS.find((l) => l.name.toLowerCase() === txt);
      if (cityMatch) return { city: cityMatch.name, county: cityMatch.county, source: "profile" };
      const countyMatch = KENYAN_LOCATIONS.find((l) => l.county.toLowerCase() === txt);
      if (countyMatch) return { city: null, county: countyMatch.county, source: "profile" };
    }

    return { city: null, county: null, source: "none" };
  }, [location, profile?.location]);
};
