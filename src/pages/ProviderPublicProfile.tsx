import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, Phone, Mail, Briefcase, Star, MessageSquare, Award, Ruler, CheckCircle, Clock as ClockIcon } from "lucide-react";
import { getOrCreateConversation } from "@/lib/conversations";
import { useToast } from "@/hooks/use-toast";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const statusBadge: Record<string, { label: string; color: string }> = {
  available: { label: "🟢 Available", color: "bg-primary/10 text-primary" },
  busy: { label: "🟡 Busy", color: "bg-accent/20 text-accent-foreground" },
  offline: { label: "🔴 Offline", color: "bg-secondary/10 text-secondary" },
};

const ProviderPublicProfile = () => {
  const { providerId } = useParams<{ providerId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [reviewCount, setReviewCount] = useState(0);
  const [portfolio, setPortfolio] = useState<any[]>([]);
  const [availability, setAvailability] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);

  useEffect(() => {
    if (providerId) fetchAll();
  }, [providerId]);

  const fetchAll = async () => {
    const [profRes, revRes, portRes, availRes, svcRes] = await Promise.all([
      supabase.from("provider_profiles").select("*").eq("user_id", providerId!).maybeSingle(),
      supabase.from("reviews").select("rating").eq("provider_id", providerId!),
      supabase.from("portfolio_items").select("*").eq("user_id", providerId!).order("created_at", { ascending: false }),
      supabase.from("provider_availability").select("*").eq("user_id", providerId!).order("day_of_week"),
      supabase.from("services").select("*").eq("provider_id", providerId!).eq("is_active", true),
    ]);
    setProfile(profRes.data);
    const reviews = revRes.data || [];
    if (reviews.length > 0) {
      setAvgRating(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length);
      setReviewCount(reviews.length);
    }
    setPortfolio(portRes.data || []);
    setAvailability(availRes.data || []);
    setServices(svcRes.data || []);
    setLoading(false);
  };

  const handleMessage = async () => {
    if (!user || !providerId) return;
    const convId = await getOrCreateConversation(user.id, providerId);
    if (convId) navigate(`/chat/${convId}`);
    else toast({ title: "Could not start conversation", variant: "destructive" });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background px-6 py-8">
        <div className="max-w-sm mx-auto text-center">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground mb-8">
            <ArrowLeft className="w-5 h-5" /><span>Back</span>
          </button>
          <Briefcase className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="font-display text-xl font-bold text-foreground mb-2">Profile not found</h2>
          <p className="text-muted-foreground">This provider hasn't set up their profile yet.</p>
        </div>
      </div>
    );
  }

  const badge = statusBadge[profile.availability_status] || statusBadge.available;

  return (
    <div className="min-h-screen bg-background">
      <div className="relative h-48 bg-gradient-to-br from-primary to-primary/70">
        <button onClick={() => navigate(-1)} className="absolute top-4 left-4 w-10 h-10 rounded-xl bg-black/20 backdrop-blur-sm flex items-center justify-center text-white">
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      <div className="px-6 -mt-16">
        <div className="max-w-sm mx-auto">
          <div className="w-28 h-28 rounded-2xl bg-card border-4 border-background overflow-hidden shadow-lg mb-4 relative">
            {profile.profile_image_url ? (
              <img src={profile.profile_image_url} alt={profile.business_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center">
                <Briefcase className="w-10 h-10 text-muted-foreground" />
              </div>
            )}
            {profile.is_verified && (
              <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-lg border-2 border-background">
                <CheckCircle className="w-5 h-5 text-primary-foreground" />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 mb-1">
            <h1 className="font-display text-2xl font-bold text-foreground">{profile.business_name}</h1>
            {profile.is_verified && (
              <Badge className="bg-primary/10 text-primary gap-1 text-xs">
                <CheckCircle className="w-3 h-3" /> Verified
              </Badge>
            )}
          </div>
          <span className={`inline-block text-xs font-semibold px-3 py-1 rounded-full ${badge.color}`}>{badge.label}</span>

          {/* Quick stats */}
          <div className="flex gap-3 mt-4">
            {profile.years_experience > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Award className="w-4 h-4" /><span>{profile.years_experience}yr exp</span>
              </div>
            )}
            {profile.service_radius_km > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Ruler className="w-4 h-4" /><span>{profile.service_radius_km}km radius</span>
              </div>
            )}
          </div>

          {/* Skills */}
          {profile.skills?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {profile.skills.map((skill: string) => (
                <Badge key={skill} variant="secondary" className="text-xs">{skill}</Badge>
              ))}
            </div>
          )}

          {profile.description && (
            <p className="text-muted-foreground mt-4 leading-relaxed">{profile.description}</p>
          )}

          {/* Action buttons */}
          {user && user.id !== providerId && (
            <div className="flex gap-3 mt-6">
              <Button className="flex-1 rounded-xl gap-2" onClick={handleMessage}>
                <MessageSquare className="w-4 h-4" /> Message
              </Button>
              {profile.contact_phone && (
                <Button variant="outline" className="rounded-xl gap-2" asChild>
                  <a href={`tel:${profile.contact_phone}`}><Phone className="w-4 h-4" /> Call</a>
                </Button>
              )}
            </div>
          )}

          {/* Contact info */}
          <div className="space-y-3 mt-6">
            {(profile.city || profile.county) && (
              <Card>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><MapPin className="w-5 h-5 text-primary" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p className="font-medium text-foreground">{[profile.city, profile.county].filter(Boolean).join(", ")}</p>
                  </div>
                </CardContent>
              </Card>
            )}
            {profile.contact_email && (
              <Card>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><Mail className="w-5 h-5 text-primary" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="font-medium text-foreground">{profile.contact_email}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Services */}
          {services.length > 0 && (
            <Card className="mt-6">
              <CardContent className="p-5">
                <h3 className="font-semibold text-foreground mb-3">Services</h3>
                <div className="space-y-2">
                  {services.map((svc: any) => (
                    <div key={svc.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => navigate(`/services/${svc.id}`)}>
                      <span className="text-sm font-medium text-foreground">{svc.title}</span>
                      {svc.price && <span className="text-xs font-semibold text-primary">KSh {svc.price.toLocaleString()}</span>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Working Hours */}
          {availability.length > 0 && (
            <Card className="mt-6">
              <CardContent className="p-5">
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <ClockIcon className="w-4 h-4" /> Working Hours
                </h3>
                <div className="space-y-2">
                  {DAYS.map((day, i) => {
                    const avail = availability.find((a: any) => a.day_of_week === i);
                    return (
                      <div key={day} className="flex items-center justify-between text-sm">
                        <span className={`font-medium ${avail?.is_available ? "text-foreground" : "text-muted-foreground"}`}>{day}</span>
                        {avail?.is_available ? (
                          <span className="text-muted-foreground">{avail.start_time} – {avail.end_time}</span>
                        ) : (
                          <span className="text-muted-foreground">Closed</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Portfolio */}
          {portfolio.length > 0 && (
            <Card className="mt-6">
              <CardContent className="p-5">
                <h3 className="font-semibold text-foreground mb-3">Portfolio</h3>
                <div className="grid grid-cols-2 gap-3">
                  {portfolio.map((item: any) => (
                    <div key={item.id} className="rounded-xl overflow-hidden border">
                      <img src={item.image_url} alt={item.title} className="w-full h-24 object-cover" />
                      <div className="p-2">
                        <p className="text-xs font-medium text-foreground truncate">{item.title}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reviews */}
          <Card className="mt-6">
            <CardContent className="p-6 text-center">
              <Star className="w-8 h-8 text-accent mx-auto mb-2" />
              {avgRating !== null ? (
                <>
                  <p className="text-2xl font-bold text-foreground">{avgRating.toFixed(1)}</p>
                  <div className="flex justify-center gap-1 my-1">
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star key={s} className={`w-4 h-4 ${s <= Math.round(avgRating) ? "text-accent fill-accent" : "text-muted-foreground"}`} />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">{reviewCount} review{reviewCount !== 1 ? "s" : ""}</p>
                  <Button variant="link" onClick={() => navigate(`/provider/${providerId}/reviews`)} className="mt-2">View all reviews</Button>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-muted-foreground">No reviews yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Reviews will appear here after completed jobs</p>
                </>
              )}
            </CardContent>
          </Card>

          <div className="h-8" />
        </div>
      </div>
    </div>
  );
};

export default ProviderPublicProfile;
