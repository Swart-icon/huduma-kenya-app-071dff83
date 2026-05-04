import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera, X, Loader2, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BoostStatusDialog } from "./BoostStatusDialog";
import {
  validateImageFile, prepareImageForUpload, uploadWithProgress,
  friendlyUploadError, logFileMeta,
} from "@/lib/mobileUpload";

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
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [postedStatusId, setPostedStatusId] = useState<string | null>(null);
  const [showBoost, setShowBoost] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    logFileMeta("CreateStory", file);
    const v = validateImageFile(file);
    if (!v.ok) {
      toast({ title: v.error!, variant: "destructive" });
      return;
    }
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
    setProgress(0);

    let image_url: string | null = null;

    if (imageFile) {
      try {
        setProgressLabel("Processing image…");
        const prepared = await prepareImageForUpload(imageFile);
        const rawExt = (prepared.name.split(".").pop() || "jpg").toLowerCase();
        const ext = rawExt.length <= 5 ? rawExt : "jpg";
        const path = `${user.id}/status_${Date.now()}.${ext}`;

        setProgressLabel("Uploading…");
        await uploadWithProgress({
          bucket: "provider-images",
          path,
          file: prepared,
          contentType: prepared.type || "image/jpeg",
          upsert: true,
          onProgress: setProgress,
        });

        const { data: urlData } = supabase.storage
          .from("provider-images")
          .getPublicUrl(path);
        image_url = urlData.publicUrl;
      } catch (uploadErr: any) {
        console.error("[CreateStory] upload error", uploadErr);
        toast({
          title: "Image upload failed",
          description: friendlyUploadError(uploadErr),
          variant: "destructive",
        });
        setSubmitting(false);
        setProgress(0);
        setProgressLabel("");
        return;
      }
    }

    const { data: inserted, error } = await supabase
      .from("provider_statuses")
      .insert({
        user_id: user.id,
        text_content: text.trim() || null,
        image_url,
      })
      .select("id")
      .single();

    setSubmitting(false);
    setProgress(0);
    setProgressLabel("");

    if (error || !inserted) {
      toast({ title: "Failed to post story", description: error?.message, variant: "destructive" });
    } else {
      toast({ title: "Story posted!" });
      setPostedStatusId(inserted.id);
    }
  };

  const resetAll = () => {
    setText("");
    setImageFile(null);
    setPreview(null);
    setPostedStatusId(null);
    setShowBoost(false);
    onClose();
  };

  return (
    <>
      <Dialog open={open && !showBoost} onOpenChange={(v) => !v && resetAll()}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">
              {postedStatusId ? "Boost Your Story?" : "Create Story"}
            </DialogTitle>
          </DialogHeader>

          {postedStatusId ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-gradient-to-br from-primary/10 via-accent/10 to-primary/10 p-5 text-center space-y-2">
                <div className="w-12 h-12 mx-auto rounded-full bg-primary/15 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-primary" />
                </div>
                <p className="font-bold text-foreground">Boost this status for KES 50</p>
                <p className="text-xs text-muted-foreground">
                  Reach more viewers — appears higher in the story & video feeds for 24 hours.
                </p>
              </div>

              <Button
                onClick={() => setShowBoost(true)}
                className="w-full h-12 rounded-xl font-bold"
              >
                <Zap className="w-4 h-4 mr-2" />
                Boost for KES 50
              </Button>
              <Button
                onClick={resetAll}
                variant="ghost"
                className="w-full rounded-xl"
              >
                Maybe later
              </Button>
            </div>
          ) : (
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
                  Posting is free • Expires in 24 hours
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
          )}
        </DialogContent>
      </Dialog>

      {postedStatusId && (
        <BoostStatusDialog
          open={showBoost}
          onClose={() => setShowBoost(false)}
          statusId={postedStatusId}
          onBoosted={() => {
            setShowBoost(false);
            resetAll();
          }}
        />
      )}
    </>
  );
};
