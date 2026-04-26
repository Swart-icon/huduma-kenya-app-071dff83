import { useAuth, type AppRole } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import servioLogo from "@/assets/serviohub-logo-transparent.png";
import {
  Briefcase, HelpCircle, Map as MapIcon, Search, UserCheck,
  LogOut, User, Shield, List, Grid, FileText, Calendar,
  ClipboardList, MessageCircle, Bell, Star, MapPin, ChevronRight,
  Settings, PlusCircle, TrendingUp, Eye, Navigation as NavigationIcon,
  Video, Lightbulb, Bookmark, Send, Plus, Inbox as InboxIcon,
  Zap, Sparkles, Rocket, Target, Award,
} from "lucide-react";
import { useUnreadCount } from "@/hooks/useUnreadCount";
import { useInboxUnread } from "@/hooks/useInboxUnread";
import { InstallBanner } from "@/components/InstallBanner";
import { StoryBar } from "@/components/stories/StoryBar";
import NearbyServicesSection from "@/components/NearbyServicesSection";
import { ThemeToggle } from "@/components/ThemeToggle";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";

/* ────────── Role Config ────────── */
const roleConfig: Record<string, { title: string; subtitle: string; icon: React.ReactNode; gradient: string }> = {
  provider: { title: "Service Provider", subtitle: "Manage your services & bookings", icon: <Briefcase className="w-5 h-5" />, gradient: "from-primary to-primary/80" },
  job_seeker: { title: "Job Seeker", subtitle: "Find opportunities & grow your career", icon: <Search className="w-5 h-5" />, gradient: "from-accent to-accent/80" },
  client: { title: "Client", subtitle: "Post jobs & book services", icon: <UserCheck className="w-5 h-5" />, gradient: "from-secondary to-secondary/80" },
  admin: { title: "Administrator", subtitle: "Manage platform", icon: <Shield className="w-5 h-5" />, gradient: "from-destructive to-destructive/80" },
};

