import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, MapPin, Clock, CheckCircle, XCircle, Eye, Star, Send,
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

const MyApplications = () => {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!authLoading && (!user || role !== "job_seeker")) {
      navigate("/dashboard");
      return;
    }
    if (user) fetchApplications();
  }, [authLoading, user, role]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("apps-realtime")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "job_applications",
        filter: `applicant_id=eq.${user.id}`,
      }, () => fetchApplications())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const fetchApplications = async () => {
    const { data } = await supabase
      .from("job_applications")
      .select("*")
      .eq("applicant_id", user!.id)
      .order("created_at", { ascending: false });

    const appsData = data || [];
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
    setLoading(false);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const filtered = filter === "all" ? applications : applications.filter(a => a.status === filter);

  return (
    <div className="min-h-screen bg-background px-5 py-5 pb-24">
      <div className="max-w-lg mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground mb-5">
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        <h1 className="font-display text-2xl font-bold text-foreground mb-4">My Applications</h1>

        <Tabs defaultValue="all" onValueChange={setFilter} className="mb-5">
          <TabsList className="w-full rounded-xl h-10">
            <TabsTrigger value="all" className="rounded-lg text-xs flex-1">All</TabsTrigger>
            <TabsTrigger value="pending" className="rounded-lg text-xs flex-1">Pending</TabsTrigger>
            <TabsTrigger value="shortlisted" className="rounded-lg text-xs flex-1">Shortlisted</TabsTrigger>
            <TabsTrigger value="accepted" className="rounded-lg text-xs flex-1">Accepted</TabsTrigger>
          </TabsList>
        </Tabs>

        {filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground text-sm">No applications found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((app) => (
              <Card key={app.id} className="border-0 shadow-sm rounded-2xl cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/jobs/${app.job_post_id}`)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-sm font-semibold text-foreground line-clamp-1 flex-1 mr-2">{app.job_title}</h3>
                    <Badge variant="outline" className={`text-[10px] px-2 py-0.5 h-5 gap-1 shrink-0 ${statusColors[app.status] || statusColors.pending}`}>
                      {statusIcons[app.status]}
                      {app.status}
                    </Badge>
                  </div>
                  {app.cover_message && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{app.cover_message}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {(app.job_city || app.job_county) && (
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{[app.job_city, app.job_county].filter(Boolean).join(", ")}</span>
                    )}
                    {app.job_budget && <span className="font-semibold text-foreground">KSh {app.job_budget.toLocaleString()}</span>}
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(app.created_at).toLocaleDateString()}</span>
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

export default MyApplications;
