import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { useLocation } from "@/contexts/LocationContext";
import { getDistanceKm } from "@/hooks/useGeolocation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, MapPin, Navigation, Star, User } from "lucide-react";
import LocationPicker from "@/components/LocationPicker";

delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

type Coordinates = {
  latitude: number;
  longitude: number;
};

type MapCenter = {
  lat: number;
  lng: number;
};

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
  const borderColor = isVerified ? "hsl(var(--accent))" : "hsl(var(--primary))";
  const fallbackAvatar = "<div style=\"display:none;width:100%;height:100%;border-radius:999px;background:hsl(var(--muted));align-items:center;justify-content:center;color:hsl(var(--primary));font:600 12px system-ui,sans-serif;\">P</div>";
  const avatar = imageUrl
    ? `<img src="${imageUrl}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:999px;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />${fallbackAvatar}`
    : `<div style="display:flex;width:100%;height:100%;border-radius:999px;background:hsl(var(--muted));align-items:center;justify-content:center;color:hsl(var(--primary));"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>`;

  return L.divIcon({
    className: "custom-map-marker",
    html: `
      <div style="width:42px;height:42px;border-radius:999px;border:3px solid ${borderColor};background:hsl(var(--background));overflow:hidden;box-shadow:0 10px 24px rgba(0,0,0,0.18);display:flex;align-items:center;justify-content:center;">
        ${avatar}
      </div>
      <div style="width:12px;height:12px;background:${borderColor};transform:rotate(45deg);margin:-8px auto 0;border-radius:0 0 2px 0;box-shadow:2px 2px 4px rgba(0,0,0,0.15);"></div>
    `,
    iconSize: [42, 54],
    iconAnchor: [21, 54],
    popupAnchor: [0, -54],
  });
};

