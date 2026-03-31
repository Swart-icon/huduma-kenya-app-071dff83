import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Camera, Save, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const kenyanCounties = [
  "Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo-Marakwet", "Embu", "Garissa",
  "Homa Bay", "Isiolo", "Kajiado", "Kakamega", "Kericho", "Kiambu", "Kilifi",
  "Kirinyaga", "Kisii", "Kisumu", "Kitui", "Kwale", "Laikipia", "Lamu", "Machakos",
  "Makueni", "Mandera", "Marsabit", "Meru", "Migori", "Mombasa", "Murang'a",
  "Nairobi", "Nakuru", "Nandi", "Narok", "Nyamira", "Nyandarua", "Nyeri",
  "Samburu", "Siaya", "Taita-Taveta", "Tana River", "Tharaka-Nithi", "Trans-Nzoia",
  "Turkana", "Uasin Gishu", "Vihiga", "Wajir", "West Pokot",
];

type ProviderProfile = {
  business_name: string;
  description: string;
  city: string;
  county: string;
  contact_phone: string;
  contact_email: string;
  profile_image_url: string;
  availability_status: string;
};

const emptyProfile: ProviderProfile = {
  business_name: "",
  description: "",
  city: "",
  county: "",
  contact_phone: "",
  contact_email: "",
  profile_image_url: "",
  availability_status: "available",
};

const ProviderProfileEdit = () => {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<ProviderProfile>(emptyProfile);
  const [isNew, setIsNew] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

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

    if (data) {
      setProfile({
        business_name: data.business_name || "",
        description: data.description || "",
        city: data.city || "",
        county: data.county || "",
        contact_phone: data.contact_phone || "",
        contact_email: data.contact_email || "",
        profile_image_url: data.profile_image_url || "",
        availability_status: data.availability_status || "available",
      });
      setIsNew(false);
    }
    setLoadingProfile(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    const fileExt = file.name.split(".").pop();
    const filePath = `${user.id}/profile.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("provider-images")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("provider-images")
      .getPublicUrl(filePath);

    setProfile({ ...profile, profile_image_url: publicUrl });
    setUploading(false);
    toast({ title: "Image uploaded! 📸" });
  };

  const handleSave = async () => {
    if (!user) return;
    if (!profile.business_name.trim()) {
      toast({ title: "Business name is required", variant: "destructive" });
      return;
    }
    if (!profile.county) {
      toast({ title: "Please select a county", variant: "destructive" });
      return;
    }

    setSaving(true);

    const payload = {
      user_id: user.id,
      business_name: profile.business_name.trim(),
      description: profile.description.trim(),
      city: profile.city.trim(),
      county: profile.county,
      contact_phone: profile.contact_phone.trim(),
      contact_email: profile.contact_email.trim(),
      profile_image_url: profile.profile_image_url,
      availability_status: profile.availability_status,
    };

    const { error } = isNew
      ? await supabase.from("provider_profiles").insert(payload)
      : await supabase.from("provider_profiles").update(payload).eq("user_id", user.id);

    setSaving(false);

    if (error) {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
    } else {
      toast({ title: isNew ? "Profile created! 🎉" : "Profile updated! ✅" });
      setIsNew(false);
    }
  };

  if (authLoading || loadingProfile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-6 py-6 pb-24">
      <div className="max-w-sm mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2 text-muted-foreground">
            <ArrowLeft className="w-5 h-5" />
            <span>Dashboard</span>
          </button>
          <Button variant="ghost" size="sm" onClick={() => navigate("/provider-profile/preview")} className="gap-1.5">
            <Eye className="w-4 h-4" />
            Preview
          </Button>
        </div>

        <h1 className="font-display text-2xl font-bold text-foreground mb-6">
          {isNew ? "Create Business Profile" : "Edit Business Profile"}
        </h1>

        {/* Profile Image */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            <div
              className="w-28 h-28 rounded-2xl bg-muted flex items-center justify-center overflow-hidden border-2 border-border cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              {profile.profile_image_url ? (
                <img src={profile.profile_image_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <Camera className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg"
            >
              <Camera className="w-4 h-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
          </div>
        </div>
        {uploading && <p className="text-center text-sm text-muted-foreground mb-4">Uploading...</p>}

        {/* Form */}
        <div className="space-y-5">
          <div>
            <Label className="text-sm font-semibold">Business Name *</Label>
            <Input
              value={profile.business_name}
              onChange={(e) => setProfile({ ...profile, business_name: e.target.value })}
              placeholder="e.g. Kamau Plumbing Services"
              className="h-12 rounded-xl mt-1.5"
              maxLength={100}
            />
          </div>

          <div>
            <Label className="text-sm font-semibold">Description</Label>
            <Textarea
              value={profile.description}
              onChange={(e) => setProfile({ ...profile, description: e.target.value })}
              placeholder="Tell clients what you do, your experience, and specialties..."
              className="rounded-xl mt-1.5 min-h-[100px]"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground mt-1">{profile.description.length}/500</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-semibold">County *</Label>
              <Select value={profile.county} onValueChange={(v) => setProfile({ ...profile, county: v })}>
                <SelectTrigger className="h-12 rounded-xl mt-1.5">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {kenyanCounties.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-semibold">City / Town</Label>
              <Input
                value={profile.city}
                onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                placeholder="e.g. Westlands"
                className="h-12 rounded-xl mt-1.5"
              />
            </div>
          </div>

          <div>
            <Label className="text-sm font-semibold">Phone</Label>
            <Input
              value={profile.contact_phone}
              onChange={(e) => setProfile({ ...profile, contact_phone: e.target.value })}
              placeholder="+254 7XX XXX XXX"
              className="h-12 rounded-xl mt-1.5"
            />
          </div>

          <div>
            <Label className="text-sm font-semibold">Email</Label>
            <Input
              type="email"
              value={profile.contact_email}
              onChange={(e) => setProfile({ ...profile, contact_email: e.target.value })}
              placeholder="business@email.com"
              className="h-12 rounded-xl mt-1.5"
            />
          </div>

          <div>
            <Label className="text-sm font-semibold">Availability</Label>
            <Select value={profile.availability_status} onValueChange={(v) => setProfile({ ...profile, availability_status: v })}>
              <SelectTrigger className="h-12 rounded-xl mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">🟢 Available</SelectItem>
                <SelectItem value="busy">🟡 Busy</SelectItem>
                <SelectItem value="offline">🔴 Offline</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full h-14 text-lg font-bold rounded-xl" size="lg">
            <Save className="w-5 h-5 mr-2" />
            {saving ? "Saving..." : isNew ? "Create Profile" : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProviderProfileEdit;
