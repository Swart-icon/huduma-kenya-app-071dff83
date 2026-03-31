import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Briefcase, Search, UserCheck, LogOut, User, Shield, List, Grid, FileText, Calendar, ClipboardList } from "lucide-react";

const roleConfig = {
  provider: {
    title: "Service Provider",
    subtitle: "Manage your services & bookings",
    icon: <Briefcase className="w-6 h-6" />,
    color: "bg-primary text-primary-foreground",
    features: ["Create & manage services", "View booking requests", "Track earnings", "Manage your profile"],
  },
  job_seeker: {
    title: "Job Seeker",
    subtitle: "Find opportunities & grow your career",
    icon: <Search className="w-6 h-6" />,
    color: "bg-accent text-accent-foreground",
    features: ["Browse available jobs", "Upload your CV", "Track applications", "Get job alerts"],
  },
  client: {
    title: "Client",
    subtitle: "Post jobs & book services",
    icon: <UserCheck className="w-6 h-6" />,
    color: "bg-secondary text-secondary-foreground",
    features: ["Post job listings", "Book services", "Manage orders", "Review providers"],
  },
};

const Dashboard = () => {
  const { user, role, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate("/welcome");
    if (!loading && user && !role) navigate("/register");
  }, [loading, user, role, navigate]);

  if (loading || !role) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const config = roleConfig[role];

  const handleLogout = async () => {
    await signOut();
    navigate("/welcome");
  };

  return (
    <div className="min-h-screen bg-background px-6 py-6">
      <div className="max-w-sm mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-lg text-foreground">Huduma</span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/profile")} className="rounded-xl">
              <User className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="rounded-xl">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Welcome Card */}
        <Card className="mb-6 border-0 shadow-lg overflow-hidden">
          <div className={`${config.color} p-6`}>
            <div className="flex items-center gap-3 mb-2">
              {config.icon}
              <span className="text-sm font-semibold opacity-90">{config.title}</span>
            </div>
            <h2 className="font-display text-xl font-bold">
              Karibu, {user?.user_metadata?.full_name?.split(" ")[0] || "there"}! 👋
            </h2>
            <p className="text-sm opacity-80 mt-1">{config.subtitle}</p>
          </div>
        </Card>

        {/* Provider-specific actions */}
        {role === "provider" && (
          <div className="space-y-3 mb-6">
            <h3 className="font-display font-bold text-lg text-foreground">Your Business</h3>
            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/provider-profile/preview")}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Briefcase className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium text-foreground">Business Profile</span>
                  <p className="text-xs text-muted-foreground">View & edit your profile</p>
                </div>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/my-services")}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center shrink-0">
                  <List className="w-5 h-5 text-accent-foreground" />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium text-foreground">My Services</span>
                  <p className="text-xs text-muted-foreground">Manage your service listings</p>
                </div>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/job-board")}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
                  <ClipboardList className="w-5 h-5 text-secondary" />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium text-foreground">Job Board</span>
                  <p className="text-xs text-muted-foreground">Browse open job posts</p>
                </div>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/my-bookings")}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium text-foreground">My Bookings</span>
                  <p className="text-xs text-muted-foreground">View & manage bookings</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Client-specific actions */}
        {role === "client" && (
          <div className="space-y-3 mb-6">
            <h3 className="font-display font-bold text-lg text-foreground">Your Activity</h3>
            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/my-jobs")}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-secondary" />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium text-foreground">My Job Posts</span>
                  <p className="text-xs text-muted-foreground">Post & manage jobs</p>
                </div>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/my-bookings")}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium text-foreground">My Bookings</span>
                  <p className="text-xs text-muted-foreground">Track service bookings</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Browse categories - visible to all */}
        <div className="mb-6">
          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/categories")}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
                <Grid className="w-5 h-5 text-secondary" />
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium text-foreground">Browse Services</span>
                <p className="text-xs text-muted-foreground">Explore by category</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Features */}
        <h3 className="font-display font-bold text-lg text-foreground mb-4">What you can do</h3>
        <div className="space-y-3">
          {config.features.map((feature, i) => (
            <Card key={i} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                </div>
                <span className="text-sm font-medium text-foreground">{feature}</span>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          More features coming soon 🚀
        </p>
      </div>
    </div>
  );
};

export default Dashboard;
