import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, MapPin, Clock, MessageSquare } from "lucide-react";

type JobPost = {
  id: string;
  title: string;
  description: string | null;
  budget: number | null;
  budget_type: string;
  city: string | null;
  county: string | null;
  status: string;
  created_at: string;
  category_id: string;
};

type Category = { id: string; name: string; icon: string | null };

const statusColors: Record<string, string> = {
  open: "bg-primary/10 text-primary border-primary/20",
  closed: "bg-muted text-muted-foreground border-border",
  in_progress: "bg-accent/10 text-accent-foreground border-accent/20",
};

const MyJobs = () => {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [categories, setCategories] = useState<Record<string, Category>>({});
  const [responseCounts, setResponseCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && (!user || role !== "client")) {
      navigate("/dashboard");
      return;
    }
    if (user) fetchData();
  }, [authLoading, user, role]);

  const fetchData = async () => {
    const [jobsRes, catsRes] = await Promise.all([
      supabase.from("job_posts").select("*").eq("client_id", user!.id).order("created_at", { ascending: false }),
      supabase.from("service_categories").select("*"),
    ]);

    const jobsData = jobsRes.data || [];
    setJobs(jobsData);

    const catMap: Record<string, Category> = {};
    (catsRes.data || []).forEach((c: Category) => { catMap[c.id] = c; });
    setCategories(catMap);

    // Fetch response counts
    if (jobsData.length > 0) {
      const { data: responses } = await supabase
        .from("job_responses")
        .select("job_post_id")
        .in("job_post_id", jobsData.map(j => j.id));
      const counts: Record<string, number> = {};
      (responses || []).forEach((r: { job_post_id: string }) => {
        counts[r.job_post_id] = (counts[r.job_post_id] || 0) + 1;
      });
      setResponseCounts(counts);
    }

    setLoading(false);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-6 py-6 pb-24">
      <div className="max-w-sm mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground mb-6">
          <ArrowLeft className="w-5 h-5" />
          <span>Dashboard</span>
        </button>

        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-2xl font-bold text-foreground">My Jobs</h1>
          <Button onClick={() => navigate("/jobs/new")} size="sm" className="rounded-xl gap-1">
            <Plus className="w-4 h-4" /> Post Job
          </Button>
        </div>

        {jobs.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground mb-4">No jobs posted yet</p>
              <Button onClick={() => navigate("/jobs/new")} className="rounded-xl">Post Your First Job</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <Card key={job.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/jobs/${job.id}`)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <Badge variant="outline" className={statusColors[job.status] || statusColors.open}>
                      {job.status}
                    </Badge>
                    {categories[job.category_id] && (
                      <span className="text-xs text-muted-foreground">{categories[job.category_id].icon} {categories[job.category_id].name}</span>
                    )}
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">{job.title}</h3>
                  {job.description && <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{job.description}</p>}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {(job.city || job.county) && (
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{[job.city, job.county].filter(Boolean).join(", ")}</span>
                    )}
                    {job.budget && <span className="font-semibold text-foreground">KSh {job.budget.toLocaleString()}</span>}
                    <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{responseCounts[job.id] || 0} responses</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyJobs;
