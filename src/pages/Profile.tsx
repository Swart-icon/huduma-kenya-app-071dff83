import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, LogOut, User, MapPin, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Profile = () => {
  const { user, role, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState({ full_name: "", phone: "", location: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/welcome");
  }, [loading, user, navigate]);

  useEffect(() => {
    if (user) {
      supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => {
        if (data) setProfile({ full_name: data.full_name || "", phone: data.phone || "", location: data.location || "" });
      });
    }
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: profile.full_name, phone: profile.phone, location: profile.location })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profile updated! ✅" });
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/welcome");
  };

  if (loading) return null;

  const roleLabel = role === "provider" ? "Service Provider" : role === "job_seeker" ? "Job Seeker" : "Client";

  return (
    <div className="min-h-screen bg-background px-6 py-8">
      <div className="max-w-sm mx-auto">
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2 text-muted-foreground mb-6">
          <ArrowLeft className="w-5 h-5" />
          <span>Dashboard</span>
        </button>

        <h1 className="font-display text-2xl font-bold text-foreground mb-6">Your Profile</h1>

        <Card className="mb-6">
          <CardContent className="p-5">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center">
                <User className="w-7 h-7 text-primary-foreground" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{profile.full_name || "No name set"}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <span className="inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  {roleLabel}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <div>
            <Label className="text-sm font-semibold">Full Name</Label>
            <div className="relative mt-1.5">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} className="h-12 rounded-xl pl-10" />
            </div>
          </div>
          <div>
            <Label className="text-sm font-semibold">Phone</Label>
            <div className="relative mt-1.5">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="+254 7XX XXX XXX" className="h-12 rounded-xl pl-10" />
            </div>
          </div>
          <div>
            <Label className="text-sm font-semibold">Location</Label>
            <div className="relative mt-1.5">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input value={profile.location} onChange={(e) => setProfile({ ...profile, location: e.target.value })} placeholder="Nairobi, Kenya" className="h-12 rounded-xl pl-10" />
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full h-14 text-lg font-bold rounded-xl" size="lg">
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>

        <Button variant="outline" onClick={handleLogout} className="w-full h-12 rounded-xl mt-6 border-2 text-secondary font-semibold">
          <LogOut className="w-5 h-5 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
};

export default Profile;
