import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLocation } from "@/contexts/LocationContext";
import { getDistanceKm } from "@/hooks/useGeolocation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Star, Navigation, ChevronRight } from "lucide-react";
import LocationPicker from "./LocationPicker";

type NearbyService = {
  id: string;
  title: string;
  price: number | null;
  price_type: string;
  city: string | null;
  county: string | null;
  latitude: number | null;
  longitude: number | null;
  provider_id: string;
  distance?: number;
};

const NearbyServicesSection = () => {
  const navigate = useNavigate();
  const { location, status } = useLocation();
  const [services, setServices] = useState<NearbyService[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    if (!location) return;

    const fetchNearby = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("services")
        .select("id,title,price,price_type,city,county,latitude,longitude,provider_id")
        .eq("is_active", true)
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .limit(20);

      if (data) {
        const withDistance = data
          .map((s) => ({
            ...s,
            distance: s.latitude && s.longitude
              ? getDistanceKm(location.latitude, location.longitude, s.latitude, s.longitude)
              : Infinity,
          }))
          .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
          .slice(0, 6);
        setServices(withDistance);
      }
      setLoading(false);
    };

    fetchNearby();
  }, [location]);

  if (status === "idle" && !showPicker) {
    return (
      <div className="px-4 py-4">
        <div className="max-w-lg mx-auto">
          <Button
            variant="outline"
            className="w-full rounded-xl h-12 gap-2 border-dashed"
            onClick={setShowPicker.bind(null, true)}
          >
            <Navigation className="w-4 h-4 text-primary" />
            <span className="text-sm">Enable location for nearby services</span>
          </Button>
        </div>
      </div>
    );
  }

  if (showPicker && !location) {
    return (
      <div className="px-4 py-4">
        <div className="max-w-lg mx-auto">
          <h2 className="font-display text-base font-bold text-foreground mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            Find Nearby Services
          </h2>
          <LocationPicker onLocationSet={() => setShowPicker(false)} />
        </div>
      </div>
    );
  }

  if (!location || services.length === 0) return null;

  return (
    <div className="px-4 py-4">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-base font-bold text-foreground flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            Nearby Services
          </h2>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-primary gap-1"
            onClick={() => navigate("/search?sort=nearby")}
          >
            See all <ChevronRight className="w-3 h-3" />
          </Button>
        </div>

        <div className="space-y-2">
          {services.map((svc) => (
            <Card
              key={svc.id}
              className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]"
              onClick={() => navigate(`/services/${svc.id}`)}
            >
              <CardContent className="p-3 flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-foreground truncate">{svc.title}</h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" />
                    {[svc.city, svc.county].filter(Boolean).join(", ")}
                  </p>
                </div>
                {svc.distance !== undefined && svc.distance !== Infinity && (
                  <Badge variant="secondary" className="text-[10px] shrink-0 ml-2">
                    {svc.distance < 1
                      ? `${Math.round(svc.distance * 1000)}m`
                      : `${svc.distance.toFixed(1)}km`}
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NearbyServicesSection;
