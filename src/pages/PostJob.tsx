import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const kenyanCounties = [
  "Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo-Marakwet", "Embu", "Garissa",
  "Homa Bay", "Isiolo", "Kajiado", "Kakamega", "Kericho", "Kiambu", "Kilifi",
  "Kirinyaga", "Kisii", "Kisumu", "Kitui", "Kwale", "Laikipia", "Lamu", "Machakos",
  "Makueni", "Mandera", "Marsabit", "Meru", "Migori", "Mombasa", "Murang'a",
  "Nairobi", "Nakuru", "Nandi", "Narok", "Nyamira", "Nyandarua", "Nyeri",
  "Samburu", "Siaya", "Taita-Taveta", "Tana River", "Tharaka-Nithi", "Trans-Nzoia",
  "Turkana", "Uasin Gishu", "Vihiga", "Wajir", "West Pokot",
];

type Category = { id: string; name: string; icon: string | null };

const PostJob = () => {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [budget, setBudget] = useState("");
  const [budgetType, setBudgetType] = useState("fixed");
  const [city, setCity] = useState("");
  const [county, setCounty] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || role !== "client")) {
      navigate("/dashboard");
      return;
    }
    supabase.from("service_categories").select("*").order("sort_order")
      .then(({ data }) => setCategories(data || []));
  }, [authLoading, user, role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { toast({ title: "Title is required", variant: "destructive" }); return; }
    if (!categoryId) { toast({ title: "Please select a category", variant: "destructive" }); return; }

    setSaving(true);
    const { error } = await supabase.from("job_posts").insert({
      client_id: user!.id,
      category_id: categoryId,
      title: title.trim(),
      description: description.trim() || null,
      budget: budget ? parseFloat(budget) : null,
      budget_type: budgetType,
      city: city.trim() || null,
      county: county || null,
    });
    setSaving(false);

    if (error) {
      toast({ title: "Failed to post job", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Job posted! 🎉" });
      navigate("/my-jobs");
    }
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-background px-6 py-6 pb-24">
      <div className="max-w-sm mx-auto">
        <button onClick={() => navigate("/my-jobs")} className="flex items-center gap-2 text-muted-foreground mb-6">
          <ArrowLeft className="w-5 h-5" />
          <span>My Jobs</span>
        </button>

        <h1 className="font-display text-2xl font-bold text-foreground mb-6">Post a Job</h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label className="text-sm font-semibold">Category *</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="h-12 rounded-xl mt-1.5"><SelectValue placeholder="Select a category" /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-semibold">Job Title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Need a plumber for kitchen renovation" className="h-12 rounded-xl mt-1.5" maxLength={100} />
          </div>

          <div>
            <Label className="text-sm font-semibold">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the job, requirements, timeline..." className="rounded-xl mt-1.5 min-h-[100px]" maxLength={2000} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-semibold">Budget (KSh)</Label>
              <Input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="0" className="h-12 rounded-xl mt-1.5" min="0" />
            </div>
            <div>
              <Label className="text-sm font-semibold">Budget Type</Label>
              <Select value={budgetType} onValueChange={setBudgetType}>
                <SelectTrigger className="h-12 rounded-xl mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed</SelectItem>
                  <SelectItem value="negotiable">Negotiable</SelectItem>
                  <SelectItem value="hourly">Hourly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-semibold">County</Label>
              <Select value={county} onValueChange={setCounty}>
                <SelectTrigger className="h-12 rounded-xl mt-1.5"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {kenyanCounties.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-semibold">City / Town</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Westlands" className="h-12 rounded-xl mt-1.5" />
            </div>
          </div>

          <Button type="submit" disabled={saving} className="w-full h-14 text-lg font-bold rounded-xl" size="lg">
            <Send className="w-5 h-5 mr-2" />
            {saving ? "Posting..." : "Post Job"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default PostJob;
