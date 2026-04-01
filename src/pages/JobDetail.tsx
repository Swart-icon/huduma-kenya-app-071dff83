import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, MapPin, DollarSign, Clock, Send, CheckCircle, XCircle, Bookmark, BookmarkCheck, User, MessageSquare, Phone } from "lucide-react";
import { getOrCreateConversation } from "@/lib/conversations";
import { useToast } from "@/hooks/use-toast";

type JobPost = {
  id: string;
  client_id: string;
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

type JobResponse = {
  id: string;
  provider_id: string;
  message: string | null;
  proposed_price: number | null;
  status: string;
  created_at: string;
  provider_name?: string;
  provider_phone?: string | null;
  provider_image?: string | null;
};

type Category = { id: string; name: string; icon: string | null };

const JobDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [job, setJob] = useState<JobPost | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [responses, setResponses] = useState<JobResponse[]>([]);
  const [loading, setLoading] = useState(true);

  // Provider response form
  const [message, setMessage] = useState("");
  const [proposedPrice, setProposedPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hasResponded, setHasResponded] = useState(false);

  // Job seeker application
  const [coverMessage, setCoverMessage] = useState("");
  const [applySubmitting, setApplySubmitting] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    if (id) fetchJob();
  }, [id]);

  const fetchJob = async () => {
    const { data: jobData } = await supabase.from("job_posts").select("*").eq("id", id!).maybeSingle();
    if (!jobData) { navigate("/dashboard"); return; }
    setJob(jobData);

    const { data: catData } = await supabase.from("service_categories").select("*").eq("id", jobData.category_id).maybeSingle();
    setCategory(catData);

    // Check if current user (provider) already responded
    if (user && role === "provider") {
      const { data: existingResponse } = await supabase
        .from("job_responses").select("*").eq("job_post_id", id!).eq("provider_id", user.id).maybeSingle();
      if (existingResponse) setHasResponded(true);
    }

    // Check if job seeker already applied
    if (user && role === "job_seeker") {
      const { data: existingApp } = await supabase
        .from("job_applications").select("*").eq("job_post_id", id!).eq("applicant_id", user.id).maybeSingle();
      if (existingApp) setHasApplied(true);
    }

    // Check if saved
    if (user) {
      const { data: saved } = await supabase
        .from("saved_jobs").select("id").eq("user_id", user.id).eq("job_post_id", id!).maybeSingle();
      if (saved) { setIsSaved(true); setSavedId(saved.id); }
    }

    // If client owns this job, fetch responses
    if (user && jobData.client_id === user.id) {
      const { data: resps } = await supabase.from("job_responses").select("*").eq("job_post_id", id!).order("created_at", { ascending: false });
      const providerIds = (resps || []).map((r: JobResponse) => r.provider_id);
      if (providerIds.length > 0) {
        const { data: profiles } = await supabase.from("provider_profiles").select("user_id, business_name, contact_phone, profile_image_url").in("user_id", providerIds);
        const profileMap: Record<string, { name: string; phone: string | null; image: string | null }> = {};
        (profiles || []).forEach((p: any) => { profileMap[p.user_id] = { name: p.business_name, phone: p.contact_phone, image: p.profile_image_url }; });
        setResponses((resps || []).map((r: JobResponse) => ({
          ...r,
          provider_name: profileMap[r.provider_id]?.name || "Provider",
          provider_phone: profileMap[r.provider_id]?.phone || null,
          provider_image: profileMap[r.provider_id]?.image || null,
        })));
      } else {
        setResponses([]);
      }
    }

    setLoading(false);
  };

  const handleRespond = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || role !== "provider") return;

    setSubmitting(true);
    const { error } = await supabase.from("job_responses").insert({
      job_post_id: id!,
      provider_id: user.id,
      message: message.trim() || null,
      proposed_price: proposedPrice ? parseFloat(proposedPrice) : null,
    });
    setSubmitting(false);

    if (error) {
      toast({ title: "Failed to respond", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Response sent! ✅" });
      setHasResponded(true);
    }
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || role !== "job_seeker") return;
    setApplySubmitting(true);
    const { error } = await supabase.from("job_applications").insert({
      job_post_id: id!,
      applicant_id: user.id,
      cover_message: coverMessage.trim() || null,
    });
    setApplySubmitting(false);
    if (error) {
      toast({ title: "Failed to apply", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Application sent! ✅" });
      setHasApplied(true);
    }
  };

  const handleToggleSave = async () => {
    if (!user) return;
    if (isSaved && savedId) {
      await supabase.from("saved_jobs").delete().eq("id", savedId);
      setIsSaved(false);
      setSavedId(null);
      toast({ title: "Removed from saved" });
    } else {
      const { data, error } = await supabase.from("saved_jobs").insert({ user_id: user.id, job_post_id: id! }).select("id").single();
      if (!error && data) {
        setIsSaved(true);
        setSavedId(data.id);
        toast({ title: "Job saved! 🔖" });
      }
    }
  };

  const handleMessageProvider = async (providerId: string) => {
    if (!user) return;
    const convId = await getOrCreateConversation(user.id, providerId);
    if (convId) navigate(`/chat/${convId}`);
    else toast({ title: "Could not start conversation", variant: "destructive" });
  };

  const handleAcceptResponse = async (responseId: string, providerId: string) => {
    await supabase.from("job_responses").update({ status: "accepted" }).eq("id", responseId);
    await supabase.from("job_posts").update({ status: "in_progress" }).eq("id", id!);
    toast({ title: "Response accepted! 🎉" });
    fetchJob();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!job) return null;

  const isOwner = user?.id === job.client_id;

  return (
    <div className="min-h-screen bg-background px-6 py-6 pb-24">
      <div className="max-w-sm mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground mb-6">
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        {/* Job Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={job.status === "open" ? "bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground"}>
                {job.status}
              </Badge>
              {category && <span className="text-sm text-muted-foreground">{category.name}</span>}
            </div>
            {user && !isOwner && (
              <button onClick={handleToggleSave} className="p-1.5">
                {isSaved ? <BookmarkCheck className="w-5 h-5 text-primary" /> : <Bookmark className="w-5 h-5 text-muted-foreground" />}
              </button>
            )}
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">{job.title}</h1>
          {job.description && <p className="text-muted-foreground">{job.description}</p>}
        </div>

        {/* Details */}
        <Card className="mb-6">
          <CardContent className="p-4 space-y-3">
            {job.budget && (
              <div className="flex items-center gap-3">
                <DollarSign className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm font-semibold text-foreground">KSh {job.budget.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground capitalize">{job.budget_type}</p>
                </div>
              </div>
            )}
            {(job.city || job.county) && (
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-secondary" />
                <p className="text-sm text-foreground">{[job.city, job.county].filter(Boolean).join(", ")}</p>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-accent-foreground" />
              <p className="text-sm text-muted-foreground">Posted {new Date(job.created_at).toLocaleDateString()}</p>
            </div>
          </CardContent>
        </Card>

        {/* Provider Response Form */}
        {role === "provider" && job.status === "open" && !isOwner && (
          <Card className="mb-6">
            <CardContent className="p-4">
              {hasResponded ? (
                <div className="flex items-center gap-3 text-primary">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-semibold">You've already responded to this job</span>
                </div>
              ) : (
                <form onSubmit={handleRespond} className="space-y-4">
                  <h3 className="font-semibold text-foreground">Respond to this Job</h3>
                  <div>
                    <Label className="text-sm">Your Message</Label>
                    <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Describe your experience and why you're a good fit..." className="rounded-xl mt-1.5" maxLength={1000} />
                  </div>
                  <div>
                    <Label className="text-sm">Proposed Price (KSh)</Label>
                    <Input type="number" value={proposedPrice} onChange={(e) => setProposedPrice(e.target.value)} placeholder="Your quote" className="h-12 rounded-xl mt-1.5" min="0" />
                  </div>
                  <Button type="submit" disabled={submitting} className="w-full rounded-xl">
                    <Send className="w-4 h-4 mr-2" />{submitting ? "Sending..." : "Send Response"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        )}

        {/* Job Seeker Apply Form */}
        {role === "job_seeker" && job.status === "open" && !isOwner && (
          <Card className="mb-6">
            <CardContent className="p-4">
              {hasApplied ? (
                <div className="flex items-center gap-3 text-primary">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-semibold">You've applied to this job</span>
                </div>
              ) : (
                <form onSubmit={handleApply} className="space-y-4">
                  <h3 className="font-semibold text-foreground">Apply for this Job</h3>
                  <div>
                    <Label className="text-sm">Cover Message</Label>
                    <Textarea
                      value={coverMessage}
                      onChange={(e) => setCoverMessage(e.target.value)}
                      placeholder="Why are you interested in this job? Describe your relevant skills..."
                      className="rounded-xl mt-1.5"
                      maxLength={1000}
                    />
                  </div>
                  <Button type="submit" disabled={applySubmitting} className="w-full rounded-xl">
                    <Send className="w-4 h-4 mr-2" />{applySubmitting ? "Applying..." : "Submit Application"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        )}

        {isOwner && responses.length > 0 && (
          <div>
            <h3 className="font-display font-bold text-lg text-foreground mb-4">Responses ({responses.length})</h3>
            <div className="space-y-3">
              {responses.map((r) => (
                <Card key={r.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-foreground">{r.provider_name}</span>
                      <Badge variant="outline" className={r.status === "accepted" ? "bg-primary/10 text-primary" : ""}>{r.status}</Badge>
                    </div>
                    {r.message && <p className="text-sm text-muted-foreground mb-2">{r.message}</p>}
                    {r.proposed_price && <p className="text-sm font-semibold text-foreground mb-3">Quote: KSh {r.proposed_price.toLocaleString()}</p>}
                    {r.status === "pending" && job.status === "open" && (
                      <Button size="sm" className="rounded-xl" onClick={() => handleAcceptResponse(r.id, r.provider_id)}>
                        <CheckCircle className="w-4 h-4 mr-1" /> Accept
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {isOwner && responses.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">No responses yet. Providers will see your job and respond.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default JobDetail;