const userIcon = L.divIcon({
  className: "user-location-marker",
  html: `
    <div style="width:20px;height:20px;border-radius:999px;background:hsl(var(--primary));border:3px solid hsl(var(--background));box-shadow:0 0 0 2px hsl(var(--primary)),0 2px 8px rgba(0,0,0,0.3);"></div>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

type ServiceMapViewportProps = {
  center: MapCenter;
  providers: MapProvider[];
  userLocation: Coordinates | null;
  onSelectProvider: (provider: MapProvider) => void;
};

const ServiceMapViewport = ({ center, providers, userLocation, onSelectProvider }: ServiceMapViewportProps) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const providerLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || mapRef.current) return;

    if ("_leaflet_id" in container) {
      delete (container as HTMLDivElement & { _leaflet_id?: number })._leaflet_id;
    }

    const map = L.map(container, {
      attributionControl: false,
      zoomControl: false,
    });

    mapRef.current = map;
    providerLayerRef.current = L.layerGroup().addTo(map);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    map.setView([center.lat, center.lng], userLocation ? 13 : 7);

    return () => {
      providerLayerRef.current?.clearLayers();
      providerLayerRef.current = null;
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const target: L.LatLngExpression = [center.lat, center.lng];

    if (userLocation) {
      map.flyTo(target, 13, { duration: 1.2 });
      return;
    }

    map.setView(target, 7);
  }, [center, userLocation]);

  useEffect(() => {
    const map = mapRef.current;
    const providerLayer = providerLayerRef.current;

    if (!map || !providerLayer) return;

    providerLayer.clearLayers();

    providers.forEach((provider) => {
      const marker = L.marker([provider.latitude, provider.longitude], {
        icon: createProviderIcon(provider.profile_image_url, provider.is_verified),
      });

      marker.on("click", () => onSelectProvider(provider));
      marker.addTo(providerLayer);
    });

    userMarkerRef.current?.remove();
    userMarkerRef.current = null;

    if (userLocation) {
      userMarkerRef.current = L.marker([userLocation.latitude, userLocation.longitude], {
        icon: userIcon,
      }).addTo(map);
    }
  }, [onSelectProvider, providers, userLocation]);

  return <div ref={mapContainerRef} className="h-full w-full" aria-label="Service provider map" />;
};

const ServiceMap = () => {
  const navigate = useNavigate();
  const { location: userLocation } = useLocation();
  const [providers, setProviders] = useState<MapProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<MapProvider | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const center = useMemo<MapCenter>(() => {
    if (userLocation) {
      return {
        lat: userLocation.latitude,
        lng: userLocation.longitude,
      };
    }

    return { lat: -1.2921, lng: 36.8219 };
  }, [userLocation]);

  useEffect(() => {
    const fetchProviders = async () => {
      setLoading(true);

      const { data: providerProfiles, error: providerError } = await supabase
        .rpc("public_provider_map_points");

      if (providerError || !providerProfiles?.length) {
        setProviders([]);
        setLoading(false);
        return;
      }

      const providerIds = providerProfiles.map((provider) => provider.user_id);

      const [{ data: reviewData }, { data: serviceData }] = await Promise.all([
        supabase.from("reviews").select("provider_id,rating").in("provider_id", providerIds),
        supabase
          .from("services")
          .select("provider_id,category_id")
          .eq("is_active", true)
          .in("provider_id", providerIds),
      ]);

      const categoryIds = [...new Set((serviceData || []).map((service) => service.category_id))];
      const { data: categoryData } = categoryIds.length
        ? await supabase.from("service_categories").select("id,name").in("id", categoryIds)
        : { data: [] as { id: string; name: string }[] };

      const ratingMap = new Map<string, { total: number; count: number }>();
      (reviewData || []).forEach((review) => {
        const current = ratingMap.get(review.provider_id) || { total: 0, count: 0 };
        current.total += review.rating;
        current.count += 1;
        ratingMap.set(review.provider_id, current);
      });

      const categoryMap = new Map((categoryData || []).map((category) => [category.id, category.name]));
      const providerCategoryMap = new Map<string, string[]>();

      (serviceData || []).forEach((service) => {
        const currentCategories = providerCategoryMap.get(service.provider_id) || [];
        const categoryName = categoryMap.get(service.category_id);

        if (categoryName && !currentCategories.includes(categoryName)) {
          currentCategories.push(categoryName);
        }

        providerCategoryMap.set(service.provider_id, currentCategories);
      });

      const mappedProviders: MapProvider[] = providerProfiles
        .filter((provider) => provider.latitude != null && provider.longitude != null)
        .map((provider) => {
          const ratings = ratingMap.get(provider.user_id);
          const distance = userLocation
            ? getDistanceKm(
                userLocation.latitude,
                userLocation.longitude,
                provider.latitude as number,
                provider.longitude as number,
              )
            : 0;

          return {
            user_id: provider.user_id,
            business_name: provider.business_name,
            city: provider.city,
            county: provider.county,
            latitude: provider.latitude as number,
            longitude: provider.longitude as number,
            is_verified: provider.is_verified,
            profile_image_url: provider.profile_image_url,
            avg_rating: ratings ? ratings.total / ratings.count : null,
            review_count: ratings?.count || 0,
            distance,
            categories: providerCategoryMap.get(provider.user_id) || [],
          };
        })
        .sort((left, right) => left.distance - right.distance);

      setProviders(mappedProviders);
      setLoading(false);
    };

    void fetchProviders();
  }, [userLocation]);

  return (
    <div className="h-screen flex flex-col bg-background">
      <div className="sticky top-0 z-[1000] bg-background border-b border-border px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="text-muted-foreground" type="button">
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
              onClick={() => setShowLocationPicker((open) => !open)}
            >
              <Navigation className="w-3 h-3" />
              {userLocation ? "Update" : "Set Location"}
            </Button>
          </div>
        </div>
      </div>

      {showLocationPicker && (
        <div className="z-[999] bg-card border-b border-border px-4 py-4 animate-in slide-in-from-top-2">
          <div className="max-w-lg mx-auto">
            <LocationPicker onLocationSet={() => setShowLocationPicker(false)} />
          </div>
        </div>
      )}

      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 z-[500] bg-background/50 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        <ServiceMapViewport
          center={center}
          providers={providers}
          userLocation={userLocation}
          onSelectProvider={setSelectedProvider}
        />

        <div className="absolute top-3 left-3 z-[500]">
          <Badge className="bg-background text-foreground shadow-md border border-border text-xs gap-1">
            <MapPin className="w-3 h-3 text-primary" />
            {providers.length} provider{providers.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        {selectedProvider && (
          <div className="absolute bottom-4 left-4 right-4 z-[500] animate-in slide-in-from-bottom-4">
            <Card className="shadow-xl border-0 rounded-2xl overflow-hidden max-w-lg mx-auto">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                    {selectedProvider.profile_image_url ? (
                      <img
                        src={selectedProvider.profile_image_url}
                        alt={selectedProvider.business_name}
                        className="w-full h-full object-cover"
                        onError={(event) => {
                          (event.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <User className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-bold text-sm text-foreground truncate">
                        {selectedProvider.business_name}
                      </h3>

                      {selectedProvider.is_verified && (
                        <Badge variant="secondary" className="text-[9px] shrink-0">
                          Verified
                        </Badge>
                      )}
                    </div>

                    {selectedProvider.categories.length > 0 && (
                      <p className="text-[11px] text-muted-foreground truncate mb-1">
                        {selectedProvider.categories.slice(0, 2).join(" · ")}
                      </p>
                    )}

                    <div className="flex items-center gap-3 mb-2">
                      {selectedProvider.avg_rating !== null && (
                        <span className="text-xs flex items-center gap-0.5 text-foreground">
                          <Star className="w-3 h-3 fill-primary text-primary" />
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
