import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera, X, Loader2, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BoostStatusDialog } from "./BoostStatusDialog";

interface Props {
  open: boolean;
  onClose: () => void;
}

export const CreateStoryDialog = ({ open, onClose }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [postedStatusId, setPostedStatusId] = useState<string | null>(null);
  const [showBoost, setShowBoost] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    setPreview(null);
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!text.trim() && !imageFile) {
      toast({ title: "Add text or an image", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    let image_url: string | null = null;

    if (imageFile) {
      const ext = imageFile.name.split(".").pop();
      const path = `${user.id}/status_${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("provider-images")
        .upload(path, imageFile, { upsert: true });

      if (uploadErr) {
        toast({ title: "Image upload failed", description: uploadErr.message, variant: "destructive" });
        setSubmitting(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("provider-images")
        .getPublicUrl(path);
      image_url = urlData.publicUrl;
    }

    const { error } = await supabase.from("provider_statuses").insert({
      user_id: user.id,
      text_content: text.trim() || null,
      image_url,
    });

    setSubmitting(false);

    if (error) {
      toast({ title: "Failed to post story", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Story posted!" });
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">Create Story</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Image preview */}
          {preview ? (
            <div className="relative rounded-xl overflow-hidden">
              <img src={preview} alt="Preview" className="w-full h-48 object-cover" />
              <button
                onClick={removeImage}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full h-32 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
            >
              <Camera className="w-8 h-8" />
              <span className="text-sm font-semibold">Add Photo</span>
            </button>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What's on your mind?"
            maxLength={280}
            className="rounded-xl resize-none"
            rows={3}
          />

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Expires in 24 hours
            </span>
            <span className="text-xs text-muted-foreground">{text.length}/280</span>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitting || (!text.trim() && !imageFile)}
            className="w-full rounded-xl h-12 font-bold"
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Posting...</>
            ) : (
              "Share Story"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
