import { useAuth, type AppRole } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, LogOut, User, MapPin, Phone, Briefcase, Search, UserCheck, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const roleOptions: { value: AppRole; label: string; icon: React.ReactNode }[] = [
  { value: "provider", label: "Service Provider", icon: <Briefcase className="w-4 h-4" /> },
  { value: "job_seeker", label: "Job Seeker", icon: <Search className="w-4 h-4" /> },
  { value: "client", label: "Client", icon: <UserCheck className="w-4 h-4" /> },
];

const Profile = () => {
  const { user, role, roles, loading, signOut, addRole, removeRole } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState({ full_name: "", phone: "", location: "" });
  const [saving, setSaving] = useState(false);
  const [roleLoading, setRoleLoading] = useState<string | null>(null);

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

  const handleAddRole = async (r: AppRole) => {
    setRoleLoading(r);
    const { error } = await addRole(r);
    setRoleLoading(null);
    if (error) {
      toast({ title: "Failed to add role", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Added ${roleOptions.find((o) => o.value === r)?.label} role ✅` });
    }
  };

  const handleRemoveRole = async (r: AppRole) => {
    setRoleLoading(r);
    const { error } = await removeRole(r);
    setRoleLoading(null);
    if (error) {
      toast({ title: "Cannot remove role", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Removed ${roleOptions.find((o) => o.value === r)?.label} role` });
    }
  };

  if (loading) return null;

  const nonAdminRoles = roles.filter((r) => r !== "admin");
  const activeRoleLabel = roleOptions.find((r) => r.value === role)?.label || "User";

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
                <div className="flex flex-wrap gap-1 mt-1">
                  {nonAdminRoles.map((r) => (
                    <span key={r} className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${
                      r === role ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    }`}>
                      {roleOptions.find((o) => o.value === r)?.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Role Management */}
        <Card className="mb-6">
          <CardContent className="p-5">
            <h3 className="font-semibold text-foreground mb-3">Manage Roles</h3>
            <div className="space-y-2">
              {roleOptions.map((opt) => {
                const hasRole = (nonAdminRoles as string[]).includes(opt.value);
                const isOnlyRole = hasRole && nonAdminRoles.length === 1;
                const isLoading = roleLoading === opt.value;

                return (
                  <div key={opt.value} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      {opt.icon}
                      <span className="text-sm font-medium text-foreground">{opt.label}</span>
                    </div>
                    {hasRole ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs h-8 text-destructive"
                        disabled={isOnlyRole || isLoading}
                        onClick={() => handleRemoveRole(opt.value)}
                      >
                        {isLoading ? "..." : <><X className="w-3 h-3 mr-1" />Remove</>}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-8"
                        disabled={isLoading}
                        onClick={() => handleAddRole(opt.value)}
                      >
                        {isLoading ? "..." : <><Plus className="w-3 h-3 mr-1" />Add</>}
                      </Button>
                    )}
                  </div>
                );
              })}
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
