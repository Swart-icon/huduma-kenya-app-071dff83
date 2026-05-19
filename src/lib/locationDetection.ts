/**
 * Location detection helpers.
 *
 * Privacy: precise lat/lng + area are stored privately on the profile and
 * should never be displayed publicly — UIs should render only city + county.
 */

export type DetailedLocation = {
  country: string;
  county: string;
  city: string;
  area: string;
  latitude: number;
  longitude: number;
  /** Public-friendly approximate label, e.g. "Mikinduri, Meru County" */
  approximate: string;
};

const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/reverse";

const pickFirst = (...candidates: Array<string | undefined | null>): string => {
  for (const c of candidates) {
    if (c && typeof c === "string" && c.trim()) return c.trim();
  }
  return "";
};

const stripCountySuffix = (s: string) => s.replace(/\s+County$/i, "").trim();

export const reverseGeocode = async (
  latitude: number,
  longitude: number,
): Promise<DetailedLocation> => {
  const url = `${NOMINATIM_ENDPOINT}?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=14&addressdetails=1&accept-language=en`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error("Reverse geocoding failed");
  const data = await res.json();
  const a = data?.address ?? {};

  const country = pickFirst(a.country, "Kenya");
  const countyRaw = pickFirst(a.county, a.state_district, a.state, a.region);
  const county = stripCountySuffix(countyRaw);
  const city = pickFirst(a.city, a.town, a.municipality, a.village, a.hamlet, a.suburb, a.county);
  const area = pickFirst(a.suburb, a.neighbourhood, a.village, a.hamlet, a.quarter, a.city_district);

  const cityLabel = city || county || "Unknown";
  const countyLabel = county ? `${county} County` : "";
  const approximate = [cityLabel, countyLabel].filter(Boolean).join(", ");

  return {
    country,
    county,
    city: cityLabel,
    area,
    latitude,
    longitude,
    approximate,
  };
};

export const detectCurrentLocation = async (): Promise<DetailedLocation> => {
  const { Capacitor } = await import("@capacitor/core");

  if (Capacitor.isNativePlatform()) {
    const { Geolocation } = await import("@capacitor/geolocation");
    const perm = await Geolocation.requestPermissions();
    if (perm.location !== "granted" && perm.coarseLocation !== "granted") {
      throw new Error("Location permission denied. Please pick your location manually.");
    }
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000,
    });
    return reverseGeocode(pos.coords.latitude, pos.coords.longitude);
  }

  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation is not supported on this device"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const detailed = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
          resolve(detailed);
        } catch (err) {
          reject(err instanceof Error ? err : new Error("Could not look up your address"));
        }
      },
      (err) => {
        const reason =
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied. Please pick your location manually."
            : err.code === err.POSITION_UNAVAILABLE
              ? "Your position is unavailable right now. Please pick manually."
              : err.code === err.TIMEOUT
                ? "Location request timed out. Please try again or pick manually."
                : "Could not detect your location.";
        reject(new Error(reason));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  });
};


/** Public-display helper: never include precise area or coordinates. */
export const formatPublicLocation = (parts: {
  city?: string | null;
  county?: string | null;
}): string => {
  const city = parts.city?.trim();
  const county = parts.county?.trim();
  if (city && county) return `${city}, ${county} County`;
  return city || county || "Location not set";
};
