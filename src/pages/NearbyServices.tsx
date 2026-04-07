import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLocation } from "@/contexts/LocationContext";
import { useCategories } from "@/hooks/useCategories";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft,
  MapPin,
  Star,
  Navigation,
  Loader2,
  SlidersHorizontal,
  X,
  ChevronDown,
  Map as MapIcon,
  User,
} from "lucide-react";
import LocationPicker from "@/components/LocationPicker";
import { ServiceCardSkeleton, ListSkeletons } from "@/components/Skeletons";

type NearbyResult = {
  service_id: string;
  title: string;
  description: string | null;
  price: number | null;
  price_type: string;
  city: string | null;
  county: string | null;
  latitude: number;
  longitude: number;
  category_id: string;
  category_name: string;
  category_icon: string | null;
  provider_id: string;
  business_name: string;
  is_verified: boolean;
  profile_image_url: string | null;
  avg_rating: number;
  review_count: number;
  distance_km: number;
};

const RADIUS_OPTIONS = [
  { value: "1", label: "1 km" },
  { value: "5", label: "5 km" },
  { value: "10", label: "10 km" },
  { value: "25", label: "25 km" },
  { value: "50", label: "50 km" },
  { value: "100", label: "100 km" },
];

const SORT_OPTIONS = [
  { value: "nearest", label: "Nearest first" },
  { value: "highest_rated", label: "Highest rated" },
  { value: "best_match", label: "Best match" },
];

const PAGE_SIZE = 15;

const priceLabel = (price: number | null, type: string) => {
  if (!price) return "Price on request";
  const formatted = `KSh ${price.toLocaleString()}`;
  if (type === "starting_from") return `From ${formatted}`;
  if (type === "negotiable") return `${formatted} (neg.)`;
  return formatted;
};

const formatDistance = (km: number) => {
  if (km < 0.1) return `${Math.round(km * 1000)}m`;
  if (km < 1) return `${(km * 1000).toFixed(0)}m`;
  if (km < 10) return `${km.toFixed(1)}km`;
  return `${Math.round(km)}km`;
};

