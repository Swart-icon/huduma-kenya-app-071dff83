import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Plus, X, Save, Loader2, MapPin, Locate,
  Phone, Mail, User as UserIcon, Upload, FileText, Trash2, AlertCircle, CheckCircle2,
} from "lucide-react";
import { useGeolocation } from "@/hooks/useGeolocation";

const COMMON_SKILLS = [
  "Plumbing", "Electrical", "Carpentry", "Painting", "Masonry",
  "Welding", "Landscaping", "Cleaning", "Cooking", "Driving",
  "Tutoring", "Photography", "Graphic Design", "Web Development",
  "Mechanic", "Tailoring", "Hairdressing", "Security", "Farming",
];

type DocItem = { name: string; url: string; path: string; type: string };

const JobSeekerProfile = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { requestLocation, location, status: geoStatus, error: geoError } = useGeolocation();

  // Personal (mandatory)
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [locationText, setLocationText] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Profile fields
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState("");
  const [experienceYears, setExperienceYears] = useState(0);
  const [experienceDesc, setExperienceDesc] = useState("");
  const [education, setEducation] = useState("");
  const [bio, setBio] = useState("");
  const [documents, setDocuments] = useState<DocItem[]>([]);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) { navigate("/login"); return; }
    if (user) loadAll();
  }, [authLoading, user]);

  // Reverse-geocode when GPS location resolves
  useEffect(() => {
    if (geoStatus === "granted" && location) {
      setCoords({ lat: location.latitude, lng: location.longitude });
      // Best-effort reverse geocoding via OSM Nominatim
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${location.latitude}&lon=${location.longitude}&zoom=12`)
        .then((r) => r.json())
        .then((d) => {
          const a = d?.address || {};
          const city = a.city || a.town || a.village || a.suburb || "";
          const county = a.county || a.state || "";
          const composed = [city, county].filter(Boolean).join(", ");
          if (composed) setLocationText(composed);
          else if (d?.display_name) setLocationText(String(d.display_name).split(",").slice(0, 2).join(",").trim());
        })
        .catch(() => {/* ignore */});
      toast({ title: "Location detected ✅" });
    }
    if (geoStatus === "denied" || geoStatus === "error" || geoStatus === "unavailable") {
      if (geoError) toast({ title: "Couldn't detect location", description: geoError, variant: "destructive" });
    }
  }, [geoStatus, location]);

  const loadAll = async () => {
    if (!user) return;
    const [profRes, jsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("job_seeker_profiles").select("*").eq("user_id", user.id).maybeSingle(),
    ]);

    setEmail(user.email || "");
    if (profRes.data) {
      setFullName(profRes.data.full_name || "");
      setPhone(profRes.data.phone || "");
      setLocationText(profRes.data.location || "");
    }
    if (jsRes.data) {
      const d: any = jsRes.data;
      setHasProfile(true);
      setSkills((d.skills as string[]) || []);
      setExperienceYears(d.experience_years || 0);
      setExperienceDesc(d.experience_description || "");
      setEducation(d.education || "");
      setBio(d.bio || "");
      setDocuments(Array.isArray(d.documents) ? (d.documents as DocItem[]) : []);
    }
    setLoading(false);
  };

  const addSkill = (skill: string) => {
    const s = skill.trim();
    if (s && !skills.includes(s)) setSkills([...skills, s]);
    setNewSkill("");
  };
  const removeSkill = (skill: string) => setSkills(skills.filter((s) => s !== skill));

  // ===== Validation =====
  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!fullName.trim()) e.fullName = "Full name is required";
    if (!phone.trim()) e.phone = "Mobile number is required";
    else if (!/^\+?[\d\s-]{7,}$/.test(phone.trim())) e.phone = "Enter a valid mobile number";
    if (!email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = "Enter a valid email";
    if (!locationText.trim()) e.location = "Location is required (enter manually or detect)";
    return e;
  }, [fullName, phone, email, locationText]);

  // ===== Completion (mandatory only) =====
  const completion = useMemo(() => {
    const checks = [
      !!fullName.trim(),
      !!phone.trim() && !errors.phone,
      !!email.trim() && !errors.email,
      !!locationText.trim(),
    ];
    const filled = checks.filter(Boolean).length;
    return Math.round((filled / checks.length) * 100);
  }, [fullName, phone, email, locationText, errors]);

  const isComplete = completion === 100;

  // ===== Document uploads =====
  const handleUploadDocs = async (files: FileList | null) => {
    if (!files || !user) return;
    setUploading(true);
    const uploaded: DocItem[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: `${file.name} too large`, description: "Max 10MB per file", variant: "destructive" });
        continue;
      }
      const ext = file.name.split(".").pop() || "bin";
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("job-seeker-docs").upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (upErr) {
        toast({ title: `Upload failed: ${file.name}`, description: upErr.message, variant: "destructive" });
        continue;
      }
      const { data: pub } = supabase.storage.from("job-seeker-docs").getPublicUrl(path);
      uploaded.push({ name: file.name, url: pub.publicUrl, path, type: file.type });
    }
    if (uploaded.length) setDocuments((d) => [...d, ...uploaded]);
    setUploading(false);
  };

  const removeDocument = async (doc: DocItem) => {
    await supabase.storage.from("job-seeker-docs").remove([doc.path]);
    setDocuments((d) => d.filter((x) => x.path !== doc.path));
  };

  // ===== Save =====
  const handleSave = async () => {
    if (!user) return;
    setShowErrors(true);
    if (Object.keys(errors).length > 0) {
      toast({ title: "Please fix the highlighted fields", variant: "destructive" });
      return;
    }
    setSaving(true);

    // 1. Update main profile (mandatory personal info)
    const { error: profErr } = await supabase.from("profiles").update({
      full_name: fullName.trim(),
      phone: phone.trim(),
      location: locationText.trim(),
    }).eq("user_id", user.id);

    if (profErr) {
      setSaving(false);
      toast({ title: "Failed to save profile", description: profErr.message, variant: "destructive" });
      return;
    }

    // 2. Upsert job_seeker_profiles
    const cityCounty = locationText.split(",").map((s) => s.trim());
    const payload = {
      user_id: user.id,
      skills,
      experience_years: experienceYears,
      experience_description: experienceDesc.trim() || null,
      education: education.trim() || null,
      bio: bio.trim() || null,
      preferred_city: cityCounty[0] || null,
      preferred_county: cityCounty[1] || cityCounty[0] || null,
      documents: documents as any,
    };

    const { error } = hasProfile
      ? await supabase.from("job_seeker_profiles").update(payload).eq("user_id", user.id)
      : await supabase.from("job_seeker_profiles").insert(payload);

    setSaving(false);
    if (error) {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
    } else {
      setHasProfile(true);
      toast({ title: "Profile saved! ✅" });
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const fieldErrClass = (key: string) =>
    showErrors && errors[key] ? "border-destructive focus-visible:ring-destructive" : "";

  const FieldError = ({ k }: { k: string }) =>
    showErrors && errors[k] ? (
      <p className="text-xs text-destructive flex items-center gap-1 mt-1">
        <AlertCircle className="w-3 h-3" />{errors[k]}
      </p>
    ) : null;

  const suggestedSkills = COMMON_SKILLS.filter((s) => !skills.includes(s));

  return (
    <div className="min-h-screen bg-background px-5 py-5 pb-24">
      <div className="max-w-lg mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground mb-5">
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        <h1 className="font-display text-2xl font-bold text-foreground mb-3">My Profile</h1>

        {/* Completion banner */}
        <Card className="border-0 shadow-sm rounded-2xl mb-4 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {isComplete
                  ? <CheckCircle2 className="w-4 h-4 text-primary" />
                  : <AlertCircle className="w-4 h-4 text-primary" />}
                <span className="text-sm font-semibold text-foreground">Profile Completion</span>
              </div>
              <span className="text-sm font-bold text-primary">{completion}%</span>
            </div>
            <Progress value={completion} className="h-2 rounded-full" />
            <p className="text-xs text-muted-foreground mt-1.5">
              {isComplete
                ? "All required information provided. You're all set!"
                : "Fill in the required fields below to reach 100%."}
            </p>
          </CardContent>
        </Card>

        {/* Personal Info (MANDATORY) */}
        <Card className="border-0 shadow-sm rounded-2xl mb-4">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-bold">Personal Information</Label>
              <Badge variant="outline" className="text-[10px] rounded-full">Required</Badge>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Full Name *</Label>
              <div className="relative mt-1">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  className={`h-10 rounded-xl pl-9 ${fieldErrClass("fullName")}`}
                />
              </div>
              <FieldError k="fullName" />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Mobile Number *</Label>
              <div className="relative mt-1">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+254 7XX XXX XXX"
                  className={`h-10 rounded-xl pl-9 ${fieldErrClass("phone")}`}
                />
              </div>
              <FieldError k="phone" />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Email *</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={`h-10 rounded-xl pl-9 ${fieldErrClass("email")}`}
                />
              </div>
              <FieldError k="email" />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Current Location *</Label>
              <div className="relative mt-1">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={locationText}
                  onChange={(e) => setLocationText(e.target.value)}
                  placeholder="e.g. Nairobi, Kenya"
                  className={`h-10 rounded-xl pl-9 ${fieldErrClass("location")}`}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={requestLocation}
                disabled={geoStatus === "requesting"}
                className="w-full mt-2 h-9 rounded-xl"
              >
                {geoStatus === "requesting" ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Detecting…</>
                ) : (
                  <><Locate className="w-4 h-4 mr-2" />Detect Location</>
                )}
              </Button>
              {coords && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  GPS: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                </p>
              )}
              <FieldError k="location" />
            </div>
          </CardContent>
        </Card>

        {/* Bio */}
        <Card className="border-0 shadow-sm rounded-2xl mb-4">
          <CardContent className="p-4 space-y-3">
            <Label className="text-sm font-bold">About Me</Label>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Brief introduction about yourself..."
              className="rounded-xl"
              maxLength={500}
            />
          </CardContent>
        </Card>

        {/* Skills */}
        <Card className="border-0 shadow-sm rounded-2xl mb-4">
          <CardContent className="p-4 space-y-3">
            <Label className="text-sm font-bold">Skills</Label>
            <div className="flex flex-wrap gap-1.5">
              {skills.map((s) => (
                <Badge key={s} variant="secondary" className="gap-1 pr-1 rounded-lg">
                  {s}
                  <button onClick={() => removeSkill(s)} className="hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill(newSkill))}
                placeholder="Add a skill..."
                className="h-10 rounded-xl flex-1"
              />
              <Button size="sm" variant="outline" className="rounded-xl h-10" onClick={() => addSkill(newSkill)} disabled={!newSkill.trim()}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {suggestedSkills.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Suggestions:</p>
                <div className="flex flex-wrap gap-1">
                  {suggestedSkills.slice(0, 8).map((s) => (
                    <button key={s} onClick={() => addSkill(s)} className="text-xs px-2 py-1 rounded-lg bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors">
                      + {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Experience */}
        <Card className="border-0 shadow-sm rounded-2xl mb-4">
          <CardContent className="p-4 space-y-3">
            <Label className="text-sm font-bold">Experience</Label>
            <div>
              <Label className="text-xs text-muted-foreground">Years of Experience</Label>
              <Input
                type="number"
                value={experienceYears}
                onChange={(e) => setExperienceYears(parseInt(e.target.value) || 0)}
                className="h-10 rounded-xl mt-1"
                min={0}
                max={50}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Description</Label>
              <Textarea
                value={experienceDesc}
                onChange={(e) => setExperienceDesc(e.target.value)}
                placeholder="Describe your work experience..."
                className="rounded-xl mt-1"
                maxLength={1000}
              />
            </div>
          </CardContent>
        </Card>

        {/* Education */}
        <Card className="border-0 shadow-sm rounded-2xl mb-4">
          <CardContent className="p-4 space-y-3">
            <Label className="text-sm font-bold">Education</Label>
            <Textarea
              value={education}
              onChange={(e) => setEducation(e.target.value)}
              placeholder="Your educational background..."
              className="rounded-xl"
              maxLength={500}
            />
          </CardContent>
        </Card>

        {/* Certifications & Documents (OPTIONAL) */}
        <Card className="border-0 shadow-sm rounded-2xl mb-6">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-bold">Certifications & ID Documents</Label>
              <Badge variant="outline" className="text-[10px] rounded-full">Optional</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Upload certificates, licenses or identification (ID, passport). PDF or image, max 10MB each.
            </p>

            {documents.length > 0 && (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div key={doc.path} className="flex items-center gap-2 p-2 rounded-xl bg-muted/50">
                    <FileText className="w-4 h-4 text-primary shrink-0" />
                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-xs text-foreground flex-1 truncate hover:underline">
                      {doc.name}
                    </a>
                    <button onClick={() => removeDocument(doc)} className="text-destructive hover:opacity-70">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <label className="block">
              <input
                type="file"
                accept="image/*,application/pdf"
                multiple
                onChange={(e) => handleUploadDocs(e.target.files)}
                className="hidden"
                disabled={uploading}
              />
              <div className={`border-2 border-dashed border-border rounded-xl p-4 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                {uploading ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" />
                ) : (
                  <>
                    <Upload className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
                    <p className="text-xs font-semibold text-foreground">Upload documents</p>
                    <p className="text-[10px] text-muted-foreground">Tap to choose files</p>
                  </>
                )}
              </div>
            </label>
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={saving} className="w-full rounded-xl h-12">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          {saving ? "Saving..." : "Save Profile"}
        </Button>
      </div>
    </div>
  );
};

export default JobSeekerProfile;
