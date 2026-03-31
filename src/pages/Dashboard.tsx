import { useAuth, type AppRole } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { Briefcase, Search, UserCheck, LogOut, User, Shield, List, Grid, FileText, Calendar, ClipboardList, MessageCircle, Bell, Ban, Clock, UserPlus, Trash2, ArrowLeftRight } from "lucide-react";
import { useUnreadCount } from "@/hooks/useUnreadCount";
import { useToast } from "@/hooks/use-toast";

const roleConfig: Record<string, { title: string; subtitle: string; icon: React.ReactNode; color: string; features: string[] }> = {
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
  admin: {
    title: "Administrator",
    subtitle: "Manage users & platform",
    icon: <Shield className="w-6 h-6" />,
    color: "bg-destructive text-destructive-foreground",
    features: ["Review user reports", "Manage suspensions", "Monitor login activity", "Platform security"],
  },
};

const AdminSection = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reports, setReports] = useState<any[]>([]);
  const [suspensions, setSuspensions] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [reportsRes, suspensionsRes, adminsRes] = await Promise.all([
      supabase.from("user_reports").select("*").order("created_at", { ascending: false }),
      supabase.from("user_suspensions").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("*").eq("role", "admin"),
    ]);
    setReports(reportsRes.data || []);
    setSuspensions(suspensionsRes.data || []);
    setAdmins(adminsRes.data || []);
    setLoading(false);
  };

  const handleSuspendUser = async (userId: string, type: "temporary" | "permanent") => {
    if (!user) return;
    const { error } = await supabase.from("user_suspensions").insert({
      user_id: userId,
      suspended_by: user.id,
      reason: "Admin action",
      suspension_type: type,
      suspended_until: type === "temporary" ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : null,
    });
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { toast({ title: type === "permanent" ? "User banned" : "User suspended 7 days" }); loadData(); }
  };

  const handleResolveReport = async (reportId: string) => {
    if (!user) return;
    const { error } = await supabase.from("user_reports")
      .update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_by: user.id })
      .eq("id", reportId);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Report resolved" }); loadData(); }
  };

  const handleLiftSuspension = async (suspensionId: string) => {
    const { error } = await supabase.from("user_suspensions").update({ is_active: false }).eq("id", suspensionId);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Suspension lifted" }); loadData(); }
  };

  const handleAddAdmin = async () => {
    if (!newAdminEmail.trim()) return;
    setAdding(true);
    const { data, error } = await supabase.functions.invoke("add-admin", {
      body: { email: newAdminEmail.trim() },
    });
    setAdding(false);
    if (error || data?.error) {
      toast({ title: "Failed to add admin", description: data?.error || error?.message, variant: "destructive" });
    } else {
      toast({ title: "Admin added!" });
      setNewAdminEmail("");
      loadData();
    }
  };

  const handleRemoveAdmin = async (roleId: string, userId: string) => {
    if (userId === user?.id) {
      toast({ title: "Cannot remove yourself", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("user_roles").delete().eq("id", roleId);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Admin removed" }); loadData(); }
  };

  return (
    <div className="space-y-3 mb-6">
      <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
        <Shield className="w-5 h-5 text-destructive" /> Admin Tools
      </h3>
      <Tabs defaultValue="reports">
        <TabsList className="w-full mb-3">
          <TabsTrigger value="reports" className="flex-1 text-xs">
            Reports ({reports.filter(r => r.status === "pending").length})
          </TabsTrigger>
          <TabsTrigger value="suspensions" className="flex-1 text-xs">
            Bans ({suspensions.filter(s => s.is_active).length})
          </TabsTrigger>
          <TabsTrigger value="admins" className="flex-1 text-xs">
            Admins ({admins.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="space-y-3">
          {loading ? <p className="text-center text-muted-foreground py-4 text-sm">Loading...</p> :
           reports.length === 0 ? <p className="text-center text-muted-foreground py-4 text-sm">No reports</p> :
           reports.map((report) => (
            <Card key={report.id}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant={report.status === "pending" ? "destructive" : "secondary"} className="text-xs">{report.status}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(report.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-sm font-medium text-foreground capitalize">{report.reason.replace("_", " ")}</p>
                {report.description && <p className="text-xs text-muted-foreground">{report.description}</p>}
                {report.status === "pending" && (
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => handleResolveReport(report.id)}>Resolve</Button>
                    <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => handleSuspendUser(report.reported_user_id, "temporary")}>
                      <Clock className="w-3 h-3 mr-1" />7d
                    </Button>
                    <Button size="sm" variant="destructive" className="text-xs h-8" onClick={() => handleSuspendUser(report.reported_user_id, "permanent")}>
                      <Ban className="w-3 h-3 mr-1" />Ban
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="suspensions" className="space-y-3">
          {loading ? <p className="text-center text-muted-foreground py-4 text-sm">Loading...</p> :
           suspensions.length === 0 ? <p className="text-center text-muted-foreground py-4 text-sm">No suspensions</p> :
           suspensions.map((s) => (
            <Card key={s.id}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant={s.is_active ? "destructive" : "secondary"} className="text-xs">
                    {s.is_active ? (s.suspension_type === "permanent" ? "Banned" : "Suspended") : "Lifted"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-xs text-muted-foreground">User: {s.user_id.slice(0, 8)}...</p>
                {s.is_active && (
                  <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => handleLiftSuspension(s.id)}>Lift</Button>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="admins" className="space-y-3">
          {admins.map((a) => (
            <Card key={a.id}>
              <CardContent className="p-3 flex items-center justify-between">
                <span className="text-sm text-foreground">{a.user_id === user?.id ? "You" : a.user_id.slice(0, 12) + "..."}</span>
                {a.user_id !== user?.id && (
                  <Button size="sm" variant="ghost" className="text-xs h-8 text-destructive" onClick={() => handleRemoveAdmin(a.id, a.user_id)}>
                    <Trash2 className="w-3 h-3 mr-1" />Remove
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
          <div className="flex gap-2">
            <Input
              placeholder="User email..."
              value={newAdminEmail}
              onChange={(e) => setNewAdminEmail(e.target.value)}
              className="h-10 rounded-xl text-sm"
            />
            <Button size="sm" className="h-10 rounded-xl px-4" onClick={handleAddAdmin} disabled={adding}>
              <UserPlus className="w-4 h-4" />
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const Dashboard = () => {
  const { user, role, loading, isAdmin, isSuspended, signOut } = useAuth();
  const navigate = useNavigate();
  const { unreadMessages, unreadNotifications } = useUnreadCount();

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

  const config = roleConfig[role] || roleConfig.client;

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
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => navigate("/conversations")} className="rounded-xl relative">
              <MessageCircle className="w-5 h-5" />
              {unreadMessages > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 text-[10px] font-bold rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                  {unreadMessages}
                </span>
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate("/notifications")} className="rounded-xl relative">
              <Bell className="w-5 h-5" />
              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 text-[10px] font-bold rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                  {unreadNotifications}
                </span>
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate("/profile")} className="rounded-xl">
              <User className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="rounded-xl">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Suspension Warning */}
        {isSuspended && (
          <Card className="mb-6 border-destructive bg-destructive/10">
            <CardContent className="p-4 flex items-center gap-3">
              <Shield className="w-5 h-5 text-destructive shrink-0" />
              <div>
                <p className="font-semibold text-destructive text-sm">Account Suspended</p>
                <p className="text-xs text-muted-foreground">Your account has been suspended. Some features may be restricted.</p>
              </div>
            </CardContent>
          </Card>
        )}

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

        {/* Role Switcher */}
        <RoleSwitcher />

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

        {/* Admin Panel - inline */}
        {isAdmin && <AdminSection />}

        {/* Browse categories - visible to all */}
        <div className="space-y-3 mb-6">
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
          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/security")}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium text-foreground">Security Settings</span>
                <p className="text-xs text-muted-foreground">Manage sessions & password</p>
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
