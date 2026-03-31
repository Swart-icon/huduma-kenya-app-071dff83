import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, Briefcase, FileText, Bookmark, User, ChevronRight,
  MapPin, Clock, Send, CheckCircle, XCircle, Eye, Star,
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
  id: string;
  job_post_id: string;
  status: string;
  created_at: string;
  cover_message: string | null;
  job_title?: string;
  job_city?: string | null;
  job_county?: string | null;
  job_budget?: number | null;
};

type RecommendedJob = {
  id: string;
  title: string;
  city: string | null;
  county: string | null;
  budget: number | null;
  budget_type: string;
  created_at: string;
  category_id: string;
};

const JobSeekerDashboard = () => {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [applications, setApplications] = useState<Application[]>([]);
  const [recommendedJobs, setRecommendedJobs] = useState<RecommendedJob[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const [profileCompletion, setProfileCompletion] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && (!user || role !== "job_seeker")) {
      navigate("/dashboard");
      return;
    }
    if (user) fetchAll();
  }, [authLoading, user, role]);

  const fetchAll = async () => {
    const [appsRes, savedRes, profileRes, jobsRes] = await Promise.all([
      supabase.from("job_applications").select("*").eq("applicant_id", user!.id).order("created_at", { ascending: false }).limit(10),
      supabase.from("saved_jobs").select("id").eq("user_id", user!.id),
      supabase.from("job_seeker_profiles").select("*").eq("user_id", user!.id).maybeSingle(),
      supabase.from("job_posts").select("*").eq("status", "open").order("created_at", { ascending: false }).limit(5),
    ]);

    // Enrich applications with job titles
    const appsData = appsRes.data || [];
    if (appsData.length > 0) {
      const jobIds = [...new Set(appsData.map((a: any) => a.job_post_id))];
      const { data: jobPosts } = await supabase.from("job_posts").select("id, title, city, county, budget").in("id", jobIds);
      const jobMap: Record<string, any> = {};
      (jobPosts || []).forEach((j: any) => { jobMap[j.id] = j; });
      setApplications(appsData.map((a: any) => ({
        ...a,
        job_title: jobMap[a.job_post_id]?.title || "Job Post",
        job_city: jobMap[a.job_post_id]?.city,
        job_county: jobMap[a.job_post_id]?.county,
        job_budget: jobMap[a.job_post_id]?.budget,
      })));
    } else {
      setApplications([]);
    }

    setSavedCount((savedRes.data || []).length);
    setRecommendedJobs(jobsRes.data || []);

    // Calculate profile completion
    if (profileRes.data) {
      const p = profileRes.data;
      let filled = 0;
      let total = 7;
      if ((p.skills as string[])?.length > 0) filled++;
      if (p.experience_years && p.experience_years > 0) filled++;
      if (p.experience_description) filled++;
      if (p.education) filled++;
      if (p.certifications) filled++;
      if (p.bio) filled++;
      if (p.cv_url) filled++;
      setProfileCompletion(Math.round((filled / total) * 100));
    }

    setLoading(false);
  };

  // Subscribe to realtime application updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("my-applications")
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "job_applications",
        filter: `applicant_id=eq.${user.id}`,
      }, () => { fetchAll(); })
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
    <div className="min-h-screen bg-background px-5 py-5 pb-24">
      <div className="max-w-lg mx-auto">
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2 text-muted-foreground mb-5">
          <ArrowLeft className="w-5 h-5" />
          <span>Dashboard</span>
        </button>

        <h1 className="font-display text-2xl font-bold text-foreground mb-5">Job Seeker Hub</h1>

        {/* Overview Stats */}
        <div className="grid grid-cols-3 gap-2.5 mb-5">
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardContent className="p-3 text-center">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-1.5">
                <Send className="w-4 h-4 text-primary" />
              </div>
              <p className="text-xl font-bold text-foreground">{totalApps}</p>
              <p className="text-[10px] text-muted-foreground">Applied</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardContent className="p-3 text-center">
              <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center mx-auto mb-1.5">
                <Briefcase className="w-4 h-4 text-accent-foreground" />
              </div>
              <p className="text-xl font-bold text-foreground">{activeApps}</p>
              <p className="text-[10px] text-muted-foreground">Active</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardContent className="p-3 text-center">
              <div className="w-9 h-9 rounded-xl bg-secondary/10 flex items-center justify-center mx-auto mb-1.5">
                <Bookmark className="w-4 h-4 text-secondary" />
              </div>
              <p className="text-xl font-bold text-foreground">{savedCount}</p>
              <p className="text-[10px] text-muted-foreground">Saved</p>
            </CardContent>
          </Card>
        </div>

        {/* Profile Completion */}
        <Card className="border-0 shadow-sm rounded-2xl mb-5 cursor-pointer" onClick={() => navigate("/job-seeker-profile")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                <span className="text-sm font-bold text-foreground">Profile</span>
              </div>
              <span className="text-sm font-bold text-primary">{profileCompletion}%</span>
            </div>
            <Progress value={profileCompletion} className="h-2 rounded-full" />
            <p className="text-xs text-muted-foreground mt-1.5">
              {profileCompletion < 100 ? "Complete your profile to stand out" : "Your profile is complete! ✅"}
            </p>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-2.5 mb-6">
          <Button variant="outline" className="h-auto py-3 rounded-xl flex flex-col gap-1" onClick={() => navigate("/job-board")}>
            <Briefcase className="w-5 h-5 text-primary" />
            <span className="text-xs font-semibold">Browse Jobs</span>
          </Button>
          <Button variant="outline" className="h-auto py-3 rounded-xl flex flex-col gap-1" onClick={() => navigate("/saved-jobs")}>
            <Bookmark className="w-5 h-5 text-primary" />
            <span className="text-xs font-semibold">Saved Jobs</span>
          </Button>
        </div>

        {/* Recent Applications */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-sm text-foreground uppercase tracking-wider">My Applications</h2>
            {applications.length > 3 && (
              <button onClick={() => navigate("/my-applications")} className="text-xs text-primary font-semibold">
                View All <ChevronRight className="w-3 h-3 inline" />
              </button>
            )}
          </div>
          {applications.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground text-sm mb-3">No applications yet</p>
                <Button size="sm" className="rounded-xl" onClick={() => navigate("/job-board")}>
                  Browse Jobs
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {applications.slice(0, 3).map((app) => (
                <Card key={app.id} className="border-0 shadow-sm rounded-2xl cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/jobs/${app.job_post_id}`)}>
                  <CardContent className="p-3.5">
                    <div className="flex items-start justify-between mb-1.5">
                      <h3 className="text-sm font-semibold text-foreground line-clamp-1 flex-1 mr-2">{app.job_title}</h3>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 gap-1 shrink-0 ${statusColors[app.status] || statusColors.pending}`}>
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
          <h2 className="font-display font-bold text-sm text-foreground uppercase tracking-wider mb-3">Recommended Jobs</h2>
          {recommendedJobs.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground text-sm">No open jobs right now</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {recommendedJobs.map((job) => (
                <Card key={job.id} className="border-0 shadow-sm rounded-2xl cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/jobs/${job.id}`)}>
                  <CardContent className="p-3.5">
                    <h3 className="text-sm font-semibold text-foreground mb-1">{job.title}</h3>
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
    </div>
  );
};

export default JobSeekerDashboard;
