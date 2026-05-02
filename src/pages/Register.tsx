import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  Briefcase,
  Search,
  UserCheck,
  Eye,
  EyeOff,
  Mail,
  Check,
  MapPin,
  Loader2,
  Globe,
  Languages,
  ShieldCheck,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { AppRole } from "@/contexts/AuthContext";
import {
  detectCurrentLocation,
  formatPublicLocation,
  type DetailedLocation,
} from "@/lib/locationDetection";
import { KENYAN_COUNTIES, getCitiesByCounty } from "@/lib/kenyanLocations";

type Step = "credentials" | "verify_email" | "role" | "locale";

const SELECTABLE_ROLES = ["provider", "job_seeker", "client"] as const;
type SelectableRole = (typeof SELECTABLE_ROLES)[number];

const roleOptions: { value: SelectableRole; label: string; description: string; icon: React.ReactNode }[] = [
  { value: "provider", label: "Service Provider", description: "Offer your skills & services", icon: <Briefcase className="w-7 h-7" /> },
  { value: "job_seeker", label: "Job Seeker", description: "Find jobs & upload your CV", icon: <Search className="w-7 h-7" /> },
  { value: "client", label: "Client", description: "Post jobs & book services", icon: <UserCheck className="w-7 h-7" /> },
];

// East African Community focus
const COUNTRIES = [
  { code: "KE", name: "Kenya" },
  { code: "UG", name: "Uganda" },
  { code: "TZ", name: "Tanzania" },
  { code: "RW", name: "Rwanda" },
];

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "sw", name: "Swahili / Kiswahili" },
];

