import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, ChevronDown, ChevronUp, ClipboardList, MapPin,
  Clock, User as UserIcon, Briefcase, MessageCircle, CheckCircle, XCircle, Star, Eye,
  Mail, Phone, FileText, Award, Calendar, DollarSign, Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type JobPost = {
  id: string;
  title: string;
  city: string | null;
  county: string | null;
  budget: number | null;
  status: string;
  created_at: string;
};

type Application = {
  id: string;
  job_post_id: string;
  applicant_id: string;
  status: string;
  created_at: string;
  cover_message: string | null;
  applicant_name: string | null;
  applicant_email: string | null;
  applicant_phone: string | null;
  years_experience: number | null;
  skills: string | null;
  availability: string | null;
  expected_salary: number | null;
  cv_url: string | null;
  cv_filename: string | null;
  applicant_display_name?: string;
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  reviewed: "bg-blue-100 text-blue-800 border-blue-200",
  shortlisted: "bg-primary/10 text-primary border-primary/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  accepted: "bg-green-100 text-green-800 border-green-200",
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="w-3 h-3" />,
  reviewed: <Eye className="w-3 h-3" />,
  shortlisted: <Star className="w-3 h-3" />,
  rejected: <XCircle className="w-3 h-3" />,
  accepted: <CheckCircle className="w-3 h-3" />,
};

