import { useEffect, useState, useRef } from "react";
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
  isImageFile, isVideoFile, normalizedMime, validateImageFile, validateVideoFile,
  prepareImageForUpload, uploadWithProgress, friendlyUploadError, logFileMeta,
} from "@/lib/mobileUpload";
import { logMobileMediaEvent, useMobileMediaLifecycle } from "@/hooks/useMobileMediaLifecycle";

interface Props {
  open: boolean;
  onClose: () => void;
}

export const CreateStoryDialog = ({ open, onClose }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [postedStatusId, setPostedStatusId] = useState<string | null>(null);
  const [showBoost, setShowBoost] = useState(false);
  const mediaLifecycle = useMobileMediaLifecycle<{ text: string }>("story-upload", open);

  useEffect(() => {
    if (!open) return;
    const draft = mediaLifecycle.loadDraft();
    if (typeof draft?.text === "string") setText(draft.text);
    const restored = mediaLifecycle.restoreFile();
    if (restored?.file) {
      setMediaFile(restored.file);
      setPreview(restored.objectUrl);
    } else if (mediaLifecycle.hasInterruptedFile()) {
      toast({ title: "Unable to load selected media", description: "Please try again.", variant: "destructive" });
    }
  }, [open]);

  useEffect(() => {
    if (open) mediaLifecycle.saveDraft({ text });
  }, [open, text, mediaLifecycle]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) { mediaLifecycle.endPicker("no-file-selected"); return; }
    logFileMeta("CreateStory", file);
    const v = isVideoFile(file) ? validateVideoFile(file) : validateImageFile(file);
    if (!v.ok) {
      mediaLifecycle.endPicker("validation-failed");
      toast({ title: v.error!, variant: "destructive" });
      return;
    }
    const stored = mediaLifecycle.rememberFile(file, isVideoFile(file) ? "gallery" : "file-picker", isVideoFile(file) ? "video" : "image");
    setMediaFile(stored.file);
    setPreview(stored.objectUrl);
    logMobileMediaEvent("story-preview-opened", { sessionKey: "story-upload", routeAfterPicker: window.location.pathname });
    e.currentTarget.value = "";
  };

  const removeImage = () => {
    setMediaFile(null);
    setPreview(null);
    mediaLifecycle.clearAll();
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!text.trim() && !mediaFile) {
      toast({ title: "Add text or media", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    setProgress(0);

    let image_url: string | null = null;

    if (mediaFile) {
      try {
        setProgressLabel(isImageFile(mediaFile) ? "Processing image…" : "Preparing video…");
        const prepared = isImageFile(mediaFile) ? await prepareImageForUpload(mediaFile) : mediaFile;
        const rawExt = (prepared.name.split(".").pop() || (isVideoFile(prepared) ? "mp4" : "jpg")).toLowerCase();
        const ext = rawExt.length <= 5 ? rawExt : (isVideoFile(prepared) ? "mp4" : "jpg");
        const path = `${user.id}/status_${Date.now()}.${ext}`;

        setProgressLabel("Uploading…");
        await uploadWithProgress({
          bucket: "provider-images",
          path,
          file: prepared,
          contentType: normalizedMime(prepared),
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
          title: "Media upload failed",
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
      mediaLifecycle.clearAll();
      setPostedStatusId(inserted.id);
    }
  };

  const resetAll = () => {
    setText("");
    setMediaFile(null);
    setPreview(null);
    mediaLifecycle.clearAll();
    setPostedStatusId(null);
    setShowBoost(false);
    onClose();
  };

  return (
    <>
      <Dialog open={open && !showBoost} onOpenChange={(v) => !v && !mediaLifecycle.shouldBlockClose() && resetAll()}>
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
                  {mediaFile && isVideoFile(mediaFile) ? (
                    <video src={preview} className="w-full h-48 object-contain bg-black" controls playsInline />
                  ) : (
                    <img src={preview} alt="Preview" className="w-full h-48 object-cover" />
                  )}
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
                  <span className="text-sm font-semibold">Add Media</span>
                </button>
              )}

              <input
                ref={fileRef}
                type="file"
                accept="image/*,video/*,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.mp4,.mov,.m4v,.webm,.3gp"
                onClick={() => mediaLifecycle.beginPicker("gallery")}
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

              {submitting && (
                <div className="space-y-1.5">
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">
                    {progressLabel} {progress > 0 && progress < 100 ? `${progress}%` : ""}
                  </p>
                </div>
              )}

              <Button
                onClick={handleSubmit}
                disabled={submitting || (!text.trim() && !mediaFile)}
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