const Register = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedRole = searchParams.get("role") as AppRole | null;
  const { user, roles, loading, signUp, setUserRoles } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("credentials");

  // Form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Multi-select roles
  const initialRoles = new Set<SelectableRole>();
  if (preselectedRole && (SELECTABLE_ROLES as readonly string[]).includes(preselectedRole)) {
    initialRoles.add(preselectedRole as SelectableRole);
  }
  const [selectedRoles, setSelectedRoles] = useState<Set<SelectableRole>>(initialRoles);

  // Locale + location
  const [country, setCountry] = useState<string>("Kenya");
  const [language, setLanguage] = useState<string>("en");
  const [detectedLocation, setDetectedLocation] = useState<DetailedLocation | null>(null);
  const [detecting, setDetecting] = useState(false);

  // Manual fallback
  const [manualCounty, setManualCounty] = useState<string>("");
  const [manualCity, setManualCity] = useState<string>("");
  const [manualArea, setManualArea] = useState<string>("");

  useEffect(() => {
    if (loading || !user) return;
    const nonAdmin = roles.filter((r) => r !== "admin");
    if (nonAdmin.length === 0) {
      setStep("role");
    } else if (step === "credentials" || step === "verify_email") {
      navigate("/videos");
    }
  }, [loading, user, roles, navigate, step]);

  const passwordStrength = (() => {
    if (password.length < 6) return { level: 0, label: "Too short", color: "bg-muted" };
    if (password.length < 8) return { level: 1, label: "Weak", color: "bg-secondary" };
    if (/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) return { level: 3, label: "Strong", color: "bg-primary" };
    return { level: 2, label: "Medium", color: "bg-accent" };
  })();

  const toggleRole = (r: SelectableRole) => {
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || password.length < 6) {
      toast({ title: "Please fill all fields", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await signUp(email, password, fullName);
    setSubmitting(false);
    if (error) {
      toast({ title: "Registration failed", description: error.message, variant: "destructive" });
    } else {
      setStep("verify_email");
    }
  };

  const handleRoleContinue = () => {
    if (selectedRoles.size === 0) {
      toast({
        title: "Pick at least one role",
        description: "Choose Client, Service Provider, Job Seeker — or any combination.",
        variant: "destructive",
      });
      return;
    }
    setStep("locale");
  };

  const handleDetectLocation = async () => {
    setDetecting(true);
    try {
      const loc = await detectCurrentLocation();
      setDetectedLocation(loc);
      // Mirror into manual fields so the user can review/edit
      setManualCounty(loc.county || "");
      setManualCity(loc.city || "");
      setManualArea(loc.area || "");
      if (loc.country) setCountry(loc.country);
      toast({
        title: "Location detected",
        description: `Approx: ${loc.approximate}`,
      });
    } catch (err) {
      toast({
        title: "Couldn't detect location",
        description: err instanceof Error ? err.message : "Try the manual selectors below.",
        variant: "destructive",
      });
    } finally {
      setDetecting(false);
    }
  };

  const finalLocation = (() => {
    // Prefer any manual override (lets user correct GPS), but keep detected coords if present
    const city = manualCity.trim() || detectedLocation?.city || "";
    const county = manualCounty.trim() || detectedLocation?.county || "";
    const area = manualArea.trim() || detectedLocation?.area || "";
    return {
      city,
      county,
      area,
      latitude: detectedLocation?.latitude ?? null,
      longitude: detectedLocation?.longitude ?? null,
    };
  })();

  const canFinish = !!country && !!language && (!!finalLocation.city || !!finalLocation.county);

  const handleFinish = async () => {
    if (!user) {
      toast({ title: "Not signed in", variant: "destructive" });
      return;
    }
    if (selectedRoles.size === 0) {
      toast({ title: "Pick at least one role", variant: "destructive" });
      setStep("role");
      return;
    }
    if (!canFinish) {
      toast({
        title: "Location is required",
        description: "Detect your location or pick County / City manually.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    // 1. Persist roles
    const { error: roleError } = await setUserRoles(Array.from(selectedRoles));
    if (roleError) {
      setSubmitting(false);
      toast({ title: "Failed to set roles", description: roleError.message, variant: "destructive" });
      return;
    }

    // 2. Persist locale + location on profile (precise coords stored privately)
    const publicLabel = formatPublicLocation({
      city: finalLocation.city,
      county: finalLocation.county,
    });

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        country,
        language,
        county: finalLocation.county || null,
        city: finalLocation.city || null,
        area: finalLocation.area || null,
        latitude: finalLocation.latitude,
        longitude: finalLocation.longitude,
        location: publicLabel, // public-friendly label only
      })
      .eq("user_id", user.id);

    setSubmitting(false);

    if (profileError) {
      toast({
        title: "Couldn't save profile",
        description: profileError.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Welcome to HudumaHub! 🎉",
      description: `Roles: ${Array.from(selectedRoles).length} active`,
    });
    navigate("/videos");
  };



  // ─── Verify email ───
  if (step === "verify_email") {
    return (
      <div className="min-h-screen bg-background px-6 py-8">
        <div className="max-w-sm mx-auto flex flex-col items-center justify-center min-h-[70vh] text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <Mail className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">Check your email</h1>
          <p className="text-muted-foreground mb-6">
            We've sent a verification link to <strong className="text-foreground">{email}</strong>. Please confirm your email to continue.
          </p>
          <p className="text-sm text-muted-foreground mb-8">After verifying, come back and sign in to choose your roles.</p>
          <Button onClick={() => navigate("/login")} className="w-full h-14 text-lg font-bold rounded-xl" size="lg">
            Go to Sign In
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ─── Step: Roles (multi-select) ───
  if (step === "role") {
    return (
      <div className="min-h-screen bg-background px-6 py-8">
        <div className="max-w-sm mx-auto">
          <button onClick={() => setStep("credentials")} className="flex items-center gap-2 text-muted-foreground mb-6">
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">Choose your roles</h1>
          <p className="text-muted-foreground mb-2">Pick one, two, or all three. You can switch between dashboards anytime.</p>
          <p className="text-xs text-muted-foreground mb-6">At least one role is required.</p>

          <div className="space-y-3 mb-6">
            {roleOptions.map((r) => {
              const isSelected = selectedRoles.has(r.value);
              return (
                <Card
                  key={r.value}
                  className={`cursor-pointer transition-all duration-200 ${
                    isSelected ? "ring-2 ring-primary border-primary shadow-lg" : "hover:border-primary/50"
                  }`}
                  onClick={() => toggleRole(r.value)}
                >
                  <CardContent className="flex items-center gap-4 p-4">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleRole(r.value)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={r.label}
                    />
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                        isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {r.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground">{r.label}</h3>
                      <p className="text-sm text-muted-foreground truncate">{r.description}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {selectedRoles.size === 0 && (
            <p className="text-xs text-destructive mb-4 text-center">Select at least one role to continue.</p>
          )}

          <Button
            onClick={handleRoleContinue}
            disabled={selectedRoles.size === 0}
            className="w-full h-14 text-lg font-bold rounded-xl"
            size="lg"
          >
            Continue ({selectedRoles.size})
          </Button>
        </div>
      </div>
    );
  }

  // ─── Step: Locale + Location ───
  if (step === "locale") {
    const cities = manualCounty ? getCitiesByCounty(manualCounty) : [];
    const publicPreview = formatPublicLocation({
      city: finalLocation.city,
      county: finalLocation.county,
    });

    return (
      <div className="min-h-screen bg-background px-6 py-8">
        <div className="max-w-sm mx-auto">
          <button onClick={() => setStep("role")} className="flex items-center gap-2 text-muted-foreground mb-6">
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">Tell us where you are</h1>
          <p className="text-muted-foreground mb-6">
            We use this to match you with nearby people. Only an approximate location is shown publicly.
          </p>

          {/* Country + Language */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div>
              <Label className="text-sm font-semibold flex items-center gap-1.5 mb-1.5">
                <Globe className="w-4 h-4" /> Country
              </Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-semibold flex items-center gap-1.5 mb-1.5">
                <Languages className="w-4 h-4" /> Language
              </Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.code} value={l.code}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Detect button */}
          <Button
            type="button"
            variant="outline"
            onClick={handleDetectLocation}
            disabled={detecting}
            className="w-full h-12 rounded-xl mb-4 border-2 font-semibold"
          >
            {detecting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Detecting…
              </>
            ) : (
              <>
                <MapPin className="w-4 h-4 mr-2" /> Detect Location
              </>
            )}
          </Button>

          <div className="text-center text-xs text-muted-foreground mb-4">— or pick manually —</div>

          {/* Manual cascading selectors */}
          <div className="space-y-3 mb-5">
            <div>
              <Label className="text-sm font-semibold mb-1.5 block">County</Label>
              <Select
                value={manualCounty}
                onValueChange={(v) => {
                  setManualCounty(v);
                  setManualCity("");
                }}
              >
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue placeholder="Select your county" />
                </SelectTrigger>
                <SelectContent>
                  {KENYAN_COUNTIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-semibold mb-1.5 block">City / Town</Label>
              <Select value={manualCity} onValueChange={setManualCity} disabled={!manualCounty}>
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue placeholder={manualCounty ? "Select a city/town" : "Pick a county first"} />
                </SelectTrigger>
                <SelectContent>
                  {cities.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-semibold mb-1.5 block">
                Area / Neighbourhood <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                value={manualArea}
                onChange={(e) => setManualArea(e.target.value)}
                placeholder="e.g. Mikinduri"
                maxLength={80}
                className="h-12 rounded-xl"
              />
            </div>
          </div>

          {/* Privacy preview */}
          {(finalLocation.city || finalLocation.county) && (
            <div className="rounded-xl bg-muted/50 border border-border p-3 mb-5 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div className="text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Public preview</p>
                <p>{publicPreview}</p>
                {finalLocation.area && (
                  <p className="mt-1 italic">
                    Area "{finalLocation.area}" stays private — only used for matching.
                  </p>
                )}
              </div>
            </div>
          )}

          <Button
            onClick={handleFinish}
            disabled={!canFinish || submitting}
            className="w-full h-14 text-lg font-bold rounded-xl"
            size="lg"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Check className="w-5 h-5 mr-2" /> Finish setup
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // ─── Step: Credentials ───
  return (
    <div className="min-h-screen bg-background px-6 py-8">
      <div className="max-w-sm mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground mb-6">
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        <h1 className="font-display text-2xl font-bold text-foreground mb-2">Create account</h1>
        <p className="text-muted-foreground mb-8">Join Kenya's marketplace</p>

        <Button
          variant="outline"
          className="w-full h-12 rounded-xl mb-6 border-2 font-semibold"
          onClick={handleGoogleSignIn}
          disabled={submitting}
        >
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </Button>

        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 h-px bg-border" />
          <span className="text-sm text-muted-foreground">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <form onSubmit={handleCredentialsSubmit} className="space-y-5">
          <div>
            <Label htmlFor="fullName" className="text-sm font-semibold">Full Name</Label>
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Kamau" maxLength={100} className="h-12 rounded-xl mt-1.5" />
          </div>
          <div>
            <Label htmlFor="email" className="text-sm font-semibold">Email</Label>
            <div className="relative mt-1.5">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@example.com" maxLength={255} className="h-12 rounded-xl pl-10" />
            </div>
          </div>
          <div>
            <Label htmlFor="password" className="text-sm font-semibold">Password</Label>
            <div className="relative mt-1.5">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 6 characters"
                maxLength={72}
                className="h-12 rounded-xl pr-10"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {password.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < passwordStrength.level ? passwordStrength.color : "bg-muted"}`} />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{passwordStrength.label}</p>
              </div>
            )}
          </div>
          <Button type="submit" disabled={submitting} className="w-full h-14 text-lg font-bold rounded-xl" size="lg">
            {submitting ? "Creating account..." : "Create Account"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-semibold hover:underline">Sign In</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
