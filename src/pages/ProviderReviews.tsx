import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Star, User } from "lucide-react";

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  client_name: string;
};

const ProviderReviews = () => {
  const { providerId } = useParams<{ providerId: string }>();
  const navigate = useNavigate();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [providerName, setProviderName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReviews();
  }, [providerId]);

  const fetchReviews = async () => {
    const [revRes, provRes] = await Promise.all([
      supabase.from("reviews").select("*").eq("provider_id", providerId!).order("created_at", { ascending: false }),
      supabase.from("provider_profiles").select("business_name").eq("user_id", providerId!).maybeSingle(),
    ]);

    setProviderName(provRes.data?.business_name || "Provider");

    const reviewsData = revRes.data || [];
    if (reviewsData.length === 0) { setReviews([]); setLoading(false); return; }

    const clientIds = [...new Set(reviewsData.map(r => r.client_id))];
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", clientIds);
    const nameMap: Record<string, string> = {};
    (profiles || []).forEach((p: { user_id: string; full_name: string | null }) => { nameMap[p.user_id] = p.full_name || "User"; });

    setReviews(reviewsData.map(r => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      created_at: r.created_at,
      client_name: nameMap[r.client_id] || "User",
    })));
    setLoading(false);
  };

  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : "0";

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-6 py-6 pb-24">
      <div className="max-w-sm mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground mb-6">
          <ArrowLeft className="w-5 h-5" /> <span>Back</span>
        </button>

        <h1 className="font-display text-2xl font-bold text-foreground mb-1">Reviews</h1>
        <p className="text-muted-foreground mb-6">{providerName}</p>

        {/* Average rating card */}
        <Card className="mb-6">
          <CardContent className="p-6 text-center">
            <p className="text-4xl font-bold text-foreground mb-1">{avgRating}</p>
            <div className="flex justify-center gap-1 mb-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} className={`w-5 h-5 ${s <= Math.round(Number(avgRating)) ? "text-accent fill-accent" : "text-muted-foreground"}`} />
              ))}
            </div>
            <p className="text-sm text-muted-foreground">{reviews.length} review{reviews.length !== 1 ? "s" : ""}</p>
          </CardContent>
        </Card>

        {/* Review list */}
        {reviews.length === 0 ? (
          <p className="text-center text-muted-foreground">No reviews yet</p>
        ) : (
          <div className="space-y-3">
            {reviews.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">{r.client_name}</p>
                      <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className={`w-3.5 h-3.5 ${s <= r.rating ? "text-accent fill-accent" : "text-muted-foreground"}`} />
                      ))}
                    </div>
                  </div>
                  {r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProviderReviews;