/* ────────── Section Header ────────── */
const SectionHeader = ({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) => (
  <div className="flex items-center justify-between mb-3">
    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{title}</h3>
    {action && (
      <button onClick={onAction} className="text-xs text-primary font-semibold flex items-center gap-0.5">
        {action} <ChevronRight className="w-3 h-3" />
      </button>
    )}
  </div>
);

/* ────────── Action Card ────────── */
const ActionCard = ({ icon, label, description, onClick, accent = "bg-primary/10 text-primary", badge }: {
  icon: React.ReactNode; label: string; description: string; onClick: () => void; accent?: string; badge?: number;
}) => (
  <Card className="border-0 shadow-sm rounded-2xl cursor-pointer hover:shadow-md transition-all active:scale-[0.98]" onClick={onClick}>
    <CardContent className="flex items-center gap-4 p-4">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${accent}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{label}</span>
          {badge !== undefined && badge > 0 && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">{badge}</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{description}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" />
    </CardContent>
  </Card>
);

/* ────────── Stat Chip ────────── */
const StatChip = ({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) => (
  <div className="flex flex-col items-center gap-1">
    <div className="w-10 h-10 rounded-2xl bg-primary-foreground/20 flex items-center justify-center">{icon}</div>
    <span className="text-lg font-bold text-primary-foreground">{value}</span>
    <span className="text-[10px] text-primary-foreground/70">{label}</span>
  </div>
);

/* ────────── Main Dashboard ────────── */
const Dashboard = () => {
  const { user, role, roles, loading, isAdmin, isSuspended, signOut } = useAuth();
  const navigate = useNavigate();
  const { unreadMessages, unreadNotifications } = useUnreadCount();
  const inboxUnread = useInboxUnread();
  const [stats, setStats] = useState({ services: 0, bookings: 0, rating: 0, jobPosts: 0, applications: 0, savedJobs: 0 });
  const [profileCompletion, setProfileCompletion] = useState<number | null>(null);

  const hasNonAdminRole = roles.filter((r) => r !== "admin").length > 0;

  useEffect(() => {
    if (!loading && !user) navigate("/welcome");
    if (!loading && user && !hasNonAdminRole) navigate("/register");
  }, [loading, user, hasNonAdminRole, navigate]);

  useEffect(() => {
    if (!user || !role) return;
    fetchStats();
  }, [user, role]);

  const fetchStats = async () => {
    if (!user) return;
    if (role === "provider") {
      const [svcRes, bookRes, revRes] = await Promise.all([
        supabase.from("services").select("id", { count: "exact", head: true }).eq("provider_id", user.id),
        supabase.from("bookings").select("id", { count: "exact", head: true }).eq("provider_id", user.id),
        supabase.from("reviews").select("rating").eq("provider_id", user.id),
      ]);
      const ratings = revRes.data || [];
      const avg = ratings.length > 0 ? (ratings.reduce((s, r) => s + r.rating, 0) / ratings.length) : 0;
      setStats(prev => ({ ...prev, services: svcRes.count || 0, bookings: bookRes.count || 0, rating: Math.round(avg * 10) / 10 }));
    } else if (role === "client") {
      const [jobRes, bookRes] = await Promise.all([
        supabase.from("job_posts").select("id", { count: "exact", head: true }).eq("client_id", user.id),
        supabase.from("bookings").select("id", { count: "exact", head: true }).eq("client_id", user.id),
      ]);
      setStats(prev => ({ ...prev, jobPosts: jobRes.count || 0, bookings: bookRes.count || 0 }));
    } else if (role === "job_seeker") {
      const [appRes, savedRes, profileRes] = await Promise.all([
        supabase.from("job_applications").select("id", { count: "exact", head: true }).eq("applicant_id", user.id),
        supabase.from("saved_jobs").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("job_seeker_profiles").select("*").eq("user_id", user.id).maybeSingle(),
      ]);
      setStats(prev => ({ ...prev, applications: appRes.count || 0, savedJobs: savedRes.count || 0 }));
      if (profileRes.data) {
        const p = profileRes.data;
        let filled = 0;
        const total = 7;
        if ((p.skills as string[])?.length > 0) filled++;
        if (p.experience_years && p.experience_years > 0) filled++;
        if (p.experience_description) filled++;
        if (p.education) filled++;
        if (p.certifications) filled++;
        if (p.bio) filled++;
        if (p.cv_url) filled++;
        setProfileCompletion(Math.round((filled / total) * 100));
      } else {
        setProfileCompletion(0);
      }
    }
  };

  if (loading || !role) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const config = roleConfig[role] || roleConfig.client;
  const firstName = user?.user_metadata?.full_name?.split(" ")[0] || "there";

  const handleLogout = async () => {
    await signOut();
    navigate("/welcome");
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <InstallBanner />

      {/* ─── Top Bar ─── */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border/40">
        <div className="flex items-center justify-between px-5 py-2.5 max-w-lg mx-auto">
          <img src={servioLogo} alt="Servio" className="h-12 w-auto" />
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => navigate("/conversations")} className="rounded-full h-9 w-9 relative">
              <MessageCircle className="w-[18px] h-[18px]" />
              {unreadMessages > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 text-[9px] font-bold rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">{unreadMessages}</span>}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate("/inbox")} className="rounded-full h-9 w-9 relative">
              <InboxIcon className="w-[18px] h-[18px]" />
              {inboxUnread > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 text-[9px] font-bold rounded-full bg-primary text-primary-foreground flex items-center justify-center">{inboxUnread}</span>}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate("/notifications")} className="rounded-full h-9 w-9 relative">
              <Bell className="w-[18px] h-[18px]" />
              {unreadNotifications > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 text-[9px] font-bold rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">{unreadNotifications}</span>}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate("/profile")} className="rounded-full h-9 w-9">
              <User className="w-[18px] h-[18px]" />
            </Button>
          </div>
        </div>
      </div>

      <div className="px-5 max-w-lg mx-auto pt-4 space-y-5">

        {/* ─── Welcome Card with Stats ─── */}
        <Card className="border-0 shadow-lg rounded-3xl overflow-hidden">
          <div className={`bg-gradient-to-br ${config.gradient} p-5 pb-4`}>
            <div className="flex items-center justify-between mb-2 gap-2">
              <span className="text-[11px] font-medium text-primary-foreground/70 bg-primary-foreground/10 px-2.5 py-0.5 rounded-full shrink-0">{config.title}</span>
              <div className="flex items-center gap-1">
                <RoleSwitcher />
                <Button variant="ghost" size="sm" onClick={handleLogout} className="h-7 px-2 text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10 text-[11px] rounded-full">
                  <LogOut className="w-3 h-3 mr-1" /> Logout
                </Button>
              </div>
            </div>
            <h2 className="font-display text-xl font-bold text-primary-foreground mt-1">Welcome, {firstName}! 👋</h2>
            <p className="text-xs text-primary-foreground/60 mt-0.5 mb-4">{config.subtitle}</p>

            {/* Inline Stats */}
            {role === "provider" && (
              <div className="flex items-center justify-around bg-primary-foreground/10 rounded-2xl p-3">
                <StatChip icon={<List className="w-4 h-4 text-primary-foreground" />} value={stats.services} label="Services" />
                <div className="w-px h-8 bg-primary-foreground/20" />
                <StatChip icon={<Calendar className="w-4 h-4 text-primary-foreground" />} value={stats.bookings} label="Bookings" />
                <div className="w-px h-8 bg-primary-foreground/20" />
                <StatChip icon={<Star className="w-4 h-4 text-primary-foreground" />} value={stats.rating || "—"} label="Rating" />
              </div>
            )}
            {role === "client" && (
              <div className="flex items-center justify-around bg-primary-foreground/10 rounded-2xl p-3">
                <StatChip icon={<FileText className="w-4 h-4 text-primary-foreground" />} value={stats.jobPosts} label="Jobs Posted" />
                <div className="w-px h-8 bg-primary-foreground/20" />
                <StatChip icon={<Calendar className="w-4 h-4 text-primary-foreground" />} value={stats.bookings} label="Bookings" />
              </div>
            )}
            {role === "job_seeker" && (
              <div className="flex items-center justify-around bg-primary-foreground/10 rounded-2xl p-3">
                <StatChip icon={<Send className="w-4 h-4 text-primary-foreground" />} value={stats.applications} label="Applied" />
                <div className="w-px h-8 bg-primary-foreground/20" />
                <StatChip icon={<Bookmark className="w-4 h-4 text-primary-foreground" />} value={stats.savedJobs} label="Saved" />
              </div>
            )}
          </div>
        </Card>

        {/* ─── Suspension Warning ─── */}
        {isSuspended && (
          <Card className="border-destructive/40 bg-destructive/5 rounded-2xl">
            <CardContent className="p-4 flex items-center gap-3">
              <Shield className="w-5 h-5 text-destructive shrink-0" />
              <div>
                <p className="font-bold text-destructive text-sm">Account Suspended</p>
                <p className="text-xs text-muted-foreground">Some features may be restricted.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── Tips Card ─── */}
        <Card className="border-0 shadow-sm rounded-2xl bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2.5">
              <Lightbulb className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-foreground">Quick Tips</span>
            </div>
            <ul className="space-y-1.5">
              {role === "provider" && (
                <>
                  <li className="text-xs text-muted-foreground flex items-start gap-2"><span className="text-primary mt-0.5">•</span>Share stories & boost your visibility</li>
                  <li className="text-xs text-muted-foreground flex items-start gap-2"><span className="text-primary mt-0.5">•</span>List your services to get discovered</li>
                  <li className="text-xs text-muted-foreground flex items-start gap-2"><span className="text-primary mt-0.5">•</span>Complete your business profile</li>
                </>
              )}
              {role === "client" && (
                <>
                  <li className="text-xs text-muted-foreground flex items-start gap-2"><span className="text-primary mt-0.5">•</span>Post a job to find skilled professionals</li>
                  <li className="text-xs text-muted-foreground flex items-start gap-2"><span className="text-primary mt-0.5">•</span>Browse nearby services for quick booking</li>
                  <li className="text-xs text-muted-foreground flex items-start gap-2"><span className="text-primary mt-0.5">•</span>Leave reviews to help the community</li>
                </>
              )}
              {role === "job_seeker" && (
                <>
                  <li className="text-xs text-muted-foreground flex items-start gap-2"><span className="text-primary mt-0.5">•</span>Complete your profile to stand out</li>
                  <li className="text-xs text-muted-foreground flex items-start gap-2"><span className="text-primary mt-0.5">•</span>Upload your CV for better chances</li>
                  <li className="text-xs text-muted-foreground flex items-start gap-2"><span className="text-primary mt-0.5">•</span>Save jobs you like and apply early</li>
                </>
              )}
            </ul>
          </CardContent>
        </Card>

        {/* ═══════════ PROVIDER DASHBOARD ═══════════ */}
        {role === "provider" && (
          <>
            {/* Quick Actions */}
            <div>
              <SectionHeader title="Quick Actions" />
              <div className="grid grid-cols-2 gap-3">
                <Button className="h-auto py-4 rounded-2xl flex flex-col gap-1.5 shadow-sm" onClick={() => navigate("/services/new")}>
                  <PlusCircle className="w-6 h-6" />
                  <span className="text-xs font-semibold">Create Service</span>
                </Button>
                <Button variant="outline" className="h-auto py-4 rounded-2xl flex flex-col gap-1.5 shadow-sm border-0 bg-muted/50" onClick={() => navigate("/videos")}>
                  <Video className="w-6 h-6 text-primary" />
                  <span className="text-xs font-semibold">Add Story</span>
                </Button>
              </div>
            </div>

            {/* Story Bar */}
            <StoryBar />

            {/* Your Business */}
            <div>
              <SectionHeader title="Your Business" />
              <div className="space-y-2.5">
                <ActionCard icon={<Eye className="w-5 h-5" />} label="Business Profile" description="View & edit your profile" onClick={() => navigate("/provider-profile/preview")} />
                <ActionCard icon={<List className="w-5 h-5" />} label="My Services" description="Manage your service listings" onClick={() => navigate("/my-services")} accent="bg-accent/15 text-accent-foreground" />
                <ActionCard icon={<Calendar className="w-5 h-5" />} label="My Bookings" description="View & manage bookings" onClick={() => navigate("/my-bookings")} accent="bg-secondary/10 text-secondary" />
              </div>
            </div>

            {/* Job Board */}
            <div>
              <SectionHeader title="Job Board" />
              <ActionCard icon={<ClipboardList className="w-5 h-5" />} label="Browse Jobs" description="Find open job posts from clients" onClick={() => navigate("/job-board")} accent="bg-primary/10 text-primary" />
            </div>

            {/* Content */}
            {/* Discover */}
            <div>
              <SectionHeader title="Discover" />
              <ActionCard icon={<Star className="w-5 h-5" />} label="My Reviews" description="View client feedback" onClick={() => navigate(`/provider/${user?.id}/reviews`)} accent="bg-accent/15 text-accent-foreground" />
            </div>
          </>
        )}

        {/* ═══════════ CLIENT DASHBOARD ═══════════ */}
        {role === "client" && (
          <>
            {/* Quick Actions */}
            <div>
              <SectionHeader title="Quick Actions" />
              <div className="grid grid-cols-2 gap-3">
                <Button className="h-auto py-4 rounded-2xl flex flex-col gap-1.5 shadow-sm" onClick={() => navigate("/jobs/new")}>
                  <PlusCircle className="w-6 h-6" />
                  <span className="text-xs font-semibold">Post a Job</span>
                </Button>
                <Button variant="outline" className="h-auto py-4 rounded-2xl flex flex-col gap-1.5 shadow-sm border-0 bg-muted/50" onClick={() => navigate("/client-applications")}>
                  <ClipboardList className="w-6 h-6 text-primary" />
                  <span className="text-xs font-semibold">My Applications</span>
                </Button>
              </div>
            </div>

            {/* Your Activity */}
            <div>
              <SectionHeader title="Your Activity" />
              <div className="space-y-2.5">
                <ActionCard icon={<FileText className="w-5 h-5" />} label="My Job Posts" description="Post & manage jobs" onClick={() => navigate("/my-jobs")} accent="bg-secondary/10 text-secondary" />
                <ActionCard icon={<ClipboardList className="w-5 h-5" />} label="My Applications" description="Track applicants for your jobs" onClick={() => navigate("/client-applications")} accent="bg-primary/10 text-primary" />
                <ActionCard icon={<Calendar className="w-5 h-5" />} label="My Bookings" description="Track service bookings" onClick={() => navigate("/my-bookings")} />
              </div>
            </div>

            {/* Nearby Services */}
            <NearbyServicesSection />

            {/* Explore */}
            <div>
              <SectionHeader title="Explore" />
              <div className="space-y-2.5">
                <ActionCard icon={<NavigationIcon className="w-5 h-5" />} label="Nearby Services" description="Discover services close to you" onClick={() => navigate("/nearby")} />
                <ActionCard icon={<Search className="w-5 h-5" />} label="Search Services" description="Find services with filters" onClick={() => navigate("/search")} accent="bg-accent/15 text-accent-foreground" />
                <ActionCard icon={<Grid className="w-5 h-5" />} label="Browse Categories" description="Explore services by category" onClick={() => navigate("/categories")} accent="bg-secondary/10 text-secondary" />
                <ActionCard icon={<MapIcon className="w-5 h-5" />} label="Service Map" description="Find providers on a map" onClick={() => navigate("/map")} />
              </div>
            </div>

          </>
        )}

        {/* ═══════════ JOB SEEKER DASHBOARD ═══════════ */}
        {role === "job_seeker" && (
          <>
            {/* Profile Completion */}
            {profileCompletion !== null && profileCompletion < 100 && (
              <Card className="border-0 shadow-sm rounded-2xl cursor-pointer" onClick={() => navigate("/job-seeker-profile")}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-primary" />
                      <span className="text-sm font-semibold text-foreground">Profile Completion</span>
                    </div>
                    <span className="text-sm font-bold text-primary">{profileCompletion}%</span>
                  </div>
                  <Progress value={profileCompletion} className="h-2 rounded-full" />
                  <p className="text-xs text-muted-foreground mt-1.5">Complete your profile to stand out</p>
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <div>
              <SectionHeader title="Quick Actions" />
              <div className="grid grid-cols-2 gap-3">
                <Button className="h-auto py-4 rounded-2xl flex flex-col gap-1.5 shadow-sm" onClick={() => navigate("/job-board")}>
                  <Briefcase className="w-6 h-6" />
                  <span className="text-xs font-semibold">Browse Jobs</span>
                </Button>
                <Button variant="outline" className="h-auto py-4 rounded-2xl flex flex-col gap-1.5 shadow-sm border-0 bg-muted/50" onClick={() => navigate("/saved-jobs")}>
                  <Bookmark className="w-6 h-6 text-primary" />
                  <span className="text-xs font-semibold">Saved Jobs</span>
                </Button>
              </div>
            </div>

            {/* Story Bar */}
            <StoryBar />

            {/* Opportunities */}
            <div>
              <SectionHeader title="Opportunities" />
              <div className="space-y-2.5">
                <ActionCard icon={<Briefcase className="w-5 h-5" />} label="Job Seeker Hub" description="Dashboard, applications & profile" onClick={() => navigate("/job-seeker")} />
                <ActionCard icon={<ClipboardList className="w-5 h-5" />} label="Job Board" description="Browse available jobs" onClick={() => navigate("/job-board")} accent="bg-accent/15 text-accent-foreground" />
                <ActionCard icon={<TrendingUp className="w-5 h-5" />} label="My Applications" description="Track your job applications" onClick={() => navigate("/my-applications")} accent="bg-secondary/10 text-secondary" />
                <ActionCard icon={<Star className="w-5 h-5" />} label="Saved Jobs" description="Your bookmarked jobs" onClick={() => navigate("/saved-jobs")} accent="bg-muted text-muted-foreground" />
              </div>
            </div>

            {/* Build Your Profile */}
            <div>
              <SectionHeader title="Build Your Profile" />
              <ActionCard icon={<User className="w-5 h-5" />} label="Job Seeker Profile" description="Update skills, CV & experience" onClick={() => navigate("/job-seeker-profile")} />
            </div>

          </>
        )}

        {/* ─── Admin Link ─── */}
        {isAdmin && (
          <ActionCard icon={<Shield className="w-5 h-5" />} label="Admin Panel" description="Manage users, services & analytics" onClick={() => navigate("/admin")} accent="bg-destructive/10 text-destructive" />
        )}

        {/* ─── Settings ─── */}
        <div>
          <SectionHeader title="Settings" />
          <div className="space-y-2.5">
            <Card className="border-0 shadow-sm rounded-2xl">
              <CardContent className="p-4">
                <p className="text-sm font-semibold text-foreground mb-2">Theme</p>
                <ThemeToggle />
              </CardContent>
            </Card>
            <ActionCard icon={<HelpCircle className="w-5 h-5" />} label="Help Center" description="FAQs, guides & support" onClick={() => navigate("/help")} />
            <ActionCard icon={<Settings className="w-5 h-5" />} label="Security" description="Manage sessions & password" onClick={() => navigate("/security")} accent="bg-muted text-muted-foreground" />
          </div>
        </div>

        <p className="text-center text-[11px] text-muted-foreground mt-6 mb-2">
          Servio — Connecting Kenya's Services 🇰🇪
        </p>
      </div>

      {/* ─── Floating Action Button ─── */}
      {role === "provider" && (
        <button
          onClick={() => navigate("/services/new")}
          className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl flex items-center justify-center transition-all active:scale-90"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}
      {role === "client" && (
        <button
          onClick={() => navigate("/jobs/new")}
          className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl flex items-center justify-center transition-all active:scale-90"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}
      {role === "job_seeker" && (
        <button
          onClick={() => navigate("/job-board")}
          className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl flex items-center justify-center transition-all active:scale-90"
        >
          <Search className="w-6 h-6" />
        </button>
      )}
    </div>
  );
};

export default Dashboard;
