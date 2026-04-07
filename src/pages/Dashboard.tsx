import { useAuth, type AppRole } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import hudumaLogo from "@/assets/hudumahub-logo-transparent.png";
import {
  Briefcase,
  Search,
  UserCheck,
  LogOut,
  User,
  Shield,
  List,
  Grid,
  FileText,
  Calendar,
  ClipboardList,
  MessageCircle,
  Bell,
  ArrowLeftRight,
  Star,
  MapPin,
  ChevronRight,
  Settings,
  PlusCircle,
  TrendingUp,
  Eye,
} from "lucide-react";
import { useUnreadCount } from "@/hooks/useUnreadCount";
import { InstallBanner } from "@/components/InstallBanner";
import { StoryBar } from "@/components/stories/StoryBar";
import NearbyServicesSection from "@/components/NearbyServicesSection";

/* ────────── Role Config ────────── */
const roleConfig: Record<
  string,
  { title: string; subtitle: string; icon: React.ReactNode; gradient: string }
> = {
  provider: {
    title: "Service Provider",
    subtitle: "Manage your services & bookings",
    icon: <Briefcase className="w-5 h-5" />,
    gradient: "from-primary to-primary/80",
  },
  job_seeker: {
    title: "Job Seeker",
    subtitle: "Find opportunities & grow your career",
    icon: <Search className="w-5 h-5" />,
    gradient: "from-accent to-accent/80",
  },
  client: {
    title: "Client",
    subtitle: "Post jobs & book services",
    icon: <UserCheck className="w-5 h-5" />,
    gradient: "from-secondary to-secondary/80",
  },
  admin: {
    title: "Administrator",
    subtitle: "Manage platform",
    icon: <Shield className="w-5 h-5" />,
    gradient: "from-destructive to-destructive/80",
  },
};

