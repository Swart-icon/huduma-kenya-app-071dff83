import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { lovable } from "@/integrations/lovable";
import { ArrowLeft, Briefcase, Search, UserCheck, Eye, EyeOff, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type AppRole = "provider" | "job_seeker" | "client";
type Step = "credentials" | "role";

const roles: { value: AppRole; label: string; description: string; icon: React.ReactNode }[] = [
  { value: "provider", label: "Service Provider", description: "Offer your skills & services", icon: <Briefcase className="w-7 h-7" /> },
  { value: "job_seeker", label: "Job Seeker", description: "Find jobs & upload your CV", icon: <Search className="w-7 h-7" /> },
  { value: "client", label: "Client", description: "Post jobs & book services", icon: <UserCheck className="w-7 h-7" /> },
];

const Register = () => {
  const navigate = useNavigate();
  const { user, role, loading, signUp, setUserRole } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("credentials");

  // When user is authenticated (e.g. after Google sign-in) but has no role, show role selection
  useEffect(() => {
    if (!loading && user && !role) {
      setStep("role");
    }
    if (!loading && user && role) {
      navigate("/dashboard");
    }
  }, [loading, user, role, navigate]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AppRole | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const passwordStrength = (() => {
    if (password.length < 6) return { level: 0, label: "Too short", color: "bg-muted" };
    if (password.length < 8) return { level: 1, label: "Weak", color: "bg-secondary" };
    if (/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) return { level: 3, label: "Strong", color: "bg-primary" };
    return { level: 2, label: "Medium", color: "bg-accent" };
  })();

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || password.length < 6) {
      toast({ title: "Please fill all fields", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await signUp(email, password, fullName);
    setLoading(false);
    if (error) {
      toast({ title: "Registration failed", description: error.message, variant: "destructive" });
    } else {
      setStep("role");
    }
  };

  const handleRoleSelect = async () => {
    if (!selectedRole) return;
    setLoading(true);
    const { error } = await setUserRole(selectedRole);
    setLoading(false);
    if (error) {
      toast({ title: "Failed to set role", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Welcome to Huduma! 🎉", description: `You're registered as a ${roles.find(r => r.value === selectedRole)?.label}` });
      navigate("/dashboard");
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast({ title: "Google sign-in failed", description: String(result.error), variant: "destructive" });
    }
    setLoading(false);
  };

  if (step === "role") {
    return (
      <div className="min-h-screen bg-background px-6 py-8">
        <div className="max-w-sm mx-auto">
          <button onClick={() => setStep("credentials")} className="flex items-center gap-2 text-muted-foreground mb-6">
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">Choose your role</h1>
          <p className="text-muted-foreground mb-8">How will you use Huduma?</p>
          <div className="space-y-4 mb-8">
            {roles.map((r) => (
              <Card
                key={r.value}
                className={`cursor-pointer transition-all duration-200 ${
                  selectedRole === r.value
                    ? "ring-2 ring-primary border-primary shadow-lg"
                    : "hover:border-primary/50"
                }`}
                onClick={() => setSelectedRole(r.value)}
              >
                <CardContent className="flex items-center gap-4 p-5">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${
                    selectedRole === r.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    {r.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{r.label}</h3>
                    <p className="text-sm text-muted-foreground">{r.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Button
            onClick={handleRoleSelect}
            disabled={!selectedRole || loading}
            className="w-full h-14 text-lg font-bold rounded-xl"
            size="lg"
          >
            {loading ? "Setting up..." : "Continue"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-6 py-8">
      <div className="max-w-sm mx-auto">
        <button onClick={() => navigate("/welcome")} className="flex items-center gap-2 text-muted-foreground mb-6">
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        <h1 className="font-display text-2xl font-bold text-foreground mb-2">Create account</h1>
        <p className="text-muted-foreground mb-8">Join Kenya's marketplace</p>

        <Button
          variant="outline"
          className="w-full h-12 rounded-xl mb-6 border-2 font-semibold"
          onClick={handleGoogleSignIn}
          disabled={loading}
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
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Kamau" className="h-12 rounded-xl mt-1.5" />
          </div>
          <div>
            <Label htmlFor="email" className="text-sm font-semibold">Email</Label>
            <div className="relative mt-1.5">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@example.com" className="h-12 rounded-xl pl-10" />
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
          <Button type="submit" disabled={loading} className="w-full h-14 text-lg font-bold rounded-xl" size="lg">
            {loading ? "Creating account..." : "Create Account"}
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
