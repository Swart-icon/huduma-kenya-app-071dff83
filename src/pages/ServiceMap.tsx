import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { useLocation } from "@/contexts/LocationContext";
import { getDistanceKm } from "@/hooks/useGeolocation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, Star, Navigation, Loader2, User } from "lucide-react";
import LocationPicker from "@/components/LocationPicker";

// Fix default marker icons in Leaflet + bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

type MapProvider = {
  user_id: string;
  business_name: string;
  city: string | null;
  county: string | null;
  latitude: number;
  longitude: number;
  is_verified: boolean | null;
  profile_image_url: string | null;
  avg_rating: number | null;
  review_count: number;
  distance: number;
  categories: string[];
};

const createProviderIcon = (imageUrl: string | null, isVerified: boolean | null) => {
  const border = isVerified ? "#22c55e" : "hsl(var(--primary))";
  const img = imageUrl
    ? `<img src="${imageUrl}" class="w-full h-full object-cover rounded-full" onerror="this.style.display='none';this.nextSibling.style.display='flex'" /><div style="display:none" class="w-full h-full rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">P</div>`
    : `<div class="w-full h-full rounded-full bg-primary/20 flex items-center justify-center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-primary"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>`;

  return L.divIcon({
    className: "custom-map-marker",
    html: `
      <div style="width:42px;height:42px;border-radius:50%;border:3px solid ${border};background:white;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;">
        ${img}
      </div>
      <div style="width:12px;height:12px;background:${border};transform:rotate(45deg);margin:-8px auto 0;border-radius:0 0 2px 0;box-shadow:2px 2px 4px rgba(0,0,0,0.15);"></div>
    `,
    iconSize: [42, 54],
    iconAnchor: [21, 54],
    popupAnchor: [0, -54],
  });
};

