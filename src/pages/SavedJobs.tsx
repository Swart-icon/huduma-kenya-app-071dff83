import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPin, Bookmark, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type SavedJob = {
  id: string;
  job_post_id: string;
  title: string;
  city: string | null;
  county: string | null;
  budget: number | null;
  status: string;
};

const SavedJobs = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/dashboard");
      return;
    }
    if (user) fetchSaved();
  }, [authLoading, user]);

  const fetchSaved = async () => {
    const { data: saved } = await supabase
      .from("saved_jobs")
      .select("id, job_post_id")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false });

    if (saved && saved.length > 0) {
      const jobIds = saved.map((s: any) => s.job_post_id);
      const { data: jobs } = await supabase.from("job_posts").select("id, title, city, county, budget, status").in("id", jobIds);
      const jobMap: Record<string, any> = {};
      (jobs || []).forEach((j: any) => { jobMap[j.id] = j; });
      setSavedJobs(saved.map((s: any) => ({
        id: s.id,
        job_post_id: s.job_post_id,
        title: jobMap[s.job_post_id]?.title || "Job Post",
        city: jobMap[s.job_post_id]?.city,
        county: jobMap[s.job_post_id]?.county,
        budget: jobMap[s.job_post_id]?.budget,
        status: jobMap[s.job_post_id]?.status || "open",
      })));
    } else {
      setSavedJobs([]);
    }
    setLoading(false);
  };

  const handleUnsave = async (savedId: string) => {
    await supabase.from("saved_jobs").delete().eq("id", savedId);
    setSavedJobs(savedJobs.filter((j) => j.id !== savedId));
    toast({ title: "Job removed from saved" });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-5 py-5 pb-24">
      <div className="max-w-lg mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground mb-5">
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        <h1 className="font-display text-2xl font-bold text-foreground mb-5">
          <Bookmark className="w-6 h-6 inline mr-2 text-primary" />Saved Jobs
        </h1>

        {savedJobs.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground text-sm mb-3">No saved jobs yet</p>
              <Button size="sm" className="rounded-xl" onClick={() => navigate("/job-board")}>Browse Jobs</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2.5">
            {savedJobs.map((job) => (
              <Card key={job.id} className="border-0 shadow-sm rounded-2xl">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/jobs/${job.job_post_id}`)}>
                    <h3 className="text-sm font-semibold text-foreground line-clamp-1">{job.title}</h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      {(job.city || job.county) && (
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{[job.city, job.county].filter(Boolean).join(", ")}</span>
                      )}
                      {job.budget && <span className="font-semibold text-foreground">KSh {job.budget.toLocaleString()}</span>}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => handleUnsave(job.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SavedJobs;
