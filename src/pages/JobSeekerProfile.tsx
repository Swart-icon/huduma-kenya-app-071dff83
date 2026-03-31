import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, X, Save, Loader2 } from "lucide-react";
import { useCategories } from "@/hooks/useCategories";

const COMMON_SKILLS = [
  "Plumbing", "Electrical", "Carpentry", "Painting", "Masonry",
  "Welding", "Landscaping", "Cleaning", "Cooking", "Driving",
  "Tutoring", "Photography", "Graphic Design", "Web Development",
  "Mechanic", "Tailoring", "Hairdressing", "Security", "Farming",
];

const JobSeekerProfile = () => {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: categories = [] } = useCategories();

  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState("");
  const [experienceYears, setExperienceYears] = useState(0);
  const [experienceDesc, setExperienceDesc] = useState("");
  const [education, setEducation] = useState("");
  const [certifications, setCertifications] = useState("");
  const [bio, setBio] = useState("");
  const [preferredCounty, setPreferredCounty] = useState("");
  const [preferredCity, setPreferredCity] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || role !== "job_seeker")) {
      navigate("/dashboard");
      return;
    }
    if (user) loadProfile();
  }, [authLoading, user, role]);

  const loadProfile = async () => {
    const { data } = await supabase
      .from("job_seeker_profiles")
      .select("*")
      .eq("user_id", user!.id)
      .maybeSingle();

    if (data) {
      setHasProfile(true);
      setSkills((data.skills as string[]) || []);
      setExperienceYears(data.experience_years || 0);
      setExperienceDesc(data.experience_description || "");
      setEducation(data.education || "");
      setCertifications(data.certifications || "");
      setBio(data.bio || "");
      setPreferredCounty(data.preferred_county || "");
      setPreferredCity(data.preferred_city || "");
    }
    setLoading(false);
  };

  const addSkill = (skill: string) => {
    const s = skill.trim();
    if (s && !skills.includes(s)) {
      setSkills([...skills, s]);
    }
    setNewSkill("");
  };

  const removeSkill = (skill: string) => {
    setSkills(skills.filter((s) => s !== skill));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const payload = {
      user_id: user.id,
      skills,
      experience_years: experienceYears,
      experience_description: experienceDesc.trim() || null,
      education: education.trim() || null,
      certifications: certifications.trim() || null,
      bio: bio.trim() || null,
      preferred_county: preferredCounty.trim() || null,
      preferred_city: preferredCity.trim() || null,
    };

    let error;
    if (hasProfile) {
      ({ error } = await supabase
        .from("job_seeker_profiles")
        .update(payload)
        .eq("user_id", user.id));
    } else {
      ({ error } = await supabase
        .from("job_seeker_profiles")
        .insert(payload));
    }

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

  const suggestedSkills = COMMON_SKILLS.filter((s) => !skills.includes(s));

  return (
    <div className="min-h-screen bg-background px-5 py-5 pb-24">
      <div className="max-w-lg mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground mb-5">
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        <h1 className="font-display text-2xl font-bold text-foreground mb-5">My Profile</h1>

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

        {/* Certifications */}
        <Card className="border-0 shadow-sm rounded-2xl mb-4">
          <CardContent className="p-4 space-y-3">
            <Label className="text-sm font-bold">Certifications</Label>
            <Textarea
              value={certifications}
              onChange={(e) => setCertifications(e.target.value)}
              placeholder="Any relevant certifications or licenses..."
              className="rounded-xl"
              maxLength={500}
            />
          </CardContent>
        </Card>

        {/* Preferred Location */}
        <Card className="border-0 shadow-sm rounded-2xl mb-6">
          <CardContent className="p-4 space-y-3">
            <Label className="text-sm font-bold">Preferred Location</Label>
            <Input
              value={preferredCounty}
              onChange={(e) => setPreferredCounty(e.target.value)}
              placeholder="County (e.g., Nairobi)"
              className="h-10 rounded-xl"
            />
            <Input
              value={preferredCity}
              onChange={(e) => setPreferredCity(e.target.value)}
              placeholder="City/Town"
              className="h-10 rounded-xl"
            />
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