const NearbyServices = () => {
  const navigate = useNavigate();
  const { location: userLocation, status: locationStatus } = useLocation();
  const { data: categories = [] } = useCategories();

  const [radius, setRadius] = useState("10");
  const [categoryId, setCategoryId] = useState("all");
  const [minRating, setMinRating] = useState(0);
  const [sortBy, setSortBy] = useState("nearest");
  const [showFilters, setShowFilters] = useState(false);

  const [results, setResults] = useState<NearbyResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchNearby = useCallback(
    async (pageNum: number, append = false) => {
      if (!userLocation) return;

      setLoading(true);

      const { data, error } = await supabase.rpc("nearby_services", {
        _lat: userLocation.latitude,
        _lng: userLocation.longitude,
        _radius_km: parseFloat(radius),
        _category_id: categoryId !== "all" ? categoryId : null,
        _min_rating: minRating,
        _limit_count: PAGE_SIZE,
        _offset_count: pageNum * PAGE_SIZE,
      });

      if (error) {
        console.error("Nearby services error:", error);
        setLoading(false);
        return;
      }

      let sorted = (data as NearbyResult[]) || [];

      // Client-side sort for non-distance sorts
      if (sortBy === "highest_rated") {
        sorted = [...sorted].sort((a, b) => b.avg_rating - a.avg_rating);
      } else if (sortBy === "best_match") {
        // Best match: weighted combo of distance and rating
        sorted = [...sorted].sort((a, b) => {
          const scoreA = (a.avg_rating || 0) * 2 - a.distance_km * 0.5;
          const scoreB = (b.avg_rating || 0) * 2 - b.distance_km * 0.5;
          return scoreB - scoreA;
        });
      }

      if (append) {
        setResults((prev) => [...prev, ...sorted]);
      } else {
        setResults(sorted);
      }
      setHasMore(sorted.length === PAGE_SIZE);
      setLoading(false);
    },
    [userLocation, radius, categoryId, minRating, sortBy]
  );

  // Re-fetch on filter change
  useEffect(() => {
    if (userLocation) {
      setPage(0);
      fetchNearby(0);
    }
  }, [fetchNearby, userLocation]);

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchNearby(next, true);
  };

  const activeFilterCount = [
    categoryId !== "all",
    minRating > 0,
    radius !== "10",
  ].filter(Boolean).length;

  const clearFilters = () => {
    setRadius("10");
    setCategoryId("all");
    setMinRating(0);
    setSortBy("nearest");
  };

  // No location yet
  if (!userLocation) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-20 bg-background border-b border-border px-4 py-3">
          <div className="max-w-lg mx-auto flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="text-muted-foreground">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-display text-lg font-bold text-foreground">Nearby Services</h1>
          </div>
        </div>
        <div className="px-4 py-8 max-w-lg mx-auto">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Navigation className="w-8 h-8 text-primary" />
            </div>
            <h2 className="font-display text-lg font-bold text-foreground mb-2">
              Enable Location
            </h2>
            <p className="text-sm text-muted-foreground">
              Share your location to discover services near you
            </p>
          </div>
          <LocationPicker />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background border-b border-border px-4 py-3">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <button onClick={() => navigate(-1)} className="text-muted-foreground">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="font-display text-lg font-bold text-foreground">Nearby Services</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-xl"
                onClick={() => navigate("/map")}
              >
                <MapIcon className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-xl relative"
                onClick={() => setShowFilters(!showFilters)}
              >
                <SlidersHorizontal className="w-4 h-4" />
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground rounded-full text-[10px] flex items-center justify-center font-bold">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </div>
          </div>

          {/* Radius quick-select */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {RADIUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRadius(opt.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${
                  radius === opt.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-border hover:bg-muted"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="bg-card border-b border-border px-4 py-4 animate-in slide-in-from-top-2">
          <div className="max-w-lg mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">Filters</span>
              <button onClick={clearFilters} className="text-xs text-primary font-medium">
                Clear all
              </button>
            </div>

            {/* Category */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="h-9 rounded-lg text-sm">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Min rating */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Minimum rating</label>
              <div className="flex gap-2">
                {[0, 3, 3.5, 4, 4.5].map((r) => (
                  <button
                    key={r}
                    onClick={() => setMinRating(r)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      minRating === r
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-foreground border-border"
                    }`}
                  >
                    {r === 0 ? "Any" : `${r}+`} {r > 0 && "★"}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Sort by</label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="h-9 rounded-lg text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={() => setShowFilters(false)} className="w-full rounded-xl h-10">
              Apply filters
            </Button>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="px-4 py-4">
        <div className="max-w-lg mx-auto">
          {/* Active filter chips */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {categoryId !== "all" && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  {categories.find((c) => c.id === categoryId)?.name}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setCategoryId("all")} />
                </Badge>
              )}
              {minRating > 0 && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  {minRating}+ ★
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setMinRating(0)} />
                </Badge>
              )}
              {radius !== "10" && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  Within {radius}km
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setRadius("10")} />
                </Badge>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground mb-3">
            {loading && page === 0
              ? "Finding nearby services..."
              : `${results.length} service${results.length !== 1 ? "s" : ""} within ${radius} km`}
          </p>

          {/* Service cards */}
          <div className="space-y-3">
            {results.map((svc) => (
              <Card
                key={svc.service_id}
                className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]"
                onClick={() => navigate(`/services/${svc.service_id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Provider image */}
                    <div className="w-11 h-11 rounded-xl overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                      {svc.profile_image_url ? (
                        <img
                          src={svc.profile_image_url}
                          alt={svc.business_name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <User className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-0.5">
                        <h3 className="font-semibold text-foreground text-sm leading-tight truncate">
                          {svc.title}
                        </h3>
                        <Badge
                          variant="secondary"
                          className="text-[10px] shrink-0 gap-0.5 bg-primary/10 text-primary font-bold"
                        >
                          <MapPin className="w-2.5 h-2.5" />
                          {formatDistance(svc.distance_km)}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs text-muted-foreground truncate">
                          {svc.business_name}
                        </span>
                        {svc.is_verified && (
                          <Badge
                            variant="secondary"
                            className="text-[9px] px-1 py-0 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                          >
                            ✓
                          </Badge>
                        )}
                      </div>

                      {svc.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mb-1.5">
                          {svc.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <span className="text-sm font-bold text-primary">
                          {priceLabel(svc.price, svc.price_type)}
                        </span>
                        <div className="flex items-center gap-2">
                          {svc.avg_rating > 0 && (
                            <span className="text-xs text-amber-600 flex items-center gap-0.5">
                              <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                              {svc.avg_rating.toFixed(1)}
                              <span className="text-muted-foreground">({svc.review_count})</span>
                            </span>
                          )}
                          <Badge variant="outline" className="text-[10px]">
                            {svc.category_icon} {svc.category_name}
                          </Badge>
                        </div>
                      </div>

                      {/* Quick book button */}
                      <Button
                        size="sm"
                        className="w-full mt-2 h-8 rounded-lg text-xs gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/book/${svc.service_id}`);
                        }}
                      >
                        <Calendar className="w-3 h-3" />
                        Book Now
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Loading */}
          {loading && page === 0 && (
            <ListSkeletons Component={ServiceCardSkeleton} count={4} />
          )}
          {loading && page > 0 && (
            <div className="flex justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          )}

          {/* Load more */}
          {!loading && hasMore && results.length > 0 && (
            <Button
              variant="outline"
              className="w-full mt-4 rounded-xl"
              onClick={handleLoadMore}
            >
              <ChevronDown className="w-4 h-4 mr-1" />
              Load more
            </Button>
          )}

          {/* Empty */}
          {!loading && results.length === 0 && (
            <div className="text-center py-12">
              <MapPin className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-foreground text-sm font-semibold">No services nearby</p>
              <p className="text-xs text-muted-foreground mt-1">
                Try increasing your search radius
              </p>
              <div className="flex gap-2 justify-center mt-4">
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setRadius("50")}
                >
                  Expand to 50km
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => navigate("/search")}
                >
                  Search all
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NearbyServices;
