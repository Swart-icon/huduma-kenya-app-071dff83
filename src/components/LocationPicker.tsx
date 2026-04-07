import { useState } from "react";
import { MapPin, Navigation, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "@/contexts/LocationContext";

// Major Kenyan cities with approximate coordinates
const KENYAN_LOCATIONS = [
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

type LocationPickerProps = {
  compact?: boolean;
  onLocationSet?: () => void;
};

const LocationPicker = ({ compact = false, onLocationSet }: LocationPickerProps) => {
  const { location, status, error, requestLocation, setManualLocation, isManual } = useLocation();
  const [selectedCity, setSelectedCity] = useState("");

  const handleDetect = () => {
    requestLocation();
  };

  const handleManualSelect = (cityName: string) => {
    setSelectedCity(cityName);
    const city = KENYAN_LOCATIONS.find((c) => c.name === cityName);
    if (city) {
      setManualLocation({ latitude: city.lat, longitude: city.lng });
      onLocationSet?.();
    }
  };

  if (compact && location) {
    const nearestCity = KENYAN_LOCATIONS.reduce((closest, city) => {
      const dist = Math.abs(city.lat - location.latitude) + Math.abs(city.lng - location.longitude);
      const closestDist = Math.abs(closest.lat - location.latitude) + Math.abs(closest.lng - location.longitude);
      return dist < closestDist ? city : closest;
    }, KENYAN_LOCATIONS[0]);

    return (
      <button
        onClick={handleDetect}
        className="flex items-center gap-1 text-xs text-primary font-medium"
      >
        <MapPin className="w-3 h-3" />
        {isManual ? selectedCity || nearestCity.name : `Near ${nearestCity.name}`}
      </button>
    );
  }

  return (
    <div className="space-y-3">
      {/* GPS Detection */}
      <Button
        onClick={handleDetect}
        variant={location ? "secondary" : "default"}
        className="w-full rounded-xl h-11 gap-2"
        disabled={status === "requesting"}
      >
        {status === "requesting" ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Navigation className="w-4 h-4" />
        )}
        {status === "requesting"
          ? "Detecting location..."
          : location && !isManual
          ? "Location detected ✓"
          : "Use my current location"}
      </Button>

      {/* Error state */}
      {(status === "denied" || status === "error" || status === "unavailable") && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-xs">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">{error}</p>
            <p className="mt-1 text-muted-foreground">Select your location manually below</p>
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or select manually</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Manual city selection */}
      <Select value={selectedCity} onValueChange={handleManualSelect}>
        <SelectTrigger className="h-11 rounded-xl text-sm">
          <SelectValue placeholder="Choose your city" />
        </SelectTrigger>
        <SelectContent>
          {KENYAN_LOCATIONS.map((city) => (
            <SelectItem key={city.name} value={city.name}>
              <span className="flex items-center gap-2">
                <MapPin className="w-3 h-3 text-muted-foreground" />
                {city.name}, {city.county}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {location && (
        <p className="text-[11px] text-muted-foreground text-center">
          📍 Your location is only used to find nearby services and is never shared publicly.
        </p>
      )}
    </div>
  );
};

export default LocationPicker;
