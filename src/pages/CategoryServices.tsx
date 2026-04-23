import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, MapPin } from "lucide-react";

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

type Category = {
  id: string;
  name: string;
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
  const [services, setServices] = useState<Service[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      // Support both slug and UUID lookups
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug!);
      const { data: cat } = await supabase
        .from("service_categories")
        .select("*")
        .eq(isUuid ? "id" : "slug", slug!)
        .maybeSingle();

      if (!cat) {
        setLoading(false);
        return;
      }
      setCategory(cat);

      const { data: svc } = await supabase
        .from("services")
        .select("*")
        .eq("category_id", cat.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      setServices(svc || []);
      setLoading(false);
    };
    fetchData();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!category) {
    return (
      <div className="min-h-screen bg-background px-6 py-8 text-center">
        <p className="text-muted-foreground">Category not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-6 py-6">
      <div className="max-w-sm mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground mb-6">
          <ArrowLeft className="w-5 h-5" />
          <span>Categories</span>
        </button>

        <div className="flex items-center gap-3 mb-6">
          <span className="text-3xl">{category.icon}</span>
          <h1 className="font-display text-2xl font-bold text-foreground">{category.name}</h1>
        </div>

        {services.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No services listed yet in this category.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {services.map((svc) => (
              <Card
                key={svc.id}
                className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]"
                onClick={() => navigate(`/services/${svc.id}`)}
              >
                <CardContent className="p-4">
                  <h3 className="font-semibold text-foreground mb-1">{svc.title}</h3>
                  {svc.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{svc.description}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-primary">
                      {priceLabel(svc.price, svc.price_type)}
                    </span>
                    {(svc.city || svc.county) && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
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
