import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft, Save, ImagePlus, X, Loader2, Navigation, MapPin,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { KENYAN_LOCATIONS, getCoordinatesForCounty } from "@/lib/kenyanLocations";

const kenyanCounties = [
  "Baringo","Bomet","Bungoma","Busia","Elgeyo-Marakwet","Embu","Garissa",
  "Homa Bay","Isiolo","Kajiado","Kakamega","Kericho","Kiambu","Kilifi",
  "Kirinyaga","Kisii","Kisumu","Kitui","Kwale","Laikipia","Lamu","Machakos",
  "Makueni","Mandera","Marsabit","Meru","Migori","Mombasa","Murang'a",
  "Nairobi","Nakuru","Nandi","Narok","Nyamira","Nyandarua","Nyeri",
  "Samburu","Siaya","Taita-Taveta","Tana River","Tharaka-Nithi","Trans-Nzoia",
  "Turkana","Uasin Gishu","Vihiga","Wajir","West Pokot",
];

const MAX_IMAGES = 6;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

type Category = { id: string; name: string; icon: string | null };

const CreateGood = () => {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [price, setPrice] = useState("");
  const [priceType, setPriceType] = useState("fixed");
  const [condition, setCondition] = useState("new");
  const [stock, setStock] = useState("");
  const [city, setCity] = useState("");
  const [county, setCounty] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);

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
  }, [authLoading, user, role, navigate]);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const incoming = Array.from(files);
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      toast({ title: `Maximum ${MAX_IMAGES} images`, variant: "destructive" });
      return;
    }
    const accepted: File[] = [];
    for (const f of incoming.slice(0, remaining)) {
      if (!f.type.startsWith("image/")) continue;
      if (f.size > MAX_IMAGE_BYTES) {
        toast({ title: `${f.name} is over 5 MB`, variant: "destructive" });
        continue;
      }
      accepted.push(f);
    }
    setImages((prev) => [...prev, ...accepted]);
    setPreviews((prev) => [...prev, ...accepted.map((f) => URL.createObjectURL(f))]);
  };

  const removeImage = (idx: number) => {
    URL.revokeObjectURL(previews[idx]);
    setImages((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "Geolocation not supported", variant: "destructive" });
      return;
    }
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setDetecting(false);
        toast({ title: "Location detected 📍" });
      },
      () => {
        setDetecting(false);
        toast({ title: "Could not detect location", variant: "destructive" });
      },
      { enableHighAccuracy: false, timeout: 10000 },
    );
  };

  const handleCountyChange = (v: string) => {
    setCounty(v);
    if (!latitude) {
      const coords = getCoordinatesForCounty(v);
      if (coords) { setLatitude(coords.lat); setLongitude(coords.lng); }
    }
  };

  const handleManualCity = (cityName: string) => {
    const c = KENYAN_LOCATIONS.find((loc) => loc.name === cityName);
    if (c) {
      setCity(c.name); setCounty(c.county);
      setLatitude(c.lat); setLongitude(c.lng);
    }
  };

  const uploadImages = async (): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of images) {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user!.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("product-images")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    return urls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { toast({ title: "Title is required", variant: "destructive" }); return; }
    if (!categoryId) { toast({ title: "Pick a category", variant: "destructive" }); return; }
    if (images.length === 0) { toast({ title: "Add at least one product photo", variant: "destructive" }); return; }

    setSaving(true);
    try {
      const imageUrls = await uploadImages();
      const { error } = await supabase.from("goods").insert({
        seller_id: user!.id,
        category_id: categoryId,
        title: title.trim(),
        description: description.trim() || null,
        price: price ? parseFloat(price) : null,
        price_type: priceType,
        condition,
        stock_quantity: stock ? parseInt(stock, 10) : null,
        images: imageUrls,
        city: city.trim() || null,
        county: county || null,
        latitude,
        longitude,
      });
      if (error) throw error;
      toast({ title: "Product listed 🎉" });
      navigate("/my-goods");
    } catch (err: any) {
      toast({ title: "Failed to list product", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-background px-6 py-6 pb-24">
      <div className="max-w-sm mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground mb-6">
          <ArrowLeft className="w-5 h-5" /><span>Back</span>
        </button>

        <h1 className="font-display text-2xl font-bold text-foreground mb-1">List a Product</h1>
        <p className="text-sm text-muted-foreground mb-6">Sell goods to clients browsing the marketplace.</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Images */}
          <div>
            <Label className="text-sm font-semibold">Photos * <span className="text-xs font-normal text-muted-foreground">(up to {MAX_IMAGES})</span></Label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {previews.map((src, i) => (
                <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-muted">
                  <img src={src} alt={`Product ${i+1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center"
                    aria-label="Remove image"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {images.length < MAX_IMAGES && (
                <label className="aspect-square rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-primary text-muted-foreground hover:text-primary transition-colors">
                  <ImagePlus className="w-5 h-5" />
                  <span className="text-[10px] font-medium">Add photo</span>
                  <input
                    type="file" accept="image/*" multiple className="hidden"
                    onChange={(e) => handleFiles(e.target.files)}
                  />
                </label>
              )}
            </div>
          </div>

          <div>
            <Label className="text-sm font-semibold">Category *</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="h-12 rounded-xl mt-1.5">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-semibold">Product Name *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Samsung Galaxy A15 — 128GB"
              className="h-12 rounded-xl mt-1.5" maxLength={100} />
          </div>

          <div>
            <Label className="text-sm font-semibold">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Specs, condition details, what's included..."
              className="rounded-xl mt-1.5 min-h-[100px]" maxLength={1500} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-semibold">Price (KSh)</Label>
              <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)}
                placeholder="0" className="h-12 rounded-xl mt-1.5" min="0" />
            </div>
            <div>
              <Label className="text-sm font-semibold">Price Type</Label>
              <Select value={priceType} onValueChange={setPriceType}>
                <SelectTrigger className="h-12 rounded-xl mt-1.5"><SelectValue /></SelectTrigger>
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
              <Label className="text-sm font-semibold">Condition</Label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger className="h-12 rounded-xl mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">Brand new</SelectItem>
                  <SelectItem value="like_new">Like new</SelectItem>
                  <SelectItem value="used">Used</SelectItem>
                  <SelectItem value="refurbished">Refurbished</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-semibold">Stock</Label>
              <Input type="number" value={stock} onChange={(e) => setStock(e.target.value)}
                placeholder="Optional" className="h-12 rounded-xl mt-1.5" min="0" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-semibold">County</Label>
              <Select value={county} onValueChange={handleCountyChange}>
                <SelectTrigger className="h-12 rounded-xl mt-1.5"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {kenyanCounties.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-semibold">City / Town</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Westlands" className="h-12 rounded-xl mt-1.5" />
            </div>
          </div>

          <Card className="border-dashed">
            <CardContent className="p-4 space-y-3">
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-primary" /> Pin Pickup Location
              </Label>
              <Button type="button" variant={latitude ? "secondary" : "default"}
                className="w-full rounded-xl h-11 gap-2"
                onClick={handleDetectLocation} disabled={detecting}>
                {detecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
                {detecting ? "Detecting..." : latitude ? "Location set ✓ — Re-detect" : "Detect My Location"}
              </Button>
              <Select onValueChange={handleManualCity}>
                <SelectTrigger className="h-11 rounded-xl text-sm">
                  <SelectValue placeholder="Or pick a major city" />
                </SelectTrigger>
                <SelectContent>
                  {KENYAN_LOCATIONS.map((loc) => (
                    <SelectItem key={loc.name} value={loc.name}>{loc.name}, {loc.county}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Button type="submit" disabled={saving} className="w-full h-14 text-lg font-bold rounded-xl">
            <Save className="w-5 h-5 mr-2" />
            {saving ? "Publishing..." : "Publish Product"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default CreateGood;
