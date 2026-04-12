import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useCategories } from "@/hooks/useCategories";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Video, Upload, Loader2, X } from "lucide-react";
import { toast } from "sonner";

const MAX_VIDEO_SIZE_MB = 1024;
const ALLOWED_FORMATS = ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"];

export const UploadVideoDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: categories } = useCategories();
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const resetForm = () => { setFile(null); setCaption(""); setCategoryId(""); setPreview(null); };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!ALLOWED_FORMATS.includes(f.type)) { toast.error("Use MP4, WebM, or MOV."); return; }
    if (f.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) { toast.error(`Video must be under ${MAX_VIDEO_SIZE_MB}MB`); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleUpload = async () => {
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "mp4";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: storageError } = await supabase.storage.from("user-videos").upload(path, file, { contentType: file.type });
      if (storageError) throw storageError;
      const { data: urlData } = supabase.storage.from("user-videos").getPublicUrl(path);
      const { error: dbError } = await supabase.from("videos").insert({
        user_id: user.id,
        title: caption.trim() || "Untitled",
        category_id: categoryId || null,
        video_url: urlData.publicUrl,
        status: "active",
      });
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="w-5 h-5 text-primary" /> Upload Video
          </DialogTitle>
          <DialogDescription>Share your work, skills, or services</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {!file ? (
            <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-primary/30 rounded-2xl cursor-pointer hover:border-primary/60 bg-primary/5 transition-colors">
              <Upload className="w-8 h-8 text-primary/60 mb-2" />
              <p className="text-sm font-medium text-primary">Tap to select video</p>
              <p className="text-xs text-muted-foreground mt-1">MP4, WebM, MOV • Max 1GB</p>
              <input type="file" accept="video/mp4,video/webm,video/quicktime,video/x-m4v" className="hidden" onChange={handleFileSelect} />
            </label>
          ) : (
            <div className="relative rounded-2xl overflow-hidden bg-black">
              <video src={preview!} className="w-full max-h-48 object-contain" controls />
              <button onClick={() => { setFile(null); setPreview(null); }} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          )}
          <div>
            <Label>Caption</Label>
            <Textarea placeholder="Describe your video..." value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={300} className="mt-1" />
            <p className="text-xs text-muted-foreground text-right mt-1">{caption.length}/300</p>
          </div>
          <div>
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select a category" /></SelectTrigger>
              <SelectContent>
                {categories?.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleUpload} disabled={!file || uploading} className="w-full rounded-xl">
            {uploading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading...</>) : (<><Upload className="w-4 h-4 mr-2" />Upload Video</>)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
