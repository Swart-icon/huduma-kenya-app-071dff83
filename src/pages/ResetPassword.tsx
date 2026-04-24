import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Eye, EyeOff, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type LinkStatus = "checking" | "valid" | "invalid" | "expired";

const ResetPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [linkStatus, setLinkStatus] = useState<LinkStatus>("checking");
  const [linkError, setLinkError] = useState<string>("");

  useEffect(() => {
    const verifyRecoveryLink = async () => {
      // Newer Supabase recovery flow uses ?code=... in the query string
      const code = searchParams.get("code");
      const errorParam = searchParams.get("error");
      const errorCode = searchParams.get("error_code");
      const errorDescription = searchParams.get("error_description");

      // Legacy hash-based recovery (#access_token=...&type=recovery)
      const hash = window.location.hash;
      const hashParams = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
      const hashError = hashParams.get("error");
      const hashErrorCode = hashParams.get("error_code");
      const hashErrorDescription = hashParams.get("error_description");
      const hasRecoveryHash = hashParams.get("type") === "recovery" && hashParams.get("access_token");

      // Surface explicit error params from Supabase
      const anyError = errorParam || hashError;
      const anyErrorCode = errorCode || hashErrorCode;
      const anyErrorDescription = errorDescription || hashErrorDescription;

      if (anyError || anyErrorCode) {
        const isExpired =
          anyErrorCode === "otp_expired" ||
          anyError === "access_denied" ||
          /expired/i.test(anyErrorDescription ?? "");
        setLinkStatus(isExpired ? "expired" : "invalid");
        setLinkError(
          anyErrorDescription
            ? decodeURIComponent(anyErrorDescription.replace(/\+/g, " "))
            : isExpired
              ? "This reset link has expired."
              : "This reset link is invalid."
        );
        return;
      }

      // Exchange ?code=... for a session (PKCE / new flow)
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          const isExpired = /expired|invalid/i.test(error.message);
          setLinkStatus(isExpired ? "expired" : "invalid");
          setLinkError(error.message);
          return;
        }
        setLinkStatus("valid");
        return;
      }

      // Legacy hash-based recovery — Supabase auto-sets the session, listen for it
      if (hasRecoveryHash) {
        setLinkStatus("valid");
        return;
      }

      // Otherwise, wait briefly for PASSWORD_RECOVERY event before declaring invalid
      const timeout = setTimeout(async () => {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          setLinkStatus("valid");
        } else {
          setLinkStatus("invalid");
          setLinkError("No reset link detected. Please request a new password reset email.");
        }
      }, 600);

      return () => clearTimeout(timeout);
    };

    verifyRecoveryLink();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setLinkStatus("valid");
      }
    });

    return () => subscription.unsubscribe();
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "Password too short", description: "Must be at least 6 characters", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) {
      toast({ title: "Failed to reset password", description: error.message, variant: "destructive" });
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background px-6 py-8">
        <div className="max-w-sm mx-auto flex flex-col items-center justify-center min-h-[70vh] text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <CheckCircle className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">Password updated!</h1>
          <p className="text-muted-foreground mb-8">Your password has been successfully reset.</p>
          <Button onClick={() => navigate("/dashboard")} className="w-full h-14 text-lg font-bold rounded-xl" size="lg">
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (linkStatus === "checking") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm">Verifying reset link…</p>
        </div>
      </div>
    );
  }

  if (linkStatus === "invalid" || linkStatus === "expired") {
    const isExpired = linkStatus === "expired";
    return (
      <div className="min-h-screen bg-background px-6 py-8">
        <div className="max-w-sm mx-auto flex flex-col items-center justify-center min-h-[70vh] text-center">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">
            {isExpired ? "Reset link expired" : "Invalid reset link"}
          </h1>
          <p className="text-muted-foreground mb-2">
            {isExpired
              ? "This password reset link is no longer valid. Reset links expire after a short time for your security."
              : "We couldn't verify this reset link. It may have already been used or was malformed."}
          </p>
          {linkError && (
            <p className="text-xs text-muted-foreground/80 mb-8 italic">{linkError}</p>
          )}
          <Button
            onClick={() => navigate("/forgot-password")}
            className="w-full h-14 text-lg font-bold rounded-xl mt-4"
            size="lg"
          >
            Request New Link
          </Button>
          <Button
            onClick={() => navigate("/login")}
            variant="ghost"
            className="w-full h-12 rounded-xl mt-2"
          >
            Back to Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-6 py-8">
      <div className="max-w-sm mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground mb-6">
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        <h1 className="font-display text-2xl font-bold text-foreground mb-2">Set new password</h1>
        <p className="text-muted-foreground mb-8">Choose a strong password for your account</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label htmlFor="password" className="text-sm font-semibold">New Password</Label>
            <div className="relative mt-1.5">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 6 characters"
                className="h-12 rounded-xl pr-10"
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <div>
            <Label htmlFor="confirmPassword" className="text-sm font-semibold">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat password"
              className="h-12 rounded-xl mt-1.5"
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" disabled={submitting} className="w-full h-14 text-lg font-bold rounded-xl" size="lg">
            {submitting ? "Updating..." : "Update Password"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
