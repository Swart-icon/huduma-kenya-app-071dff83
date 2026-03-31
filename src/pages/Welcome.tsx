import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  Search,
  Shield,
  Star,
  MapPin,
  Users,
  CheckCircle,
  ArrowRight,
  Briefcase,
  ChevronRight,
  BadgeCheck,
} from "lucide-react";
import { getCategoryIcon } from "@/lib/categoryIcons";
import heroImage from "@/assets/hero-services.jpg";

type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  sort_order: number;
};

type FeaturedProvider = {
  id: string;
  business_name: string;
  city: string | null;
  county: string | null;
  is_verified: boolean | null;
  profile_image_url: string | null;
  avg_rating: number;
  review_count: number;
};


const Welcome = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [providers, setProviders] = useState<FeaturedProvider[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [stats, setStats] = useState({ users: 0, services: 0 });

  useEffect(() => {
    // Load categories
    supabase
      .from("service_categories")
      .select("*")
      .order("sort_order")
      .limit(8)
      .then(({ data }) => setCategories(data || []));

    // Load featured providers
    supabase
      .from("provider_profiles")
      .select("id, business_name, city, county, is_verified, profile_image_url, user_id")
      .eq("is_verified", true)
      .limit(6)
      .then(async ({ data }) => {
        if (!data || data.length === 0) {
          // Fallback: get any providers
          const { data: fallback } = await supabase
            .from("provider_profiles")
            .select("id, business_name, city, county, is_verified, profile_image_url, user_id")
            .limit(6);
          data = fallback;
        }
        if (!data) return;

        // Get reviews for these providers
        const userIds = data.map((p) => p.user_id);
        const { data: reviews } = await supabase
          .from("reviews")
          .select("provider_id, rating")
          .in("provider_id", userIds);

        const mapped = data.map((p) => {
          const provReviews = (reviews || []).filter((r) => r.provider_id === p.user_id);
          const avg = provReviews.length > 0
            ? provReviews.reduce((s, r) => s + r.rating, 0) / provReviews.length
            : 0;
          return {
            ...p,
            avg_rating: Math.round(avg * 10) / 10,
            review_count: provReviews.length,
          };
        });
        setProviders(mapped);
      });

    // Load stats
    Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("services").select("id", { count: "exact", head: true }).eq("is_active", true),
    ]).then(([profilesRes, servicesRes]) => {
      setStats({
        users: profilesRes.count || 0,
        services: servicesRes.count || 0,
      });
    });
  }, []);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate("/search");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative min-h-[480px] flex flex-col justify-end overflow-hidden">
        <img
          src={heroImage}
          alt="Kenyan service professionals at work"
          className="absolute inset-0 w-full h-full object-cover"
          width={1280}
          height={720}
        />
        <div className="absolute inset-0 gradient-hero" />

        <div className="relative z-10 px-5 pb-8 pt-16">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-8">
            <div className="w-9 h-9 rounded-xl bg-primary-foreground/20 backdrop-blur-sm flex items-center justify-center border border-primary-foreground/10">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-lg text-primary-foreground">Huduma</span>
          </div>

          <h1 className="font-display text-3xl font-bold text-primary-foreground leading-tight mb-2">
            Find Trusted Service Providers
          </h1>
          <p className="text-primary-foreground/75 text-sm mb-6 max-w-[300px]">
            Kenya's marketplace for verified professionals. Book with confidence.
          </p>

          {/* Search Bar */}
          <div className="flex gap-2 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="What service do you need?"
                className="h-12 rounded-xl pl-10 bg-card/95 backdrop-blur-sm border-0 shadow-lg text-sm"
              />
            </div>
            <Button
              onClick={handleSearch}
              className="h-12 w-12 rounded-xl shadow-lg"
              size="icon"
            >
              <ArrowRight className="w-5 h-5" />
            </Button>
          </div>

          {/* Trust Stats */}
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-accent" />
              <span className="text-primary-foreground/80 text-xs font-semibold">
                {stats.users > 0 ? `${stats.users}+ Users` : "Growing Community"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-accent" />
              <span className="text-primary-foreground/80 text-xs font-semibold">
                {stats.services > 0 ? `${stats.services} Services` : "Verified Pros"}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="px-5 -mt-4 relative z-20">
        <Card className="shadow-xl border-0 rounded-2xl overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-bold text-base text-foreground">Categories</h2>
              <button
                onClick={() => navigate("/categories")}
                className="text-xs font-semibold text-primary flex items-center gap-0.5"
              >
                View all <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {categories.slice(0, 8).map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => navigate(`/categories/${cat.slug}`)}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-muted transition-colors active:scale-95"
                >
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                    {getCategoryIcon(cat.slug)}
                  </div>
                  <span className="text-[11px] font-semibold text-foreground text-center leading-tight line-clamp-2">
                    {cat.name}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Featured Providers */}
      {providers.length > 0 && (
        <section className="px-5 mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-base text-foreground">Top Providers</h2>
            <button
              onClick={() => navigate("/search")}
              className="text-xs font-semibold text-primary flex items-center gap-0.5"
            >
              See all <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-1 px-1">
            {providers.map((provider) => (
              <Card
                key={provider.id}
                className="min-w-[160px] max-w-[160px] shrink-0 card-hover border-0 shadow-md rounded-2xl overflow-hidden cursor-pointer"
                onClick={() => navigate("/search")}
              >
                <CardContent className="p-3 flex flex-col items-center text-center">
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-2 relative overflow-hidden">
                    {provider.profile_image_url ? (
                      <img
                        src={provider.profile_image_url}
                        alt={provider.business_name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-xl font-bold text-muted-foreground">
                        {provider.business_name.charAt(0)}
                      </span>
                    )}
                    {provider.is_verified && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-primary rounded-full flex items-center justify-center border-2 border-card">
                        <BadgeCheck className="w-3 h-3 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-bold text-foreground leading-tight line-clamp-1 mb-0.5">
                    {provider.business_name}
                  </p>
                  {(provider.city || provider.county) && (
                    <div className="flex items-center gap-0.5 mb-1">
                      <MapPin className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">
                        {provider.city || provider.county}
                      </span>
                    </div>
                  )}
                  {provider.review_count > 0 && (
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-accent fill-accent" />
                      <span className="text-[11px] font-semibold text-foreground">
                        {provider.avg_rating}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        ({provider.review_count})
                      </span>
                    </div>
                  )}
                  {provider.is_verified && (
                    <Badge className="mt-1.5 text-[9px] px-1.5 py-0 h-4">Verified</Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="px-5 mt-8 pb-10">
        <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-primary">
          <CardContent className="p-6 text-center">
            <h3 className="font-display text-lg font-bold text-primary-foreground mb-1">
              Ready to get started?
            </h3>
            <p className="text-primary-foreground/70 text-xs mb-5">
              Join thousands of Kenyans finding services & opportunities
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => navigate("/register")}
                className="flex-1 h-12 rounded-xl font-bold bg-accent text-accent-foreground hover:bg-accent/90 shadow-md"
              >
                Get Started
              </Button>
              <Button
                onClick={() => navigate("/login")}
                variant="outline"
                className="flex-1 h-12 rounded-xl font-bold border-2 border-primary-foreground/30 text-primary-foreground bg-transparent hover:bg-primary-foreground/10"
              >
                Sign In
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default Welcome;
