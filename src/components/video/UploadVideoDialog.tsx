import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useCategories } from "@/hooks/useCategories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Video, Upload, Loader2, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { KENYAN_COUNTIES, getCitiesByCounty } from "@/lib/kenyanLocations";

const MAX_VIDEO_SIZE_MB = 1024;
const ALLOWED_FORMATS = ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"];

type ValidationErrors = {
  file?: string;
  description?: string;
  category?: string;
  county?: string;
  city?: string;
};

export const UploadVideoDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) => {
  const { user, roles } = useAuth();
  const queryClient = useQueryClient();
  const { data: categories } = useCategories();
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [county, setCounty] = useState("");
  const [city, setCity] = useState("");
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [submitted, setSubmitted] = useState(false);

  const canUpload = roles.includes("provider") || roles.includes("job_seeker");
  const cities = county ? getCitiesByCounty(county) : [];

  const resetForm = () => {
    setFile(null); setDescription(""); setCategoryId("");
    setCounty(""); setCity(""); setPreview(null);
    setErrors({}); setSubmitted(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!ALLOWED_FORMATS.includes(f.type)) { toast.error("Use MP4, WebM, or MOV format."); return; }
    if (f.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) { toast.error(`Video must be under 1GB`); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    if (submitted) setErrors((prev) => ({ ...prev, file: undefined }));
  };

  const validate = (): ValidationErrors => {
    const e: ValidationErrors = {};
    if (!file) e.file = "Please select a video";
    if (!description.trim()) e.description = "Description is required";
    else if (description.trim().length < 10) e.description = "Description must be at least 10 characters";
    if (!categoryId) e.category = "Category is required";
    if (!county) e.county = "County is required";
    if (!city) e.city = "City is required";
    return e;
  };

  const handleUpload = async () => {
    setSubmitted(true);
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (!file || !user || !canUpload) return;

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "mp4";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: storageError } = await supabase.storage.from("user-videos").upload(path, file, { contentType: file.type });
      if (storageError) throw storageError;
      const { data: urlData } = supabase.storage.from("user-videos").getPublicUrl(path);
      const { error: dbError } = await supabase.from("videos").insert({
        user_id: user.id,
        title: description.trim(),
        category_id: categoryId,
        video_url: urlData.publicUrl,
        county,
        city,
        status: "active",
      } as any);
      if (dbError) throw dbError;
      toast.success("Video uploaded! 🎬");
      queryClient.invalidateQueries({ queryKey: ["videos-feed"] });
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const FieldError = ({ message }: { message?: string }) =>
    message ? (
      <p className="text-destructive text-xs flex items-center gap-1 mt-1">
        <AlertCircle className="w-3 h-3" /> {message}
      </p>
    ) : null;

  if (!canUpload) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm mx-auto text-center">
          <DialogHeader>
            <DialogTitle>Upload Not Available</DialogTitle>
            <DialogDescription>
              Only Service Providers and Job Seekers can upload videos. Update your role in your profile settings.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => onOpenChange(false)} className="w-full rounded-xl mt-2">Close</Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="w-5 h-5 text-primary" /> Upload Video
          </DialogTitle>
          <DialogDescription>All fields are required before uploading</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {/* Video file */}
          {!file ? (
            <div>
              <label className={`flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-2xl cursor-pointer transition-colors ${
                errors.file ? "border-destructive bg-destructive/5" : "border-primary/30 hover:border-primary/60 bg-primary/5"
              }`}>
                <Upload className="w-8 h-8 text-primary/60 mb-2" />
                <p className="text-sm font-medium text-primary">Tap to select video</p>
                <p className="text-xs text-muted-foreground mt-1">MP4, WebM, MOV • Max 1GB</p>
                <input type="file" accept="video/mp4,video/webm,video/quicktime,video/x-m4v" className="hidden" onChange={handleFileSelect} />
              </label>
              <FieldError message={errors.file} />
            </div>
          ) : (
            <div className="relative rounded-2xl overflow-hidden bg-black">
              <video src={preview!} className="w-full max-h-40 object-contain" controls />
              <button onClick={() => { setFile(null); setPreview(null); }} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          )}

          {/* Description */}
          <div>
            <Label className="text-sm font-medium">
              Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              placeholder="Describe your video, skills, or services shown..."
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (submitted) setErrors((prev) => ({ ...prev, description: undefined }));
              }}
              maxLength={300}
              className={`mt-1 ${errors.description ? "border-destructive" : ""}`}
            />
            <div className="flex justify-between mt-1">
              <FieldError message={errors.description} />
              <p className="text-xs text-muted-foreground">{description.length}/300</p>
            </div>
          </div>

          {/* Category */}
          <div>
            <Label className="text-sm font-medium">
              Category <span className="text-destructive">*</span>
            </Label>
            <Select value={categoryId} onValueChange={(v) => {
              setCategoryId(v);
              if (submitted) setErrors((prev) => ({ ...prev, category: undefined }));
            }}>
              <SelectTrigger className={`mt-1 ${errors.category ? "border-destructive" : ""}`}>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories?.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
              </SelectContent>
            </Select>
            <FieldError message={errors.category} />
          </div>

          {/* Location: County */}
          <div>
            <Label className="text-sm font-medium">
              County <span className="text-destructive">*</span>
            </Label>
            <Select value={county} onValueChange={(v) => {
              setCounty(v);
              setCity("");
              if (submitted) setErrors((prev) => ({ ...prev, county: undefined, city: undefined }));
            }}>
              <SelectTrigger className={`mt-1 ${errors.county ? "border-destructive" : ""}`}>
                <SelectValue placeholder="Select county" />
              </SelectTrigger>
              <SelectContent>
                {KENYAN_COUNTIES.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
              </SelectContent>
            </Select>
            <FieldError message={errors.county} />
          </div>

          {/* Location: City */}
          <div>
            <Label className="text-sm font-medium">
              City <span className="text-destructive">*</span>
            </Label>
            <Select value={city} onValueChange={(v) => {
              setCity(v);
              if (submitted) setErrors((prev) => ({ ...prev, city: undefined }));
            }} disabled={!county}>
              <SelectTrigger className={`mt-1 ${errors.city ? "border-destructive" : ""}`}>
                <SelectValue placeholder={county ? "Select city" : "Select county first"} />
              </SelectTrigger>
              <SelectContent>
                {cities.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
              </SelectContent>
            </Select>
            <FieldError message={errors.city} />
          </div>

          <Button onClick={handleUpload} disabled={uploading} className="w-full rounded-xl">
            {uploading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading...</>) : (<><Upload className="w-4 h-4 mr-2" />Upload Video</>)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
