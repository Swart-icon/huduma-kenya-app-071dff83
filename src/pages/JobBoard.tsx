import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, MapPin, DollarSign, Search } from "lucide-react";

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

const JobBoard = () => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [categories, setCategories] = useState<Record<string, Category>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [jobsRes, catsRes] = await Promise.all([
      supabase.from("job_posts").select("*").eq("status", "open").order("created_at", { ascending: false }),
      supabase.from("service_categories").select("*"),
    ]);
    setJobs(jobsRes.data || []);
    const catMap: Record<string, Category> = {};
    (catsRes.data || []).forEach((c: Category) => { catMap[c.id] = c; });
    setCategories(catMap);
    setLoading(false);
  };

  const filtered = jobs.filter((j) =>
    j.title.toLowerCase().includes(search.toLowerCase()) ||
    (j.description || "").toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-6 py-6 pb-24">
      <div className="max-w-sm mx-auto">
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2 text-muted-foreground mb-6">
          <ArrowLeft className="w-5 h-5" />
          <span>Dashboard</span>
        </button>

        <h1 className="font-display text-2xl font-bold text-foreground mb-4">Job Board</h1>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search jobs..." className="h-12 rounded-xl pl-10" />
        </div>

        {filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No open jobs found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((job) => (
              <Card key={job.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/jobs/${job.id}`)}>
                <CardContent className="p-4">
                  {categories[job.category_id] && (
                    <span className="text-xs text-muted-foreground">{categories[job.category_id].icon} {categories[job.category_id].name}</span>
                  )}
                  <h3 className="font-semibold text-foreground mt-1 mb-1">{job.title}</h3>
                  {job.description && <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{job.description}</p>}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {(job.city || job.county) && (
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{[job.city, job.county].filter(Boolean).join(", ")}</span>
                    )}
                    {job.budget && (
                      <span className="flex items-center gap-1 font-semibold text-foreground"><DollarSign className="w-3 h-3" />KSh {job.budget.toLocaleString()}</span>
                    )}
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

export default JobBoard;
