import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Plus, MapPin, ToggleLeft, ToggleRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Service = {
  id: string;
  title: string;
  price: number | null;
  price_type: string;
  city: string | null;
  county: string | null;
  is_active: boolean;
  category_id: string;
};

type Category = { id: string; name: string; icon: string | null };

const priceLabel = (price: number | null, type: string) => {
  if (!price) return "Price on request";
  const formatted = `KSh ${price.toLocaleString()}`;
  if (type === "starting_from") return `From ${formatted}`;
  if (type === "negotiable") return `${formatted} (neg.)`;
  return formatted;
};

const MyServices = () => {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Record<string, Category>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && (!user || role !== "provider")) {
      navigate("/dashboard");
      return;
    }
    if (user) fetchData();
  }, [authLoading, user, role]);

  const fetchData = async () => {
    const [svcRes, catRes] = await Promise.all([
      supabase.from("services").select("*").eq("provider_id", user!.id).order("created_at", { ascending: false }),
      supabase.from("service_categories").select("*").order("sort_order"),
    ]);

    setServices(svcRes.data || []);
    const catMap: Record<string, Category> = {};
    (catRes.data || []).forEach((c: any) => { catMap[c.id] = c; });
    setCategories(catMap);
    setLoading(false);
  };

  const toggleActive = async (svc: Service) => {
    const { error } = await supabase
      .from("services")
      .update({ is_active: !svc.is_active })
      .eq("id", svc.id);

    if (error) {
      toast({ title: "Failed to update", variant: "destructive" });
    } else {
      setServices(services.map((s) => s.id === svc.id ? { ...s, is_active: !s.is_active } : s));
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-6 py-6">
      <div className="max-w-sm mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2 text-muted-foreground">
            <ArrowLeft className="w-5 h-5" />
            <span>Dashboard</span>
          </button>
          <Button onClick={() => navigate("/services/new")} size="sm" className="rounded-xl gap-1.5">
            <Plus className="w-4 h-4" />
            Add Service
          </Button>
        </div>

        <h1 className="font-display text-2xl font-bold text-foreground mb-6">My Services</h1>

        {services.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">You haven't listed any services yet.</p>
            <Button onClick={() => navigate("/services/new")} className="rounded-xl">
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Service
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {services.map((svc) => {
              const cat = categories[svc.category_id];
              return (
                <Card key={svc.id} className={`transition-shadow ${!svc.is_active ? "opacity-60" : "hover:shadow-md"}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 cursor-pointer" onClick={() => navigate(`/services/${svc.id}`)}>
                        <h3 className="font-semibold text-foreground mb-1">{svc.title}</h3>
                        {cat && (
                          <span className="text-xs text-muted-foreground">{cat.icon} {cat.name}</span>
                        )}
                        <div className="flex items-center justify-between mt-2">
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
                      </div>
                      <button onClick={() => toggleActive(svc)} className="shrink-0 mt-1" title={svc.is_active ? "Deactivate" : "Activate"}>
                        {svc.is_active ? (
                          <ToggleRight className="w-6 h-6 text-primary" />
                        ) : (
                          <ToggleLeft className="w-6 h-6 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyServices;
