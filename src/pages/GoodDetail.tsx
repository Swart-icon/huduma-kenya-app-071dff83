import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, MessageCircle, Package, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getOrCreateConversation } from "@/lib/conversations";

type Good = {
  id: string;
  seller_id: string;
  title: string;
  description: string | null;
  price: number | null;
  price_type: string;
  condition: string;
  stock_quantity: number | null;
  images: string[];
  city: string | null;
  county: string | null;
  category_id: string;
};

type Category = { id: string; name: string; icon: string | null; slug: string };
type Seller = { user_id: string; business_name: string | null; full_name: string | null };

const conditionLabel: Record<string, string> = {
  new: "Brand new", like_new: "Like new", used: "Used", refurbished: "Refurbished",
};

const priceLabel = (p: number | null, t: string) => {
  if (!p) return "Price on request";
  const f = `KSh ${p.toLocaleString()}`;
  if (t === "starting_from") return `From ${f}`;
  if (t === "negotiable") return `${f} (negotiable)`;
  return f;
};

const GoodDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [good, setGood] = useState<Good | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [activeImg, setActiveImg] = useState(0);
  const [loading, setLoading] = useState(true);
  const [contacting, setContacting] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: g } = await supabase.from("goods").select("*").eq("id", id!).maybeSingle();
      if (!g) { setLoading(false); return; }
      setGood(g as Good);

      const [catRes, profRes, provRes] = await Promise.all([
        supabase.from("service_categories").select("id, name, slug, icon").eq("id", g.category_id).maybeSingle(),
        supabase.from("profiles").select("user_id, full_name").eq("user_id", g.seller_id).maybeSingle(),
        supabase.from("provider_profiles").select("business_name, user_id").eq("user_id", g.seller_id).maybeSingle(),
      ]);
      setCategory(catRes.data as Category | null);
      setSeller({
        user_id: g.seller_id,
        business_name: provRes.data?.business_name || null,
        full_name: profRes.data?.full_name || null,
      });

      // increment view count (best-effort)
      await supabase.from("goods").update({ view_count: (g.view_count || 0) + 1 }).eq("id", g.id);
      setLoading(false);
    };
    load();
  }, [id]);

  const handleContact = async () => {
    if (!user) { navigate("/login"); return; }
    if (!good) return;
    setContacting(true);
    try {
      const convId = await getOrCreateConversation(user.id, good.seller_id);
      if (!convId) throw new Error("Could not start conversation");
      navigate(`/chat/${convId}`);
    } catch (err: any) {
      toast({ title: "Couldn't open chat", description: err.message, variant: "destructive" });
    } finally {
      setContacting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!good) {
    return (
      <div className="min-h-screen bg-background px-6 py-12 text-center">
        <p className="text-muted-foreground">Product not found</p>
        <Button onClick={() => navigate(-1)} variant="outline" className="mt-4 rounded-xl">Go back</Button>
      </div>
    );
  }

  const sellerName = seller?.business_name || seller?.full_name || "Seller";

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="max-w-md mx-auto">
        {/* Image carousel */}
        <div className="relative aspect-square bg-muted">
          <button
            onClick={() => navigate(-1)}
            className="absolute top-4 left-4 z-10 h-10 w-10 rounded-full bg-background/80 backdrop-blur flex items-center justify-center shadow"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          {good.images.length > 0 ? (
            <img src={good.images[activeImg]} alt={good.title} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <Package className="w-12 h-12 text-muted-foreground" />
            </div>
          )}
          {good.images.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {good.images.map((_, i) => (
                <button key={i} onClick={() => setActiveImg(i)}
                  className={`h-1.5 rounded-full transition-all ${i === activeImg ? "w-6 bg-white" : "w-1.5 bg-white/60"}`} />
              ))}
            </div>
          )}
        </div>

        {good.images.length > 1 && (
          <div className="flex gap-2 px-4 pt-3 overflow-x-auto">
            {good.images.map((src, i) => (
              <button key={i} onClick={() => setActiveImg(i)}
                className={`h-16 w-16 shrink-0 rounded-lg overflow-hidden border-2 ${i === activeImg ? "border-primary" : "border-transparent"}`}>
                <img src={src} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <div className="px-5 py-5 space-y-4">
          <div>
            {category && (
              <button onClick={() => navigate(`/categories/${category.slug}?mode=goods`)}
                className="text-xs font-medium text-primary mb-1.5">
                {category.icon} {category.name}
              </button>
            )}
            <h1 className="font-display text-2xl font-bold text-foreground">{good.title}</h1>
            <div className="mt-1 flex items-center flex-wrap gap-2">
              <p className="text-2xl font-bold text-primary">{priceLabel(good.price, good.price_type)}</p>
              <Badge variant="secondary" className="rounded-full">{conditionLabel[good.condition] || good.condition}</Badge>
              {good.stock_quantity !== null && (
                <Badge variant="outline" className="rounded-full">{good.stock_quantity} in stock</Badge>
              )}
            </div>
            {(good.city || good.county) && (
              <p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4" />{[good.city, good.county].filter(Boolean).join(", ")}
              </p>
            )}
          </div>

          {good.description && (
            <Card>
              <CardContent className="p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Description</h3>
                <p className="text-sm text-foreground whitespace-pre-line">{good.description}</p>
              </CardContent>
            </Card>
          )}

          <Card className="cursor-pointer" onClick={() => navigate(`/provider/${good.seller_id}`)}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Sold by</p>
                <p className="font-semibold text-foreground line-clamp-1">{sellerName}</p>
              </div>
              <span className="text-xs text-primary font-semibold">View profile →</span>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sticky contact bar */}
      {user?.id !== good.seller_id && (
        <div className="fixed bottom-0 inset-x-0 border-t bg-background/95 backdrop-blur p-4">
          <div className="max-w-md mx-auto">
            <Button onClick={handleContact} disabled={contacting} className="w-full h-12 rounded-xl gap-2 font-semibold">
              <MessageCircle className="w-5 h-5" />
              {contacting ? "Opening chat..." : "Message Seller"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoodDetail;
