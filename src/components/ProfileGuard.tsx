import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Pages that are ALWAYS accessible (no profile guard).
 * Profile edit pages must be exempt so users can actually fill their profiles.
 */
const EXEMPT_PATHS = [
  "/welcome", "/login", "/register", "/onboarding",
  "/forgot-password", "/reset-password",
  "/privacy-policy", "/terms-of-service",
  "/profile",                    // basic profile edit
  "/provider-profile/edit",      // provider profile edit
  "/job-seeker-profile",         // job seeker profile edit
  "/job-seeker",                 // job seeker hub (accessible from video feed tab)
  "/videos",                     // public video feed
  "/live",                       // public live stream viewer
  "/help",
];

const isExempt = (pathname: string) =>
  EXEMPT_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

/**
 * Wraps the app routes. If a logged-in user with a role hasn't completed
 * their profile, they are redirected to the appropriate profile page.
 */
const ProfileGuard = ({ children }: { children: React.ReactNode }) => {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [complete, setComplete] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user || !role) {
      setChecking(false);
      setComplete(true);
      return;
    }

    // Don't guard exempt pages
    if (isExempt(location.pathname)) {
      setChecking(false);
      setComplete(true);
      return;
    }

    checkProfile();
  }, [loading, user, role, location.pathname]);

  const checkProfile = async () => {
    if (!user || !role) return;
    setChecking(true);

    try {
      if (role === "provider") {
        const { data } = await supabase
          .from("provider_profiles")
          .select("business_name, description, city, county, contact_phone")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!data || !data.business_name || !data.contact_phone || !data.city) {
          setComplete(false);
          navigate("/provider-profile/edit", { replace: true });
          return;
        }
      } else if (role === "job_seeker") {
        const { data: mp } = await supabase
          .from("profiles")
          .select("full_name, phone, location")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!mp || !mp.full_name || !mp.phone || !mp.location) {
          setComplete(false);
          navigate("/job-seeker-profile", { replace: true });
          return;
        }
      } else if (role === "client") {
        const { data } = await supabase
          .from("profiles")
          .select("full_name, phone, location")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!data || !data.full_name || !data.phone) {
          setComplete(false);
          navigate("/profile", { replace: true });
          return;
        }
      }

      setComplete(true);
    } finally {
      setChecking(false);
    }
  };

  if (loading || checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
};

export default ProfileGuard;
