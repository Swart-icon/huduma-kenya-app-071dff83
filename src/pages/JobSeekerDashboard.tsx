import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useIsPremium } from "@/hooks/useSubscription";
import {
  ArrowLeft, Briefcase, Bookmark, User, ChevronRight,
  MapPin, Clock, Send, CheckCircle, XCircle, Eye, Star, Search, Crown, DollarSign,
} from "lucide-react";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  reviewed: "bg-blue-100 text-blue-800 border-blue-200",
  shortlisted: "bg-primary/10 text-primary border-primary/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  accepted: "bg-green-100 text-green-800 border-green-200",
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="w-3.5 h-3.5" />,
  reviewed: <Eye className="w-3.5 h-3.5" />,
  shortlisted: <Star className="w-3.5 h-3.5" />,
  rejected: <XCircle className="w-3.5 h-3.5" />,
  accepted: <CheckCircle className="w-3.5 h-3.5" />,
};

type Application = {
  id: string; job_post_id: string; status: string; created_at: string; cover_message: string | null;
  job_title?: string; job_city?: string | null; job_county?: string | null; job_budget?: number | null;
};

type RecommendedJob = {
  id: string; title: string; city: string | null; county: string | null;
  budget: number | null; budget_type: string; created_at: string; category_id: string;
};

