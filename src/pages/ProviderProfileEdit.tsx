import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Camera, Save, Eye, Plus, Trash2, Upload, CheckCircle, Clock, XCircle, Image, Navigation, Loader2, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { KENYAN_LOCATIONS, getCoordinatesForCounty } from "@/lib/kenyanLocations";

const kenyanCounties = [
  "Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo-Marakwet", "Embu", "Garissa",
  "Homa Bay", "Isiolo", "Kajiado", "Kakamega", "Kericho", "Kiambu", "Kilifi",
  "Kirinyaga", "Kisii", "Kisumu", "Kitui", "Kwale", "Laikipia", "Lamu", "Machakos",
  "Makueni", "Mandera", "Marsabit", "Meru", "Migori", "Mombasa", "Murang'a",
  "Nairobi", "Nakuru", "Nandi", "Narok", "Nyamira", "Nyandarua", "Nyeri",
  "Samburu", "Siaya", "Taita-Taveta", "Tana River", "Tharaka-Nithi", "Trans-Nzoia",
  "Turkana", "Uasin Gishu", "Vihiga", "Wajir", "West Pokot",
];

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type ProviderProfile = {
  business_name: string;
  description: string;
  city: string;
  county: string;
  contact_phone: string;
  contact_email: string;
  profile_image_url: string;
  availability_status: string;
  years_experience: number;
  skills: string[];
  service_radius_km: number;
  latitude: number | null;
  longitude: number | null;
  service_type: string;
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

type Verification = {
  id: string;
  document_type: string;
  document_url: string;
  status: string;
  created_at: string;
};

const emptyProfile: ProviderProfile = {
  business_name: "", description: "", city: "", county: "",
  contact_phone: "", contact_email: "", profile_image_url: "",
  availability_status: "available", years_experience: 0, skills: [], service_radius_km: 10,
  latitude: null, longitude: null, service_type: "providing_services",
};

const ProviderProfileEdit = () => {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const portfolioInputRef = useRef<HTMLInputElement>(null);
  const verifyInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<ProviderProfile>(emptyProfile);
  const [isNew, setIsNew] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Portfolio
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [newPortfolioTitle, setNewPortfolioTitle] = useState("");
  const [uploadingPortfolio, setUploadingPortfolio] = useState(false);

  // Availability
  const [availability, setAvailability] = useState<Availability[]>(
    DAYS.map((_, i) => ({ day_of_week: i, start_time: "09:00", end_time: "17:00", is_available: i > 0 && i < 6 }))
  );

  // Skills
  const [newSkill, setNewSkill] = useState("");

  // Verification
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [verifyDocType, setVerifyDocType] = useState("national_id");
  const [uploadingVerify, setUploadingVerify] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  useEffect(() => {
    if (!authLoading && (!user || role !== "provider")) {
      navigate("/dashboard");
      return;
    }
    if (user) fetchAll();
  }, [authLoading, user, role]);

  const fetchAll = async () => {
    const [profRes, portRes, availRes, verifyRes] = await Promise.all([
      supabase.from("provider_profiles").select("*").eq("user_id", user!.id).maybeSingle(),
      supabase.from("portfolio_items").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }),
      supabase.from("provider_availability").select("*").eq("user_id", user!.id),
      supabase.from("provider_verifications").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }),
    ]);

    if (profRes.data) {
      setProfile({
        business_name: profRes.data.business_name || "",
        description: profRes.data.description || "",
        city: profRes.data.city || "",
        county: profRes.data.county || "",
        contact_phone: profRes.data.contact_phone || "",
        contact_email: profRes.data.contact_email || "",
        profile_image_url: profRes.data.profile_image_url || "",
        availability_status: profRes.data.availability_status || "available",
        years_experience: profRes.data.years_experience ?? 0,
        skills: profRes.data.skills ?? [],
        service_radius_km: profRes.data.service_radius_km ?? 10,
        latitude: profRes.data.latitude ?? null,
        longitude: profRes.data.longitude ?? null,
        service_type: (profRes.data as any).service_type || "providing_services",
      });
      setIsNew(false);
    }

    setPortfolio((portRes.data as PortfolioItem[]) || []);
    setVerifications((verifyRes.data as Verification[]) || []);

    if (availRes.data && availRes.data.length > 0) {
      setAvailability(DAYS.map((_, i) => {
        const existing = availRes.data.find((a: any) => a.day_of_week === i);
        return existing
          ? { day_of_week: i, start_time: existing.start_time, end_time: existing.end_time, is_available: existing.is_available }
          : { day_of_week: i, start_time: "09:00", end_time: "17:00", is_available: i > 0 && i < 6 };
      }));
    }
    setLoadingProfile(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const fileExt = file.name.split(".").pop();
    const filePath = `${user.id}/profile.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from("provider-images").upload(filePath, file, { upsert: true });
    if (uploadError) {
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
      setUploading(false);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from("provider-images").getPublicUrl(filePath);
    setProfile({ ...profile, profile_image_url: publicUrl });
    setUploading(false);
    toast({ title: "Image uploaded! 📸" });
  };

  const handlePortfolioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingPortfolio(true);
    const fileExt = file.name.split(".").pop();
    const filePath = `${user.id}/${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from("portfolio-images").upload(filePath, file);
    if (uploadError) {
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
      setUploadingPortfolio(false);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from("portfolio-images").getPublicUrl(filePath);
    const { data, error } = await supabase.from("portfolio_items").insert({
      user_id: user.id, image_url: publicUrl, title: newPortfolioTitle || "My work",
    }).select().single();
    setUploadingPortfolio(false);
    if (error) {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
    } else {
      setPortfolio([data as PortfolioItem, ...portfolio]);
      setNewPortfolioTitle("");
      toast({ title: "Portfolio item added! 🎨" });
    }
  };

  const handleDeletePortfolio = async (id: string) => {
    const { error } = await supabase.from("portfolio_items").delete().eq("id", id);
    if (!error) setPortfolio(portfolio.filter((p) => p.id !== id));
  };

  const handleVerifyUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingVerify(true);
    const fileExt = file.name.split(".").pop();
    const filePath = `${user.id}/${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from("verification-docs").upload(filePath, file);
    if (uploadError) {
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
      setUploadingVerify(false);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from("verification-docs").getPublicUrl(filePath);
    const { data, error } = await supabase.from("provider_verifications").insert({
      user_id: user.id, document_type: verifyDocType, document_url: publicUrl,
    }).select().single();
    setUploadingVerify(false);
    if (error) {
      toast({ title: "Failed to submit", description: error.message, variant: "destructive" });
    } else {
      setVerifications([data as Verification, ...verifications]);
      toast({ title: "Document submitted for review! 📄" });
    }
  };

  const addSkill = () => {
    const skill = newSkill.trim();
    if (skill && !profile.skills.includes(skill)) {
      setProfile({ ...profile, skills: [...profile.skills, skill] });
      setNewSkill("");
    }
  };

  const removeSkill = (skill: string) => {
    setProfile({ ...profile, skills: profile.skills.filter((s) => s !== skill) });
  };

  const updateAvailability = (dayIndex: number, field: keyof Availability, value: any) => {
    setAvailability(availability.map((a) => a.day_of_week === dayIndex ? { ...a, [field]: value } : a));
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "Geolocation not supported", variant: "destructive" });
      return;
    }
    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setProfile((p) => ({ ...p, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
        setDetectingLocation(false);
        toast({ title: "Location detected! 📍" });
      },
      () => {
        setDetectingLocation(false);
        toast({ title: "Could not detect location", description: "Please select a city manually", variant: "destructive" });
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  };

  const handleCountyChange = (county: string) => {
    const coords = getCoordinatesForCounty(county);
    setProfile((p) => ({
      ...p,
      county,
      latitude: p.latitude ?? coords?.lat ?? null,
      longitude: p.longitude ?? coords?.lng ?? null,
    }));
  };

  const handleManualCitySelect = (cityName: string) => {
    const city = KENYAN_LOCATIONS.find((c) => c.name === cityName);
    if (city) {
      setProfile((p) => ({ ...p, city: city.name, county: city.county, latitude: city.lat, longitude: city.lng }));
    }
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
      years_experience: profile.years_experience,
      skills: profile.skills,
      service_radius_km: profile.service_radius_km,
      latitude: profile.latitude,
      longitude: profile.longitude,
    };

    const { error } = isNew
      ? await supabase.from("provider_profiles").insert(payload)
      : await supabase.from("provider_profiles").update(payload).eq("user_id", user.id);

    // Save availability
    for (const avail of availability) {
      await supabase.from("provider_availability").upsert({
        user_id: user.id,
        day_of_week: avail.day_of_week,
        start_time: avail.start_time,
        end_time: avail.end_time,
        is_available: avail.is_available,
      }, { onConflict: "user_id,day_of_week" });
    }

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

  const verifyStatusIcon = (status: string) => {
    if (status === "approved") return <CheckCircle className="w-4 h-4 text-primary" />;
    if (status === "rejected") return <XCircle className="w-4 h-4 text-destructive" />;
    return <Clock className="w-4 h-4 text-muted-foreground" />;
  };

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
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </div>
        </div>
        {uploading && <p className="text-center text-sm text-muted-foreground mb-4">Uploading...</p>}

        {/* Basic Info */}
        <div className="space-y-5">
          <div>
            <Label className="text-sm font-semibold">Business Name *</Label>
            <Input value={profile.business_name} onChange={(e) => setProfile({ ...profile, business_name: e.target.value })} placeholder="e.g. Kamau Plumbing Services" className="h-12 rounded-xl mt-1.5" maxLength={100} />
          </div>

          <div>
            <Label className="text-sm font-semibold">Description</Label>
            <Textarea value={profile.description} onChange={(e) => setProfile({ ...profile, description: e.target.value })} placeholder="Tell clients what you do..." className="rounded-xl mt-1.5 min-h-[100px]" maxLength={500} />
            <p className="text-xs text-muted-foreground mt-1">{profile.description.length}/500</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-semibold">County *</Label>
              <Select value={profile.county} onValueChange={handleCountyChange}>
                <SelectTrigger className="h-12 rounded-xl mt-1.5"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {kenyanCounties.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-semibold">City / Town</Label>
              <Input value={profile.city} onChange={(e) => setProfile({ ...profile, city: e.target.value })} placeholder="e.g. Westlands" className="h-12 rounded-xl mt-1.5" />
            </div>
          </div>

          {/* Location Detection */}
          <Card className="border-dashed">
            <CardContent className="p-4 space-y-3">
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-primary" />
                Pin Your Location
              </Label>
              <p className="text-xs text-muted-foreground">
                Set your GPS coordinates so clients can find you on the map.
              </p>
              <Button
                type="button"
                variant={profile.latitude ? "secondary" : "default"}
                className="w-full rounded-xl h-11 gap-2"
                onClick={handleDetectLocation}
                disabled={detectingLocation}
              >
                {detectingLocation ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Navigation className="w-4 h-4" />
                )}
                {detectingLocation
                  ? "Detecting..."
                  : profile.latitude
                  ? "Location set ✓ — Re-detect"
                  : "Detect My Location"}
              </Button>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">or pick a city</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <Select onValueChange={handleManualCitySelect}>
                <SelectTrigger className="h-11 rounded-xl text-sm">
                  <SelectValue placeholder="Choose a major city" />
                </SelectTrigger>
                <SelectContent>
                  {KENYAN_LOCATIONS.map((city) => (
                    <SelectItem key={city.name} value={city.name}>
                      <span className="flex items-center gap-2">
                        <MapPin className="w-3 h-3 text-muted-foreground" />
                        {city.name}, {city.county}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {profile.latitude && profile.longitude && (
                <p className="text-[11px] text-muted-foreground text-center">
                  📍 Coordinates: {profile.latitude.toFixed(4)}, {profile.longitude.toFixed(4)}
                </p>
              )}
            </CardContent>
          </Card>

          <div>
            <Label className="text-sm font-semibold">Phone</Label>
            <Input value={profile.contact_phone} onChange={(e) => setProfile({ ...profile, contact_phone: e.target.value })} placeholder="+254 7XX XXX XXX" className="h-12 rounded-xl mt-1.5" />
          </div>

          <div>
            <Label className="text-sm font-semibold">Email</Label>
            <Input type="email" value={profile.contact_email} onChange={(e) => setProfile({ ...profile, contact_email: e.target.value })} placeholder="business@email.com" className="h-12 rounded-xl mt-1.5" />
          </div>

          <div>
            <Label className="text-sm font-semibold">Availability</Label>
            <Select value={profile.availability_status} onValueChange={(v) => setProfile({ ...profile, availability_status: v })}>
              <SelectTrigger className="h-12 rounded-xl mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="available">🟢 Available</SelectItem>
                <SelectItem value="busy">🟡 Busy</SelectItem>
                <SelectItem value="offline">🔴 Offline</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Years of Experience */}
          <div>
            <Label className="text-sm font-semibold">Years of Experience</Label>
            <Input type="number" min={0} max={50} value={profile.years_experience} onChange={(e) => setProfile({ ...profile, years_experience: parseInt(e.target.value) || 0 })} className="h-12 rounded-xl mt-1.5" />
          </div>

          {/* Service Radius */}
          <div>
            <Label className="text-sm font-semibold">Service Radius (km)</Label>
            <Input type="number" min={1} max={500} value={profile.service_radius_km} onChange={(e) => setProfile({ ...profile, service_radius_km: parseInt(e.target.value) || 10 })} className="h-12 rounded-xl mt-1.5" />
          </div>

          {/* Skills */}
          <div>
            <Label className="text-sm font-semibold">Skills & Tags</Label>
            <div className="flex gap-2 mt-1.5">
              <Input value={newSkill} onChange={(e) => setNewSkill(e.target.value)} placeholder="Add a skill..." className="h-10 rounded-xl flex-1" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())} />
              <Button size="sm" className="h-10 rounded-xl px-3" onClick={addSkill}><Plus className="w-4 h-4" /></Button>
            </div>
            {profile.skills.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {profile.skills.map((skill) => (
                  <Badge key={skill} variant="secondary" className="gap-1 cursor-pointer" onClick={() => removeSkill(skill)}>
                    {skill} <XCircle className="w-3 h-3" />
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Working Hours */}
        <Card className="mt-8">
          <CardContent className="p-5">
            <h3 className="font-semibold text-foreground mb-4">Working Hours</h3>
            <div className="space-y-3">
              {DAYS.map((day, i) => (
                <div key={day} className="flex items-center gap-2">
                  <button
                    onClick={() => updateAvailability(i, "is_available", !availability[i].is_available)}
                    className={`w-16 text-xs font-semibold py-1.5 rounded-lg transition-colors ${
                      availability[i].is_available ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {day.slice(0, 3)}
                  </button>
                  {availability[i].is_available ? (
                    <div className="flex items-center gap-1 flex-1">
                      <Input type="time" value={availability[i].start_time} onChange={(e) => updateAvailability(i, "start_time", e.target.value)} className="h-8 rounded-lg text-xs" />
                      <span className="text-xs text-muted-foreground">–</span>
                      <Input type="time" value={availability[i].end_time} onChange={(e) => updateAvailability(i, "end_time", e.target.value)} className="h-8 rounded-lg text-xs" />
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground flex-1">Closed</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Portfolio */}
        <Card className="mt-6">
          <CardContent className="p-5">
            <h3 className="font-semibold text-foreground mb-4">Portfolio</h3>
            <div className="flex gap-2 mb-4">
              <Input value={newPortfolioTitle} onChange={(e) => setNewPortfolioTitle(e.target.value)} placeholder="Work title..." className="h-10 rounded-xl flex-1" />
              <Button size="sm" className="h-10 rounded-xl px-3" onClick={() => portfolioInputRef.current?.click()} disabled={uploadingPortfolio}>
                <Image className="w-4 h-4" />
              </Button>
              <input ref={portfolioInputRef} type="file" accept="image/*" className="hidden" onChange={handlePortfolioUpload} />
            </div>
            {uploadingPortfolio && <p className="text-sm text-muted-foreground mb-3">Uploading...</p>}
            {portfolio.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No portfolio items yet</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {portfolio.map((item) => (
                  <div key={item.id} className="relative group rounded-xl overflow-hidden border">
                    <img src={item.image_url} alt={item.title} className="w-full h-24 object-cover" />
                    <div className="p-2">
                      <p className="text-xs font-medium text-foreground truncate">{item.title}</p>
                    </div>
                    <button
                      onClick={() => handleDeletePortfolio(item.id)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-destructive/90 text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Verification */}
        <Card className="mt-6">
          <CardContent className="p-5">
            <h3 className="font-semibold text-foreground mb-4">Verification Documents</h3>
            <p className="text-xs text-muted-foreground mb-4">Submit documents to get verified and earn a trust badge.</p>
            <div className="flex gap-2 mb-4">
              <Select value={verifyDocType} onValueChange={setVerifyDocType}>
                <SelectTrigger className="h-10 rounded-xl flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="national_id">National ID</SelectItem>
                  <SelectItem value="business_license">Business License</SelectItem>
                  <SelectItem value="certificate">Certificate</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" className="h-10 rounded-xl px-3" onClick={() => verifyInputRef.current?.click()} disabled={uploadingVerify}>
                <Upload className="w-4 h-4" />
              </Button>
              <input ref={verifyInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleVerifyUpload} />
            </div>
            {uploadingVerify && <p className="text-sm text-muted-foreground mb-3">Uploading...</p>}
            {verifications.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">No documents submitted</p>
            ) : (
              <div className="space-y-2">
                {verifications.map((v) => (
                  <div key={v.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-2">
                      {verifyStatusIcon(v.status)}
                      <span className="text-sm capitalize text-foreground">{v.document_type.replace("_", " ")}</span>
                    </div>
                    <Badge variant={v.status === "approved" ? "default" : v.status === "rejected" ? "destructive" : "secondary"} className="text-xs">
                      {v.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={saving} className="w-full h-14 text-lg font-bold rounded-xl mt-8" size="lg">
          <Save className="w-5 h-5 mr-2" />
          {saving ? "Saving..." : isNew ? "Create Profile" : "Save Changes"}
        </Button>
      </div>
    </div>
  );
};

export default ProviderProfileEdit;