const userIcon = L.divIcon({
  className: "user-location-marker",
  html: `
    <div style="width:20px;height:20px;border-radius:50%;background:hsl(var(--primary));border:3px solid white;box-shadow:0 0 0 2px hsl(var(--primary)),0 2px 8px rgba(0,0,0,0.3);"></div>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

/** Moves map to user location */
const FlyToUser = ({ lat, lng }: { lat: number; lng: number }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], 13, { duration: 1.2 });
  }, [lat, lng, map]);
  return null;
};

// react-leaflet v4 for React 18 compat
const ServiceMap = () => {
  const navigate = useNavigate();
  const { location: userLocation, status: locationStatus } = useLocation();
  const [providers, setProviders] = useState<MapProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<MapProvider | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  // Default center: Nairobi
  const center = useMemo(() => {
    if (userLocation) return { lat: userLocation.latitude, lng: userLocation.longitude };
    return { lat: -1.2921, lng: 36.8219 };
  }, [userLocation]);

  useEffect(() => {
    const fetchProviders = async () => {
      setLoading(true);

      const { data: provData } = await supabase
        .from("provider_profiles")
        .select("user_id,business_name,city,county,latitude,longitude,is_verified,profile_image_url")
        .not("latitude", "is", null)
        .not("longitude", "is", null);

      if (!provData || provData.length === 0) {
        setProviders([]);
        setLoading(false);
        return;
      }

      // Fetch reviews for ratings
      const providerIds = provData.map((p) => p.user_id);
      const { data: reviewData } = await supabase
        .from("reviews")
        .select("provider_id,rating")
        .in("provider_id", providerIds);

      const ratingMap = new Map<string, { total: number; count: number }>();
      (reviewData || []).forEach((r) => {
        const e = ratingMap.get(r.provider_id) || { total: 0, count: 0 };
        e.total += r.rating;
        e.count += 1;
        ratingMap.set(r.provider_id, e);
      });

      // Fetch service categories per provider
      const { data: svcData } = await supabase
        .from("services")
        .select("provider_id,category_id")
        .eq("is_active", true)
        .in("provider_id", providerIds);

      const catIds = [...new Set((svcData || []).map((s) => s.category_id))];
      const { data: catData } = await supabase
        .from("service_categories")
        .select("id,name")
        .in("id", catIds);

      const catMap = new Map((catData || []).map((c) => [c.id, c.name]));
      const provCatMap = new Map<string, string[]>();
      (svcData || []).forEach((s) => {
        const cats = provCatMap.get(s.provider_id) || [];
        const catName = catMap.get(s.category_id);
        if (catName && !cats.includes(catName)) cats.push(catName);
        provCatMap.set(s.provider_id, cats);
      });

      const mapped: MapProvider[] = provData
        .filter((p) => p.latitude != null && p.longitude != null)
        .map((p) => {
          const rating = ratingMap.get(p.user_id);
          const distance = userLocation
            ? getDistanceKm(userLocation.latitude, userLocation.longitude, p.latitude!, p.longitude!)
            : 0;

          return {
            user_id: p.user_id,
            business_name: p.business_name,
            city: p.city,
            county: p.county,
            latitude: p.latitude!,
            longitude: p.longitude!,
            is_verified: p.is_verified,
            profile_image_url: p.profile_image_url,
            avg_rating: rating ? rating.total / rating.count : null,
            review_count: rating?.count || 0,
            distance,
            categories: provCatMap.get(p.user_id) || [],
          };
        })
        .sort((a, b) => a.distance - b.distance);

      setProviders(mapped);
      setLoading(false);
    };

    fetchProviders();
  }, [userLocation]);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="sticky top-0 z-[1000] bg-background border-b border-border px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="text-muted-foreground">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-display text-lg font-bold text-foreground">Service Map</h1>
          </div>
          <div className="flex items-center gap-2">
            {userLocation && (
              <Badge variant="secondary" className="text-[10px] gap-1">
                <MapPin className="w-3 h-3" />
                Located
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-lg text-xs gap-1"
              onClick={() => setShowLocationPicker(!showLocationPicker)}
            >
              <Navigation className="w-3 h-3" />
              {userLocation ? "Update" : "Set Location"}
            </Button>
          </div>
        </div>
      </div>

      {/* Location picker dropdown */}
      {showLocationPicker && (
        <div className="z-[999] bg-card border-b border-border px-4 py-4 animate-in slide-in-from-top-2">
          <div className="max-w-lg mx-auto">
            <LocationPicker onLocationSet={() => setShowLocationPicker(false)} />
          </div>
        </div>
      )}

      {/* Map */}
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 z-[500] bg-background/50 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        <MapContainer
          center={[center.lat, center.lng]}
          zoom={userLocation ? 13 : 7}
          className="h-full w-full"
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />

          {userLocation && (
            <>
              <FlyToUser lat={userLocation.latitude} lng={userLocation.longitude} />
              <Marker
                position={[userLocation.latitude, userLocation.longitude]}
                icon={userIcon}
              />
            </>
          )}

          {providers.map((provider) => (
            <Marker
              key={provider.user_id}
              position={[provider.latitude, provider.longitude]}
              icon={createProviderIcon(provider.profile_image_url, provider.is_verified)}
              eventHandlers={{
                click: () => setSelectedProvider(provider),
              }}
            />
          ))}
        </MapContainer>

        {/* Provider count badge */}
        <div className="absolute top-3 left-3 z-[500]">
          <Badge className="bg-background text-foreground shadow-md border border-border text-xs gap-1">
            <MapPin className="w-3 h-3 text-primary" />
            {providers.length} provider{providers.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        {/* Selected provider card */}
        {selectedProvider && (
          <div className="absolute bottom-4 left-4 right-4 z-[500] animate-in slide-in-from-bottom-4">
            <Card className="shadow-xl border-0 rounded-2xl overflow-hidden max-w-lg mx-auto">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                    {selectedProvider.profile_image_url ? (
                      <img
                        src={selectedProvider.profile_image_url}
                        alt={selectedProvider.business_name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <User className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-bold text-sm text-foreground truncate">
                        {selectedProvider.business_name}
                      </h3>
                      {selectedProvider.is_verified && (
                        <Badge variant="secondary" className="text-[9px] bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 shrink-0">
                          Verified ✓
                        </Badge>
                      )}
                    </div>

                    {/* Categories */}
                    {selectedProvider.categories.length > 0 && (
                      <p className="text-[11px] text-muted-foreground truncate mb-1">
                        {selectedProvider.categories.slice(0, 2).join(" · ")}
                      </p>
                    )}

                    <div className="flex items-center gap-3 mb-2">
                      {selectedProvider.avg_rating !== null && (
                        <span className="text-xs flex items-center gap-0.5 text-amber-600">
                          <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                          {selectedProvider.avg_rating.toFixed(1)}
                          <span className="text-muted-foreground">({selectedProvider.review_count})</span>
                        </span>
                      )}
                      {selectedProvider.distance > 0 && (
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          <MapPin className="w-3 h-3" />
                          {selectedProvider.distance < 1
                            ? `${Math.round(selectedProvider.distance * 1000)}m`
                            : `${selectedProvider.distance.toFixed(1)}km`}
                        </span>
                      )}
                      {(selectedProvider.city || selectedProvider.county) && (
                        <span className="text-xs text-muted-foreground truncate">
                          {[selectedProvider.city, selectedProvider.county].filter(Boolean).join(", ")}
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="h-8 rounded-lg text-xs flex-1"
                        onClick={() => navigate(`/provider/${selectedProvider.user_id}`)}
                      >
                        View Profile
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-lg text-xs"
                        onClick={() => setSelectedProvider(null)}
                      >
                        Close
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Empty state */}
        {!loading && providers.length === 0 && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center pointer-events-none">
            <Card className="shadow-lg rounded-2xl pointer-events-auto">
              <CardContent className="p-6 text-center">
                <MapPin className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-semibold text-foreground mb-1">No providers on map yet</p>
                <p className="text-xs text-muted-foreground">
                  Providers will appear here once they add their location
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default ServiceMap;
