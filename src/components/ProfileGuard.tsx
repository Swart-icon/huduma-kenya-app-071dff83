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
  "/inbox",
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
  const [hasCheckedOnce, setHasCheckedOnce] = useState(false);
  const [complete, setComplete] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user || !role) {
      setChecking(false);
      setHasCheckedOnce(true);
      setComplete(true);
      return;
    }

    // Don't guard exempt pages
    if (isExempt(location.pathname)) {
      setChecking(false);
      setHasCheckedOnce(true);
      setComplete(true);
      return;
    }

    checkProfile();
  }, [loading, user, role, location.pathname]);

  const checkProfile = async () => {
    if (!user || !role) return;
    // Only show the blocking spinner on the very first check.
    // Subsequent re-checks (e.g. after the WebView resumes from a gallery/camera
    // picker) must NOT unmount the current page — that would close any open
    // upload dialog and lose the selected media.
    if (!hasCheckedOnce) setChecking(true);

    try {
      if (role === "provider") {
        const [{ data: pub }, { data: priv }] = await Promise.all([
          supabase.from("provider_profiles").select("business_name, description, city, county").eq("user_id", user.id).maybeSingle(),
          supabase.from("provider_profiles_private").select("contact_phone").eq("user_id", user.id).maybeSingle(),
        ]);

        if (!pub || !pub.business_name || !priv?.contact_phone || !pub.city) {
          setComplete(false);
          navigate("/provider-profile/edit", { replace: true });
          return;
        }
      } else if (role === "job_seeker") {
        const [{ data: mp }, { data: priv }] = await Promise.all([
          supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle(),
          supabase.from("profiles_private").select("phone, location").eq("user_id", user.id).maybeSingle(),
        ]);

        if (!mp || !mp.full_name || !priv?.phone || !priv?.location) {
          setComplete(false);
          navigate("/job-seeker-profile", { replace: true });
          return;
        }
      } else if (role === "client") {
        const [{ data: mp }, { data: priv }] = await Promise.all([
          supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle(),
          supabase.from("profiles_private").select("phone").eq("user_id", user.id).maybeSingle(),
        ]);

        if (!mp || !mp.full_name || !priv?.phone) {
          setComplete(false);
          navigate("/profile", { replace: true });
          return;
        }
      }

      setComplete(true);
    } finally {
      setChecking(false);
      setHasCheckedOnce(true);
    }
  };

  // Do not blank/remount the current route after the first successful auth/profile
  // check. Mobile gallery/camera handoffs can trigger auth refresh events on app
  // resume; showing the full-screen loader here unmounts upload dialogs and drops
  // the user back to the feed while the selected file is only recoverable later.
  if ((loading && !hasCheckedOnce) || (checking && !hasCheckedOnce)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
};

export default ProfileGuard;
