import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft, Plus, MapPin, ToggleLeft, ToggleRight, Package,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Good = {
  id: string;
  title: string;
  price: number | null;
  price_type: string;
  city: string | null;
  county: string | null;
  is_active: boolean;
  category_id: string;
  images: string[];
  condition: string;
};

type Category = { id: string; name: string; icon: string | null };

const priceLabel = (p: number | null, t: string) => {
  if (!p) return "Price on request";
  const f = `KSh ${p.toLocaleString()}`;
  if (t === "starting_from") return `From ${f}`;
  if (t === "negotiable") return `${f} (neg.)`;
  return f;
};

const MyGoods = () => {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [goods, setGoods] = useState<Good[]>([]);
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
    const [gRes, cRes] = await Promise.all([
      supabase.from("goods").select("*").eq("seller_id", user!.id).order("created_at", { ascending: false }),
      supabase.from("service_categories").select("*").order("sort_order"),
    ]);
    setGoods((gRes.data as Good[]) || []);
    const map: Record<string, Category> = {};
    (cRes.data || []).forEach((c: any) => { map[c.id] = c; });
    setCategories(map);
    setLoading(false);
  };

  const toggleActive = async (g: Good) => {
    const { error } = await supabase.from("goods").update({ is_active: !g.is_active }).eq("id", g.id);
    if (error) { toast({ title: "Failed to update", variant: "destructive" }); return; }
    setGoods(goods.map((x) => x.id === g.id ? { ...x, is_active: !x.is_active } : x));
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
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground">
            <ArrowLeft className="w-5 h-5" /><span>Dashboard</span>
          </button>
          <Button onClick={() => navigate("/goods/new")} size="sm" className="rounded-xl gap-1.5">
            <Plus className="w-4 h-4" /> List Product
          </Button>
        </div>

        <h1 className="font-display text-2xl font-bold text-foreground mb-6">My Products</h1>

        {goods.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Package className="w-8 h-8 text-primary" />
            </div>
            <p className="text-muted-foreground mb-4">You haven't listed any products yet.</p>
            <Button onClick={() => navigate("/goods/new")} className="rounded-xl">
              <Plus className="w-4 h-4 mr-2" /> List Your First Product
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {goods.map((g) => {
              const cat = categories[g.category_id];
              return (
                <Card key={g.id} className={`transition-shadow ${!g.is_active ? "opacity-60" : "hover:shadow-md"}`}>
                  <CardContent className="p-3">
                    <div className="flex gap-3">
                      <div
                        className="h-20 w-20 shrink-0 rounded-xl overflow-hidden bg-muted cursor-pointer"
                        onClick={() => navigate(`/goods/${g.id}`)}
                      >
                        {g.images?.[0] && (
                          <img src={g.images[0]} alt={g.title} className="h-full w-full object-cover" loading="lazy" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/goods/${g.id}`)}>
                        <h3 className="font-semibold text-foreground line-clamp-1">{g.title}</h3>
                        {cat && <span className="text-xs text-muted-foreground">{cat.icon} {cat.name}</span>}
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-sm font-bold text-primary">{priceLabel(g.price, g.price_type)}</span>
                          {(g.city || g.county) && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <MapPin className="w-3 h-3" />{[g.city, g.county].filter(Boolean).join(", ")}
                            </span>
                          )}
                        </div>
                      </div>
                      <button onClick={() => toggleActive(g)} className="shrink-0" title={g.is_active ? "Deactivate" : "Activate"}>
                        {g.is_active ? <ToggleRight className="w-6 h-6 text-primary" /> : <ToggleLeft className="w-6 h-6 text-muted-foreground" />}
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

export default MyGoods;