/* ────────── Quick Action Card ────────── */
const QuickAction = ({
  icon,
  label,
  description,
  onClick,
  accentClass = "bg-primary/10 text-primary",
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
  accentClass?: string;
  badge?: number;
}) => (
  <Card
    className="card-hover cursor-pointer border-0 shadow-sm rounded-2xl"
    onClick={onClick}
  >
    <CardContent className="flex items-center gap-3.5 p-4">
      <div
        className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${accentClass}`}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-foreground">{label}</span>
          {badge !== undefined && badge > 0 && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
              {badge}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{description}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </CardContent>
  </Card>
);

/* ────────── Role Switcher ────────── */
const RoleSwitcher = () => {
  const { role, roles, switchRole } = useAuth();
  const nonAdminRoles = roles.filter((r) => r !== "admin");

  if (nonAdminRoles.length <= 1) return null;

  return (
    <div className="mb-5">
      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <ArrowLeftRight className="w-3 h-3" /> Switch Role
      </p>
      <div className="flex gap-2">
        {nonAdminRoles.map((r) => {
          const cfg = roleConfig[r];
          const isActive = r === role;
          return (
            <button
              key={r}
              onClick={() => switchRole(r as AppRole)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-card text-muted-foreground hover:bg-muted shadow-sm border border-border"
              }`}
            >
              {cfg?.icon}
              <span className="truncate">{cfg?.title?.split(" ")[0]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

/* ────────── Main Dashboard ────────── */
const Dashboard = () => {
  const { user, role, roles, loading, isAdmin, isSuspended, signOut } = useAuth();
  const navigate = useNavigate();
  const { unreadMessages, unreadNotifications } = useUnreadCount();

  const hasNonAdminRole = roles.filter((r) => r !== "admin").length > 0;

  useEffect(() => {
    if (!loading && !user) navigate("/welcome");
    if (!loading && user && !hasNonAdminRole) navigate("/register");
  }, [loading, user, hasNonAdminRole, navigate]);

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
    <div className="min-h-screen bg-background pb-8">
      <InstallBanner />
      {/* ─── Top Bar ─── */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="flex items-center justify-between px-5 py-3 max-w-lg mx-auto">
          <div className="flex items-center">
            <img src={hudumaLogo} alt="HudumaHub.ke" className="h-14 w-auto" />
          </div>
          <div className="flex gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/conversations")}
              className="rounded-xl h-9 w-9 relative"
            >
              <MessageCircle className="w-[18px] h-[18px]" />
              {unreadMessages > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 text-[9px] font-bold rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                  {unreadMessages}
                </span>
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/notifications")}
              className="rounded-xl h-9 w-9 relative"
            >
              <Bell className="w-[18px] h-[18px]" />
              {unreadNotifications > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 text-[9px] font-bold rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                  {unreadNotifications}
                </span>
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/profile")}
              className="rounded-xl h-9 w-9"
            >
              <User className="w-[18px] h-[18px]" />
            </Button>
          </div>
        </div>
      </div>

      <div className="px-5 max-w-lg mx-auto pt-5">
        {/* ─── Welcome Card ─── */}
        <Card className={`mb-5 border-0 shadow-lg rounded-2xl overflow-hidden`}>
          <div className={`bg-gradient-to-br ${config.gradient} p-5`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary-foreground/20 flex items-center justify-center">
                  {config.icon}
                </div>
                <span className="text-xs font-semibold text-primary-foreground/80">
                  {config.title}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="h-7 px-2 text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10 text-[11px]"
              >
                <LogOut className="w-3 h-3 mr-1" /> Logout
              </Button>
            </div>
            <h2 className="font-display text-xl font-bold text-primary-foreground">
              Karibu, {firstName}! 👋
            </h2>
            <p className="text-xs text-primary-foreground/70 mt-0.5">{config.subtitle}</p>
          </div>
        </Card>

        {/* ─── Suspension Warning ─── */}
        {isSuspended && (
          <Card className="mb-5 border-destructive/40 bg-destructive/5 rounded-2xl">
            <CardContent className="p-4 flex items-center gap-3">
              <Shield className="w-5 h-5 text-destructive shrink-0" />
              <div>
                <p className="font-bold text-destructive text-sm">Account Suspended</p>
                <p className="text-xs text-muted-foreground">
                  Some features may be restricted.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── Role Switcher ─── */}
        <RoleSwitcher />

        {/* ─── Story Bar ─── */}
        <StoryBar />

        {/* ─── Provider Actions ─── */}
        {role === "provider" && (
          <div className="space-y-2.5 mb-6">
            <h3 className="font-display font-bold text-sm text-foreground uppercase tracking-wider mb-1">
              Your Business
            </h3>
            <QuickAction
              icon={<Eye className="w-5 h-5" />}
              label="Business Profile"
              description="View & edit your profile"
              onClick={() => navigate("/provider-profile/preview")}
              accentClass="bg-primary/10 text-primary"
            />
            <QuickAction
              icon={<List className="w-5 h-5" />}
              label="My Services"
              description="Manage your service listings"
              onClick={() => navigate("/my-services")}
              accentClass="bg-accent/15 text-accent-foreground"
            />
            <QuickAction
              icon={<PlusCircle className="w-5 h-5" />}
              label="Create Service"
              description="Add a new service listing"
              onClick={() => navigate("/services/new")}
              accentClass="bg-primary/10 text-primary"
            />
            <QuickAction
              icon={<ClipboardList className="w-5 h-5" />}
              label="Job Board"
              description="Browse open job posts"
              onClick={() => navigate("/job-board")}
              accentClass="bg-secondary/10 text-secondary"
            />
            <QuickAction
              icon={<Calendar className="w-5 h-5" />}
              label="My Bookings"
              description="View & manage bookings"
              onClick={() => navigate("/my-bookings")}
              accentClass="bg-primary/10 text-primary"
            />
          </div>
        )}

        {/* ─── Client Actions ─── */}
        {role === "client" && (
          <div className="space-y-2.5 mb-6">
            <h3 className="font-display font-bold text-sm text-foreground uppercase tracking-wider mb-1">
              Your Activity
            </h3>
            <QuickAction
              icon={<FileText className="w-5 h-5" />}
              label="My Job Posts"
              description="Post & manage jobs"
              onClick={() => navigate("/my-jobs")}
              accentClass="bg-secondary/10 text-secondary"
            />
            <QuickAction
              icon={<PlusCircle className="w-5 h-5" />}
              label="Post a Job"
              description="Create a new job listing"
              onClick={() => navigate("/jobs/new")}
              accentClass="bg-accent/15 text-accent-foreground"
            />
            <QuickAction
              icon={<Calendar className="w-5 h-5" />}
              label="My Bookings"
              description="Track service bookings"
              onClick={() => navigate("/my-bookings")}
              accentClass="bg-primary/10 text-primary"
            />
          </div>
        )}

        {/* ─── Job Seeker Actions ─── */}
        {role === "job_seeker" && (
          <div className="space-y-2.5 mb-6">
            <h3 className="font-display font-bold text-sm text-foreground uppercase tracking-wider mb-1">
              Opportunities
            </h3>
            <QuickAction
              icon={<Briefcase className="w-5 h-5" />}
              label="Job Seeker Hub"
              description="Dashboard, applications & profile"
              onClick={() => navigate("/job-seeker")}
              accentClass="bg-primary/10 text-primary"
            />
            <QuickAction
              icon={<ClipboardList className="w-5 h-5" />}
              label="Job Board"
              description="Browse available jobs"
              onClick={() => navigate("/job-board")}
              accentClass="bg-accent/15 text-accent-foreground"
            />
            <QuickAction
              icon={<TrendingUp className="w-5 h-5" />}
              label="My Applications"
              description="Track your job applications"
              onClick={() => navigate("/my-applications")}
              accentClass="bg-secondary/10 text-secondary"
            />
            <QuickAction
              icon={<Star className="w-5 h-5" />}
              label="Saved Jobs"
              description="Your bookmarked jobs"
              onClick={() => navigate("/saved-jobs")}
              accentClass="bg-muted text-muted-foreground"
            />
          </div>
        )}

        {/* ─── Admin Link ─── */}
        {isAdmin && (
          <QuickAction
            icon={<Shield className="w-5 h-5" />}
            label="Admin Panel"
            description="Manage users, services & analytics"
            onClick={() => navigate("/admin")}
            accentClass="bg-destructive/10 text-destructive"
          />
        )}

        {/* ─── Client Explore Section ─── */}
        {role === "client" && (
          <>
            <NearbyServicesSection />
            <div className="space-y-2.5 mt-6 mb-6">
              <h3 className="font-display font-bold text-sm text-foreground uppercase tracking-wider mb-1">
                Explore
              </h3>
              <QuickAction
                icon={<Search className="w-5 h-5" />}
                label="Search Services"
                description="Find services with filters & sorting"
                onClick={() => navigate("/search")}
                accentClass="bg-primary/10 text-primary"
              />
              <QuickAction
                icon={<Grid className="w-5 h-5" />}
                label="Browse Categories"
                description="Explore services by category"
                onClick={() => navigate("/categories")}
                accentClass="bg-accent/15 text-accent-foreground"
              />
            </div>
          </>
        )}

        {/* ─── Provider Explore Section ─── */}
        {role === "provider" && (
          <div className="space-y-2.5 mt-6 mb-6">
            <h3 className="font-display font-bold text-sm text-foreground uppercase tracking-wider mb-1">
              Discover
            </h3>
            <QuickAction
              icon={<Star className="w-5 h-5" />}
              label="My Reviews"
              description="View client feedback"
              onClick={() => navigate(`/provider/${user?.id}/reviews`)}
              accentClass="bg-accent/15 text-accent-foreground"
            />
          </div>
        )}

        {/* ─── Job Seeker Explore Section ─── */}
        {role === "job_seeker" && (
          <div className="space-y-2.5 mt-6 mb-6">
            <h3 className="font-display font-bold text-sm text-foreground uppercase tracking-wider mb-1">
              Build Your Profile
            </h3>
            <QuickAction
              icon={<User className="w-5 h-5" />}
              label="Job Seeker Profile"
              description="Update skills, CV & experience"
              onClick={() => navigate("/job-seeker-profile")}
              accentClass="bg-primary/10 text-primary"
            />
          </div>
        )}

        {/* ─── Settings ─── */}
        <div className="space-y-2.5 mb-4">
          <h3 className="font-display font-bold text-sm text-foreground uppercase tracking-wider mb-1">
            Settings
          </h3>
          <QuickAction
            icon={<Settings className="w-5 h-5" />}
            label="Security"
            description="Manage sessions & password"
            onClick={() => navigate("/security")}
            accentClass="bg-muted text-muted-foreground"
          />
        </div>

        <p className="text-center text-[11px] text-muted-foreground mt-8 mb-2">
          HudumaHub.ke — Connecting Kenya's Services 🇰🇪
        </p>
      </div>
    </div>
  );
};

export default Dashboard;
