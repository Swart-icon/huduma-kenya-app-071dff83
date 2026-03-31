import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, MapPin, Phone, Mail, Edit, Briefcase, Star } from "lucide-react";

type ProviderProfile = {
  business_name: string;
  description: string | null;
  city: string | null;
  county: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  profile_image_url: string | null;
  availability_status: string;
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

  useEffect(() => {
    if (!authLoading && (!user || role !== "provider")) {
      navigate("/dashboard");
      return;
    }
    if (user) fetchProfile();
  }, [authLoading, user, role]);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from("provider_profiles")
      .select("*")
      .eq("user_id", user!.id)
      .maybeSingle();
    setProfile(data);
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
          <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2 text-muted-foreground mb-8">
            <ArrowLeft className="w-5 h-5" />
            <span>Dashboard</span>
          </button>
          <Briefcase className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="font-display text-xl font-bold text-foreground mb-2">No profile yet</h2>
          <p className="text-muted-foreground mb-6">Create your business profile to start getting clients.</p>
          <Button onClick={() => navigate("/provider-profile/edit")} className="h-12 rounded-xl font-semibold">
            Create Profile
          </Button>
        </div>
      </div>
    );
  }

  const badge = statusBadge[profile.availability_status] || statusBadge.available;

  return (
    <div className="min-h-screen bg-background">
      {/* Header image area */}
      <div className="relative h-48 bg-gradient-to-br from-primary to-primary/70">
        <button
          onClick={() => navigate("/dashboard")}
          className="absolute top-4 left-4 w-10 h-10 rounded-xl bg-black/20 backdrop-blur-sm flex items-center justify-center text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button
          onClick={() => navigate("/provider-profile/edit")}
          className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-black/20 backdrop-blur-sm flex items-center justify-center text-white"
        >
          <Edit className="w-5 h-5" />
        </button>
      </div>

      <div className="px-6 -mt-16">
        <div className="max-w-sm mx-auto">
          {/* Profile image */}
          <div className="w-28 h-28 rounded-2xl bg-card border-4 border-background overflow-hidden shadow-lg mb-4">
            {profile.profile_image_url ? (
              <img src={profile.profile_image_url} alt={profile.business_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center">
                <Briefcase className="w-10 h-10 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Name & status */}
          <h1 className="font-display text-2xl font-bold text-foreground mb-1">
            {profile.business_name}
          </h1>
          <span className={`inline-block text-xs font-semibold px-3 py-1 rounded-full ${badge.color}`}>
            {badge.label}
          </span>

          {/* Description */}
          {profile.description && (
            <p className="text-muted-foreground mt-4 leading-relaxed">{profile.description}</p>
          )}

          {/* Info cards */}
          <div className="space-y-3 mt-6">
            {(profile.city || profile.county) && (
              <Card>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p className="font-medium text-foreground">
                      {[profile.city, profile.county].filter(Boolean).join(", ")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
            {profile.contact_phone && (
              <Card>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5 text-primary" />
                  </div>
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
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="font-medium text-foreground">{profile.contact_email}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Services placeholder */}
          <Card className="mt-6 border-dashed">
            <CardContent className="p-6 text-center">
              <Briefcase className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium text-muted-foreground">Services coming soon</p>
              <p className="text-xs text-muted-foreground mt-1">You'll be able to list your services here</p>
            </CardContent>
          </Card>

          <div className="h-8" />
        </div>
      </div>
    </div>
  );
};

export default ProviderProfilePreview;
