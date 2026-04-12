export type KenyanLocation = {
  name: string;
  county: string;
  lat: number;
  lng: number;
};

export const KENYAN_LOCATIONS: KenyanLocation[] = [
  { name: "Nairobi", county: "Nairobi", lat: -1.2921, lng: 36.8219 },
  { name: "Mombasa", county: "Mombasa", lat: -4.0435, lng: 39.6682 },
  { name: "Kisumu", county: "Kisumu", lat: -0.1022, lng: 34.7617 },
  { name: "Nakuru", county: "Nakuru", lat: -0.3031, lng: 36.0800 },
  { name: "Eldoret", county: "Uasin Gishu", lat: 0.5143, lng: 35.2698 },
  { name: "Thika", county: "Kiambu", lat: -1.0396, lng: 37.0900 },
  { name: "Malindi", county: "Kilifi", lat: -3.2138, lng: 40.1169 },
  { name: "Nyeri", county: "Nyeri", lat: -0.4197, lng: 36.9511 },
  { name: "Machakos", county: "Machakos", lat: -1.5177, lng: 37.2634 },
  { name: "Nanyuki", county: "Laikipia", lat: 0.0067, lng: 37.0722 },
  { name: "Garissa", county: "Garissa", lat: -0.4532, lng: 39.6461 },
  { name: "Lamu", county: "Lamu", lat: -2.2717, lng: 40.9020 },
  { name: "Kitale", county: "Trans-Nzoia", lat: 1.0187, lng: 35.0020 },
  { name: "Embu", county: "Embu", lat: -0.5388, lng: 37.4596 },
  { name: "Meru", county: "Meru", lat: 0.0480, lng: 37.6559 },
];

/** Find approximate coordinates for a county name */
export const getCoordinatesForCounty = (county: string): { lat: number; lng: number } | null => {
  const match = KENYAN_LOCATIONS.find(
    (loc) => loc.county.toLowerCase() === county.toLowerCase()
  );
  return match ? { lat: match.lat, lng: match.lng } : null;
};

/** Find approximate coordinates for a city name */
export const getCoordinatesForCity = (city: string): { lat: number; lng: number } | null => {
  const match = KENYAN_LOCATIONS.find(
    (loc) => loc.name.toLowerCase() === city.toLowerCase()
  );
  return match ? { lat: match.lat, lng: match.lng } : null;
};

export const KENYAN_COUNTIES = [
  "Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo-Marakwet", "Embu", "Garissa",
  "Homa Bay", "Isiolo", "Kajiado", "Kakamega", "Kericho", "Kiambu", "Kilifi",
  "Kirinyaga", "Kisii", "Kisumu", "Kitui", "Kwale", "Laikipia", "Lamu", "Machakos",
  "Makueni", "Mandera", "Marsabit", "Meru", "Migori", "Mombasa", "Murang'a",
  "Nairobi", "Nakuru", "Nandi", "Narok", "Nyamira", "Nyandarua", "Nyeri",
  "Samburu", "Siaya", "Taita-Taveta", "Tana River", "Tharaka-Nithi", "Trans-Nzoia",
  "Turkana", "Uasin Gishu", "Vihiga", "Wajir", "West Pokot",
];

/** Get cities for a given county (falls back to county name if no mapping) */
export const getCitiesByCounty = (county: string): string[] => {
  const match = KENYAN_LOCATIONS.filter(
    (loc) => loc.county.toLowerCase() === county.toLowerCase()
  );
  if (match.length > 0) return match.map((m) => m.name);
  return [county]; // Fallback: use county name as city
};
