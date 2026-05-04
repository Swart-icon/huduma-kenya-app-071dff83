import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, MapPin, Package } from "lucide-react";
import {
  getMarketplaceCategoryCopy,
  getMarketplaceMode,
  getProviderTypesForMode,
  MARKETPLACE_MODE_COPY,
} from "@/lib/marketplace";

type Service = {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  price_type: string;
  city: string | null;
  county: string | null;
  provider_id: string;
};

type Good = {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  price_type: string;
  city: string | null;
  county: string | null;
  seller_id: string;
  images: string[];
  condition: string;
};

type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
};

const priceLabel = (price: number | null, type: string) => {
  if (!price) return "Price on request";
  const formatted = `KSh ${price.toLocaleString()}`;
  if (type === "starting_from") return `From ${formatted}`;
  if (type === "negotiable") return `${formatted} (negotiable)`;
  return formatted;
};

const CategoryServices = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = getMarketplaceMode(searchParams.get("mode"));
  const [services, setServices] = useState<Service[]>([]);
  const [goods, setGoods] = useState<Good[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug!);
      const { data: cat } = await supabase
        .from("service_categories")
        .select("id, name, slug, icon")
        .eq(isUuid ? "id" : "slug", slug!)
        .maybeSingle();

      if (!cat) {
        setCategory(null);
        setServices([]);
        setGoods([]);
        setLoading(false);
        return;
      }
      setCategory(cat);

      if (mode === "goods") {
        const { data } = await supabase
          .from("goods")
          .select("id, title, description, price, price_type, city, county, seller_id, images, condition")
          .eq("category_id", cat.id)
          .eq("is_active", true)
          .order("created_at", { ascending: false });
        setGoods((data as Good[]) || []);
        setServices([]);
      } else {
        const [providersRes, servicesRes] = await Promise.all([
          supabase
            .from("provider_profiles")
            .select("user_id, service_type")
            .in("service_type", getProviderTypesForMode(mode)),
          supabase
            .from("services")
            .select("id, title, description, price, price_type, city, county, provider_id")
            .eq("category_id", cat.id)
            .eq("is_active", true)
            .order("created_at", { ascending: false }),
        ]);
        const allowed = new Set((providersRes.data || []).map((p) => p.user_id));
        setServices((servicesRes.data || []).filter((s) => allowed.has(s.provider_id)));
        setGoods([]);
      }
      setLoading(false);
    };

    fetchData();
  }, [slug, mode]);

  const categoryCopy = useMemo(() => {
    if (!category) return null;
    return getMarketplaceCategoryCopy(category.slug, mode, category.name);
  }, [category, mode]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!category || !categoryCopy) {
    return (
      <div className="min-h-screen bg-background px-6 py-8 text-center">
        <p className="text-muted-foreground">Category not found</p>
      </div>
    );
  }

  const isEmpty = mode === "goods" ? goods.length === 0 : services.length === 0;

  return (
    <div className="min-h-screen bg-background px-6 py-6">
      <div className="mx-auto max-w-sm">
        <button onClick={() => navigate(-1)} className="mb-6 flex items-center gap-2 text-muted-foreground">
          <ArrowLeft className="h-5 w-5" />
          <span>Categories</span>
        </button>

        <div className="mb-4 inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          {MARKETPLACE_MODE_COPY[mode].title}
        </div>

        <div className="mb-6 flex items-center gap-3">
          <span className="text-3xl">{category.icon}</span>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">{categoryCopy.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{categoryCopy.subtitle}</p>
          </div>
        </div>

        {isEmpty ? (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">
              {mode === "goods"
                ? "No products are listed in this category yet."
                : "No service providers are listed in this category yet."}
            </p>
          </div>
        ) : mode === "goods" ? (
          <div className="grid grid-cols-2 gap-3">
            {goods.map((g) => (
              <Card
                key={g.id}
                className="cursor-pointer overflow-hidden transition-shadow hover:shadow-md active:scale-[0.98]"
                onClick={() => navigate(`/goods/${g.id}`)}
              >
                <div className="aspect-square bg-muted">
                  {g.images?.[0] ? (
                    <img src={g.images[0]} alt={g.title} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Package className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <CardContent className="p-3">
                  <h3 className="line-clamp-1 text-sm font-semibold text-foreground">{g.title}</h3>
                  <p className="mt-1 text-sm font-bold text-primary">{priceLabel(g.price, g.price_type)}</p>
                  {(g.city || g.county) && (
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {[g.city, g.county].filter(Boolean).join(", ")}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {services.map((svc) => (
              <Card
                key={svc.id}
                className="cursor-pointer transition-shadow hover:shadow-md active:scale-[0.98]"
                onClick={() => navigate(`/services/${svc.id}?mode=${mode}`)}
              >
                <CardContent className="p-4">
                  <h3 className="mb-1 font-semibold text-foreground">{svc.title}</h3>
                  {svc.description && (
                    <p className="mb-2 line-clamp-2 text-sm text-muted-foreground">{svc.description}</p>
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-primary">
                      {priceLabel(svc.price, svc.price_type)}
                    </span>
                    {(svc.city || svc.county) && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {[svc.city, svc.county].filter(Boolean).join(", ")}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoryServices;
