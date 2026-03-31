import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save } from "lucide-react";
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

const CreateService = () => {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [price, setPrice] = useState("");
  const [priceType, setPriceType] = useState("fixed");
  const [city, setCity] = useState("");
  const [county, setCounty] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || role !== "provider")) {
      navigate("/dashboard");
      return;
    }
    supabase
      .from("service_categories")
      .select("*")
      .order("sort_order")
      .then(({ data }) => setCategories(data || []));
  }, [authLoading, user, role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    if (!categoryId) {
      toast({ title: "Please select a category", variant: "destructive" });
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("services").insert({
      provider_id: user!.id,
      category_id: categoryId,
      title: title.trim(),
      description: description.trim() || null,
      price: price ? parseFloat(price) : null,
      price_type: priceType,
      city: city.trim() || null,
      county: county || null,
    });
    setSaving(false);

    if (error) {
      toast({ title: "Failed to create service", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Service created! 🎉" });
      navigate("/my-services");
    }
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-background px-6 py-6 pb-24">
      <div className="max-w-sm mx-auto">
        <button onClick={() => navigate("/my-services")} className="flex items-center gap-2 text-muted-foreground mb-6">
          <ArrowLeft className="w-5 h-5" />
          <span>My Services</span>
        </button>

        <h1 className="font-display text-2xl font-bold text-foreground mb-6">New Service</h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label className="text-sm font-semibold">Category *</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="h-12 rounded-xl mt-1.5">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-semibold">Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Plumbing Installation & Repair"
              className="h-12 rounded-xl mt-1.5"
              maxLength={100}
            />
          </div>

          <div>
            <Label className="text-sm font-semibold">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what you offer, experience, and what clients can expect..."
              className="rounded-xl mt-1.5 min-h-[100px]"
              maxLength={1000}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-semibold">Price (KSh)</Label>
              <Input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0"
                className="h-12 rounded-xl mt-1.5"
                min="0"
              />
            </div>
            <div>
              <Label className="text-sm font-semibold">Price Type</Label>
              <Select value={priceType} onValueChange={setPriceType}>
                <SelectTrigger className="h-12 rounded-xl mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed</SelectItem>
                  <SelectItem value="starting_from">Starting from</SelectItem>
                  <SelectItem value="negotiable">Negotiable</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-semibold">County</Label>
              <Select value={county} onValueChange={setCounty}>
                <SelectTrigger className="h-12 rounded-xl mt-1.5">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {kenyanCounties.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-semibold">City / Town</Label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Westlands"
                className="h-12 rounded-xl mt-1.5"
              />
            </div>
          </div>

          <Button type="submit" disabled={saving} className="w-full h-14 text-lg font-bold rounded-xl" size="lg">
            <Save className="w-5 h-5 mr-2" />
            {saving ? "Creating..." : "Create Service"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default CreateService;
