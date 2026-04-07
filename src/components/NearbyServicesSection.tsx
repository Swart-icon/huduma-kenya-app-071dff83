import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLocation } from "@/contexts/LocationContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, ChevronRight, Star, User } from "lucide-react";
import LocationPicker from "./LocationPicker";

type NearbyResult = {
  service_id: string;
  title: string;
  price: number | null;
  price_type: string;
  city: string | null;
  county: string | null;
  business_name: string;
  is_verified: boolean;
  profile_image_url: string | null;
  avg_rating: number;
  review_count: number;
  distance_km: number;
  category_name: string;
  category_icon: string | null;
};

const formatDistance = (km: number) => {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  if (km < 10) return `${km.toFixed(1)}km`;
  return `${Math.round(km)}km`;
};

const NearbyServicesSection = () => {
  const navigate = useNavigate();
  const { location, status } = useLocation();
  const [services, setServices] = useState<NearbyResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    if (!location) return;

    const fetchNearby = async () => {
      setLoading(true);
      const { data } = await supabase.rpc("nearby_services", {
        _lat: location.latitude,
        _lng: location.longitude,
        _radius_km: 25,
        _limit_count: 5,
        _offset_count: 0,
      });
      setServices((data as NearbyResult[]) || []);
      setLoading(false);
    };

    fetchNearby();
  }, [location]);

  if (status === "idle" && !showPicker) {
    return (
      <div className="mb-4">
        <Button
          variant="outline"
          className="w-full rounded-xl h-12 gap-2 border-dashed"
          onClick={() => setShowPicker(true)}
        >
          <Navigation className="w-4 h-4 text-primary" />
          <span className="text-sm">Enable location for nearby services</span>
        </Button>
      </div>
    );
  }

  if (showPicker && !location) {
    return (
      <div className="mb-4">
        <h2 className="font-display text-base font-bold text-foreground mb-3 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          Find Nearby Services
        </h2>
        <LocationPicker onLocationSet={() => setShowPicker(false)} />
      </div>
    );
  }

  if (!location || (services.length === 0 && !loading)) return null;

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          Nearby
        </h2>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-primary gap-1 h-7"
          onClick={() => navigate("/nearby")}
        >
          See all <ChevronRight className="w-3 h-3" />
        </Button>
      </div>

      <div className="space-y-2">
        {services.map((svc) => (
          <Card
            key={svc.service_id}
            className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]"
            onClick={() => navigate(`/services/${svc.service_id}`)}
          >
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                {svc.profile_image_url ? (
                  <img src={svc.profile_image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <User className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-foreground truncate">{svc.title}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-muted-foreground truncate">{svc.business_name}</span>
                  {svc.avg_rating > 0 && (
                    <span className="text-[11px] text-amber-600 flex items-center gap-0.5 shrink-0">
                      <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                      {svc.avg_rating.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
              <Badge variant="secondary" className="text-[10px] shrink-0 gap-0.5">
                <MapPin className="w-2.5 h-2.5" />
                {formatDistance(svc.distance_km)}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default NearbyServicesSection;