const StatChip = ({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) => (
  <Card className="border-0 shadow-sm rounded-2xl flex-1">
    <CardContent className="p-3.5 flex flex-col items-center gap-1">
      <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">{icon}</div>
      <span className="text-xl font-bold text-foreground">{value}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </CardContent>
  </Card>
);

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

const JobSeekerDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isPremium, loading: premiumLoading } = useIsPremium("job_seeker");
  const [applications, setApplications] = useState<Application[]>([]);
  const [allJobs, setAllJobs] = useState<RecommendedJob[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const [profileCompletion, setProfileCompletion] = useState(0);
  const [loading, setLoading] = useState(true);

  const checkingPremium = authLoading || premiumLoading;
  const requirePremium = !checkingPremium && !isPremium;

  const handleApply = (jobId: string) => {
    if (checkingPremium) {
      toast({ title: "Checking subscription", description: "Please wait a moment." });
      return;
    }
    if (requirePremium) {
      toast({
        title: "Premium required",
        description: "Pay KSh 200 for 30 days to apply for jobs.",
      });
      navigate("/upgrade?role=job_seeker");
      return;
    }
    navigate(`/jobs/${jobId}`);
  };

  useEffect(() => {
    if (!authLoading && !user) { navigate("/login"); return; }
    if (user) fetchAll();
  }, [authLoading, user]);

  const fetchAll = async () => {
    const [appsRes, savedRes, profileRes, jobsRes, mainProfileRes] = await Promise.all([
      supabase.from("job_applications").select("*").eq("applicant_id", user!.id).order("created_at", { ascending: false }).limit(10),
      supabase.from("saved_jobs").select("id").eq("user_id", user!.id),
      supabase.from("job_seeker_profiles").select("*").eq("user_id", user!.id).maybeSingle(),
      supabase.from("job_posts").select("*").eq("status", "open").order("created_at", { ascending: false }).limit(50),
      supabase.from("profiles").select("full_name, phone, location").eq("user_id", user!.id).maybeSingle(),
    ]);

    const appsData = appsRes.data || [];
    if (appsData.length > 0) {
      const jobIds = [...new Set(appsData.map((a: any) => a.job_post_id))];
      const { data: jobPosts } = await supabase.from("job_posts").select("id, title, city, county, budget").in("id", jobIds);
      const jobMap: Record<string, any> = {};
      (jobPosts || []).forEach((j: any) => { jobMap[j.id] = j; });
      setApplications(appsData.map((a: any) => ({
        ...a, job_title: jobMap[a.job_post_id]?.title || "Job Post",
        job_city: jobMap[a.job_post_id]?.city, job_county: jobMap[a.job_post_id]?.county, job_budget: jobMap[a.job_post_id]?.budget,
      })));
    } else { setApplications([]); }

    setSavedCount((savedRes.data || []).length);
    setAllJobs(jobsRes.data || []);

    // Completion = mandatory personal info only (full name, phone, email, location)
    const mp = mainProfileRes.data;
    const checks = [
      !!mp?.full_name?.trim(),
      !!mp?.phone?.trim(),
      !!user?.email,
      !!mp?.location?.trim(),
    ];
    const filled = checks.filter(Boolean).length;
    setProfileCompletion(Math.round((filled / checks.length) * 100));
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("my-applications")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "job_applications", filter: `applicant_id=eq.${user.id}` }, () => { fetchAll(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalApps = applications.length;
  const activeApps = applications.filter(a => !["rejected", "accepted"].includes(a.status)).length;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border/40">
        <div className="flex items-center gap-3 px-5 py-3 max-w-lg mx-auto">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </button>
          <h1 className="font-display text-lg font-bold text-foreground">Job Seeker Hub</h1>
        </div>
      </div>

      <div className="px-5 max-w-lg mx-auto pt-4 space-y-5">

        {/* Stats Row */}
        <div className="flex gap-2.5">
          <StatChip icon={<Send className="w-4.5 h-4.5 text-primary" />} value={totalApps} label="Applied" />
          <StatChip icon={<Briefcase className="w-4.5 h-4.5 text-primary" />} value={activeApps} label="Active" />
          <StatChip icon={<Bookmark className="w-4.5 h-4.5 text-primary" />} value={savedCount} label="Saved" />
        </div>

        {/* Profile Completion */}
        {profileCompletion < 100 && (
          <Card className="border-0 shadow-sm rounded-2xl cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/job-seeker-profile")}>
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

        {/* Recent Applications */}
        <div>
          <SectionHeader title="My Applications" action={applications.length > 3 ? "View All" : undefined} onAction={() => navigate("/my-applications")} />
          {applications.length === 0 ? (
            <Card className="border-dashed rounded-2xl">
              <CardContent className="py-10 text-center">
                <Send className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm mb-3">No applications yet</p>
                <Button size="sm" className="rounded-xl" onClick={() => navigate("/job-board")}>Browse Jobs</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {applications.slice(0, 3).map((app) => (
                <Card key={app.id} className="border-0 shadow-sm rounded-2xl cursor-pointer hover:shadow-md transition-all active:scale-[0.98]" onClick={() => navigate(`/jobs/${app.job_post_id}`)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-sm font-semibold text-foreground line-clamp-1 flex-1 mr-2">{app.job_title}</h3>
                      <Badge variant="outline" className={`text-[10px] px-2 py-0.5 h-5 gap-1 shrink-0 rounded-full ${statusColors[app.status] || statusColors.pending}`}>
                        {statusIcons[app.status]}
                        {app.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {(app.job_city || app.job_county) && (
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{[app.job_city, app.job_county].filter(Boolean).join(", ")}</span>
                      )}
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(app.created_at).toLocaleDateString()}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Recommended Jobs */}
        <div>
          <SectionHeader title="Recommended Jobs" />
          {recommendedJobs.length === 0 ? (
            <Card className="border-dashed rounded-2xl">
              <CardContent className="py-10 text-center">
                <Briefcase className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No open jobs right now</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {recommendedJobs.map((job) => (
                <Card key={job.id} className="border-0 shadow-sm rounded-2xl cursor-pointer hover:shadow-md transition-all active:scale-[0.98]" onClick={() => navigate(`/jobs/${job.id}`)}>
                  <CardContent className="p-4">
                    <h3 className="text-sm font-semibold text-foreground mb-1.5">{job.title}</h3>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {(job.city || job.county) && (
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{[job.city, job.county].filter(Boolean).join(", ")}</span>
                      )}
                      {job.budget && <span className="font-semibold text-foreground">KSh {job.budget.toLocaleString()}</span>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={() => navigate("/job-board")}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl flex items-center justify-center transition-all active:scale-90"
      >
        <Search className="w-6 h-6" />
      </button>
    </div>
  );
};

export default JobSeekerDashboard;
