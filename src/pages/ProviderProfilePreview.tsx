import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, Phone, Mail, Edit, Briefcase, Star, Flag, CheckCircle, Clock as ClockIcon, Ruler, Award } from "lucide-react";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type ProviderProfile = {
  business_name: string;
  description: string | null;
  city: string | null;
  county: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  profile_image_url: string | null;
  availability_status: string;
  years_experience: number;
  skills: string[];
  service_radius_km: number;
  is_verified: boolean;
};

type PortfolioItem = {
  id: string;
  image_url: string;
  title: string;
  description: string | null;
};

type Availability = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
};

const statusBadge: Record<string, { label: string; color: string }> = {
  available: { label: "🟢 Available", color: "bg-primary/10 text-primary" },
  busy: { label: "🟡 Busy", color: "bg-accent/20 text-accent-foreground" },
  offline: { label: "🔴 Offline", color: "bg-secondary/10 text-secondary" },
};

const ProviderProfilePreview = () => {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [reviewCount, setReviewCount] = useState(0);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);

  useEffect(() => {
    if (!authLoading && (!user || role !== "provider")) {
      navigate("/dashboard");
      return;
    }
    if (user) fetchAll();
  }, [authLoading, user, role]);

  const fetchAll = async () => {
    const [profRes, profPrivRes, revRes, portRes, availRes] = await Promise.all([
      supabase.from("provider_profiles").select("*").eq("user_id", user!.id).maybeSingle(),
      supabase.from("provider_profiles_private").select("contact_phone, contact_email").eq("user_id", user!.id).maybeSingle(),
      supabase.from("reviews").select("rating").eq("provider_id", user!.id),
      supabase.from("portfolio_items").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }),
      supabase.from("provider_availability").select("*").eq("user_id", user!.id).order("day_of_week"),
    ]);
    setProfile(profRes.data ? ({
      ...profRes.data,
      contact_phone: profPrivRes.data?.contact_phone ?? null,
      contact_email: profPrivRes.data?.contact_email ?? null,
    } as ProviderProfile) : null);
    const reviews = revRes.data || [];
    if (reviews.length > 0) {
      setAvgRating(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length);
      setReviewCount(reviews.length);
    }
    setPortfolio((portRes.data as PortfolioItem[]) || []);
    setAvailability((availRes.data as Availability[]) || []);
    setLoading(false);
  };

  if (authLoading || loading) {
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
            <ArrowLeft className="w-5 h-5" /><span>Dashboard</span>
          </button>
          <Briefcase className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="font-display text-xl font-bold text-foreground mb-2">No profile yet</h2>
          <p className="text-muted-foreground mb-6">Create your business profile to start getting clients.</p>
          <Button onClick={() => navigate("/provider-profile/edit")} className="h-12 rounded-xl font-semibold">Create Profile</Button>
        </div>
      </div>
    );
  }

  const badge = statusBadge[profile.availability_status] || statusBadge.available;

  return (
    <div className="min-h-screen bg-background">
      {/* Header image area */}
      <div className="relative h-48 bg-gradient-to-br from-primary to-primary/70">
        <button onClick={() => navigate(-1)} className="absolute top-4 left-4 w-10 h-10 rounded-xl bg-black/20 backdrop-blur-sm flex items-center justify-center text-white">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button onClick={() => navigate("/provider-profile/edit")} className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-black/20 backdrop-blur-sm flex items-center justify-center text-white">
          <Edit className="w-5 h-5" />
        </button>
      </div>

      <div className="px-6 -mt-16">
        <div className="max-w-sm mx-auto">
          {/* Profile image */}
          <div className="w-28 h-28 rounded-2xl bg-card border-4 border-background overflow-hidden shadow-lg mb-4 relative">
            {profile.profile_image_url ? (
              <img src={profile.profile_image_url} alt={profile.business_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center">
                <Briefcase className="w-10 h-10 text-muted-foreground" />
              </div>
            )}
            {/* Verified badge */}
            {profile.is_verified && (
              <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-lg border-2 border-background">
                <CheckCircle className="w-5 h-5 text-primary-foreground" />
              </div>
            )}
          </div>

          {/* Name & status */}
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
                <Award className="w-4 h-4" />
                <span>{profile.years_experience}yr exp</span>
              </div>
            )}
            {profile.service_radius_km > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Ruler className="w-4 h-4" />
                <span>{profile.service_radius_km}km radius</span>
              </div>
            )}
          </div>

          {/* Skills */}
          {profile.skills && profile.skills.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {profile.skills.map((skill) => (
                <Badge key={skill} variant="secondary" className="text-xs">{skill}</Badge>
              ))}
            </div>
          )}

          {/* Description */}
          {profile.description && (
            <p className="text-muted-foreground mt-4 leading-relaxed">{profile.description}</p>
          )}

          {/* Info cards */}
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
            {profile.contact_phone && (
              <Card>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><Phone className="w-5 h-5 text-primary" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="font-medium text-foreground">{profile.contact_phone}</p>
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

          {/* Working Hours */}
          {availability.length > 0 && (
            <Card className="mt-6">
              <CardContent className="p-5">
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <ClockIcon className="w-4 h-4" /> Working Hours
                </h3>
                <div className="space-y-2">
                  {DAYS.map((day, i) => {
                    const avail = availability.find((a) => a.day_of_week === i);
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
                  {portfolio.map((item) => (
                    <div key={item.id} className="rounded-xl overflow-hidden border">
                      <img src={item.image_url} alt={item.title} className="w-full h-24 object-cover" />
                      <div className="p-2">
                        <p className="text-xs font-medium text-foreground truncate">{item.title}</p>
                        {item.description && <p className="text-xs text-muted-foreground truncate">{item.description}</p>}
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
                  <Button variant="link" onClick={() => navigate(`/provider/${user!.id}/reviews`)} className="mt-2">View all reviews</Button>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-muted-foreground">No reviews yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Reviews will appear here after completed jobs</p>
                </>
              )}
            </CardContent>
          </Card>

          {user && (
            <Button variant="ghost" className="w-full text-muted-foreground mt-4" onClick={() => navigate(`/report/${user.id}`)}>
              <Flag className="w-4 h-4 mr-2" /> Report this provider
            </Button>
          )}
          <div className="h-8" />
        </div>
      </div>
    </div>
  );
};

export default ProviderProfilePreview;
