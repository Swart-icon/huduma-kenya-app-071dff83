import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, Search, MapPin, Star, SlidersHorizontal, X, ChevronDown, Loader2, Navigation } from "lucide-react";
import { useCategories } from "@/hooks/useCategories";
import { ServiceCardSkeleton, ListSkeletons } from "@/components/Skeletons";
import { useLocation } from "@/contexts/LocationContext";
import { getDistanceKm } from "@/hooks/useGeolocation";
import LocationPicker from "@/components/LocationPicker";

type Service = {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  price_type: string;
  city: string | null;
  county: string | null;
  provider_id: string;
  category_id: string;
  created_at: string;
};

type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
};

type ProviderInfo = {
  user_id: string;
  business_name: string;
  is_verified: boolean | null;
  city: string | null;
  county: string | null;
};

type ReviewAgg = {
  provider_id: string;
  avg_rating: number;
  count: number;
};

const PAGE_SIZE = 10;

const priceLabel = (price: number | null, type: string) => {
  if (!price) return "Price on request";
  const formatted = `KSh ${price.toLocaleString()}`;
  if (type === "starting_from") return `From ${formatted}`;
  if (type === "negotiable") return `${formatted} (neg.)`;
  return formatted;
};

const SearchServices = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { location: userLocation, status: locationStatus } = useLocation();

  // State
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [categoryId, setCategoryId] = useState(searchParams.get("category") || "all");
  const [county, setCounty] = useState(searchParams.get("county") || "all");
  const [sortBy, setSortBy] = useState(searchParams.get("sort") || "newest");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 100000]);
  const [minRating, setMinRating] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const { data: categories = [] } = useCategories();
  const [counties, setCounties] = useState<string[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [providers, setProviders] = useState<Map<string, ProviderInfo>>(new Map());
  const [reviewAggs, setReviewAggs] = useState<Map<string, ReviewAgg>>(new Map());
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalHint, setTotalHint] = useState(0);

  // Load counties once
  useEffect(() => {
    supabase.from("services").select("county").neq("county", null).then(({ data }) => {
      const unique = [...new Set((data || []).map((d) => d.county).filter(Boolean))] as string[];
      setCounties(unique.sort());
    });
  }, []);

  // Fetch services
  const fetchServices = useCallback(async (pageNum: number, append = false) => {
    setLoading(true);

    let q = supabase
      .from("services")
      .select("*,latitude,longitude", { count: "exact" })
      .eq("is_active", true);

    // Keyword search
    if (query.trim()) {
      q = q.or(`title.ilike.%${query.trim()}%,description.ilike.%${query.trim()}%`);
    }

    // Category filter
    if (categoryId && categoryId !== "all") {
      q = q.eq("category_id", categoryId);
    }

    // County filter
    if (county && county !== "all") {
      q = q.eq("county", county);
    }

    // Price filter
    if (priceRange[0] > 0) {
      q = q.gte("price", priceRange[0]);
    }
    if (priceRange[1] < 100000) {
      q = q.lte("price", priceRange[1]);
    }

    // Sorting
    if (sortBy === "price_low") {
      q = q.order("price", { ascending: true, nullsFirst: false });
    } else if (sortBy === "price_high") {
      q = q.order("price", { ascending: false, nullsFirst: false });
    } else {
      q = q.order("created_at", { ascending: false });
    }

    // Pagination
    const from = pageNum * PAGE_SIZE;
    q = q.range(from, from + PAGE_SIZE - 1);

    const { data, count } = await q;
    const results = data || [];

    if (append) {
      setServices((prev) => [...prev, ...results]);
    } else {
      setServices(results);
    }

    setTotalHint(count || 0);
    setHasMore(results.length === PAGE_SIZE);
    setLoading(false);

    // Fetch provider info for these services
    const providerIds = [...new Set(results.map((s) => s.provider_id))];
    if (providerIds.length > 0) {
      const { data: provData } = await supabase
        .from("provider_profiles")
        .select("user_id,business_name,is_verified,city,county")
        .in("user_id", providerIds);

      if (provData) {
        setProviders((prev) => {
          const next = new Map(prev);
          provData.forEach((p) => next.set(p.user_id, p));
          return next;
        });
      }

      // Fetch review aggregates
      const { data: revData } = await supabase
        .from("reviews")
        .select("provider_id,rating")
        .in("provider_id", providerIds);

      if (revData) {
        const aggs = new Map<string, { total: number; count: number }>();
        revData.forEach((r) => {
          const existing = aggs.get(r.provider_id) || { total: 0, count: 0 };
          existing.total += r.rating;
          existing.count += 1;
          aggs.set(r.provider_id, existing);
        });
        setReviewAggs((prev) => {
          const next = new Map(prev);
          aggs.forEach((v, k) => next.set(k, { provider_id: k, avg_rating: v.total / v.count, count: v.count }));
          return next;
        });
      }
    }
  }, [query, categoryId, county, sortBy, priceRange, minRating]);

  // Search on filter change
  useEffect(() => {
    setPage(0);
    fetchServices(0);
  }, [fetchServices]);

  // Update URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (categoryId !== "all") params.set("category", categoryId);
    if (county !== "all") params.set("county", county);
    if (sortBy !== "newest") params.set("sort", sortBy);
    setSearchParams(params, { replace: true });
  }, [query, categoryId, county, sortBy]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchServices(nextPage, true);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchServices(0);
  };

  const clearFilters = () => {
    setQuery("");
    setCategoryId("all");
    setCounty("all");
    setSortBy("newest");
    setPriceRange([0, 100000]);
    setMinRating(0);
  };

  const activeFilterCount = [
    categoryId !== "all",
    county !== "all",
    priceRange[0] > 0 || priceRange[1] < 100000,
    minRating > 0,
  ].filter(Boolean).length;

  // Filter by rating client-side & sort by distance if nearby
  const filteredServices = (() => {
    let result = minRating > 0
      ? services.filter((s) => {
          const agg = reviewAggs.get(s.provider_id);
          return agg && agg.avg_rating >= minRating;
        })
      : services;

    if (sortBy === "nearby" && userLocation) {
      result = [...result].sort((a, b) => {
        const distA = (a as any).latitude && (a as any).longitude
          ? getDistanceKm(userLocation.latitude, userLocation.longitude, (a as any).latitude, (a as any).longitude)
          : Infinity;
        const distB = (b as any).latitude && (b as any).longitude
          ? getDistanceKm(userLocation.latitude, userLocation.longitude, (b as any).latitude, (b as any).longitude)
          : Infinity;
        return distA - distB;
      });
    }
    return result;
  })();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background border-b border-border px-4 py-3">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-2 mb-3">
            <button onClick={() => navigate(-1)} className="text-muted-foreground">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-display text-lg font-bold text-foreground">Search Services</h1>
          </div>

          {/* Category selection first */}
          <div className="mb-3">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Select a category to search *</label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="h-10 rounded-xl text-sm">
                <SelectValue placeholder="Choose a category first" />
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

          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={categoryId !== "all" ? "Search within category..." : "Select a category first..."}
                className="h-10 rounded-xl pl-9 text-sm"
                disabled={categoryId === "all"}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-xl relative"
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal className="w-4 h-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground rounded-full text-[10px] flex items-center justify-center font-bold">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </form>
        </div>
      </div>

      {/* Filter panel */}
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

            {/* County */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Location</label>
              <Select value={county} onValueChange={setCounty}>
                <SelectTrigger className="h-9 rounded-lg text-sm">
                  <SelectValue placeholder="All locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All locations</SelectItem>
                  {counties.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Price range */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">
                Price range: KSh {priceRange[0].toLocaleString()} — {priceRange[1] >= 100000 ? "100k+" : `KSh ${priceRange[1].toLocaleString()}`}
              </label>
              <Slider
                value={priceRange}
                onValueChange={(v) => setPriceRange(v as [number, number])}
                min={0}
                max={100000}
                step={1000}
                className="mt-1"
              />
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
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="price_low">Lowest price</SelectItem>
                  <SelectItem value="price_high">Highest price</SelectItem>
                  <SelectItem value="top_rated">Top rated</SelectItem>
                  {userLocation && <SelectItem value="nearby">Nearest first</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            {/* Location for nearby */}
            {!userLocation && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block flex items-center gap-1">
                  <Navigation className="w-3 h-3" /> Your Location (for nearby sort)
                </label>
                <LocationPicker compact={false} />
              </div>
            )}

            <Button onClick={() => setShowFilters(false)} className="w-full rounded-xl h-10">
              Show results ({totalHint})
            </Button>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="px-4 py-4">
        <div className="max-w-lg mx-auto">
          {/* Active filters as chips */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {categoryId !== "all" && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  {categories.find((c) => c.id === categoryId)?.name}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setCategoryId("all")} />
                </Badge>
              )}
              {county !== "all" && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  {county}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setCounty("all")} />
                </Badge>
              )}
              {minRating > 0 && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  {minRating}+ ★
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setMinRating(0)} />
                </Badge>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground mb-3">
            {loading && page === 0 ? "Searching..." : `${totalHint} service${totalHint !== 1 ? "s" : ""} found`}
          </p>

          {/* Service cards */}
          <div className="space-y-3">
            {filteredServices.map((svc) => {
              const provider = providers.get(svc.provider_id);
              const review = reviewAggs.get(svc.provider_id);
              const cat = categories.find((c) => c.id === svc.category_id);

              return (
                <Card
                  key={svc.id}
                  className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]"
                  onClick={() => navigate(`/services/${svc.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-semibold text-foreground text-sm leading-tight">{svc.title}</h3>
                      {provider?.is_verified && (
                        <Badge variant="secondary" className="text-[10px] shrink-0 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                          Verified ✓
                        </Badge>
                      )}
                    </div>

                    {provider && (
                      <p className="text-xs text-muted-foreground mb-1">{provider.business_name}</p>
                    )}

                    {svc.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{svc.description}</p>
                    )}

                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <span className="text-sm font-bold text-primary">
                        {priceLabel(svc.price, svc.price_type)}
                      </span>

                      <div className="flex items-center gap-2">
                        {sortBy === "nearby" && userLocation && (svc as any).latitude && (svc as any).longitude && (
                          <Badge variant="secondary" className="text-[10px]">
                            {(() => {
                              const d = getDistanceKm(userLocation.latitude, userLocation.longitude, (svc as any).latitude, (svc as any).longitude);
                              return d < 1 ? `${Math.round(d * 1000)}m` : `${d.toFixed(1)}km`;
                            })()}
                          </Badge>
                        )}
                        {review && (
                          <span className="text-xs text-amber-600 flex items-center gap-0.5">
                            <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                            {review.avg_rating.toFixed(1)} ({review.count})
                          </span>
                        )}
                        {(svc.city || svc.county) && (
                          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                            <MapPin className="w-3 h-3" />
                            {[svc.city, svc.county].filter(Boolean).join(", ")}
                          </span>
                        )}
                      </div>
                    </div>

                    {cat && (
                      <div className="mt-2">
                        <Badge variant="outline" className="text-[10px]">
                          {cat.icon} {cat.name}
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Empty state */}
          {!loading && filteredServices.length === 0 && (
            <div className="text-center py-12">
              <Search className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No services found</p>
              <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters</p>
              <Button variant="outline" className="mt-4 rounded-xl" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          )}

          {/* Loading / Load more */}
          {loading && page === 0 && (
            <ListSkeletons Component={ServiceCardSkeleton} count={4} />
          )}

          {loading && page > 0 && (
            <div className="flex justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          )}

          {!loading && hasMore && filteredServices.length > 0 && (
            <Button
              variant="outline"
              className="w-full mt-4 rounded-xl"
              onClick={handleLoadMore}
            >
              <ChevronDown className="w-4 h-4 mr-1" />
              Load more
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchServices;