const ClientApplications = () => {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [appsByJob, setAppsByJob] = useState<Record<string, Application[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || role !== "client")) {
      navigate("/dashboard");
      return;
    }
    if (user) fetchAll();
  }, [authLoading, user, role]);

  const fetchAll = async () => {
    if (!user) return;
    setLoading(true);

    // 1. Client's job posts
    const { data: jobsData } = await supabase
      .from("job_posts")
      .select("id, title, city, county, budget, status, created_at")
      .eq("client_id", user.id)
      .order("created_at", { ascending: false });

    const jobList = jobsData || [];
    setJobs(jobList);

    if (jobList.length === 0) {
      setLoading(false);
      return;
    }

    // 2. All applications for those jobs (RLS already restricts to job owner)
    const jobIds = jobList.map((j) => j.id);
    const { data: appsData } = await supabase
      .from("job_applications")
      .select("id, job_post_id, applicant_id, status, created_at, cover_message, applicant_name, applicant_email, applicant_phone, years_experience, skills, availability, expected_salary, cv_url, cv_filename")
      .in("job_post_id", jobIds)
      .order("created_at", { ascending: false });

    const apps = appsData || [];

    // 3. Fallback: resolve applicant names from profiles for legacy rows
    const applicantIds = [...new Set(apps.map((a) => a.applicant_id))];
    const nameMap: Record<string, string> = {};
    if (applicantIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", applicantIds);
      (profs || []).forEach((p: any) => { nameMap[p.user_id] = p.full_name || "Anonymous"; });
    }

    const grouped: Record<string, Application[]> = {};
    apps.forEach((a: any) => {
      const item: Application = {
        ...a,
        applicant_display_name: a.applicant_name || nameMap[a.applicant_id] || "Anonymous",
      };
      (grouped[a.job_post_id] ||= []).push(item);
    });
    setAppsByJob(grouped);
    setLoading(false);
  };

  const updateStatus = async (appId: string, newStatus: "accepted" | "rejected" | "shortlisted" | "reviewed") => {
    setUpdating(appId);
    const { error } = await supabase
      .from("job_applications")
      .update({ status: newStatus })
      .eq("id", appId);
    setUpdating(null);
    if (error) {
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Application ${newStatus} ✅` });
    // Update locally
    setAppsByJob((prev) => {
      const next: Record<string, Application[]> = {};
      Object.entries(prev).forEach(([jobId, apps]) => {
        next[jobId] = apps.map((a) => a.id === appId ? { ...a, status: newStatus } : a);
      });
      return next;
    });
  };

  const messageApplicant = async (applicantId: string) => {
    if (!user) return;
    const [a, b] = user.id < applicantId ? [user.id, applicantId] : [applicantId, user.id];
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("participant_one", a)
      .eq("participant_two", b)
      .maybeSingle();
    let convoId = existing?.id;
    if (!convoId) {
      const { data: created, error } = await supabase
        .from("conversations")
        .insert({ participant_one: a, participant_two: b })
        .select("id")
        .single();
      if (error) {
        toast({ title: "Couldn't start chat", description: error.message, variant: "destructive" });
        return;
      }
      convoId = created.id;
    }
    navigate(`/chat/${convoId}`);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalApplications = Object.values(appsByJob).reduce((s, a) => s + a.length, 0);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border/40">
        <div className="flex items-center gap-3 px-5 py-3 max-w-lg mx-auto">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="font-display text-lg font-bold text-foreground">My Applications</h1>
            <p className="text-[11px] text-muted-foreground">
              {jobs.length} {jobs.length === 1 ? "job" : "jobs"} • {totalApplications} total {totalApplications === 1 ? "applicant" : "applicants"}
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 max-w-lg mx-auto pt-4 space-y-3">
        {jobs.length === 0 ? (
          <Card className="border-dashed rounded-2xl">
            <CardContent className="py-12 text-center">
              <ClipboardList className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm mb-4">You haven't posted any jobs yet</p>
              <Button onClick={() => navigate("/jobs/new")} className="rounded-xl">Post Your First Job</Button>
            </CardContent>
          </Card>
        ) : (
          jobs.map((job) => {
            const apps = appsByJob[job.id] || [];
            const isOpen = expanded[job.id] || false;
            return (
              <Card key={job.id} className="border-0 shadow-sm rounded-2xl overflow-hidden">
                {/* Job header (clickable to toggle) */}
                <button
                  onClick={() => setExpanded((e) => ({ ...e, [job.id]: !isOpen }))}
                  className="w-full text-left p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Briefcase className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-foreground line-clamp-1">{job.title}</h3>
                        <Badge
                          variant={apps.length > 0 ? "default" : "secondary"}
                          className="text-[10px] h-5 px-2 rounded-full shrink-0"
                        >
                          {apps.length} {apps.length === 1 ? "applicant" : "applicants"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        {(job.city || job.county) && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {[job.city, job.county].filter(Boolean).join(", ")}
                          </span>
                        )}
                        {job.budget && (
                          <span className="font-semibold text-foreground">KSh {job.budget.toLocaleString()}</span>
                        )}
                        <span className="ml-auto flex items-center gap-0.5 text-primary font-medium">
                          {isOpen ? "Hide" : "View"}
                          {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>

                {/* Applicants list */}
                {isOpen && (
                  <div className="border-t border-border/40 bg-muted/20 px-4 py-3 space-y-2">
                    {apps.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        No applications yet for this job.
                      </p>
                    ) : (
                      apps.map((app) => (
                        <div key={app.id} className="bg-background rounded-xl p-3 shadow-sm">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <UserIcon className="w-4 h-4 text-primary" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-foreground truncate">{app.applicant_display_name}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  Applied {new Date(app.created_at).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-2 py-0.5 h-5 gap-1 shrink-0 rounded-full ${statusColors[app.status] || statusColors.pending}`}
                            >
                              {statusIcons[app.status]}
                              {app.status}
                            </Badge>
                          </div>

                          {/* Contact + details grid */}
                          <div className="pl-11 space-y-1.5 mb-2">
                            {app.applicant_email && (
                              <a
                                href={`mailto:${app.applicant_email}`}
                                className="flex items-center gap-2 text-xs text-foreground hover:text-primary"
                              >
                                <Mail className="w-3 h-3 text-muted-foreground" />
                                <span className="truncate">{app.applicant_email}</span>
                              </a>
                            )}
                            {app.applicant_phone && (
                              <a
                                href={`tel:${app.applicant_phone}`}
                                className="flex items-center gap-2 text-xs text-foreground hover:text-primary"
                              >
                                <Phone className="w-3 h-3 text-muted-foreground" />
                                <span>{app.applicant_phone}</span>
                              </a>
                            )}
                            {app.years_experience !== null && app.years_experience !== undefined && (
                              <div className="flex items-center gap-2 text-xs text-foreground">
                                <Award className="w-3 h-3 text-muted-foreground" />
                                <span>{app.years_experience} {app.years_experience === 1 ? "year" : "years"} experience</span>
                              </div>
                            )}
                            {app.expected_salary && (
                              <div className="flex items-center gap-2 text-xs text-foreground">
                                <DollarSign className="w-3 h-3 text-muted-foreground" />
                                <span>Expects KSh {Number(app.expected_salary).toLocaleString()}</span>
                              </div>
                            )}
                            {app.availability && (
                              <div className="flex items-center gap-2 text-xs text-foreground">
                                <Calendar className="w-3 h-3 text-muted-foreground" />
                                <span className="truncate">{app.availability}</span>
                              </div>
                            )}
                            {app.skills && (
                              <div className="flex items-start gap-2 text-xs text-foreground">
                                <Sparkles className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
                                <span className="line-clamp-2">{app.skills}</span>
                              </div>
                            )}
                            {app.cv_url && (
                              <a
                                href={app.cv_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 mt-1 px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                {app.cv_filename || "Download CV"}
                              </a>
                            )}
                          </div>

                          {app.cover_message && (
                            <div className="pl-11 mb-2">
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">Cover message</p>
                              <p className="text-xs text-foreground whitespace-pre-wrap">{app.cover_message}</p>
                            </div>
                          )}

                          <div className="flex flex-wrap gap-1.5 pl-10">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px] rounded-lg px-2"
                              onClick={() => messageApplicant(app.applicant_id)}
                            >
                              <MessageCircle className="w-3 h-3 mr-1" />Message
                            </Button>
                            {app.status !== "accepted" && (
                              <Button
                                size="sm"
                                className="h-7 text-[11px] rounded-lg px-2 bg-green-600 hover:bg-green-700 text-white"
                                disabled={updating === app.id}
                                onClick={() => updateStatus(app.id, "accepted")}
                              >
                                <CheckCircle className="w-3 h-3 mr-1" />Accept
                              </Button>
                            )}
                            {app.status !== "rejected" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px] rounded-lg px-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                                disabled={updating === app.id}
                                onClick={() => updateStatus(app.id, "rejected")}
                              >
                                <XCircle className="w-3 h-3 mr-1" />Reject
                              </Button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ClientApplications;
