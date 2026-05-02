import { useEffect, useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Eye, EyeOff, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Login = () => {
  const navigate = useNavigate();
  const { user, role, roles, loading: authLoading, signIn } = useAuth();
  const [searchParams] = useSearchParams();
  const roleParam = searchParams.get("role");
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      const hasNonAdminRole = roles.filter((r) => r !== "admin").length > 0;
      if (hasNonAdminRole) {
        navigate("/videos");
      } else {
        navigate(roleParam ? `/register?role=${roleParam}` : "/register");
      }
    }
  }, [authLoading, user, roles, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast({ title: "Please fill all fields", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    if (error) {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
    } else {
      navigate("/videos");
    }
  };

  return (
    <div className="min-h-screen bg-background px-6 py-8">
      <div className="max-w-sm mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground mb-6">
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        <h1 className="font-display text-2xl font-bold text-foreground mb-2">Welcome back</h1>
        <p className="text-muted-foreground mb-8">Sign in to your account</p>

        <form onSubmit={handleSubmit} className="space-y-5">
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
                placeholder="Your password"
                className="h-12 rounded-xl pr-10"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <Button type="submit" disabled={submitting} className="w-full h-14 text-lg font-bold rounded-xl" size="lg">
            {submitting ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <div className="text-center mt-4">
          <Link to="/forgot-password" className="text-sm text-primary font-semibold hover:underline">
            Forgot password?
          </Link>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-4">
          Don't have an account?{" "}
          <Link to={roleParam ? `/register?role=${roleParam}` : "/register"} className="text-primary font-semibold hover:underline">Create Account</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
