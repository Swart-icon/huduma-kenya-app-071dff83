import { useAuth, type AppRole } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, LogOut, User, MapPin, Phone, Briefcase, Search, UserCheck, Plus, X, Video, Camera, Receipt, Bell } from "lucide-react";
import { useRef } from "react";
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
  const [profile, setProfile] = useState({ full_name: "", phone: "", location: "", avatar_url: "" });
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [roleLoading, setRoleLoading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !user) navigate("/welcome");
  }, [loading, user, navigate]);

  useEffect(() => {
    if (user) {
      supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => {
        if (data) setProfile({ full_name: data.full_name || "", phone: data.phone || "", location: data.location || "", avatar_url: data.avatar_url || "" });
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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please select an image file", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image must be under 5MB", variant: "destructive" });
      return;
    }
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = pub.publicUrl;
      const { error: dbErr } = await supabase.from("profiles").update({ avatar_url: url }).eq("user_id", user.id);
      if (dbErr) throw dbErr;
      setProfile((p) => ({ ...p, avatar_url: url }));
      toast({ title: "Profile picture updated ✅" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (loading) return null;

  const nonAdminRoles = roles.filter((r) => r !== "admin");
  const activeRoleLabel = roleOptions.find((r) => r.value === role)?.label || "User";

  return (
    <div className="min-h-screen bg-background px-6 py-8">
      <div className="max-w-sm mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground mb-6">
          <ArrowLeft className="w-5 h-5" />
          <span>Dashboard</span>
        </button>

        {(!profile.full_name || !profile.phone) && (
          <div className="mb-4 p-3 rounded-xl bg-primary/10 border border-primary/20">
            <p className="text-sm font-semibold text-primary">⚠️ Complete your profile to continue</p>
            <p className="text-xs text-muted-foreground mt-0.5">Fill in your full name and phone number to access the dashboard.</p>
          </div>
        )}

        <h1 className="font-display text-2xl font-bold text-foreground mb-6">Your Profile</h1>

        <Card className="mb-6">
          <CardContent className="p-5">
            <div className="flex items-center gap-4 mb-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="relative w-16 h-16 rounded-xl bg-primary flex items-center justify-center overflow-hidden group shrink-0"
                aria-label="Change profile picture"
              >
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-7 h-7 text-primary-foreground" />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                  <Camera className="w-5 h-5 text-white" />
                </div>
                {uploadingAvatar && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
              <div className="min-w-0">
                <p className="font-semibold text-foreground truncate">{profile.full_name || "No name set"}</p>
                <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-primary font-semibold mt-1"
                >
                  {profile.avatar_url ? "Change photo" : "Add photo"}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {nonAdminRoles.map((r) => (
                <span key={r} className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${
                  r === role ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}>
                  {roleOptions.find((o) => o.value === r)?.label}
                </span>
              ))}
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

        <Button variant="outline" onClick={() => navigate(`/user/${user?.id}/videos`)} className="w-full h-12 rounded-xl mt-6 border-2 font-semibold">
          <Video className="w-5 h-5 mr-2" />
          My Videos
        </Button>

        <Button variant="outline" onClick={handleLogout} className="w-full h-12 rounded-xl mt-4 border-2 text-secondary font-semibold">
          <LogOut className="w-5 h-5 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
};

export default Profile;
