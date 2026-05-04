import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Video, Upload, Loader2, X, AlertCircle, Camera, Square, CircleDot, SwitchCamera, Download, Maximize2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { KENYAN_COUNTIES, getCitiesByCounty } from "@/lib/kenyanLocations";
import { extractVideoThumbnail } from "@/lib/videoThumbnail";
import {
  isVideoFile, validateVideoFile, normalizedMime,
  uploadWithProgress, friendlyUploadError, logFileMeta, MAX_VIDEO_MB,
} from "@/lib/mobileUpload";
import { useMobileMediaLifecycle } from "@/hooks/useMobileMediaLifecycle";

type ValidationErrors = {
  file?: string;
  description?: string;
  category?: string;
  county?: string;
  city?: string;
};

const VIDEO_UPLOAD_SESSION = "video-upload";

export const UploadVideoDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) => {
  const navigate = useNavigate();
  const { user, roles } = useAuth();
  const queryClient = useQueryClient();
  const { data: categories } = useCategories();
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [county, setCounty] = useState("");
  const [city, setCity] = useState("");
  const [allowDownloads, setAllowDownloads] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState<string>("");
  const [preview, setPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const mediaLifecycle = useMobileMediaLifecycle<{
    description: string;
    categoryId: string;
    county: string;
    city: string;
    allowDownloads: boolean;
  }>(VIDEO_UPLOAD_SESSION, open);

  // Recording state
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveVideoRef = useRef<HTMLVideoElement>(null);

  const canUpload = roles.includes("provider") || roles.includes("job_seeker");
  const cities = county ? getCitiesByCounty(county) : [];

  const resetForm = useCallback(() => {
    setFile(null); setDescription(""); setCategoryId("");
    setCounty(""); setCity(""); setPreview(null);
    setErrors({}); setSubmitted(false);
    mediaLifecycle.clearAll();
    stopCamera();
  }, [mediaLifecycle]);

  // Cleanup on dialog close
  useEffect(() => {
    if (!open) {
      stopCamera();
    }
  }, [open]);

  // Persist form state while Android/iOS temporarily background the webview for camera/gallery.
  useEffect(() => {
    if (!open) return;
    mediaLifecycle.saveDraft({ description, categoryId, county, city, allowDownloads });
  }, [open, description, categoryId, county, city, allowDownloads, mediaLifecycle]);

  // Restore draft + selected file if the app was paused/recreated during picker handoff.
  useEffect(() => {
    if (!open) return;
    const draft = mediaLifecycle.loadDraft();
    if (draft) {
      if (typeof draft.description === "string") setDescription(draft.description);
      if (typeof draft.categoryId === "string") setCategoryId(draft.categoryId);
      if (typeof draft.county === "string") setCounty(draft.county);
      if (typeof draft.city === "string") setCity(draft.city);
      if (typeof draft.allowDownloads === "boolean") setAllowDownloads(draft.allowDownloads);
    }
    const restored = mediaLifecycle.restoreFile();
    if (restored?.file) {
      setFile(restored.file);
      setPreview(restored.objectUrl);
    } else if (mediaLifecycle.hasInterruptedFile()) {
      toast.error("Unable to load selected media. Please try again.");
    }
  }, [open]);

  // Ingest a pending recording handed off from the full-screen recorder
  useEffect(() => {
    if (!open) return;
    try {
      const raw = sessionStorage.getItem("pending_recorded_video");
      const memRef = sessionStorage.getItem("pending_recorded_video_ref");
      if (raw) {
        const meta = JSON.parse(raw) as { name: string; type: string; data: string };
        const bin = atob(meta.data);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const recordedFile = new File([bytes], meta.name, { type: meta.type });
        const stored = mediaLifecycle.rememberFile(recordedFile, "recorder", "video");
        setFile(stored.file);
        setPreview(stored.objectUrl);
        sessionStorage.removeItem("pending_recorded_video");
      } else if (memRef === "memory" && (window as any).__pendingRecordedVideo) {
        const recordedFile = (window as any).__pendingRecordedVideo as File;
        const stored = mediaLifecycle.rememberFile(recordedFile, "recorder", "video");
        setFile(stored.file);
        setPreview(stored.objectUrl);
        delete (window as any).__pendingRecordedVideo;
        sessionStorage.removeItem("pending_recorded_video_ref");
      }
    } catch (err) {
      console.error("[UploadVideo] recorded handoff failed", err);
      toast.error("Unable to load selected media. Please try again.");
    }
  }, [open, mediaLifecycle]);

  // Sync stream to video element after render
  useEffect(() => {
    if (stream && liveVideoRef.current) {
      liveVideoRef.current.srcObject = stream;
      liveVideoRef.current.play().catch(() => {});
    }
  }, [stream]);

  const stopCamera = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecording(false);
    setRecordingTime(0);
  };

  const startCamera = async (mode: "user" | "environment" = facingMode) => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1080 }, height: { ideal: 1920 } },
        audio: true,
      });
      setStream(mediaStream);
      setFacingMode(mode);
    } catch (err: any) {
      toast.error("Camera access denied. Please allow camera permissions.");
    }
  };

  const flipCamera = async () => {
    if (recording) return;
    // Stop current stream
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
    const newMode = facingMode === "user" ? "environment" : "user";
    await startCamera(newMode);
  };

  const startRecording = () => {
    if (!stream) return;
    chunksRef.current = [];
    // iOS Safari can't record webm. Try webm first (Android/desktop), fall back to mp4 (iOS).
    const candidates = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4;codecs=h264,aac",
      "video/mp4",
    ];
    const mimeType = candidates.find((m) => MediaRecorder.isTypeSupported(m)) || "";
    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);
    const outputType = mimeType || recorder.mimeType || "video/webm";
    const ext = outputType.includes("mp4") ? "mp4" : "webm";
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: outputType });
      const recordedFile = new File([blob], `recording-${Date.now()}.${ext}`, { type: outputType });
      setFile(recordedFile);
      setPreview(URL.createObjectURL(blob));
      stopCamera();
    };
    mediaRecorderRef.current = recorder;
    recorder.start(1000);
    setRecording(true);
    setRecordingTime(0);
    timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecording(false);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) {
      mediaLifecycle.endPicker("no-file-selected");
      return;
    }
    logFileMeta("UploadVideo", f);
    if (!isVideoFile(f)) { mediaLifecycle.endPicker("unsupported-type"); toast.error("Unsupported file type. Use MP4, MOV, or WebM."); return; }
    const v = validateVideoFile(f);
    if (!v.ok) { mediaLifecycle.endPicker("validation-failed"); toast.error(v.error!); return; }
    const stored = mediaLifecycle.rememberFile(f, "gallery", "video");
    setFile(stored.file);
    setPreview(stored.objectUrl);
    if (submitted) setErrors((prev) => ({ ...prev, file: undefined }));
    e.currentTarget.value = "";
  };

  const validate = (): ValidationErrors => {
    const e: ValidationErrors = {};
    if (!file) e.file = "Please select or record a video";
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

    // Final size guard (covers files dropped in via the recorder/handoff)
    const v = validateVideoFile(file);
    if (!v.ok) { toast.error(v.error!); return; }

    setUploading(true);
    setProgress(0);
    setProgressLabel("Preparing…");
    try {
      const rawExt = (file.name.split(".").pop() || "mp4").toLowerCase();
      const ext = rawExt.length <= 5 ? rawExt : "mp4";
      const baseKey = `${user.id}/${Date.now()}`;
      const path = `${baseKey}.${ext}`;
      const contentType = normalizedMime(file);

      // Kick off thumbnail extraction in parallel — never blocks the post
      const thumbnailPromise = extractVideoThumbnail(file).catch(() => null);

      setProgressLabel("Uploading video…");
      await uploadWithProgress({
        bucket: "user-videos",
        path,
        file,
        contentType,
        onProgress: (pct) => setProgress(pct),
      });

      const { data: urlData } = supabase.storage.from("user-videos").getPublicUrl(path);

      // Upload thumbnail (best-effort — never block the post)
      setProgressLabel("Finalizing…");
      let thumbnailUrl: string | null = null;
      try {
        const thumbFile = await thumbnailPromise;
        if (thumbFile) {
          const thumbPath = `${baseKey}_thumb.jpg`;
          const { error: thumbErr } = await supabase.storage
            .from("user-videos")
            .upload(thumbPath, thumbFile, { contentType: "image/jpeg", cacheControl: "31536000" });
          if (!thumbErr) {
            thumbnailUrl = supabase.storage.from("user-videos").getPublicUrl(thumbPath).data.publicUrl;
          }
        }
      } catch {
        // Non-fatal
      }

      const { error: dbError } = await supabase.from("videos").insert({
        user_id: user.id,
        title: description.trim(),
        category_id: categoryId,
        video_url: urlData.publicUrl,
        thumbnail_url: thumbnailUrl,
        county,
        city,
        allow_downloads: allowDownloads,
        status: "active",
      } as any);
      if (dbError) {
        console.error("[UploadVideo] db error", dbError);
        throw dbError;
      }
      toast.success("Video uploaded! 🎬");
      queryClient.invalidateQueries({ queryKey: ["videos-feed"] });
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      console.error("[UploadVideo] failed", err);
      toast.error(friendlyUploadError(err));
    } finally {
      setUploading(false);
      setProgress(0);
      setProgressLabel("");
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
    <Dialog open={open} onOpenChange={(next) => {
      if (!next && mediaLifecycle.shouldBlockClose()) return;
      onOpenChange(next);
    }}>
      <DialogContent className="max-w-md mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="w-5 h-5 text-primary" /> Upload Video
          </DialogTitle>
          <DialogDescription>Record or upload a video</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {/* Video source: Upload or Record */}
          {!file ? (
            <Tabs defaultValue="upload" className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="upload" className="flex-1 gap-1.5">
                  <Upload className="w-4 h-4" /> Upload
                </TabsTrigger>
                <TabsTrigger value="record" className="flex-1 gap-1.5">
                  <Camera className="w-4 h-4" /> Record
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upload">
                <label className={`flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-2xl cursor-pointer transition-colors ${
                  errors.file ? "border-destructive bg-destructive/5" : "border-primary/30 hover:border-primary/60 bg-primary/5"
                }`}>
                  <Upload className="w-8 h-8 text-primary/60 mb-2" />
                  <p className="text-sm font-medium text-primary">Tap to select video</p>
                  <p className="text-xs text-muted-foreground mt-1">MP4, WebM, MOV • Max 1GB</p>
                  <input
                    type="file"
                    accept="video/*,.mp4,.mov,.m4v,.webm,.3gp,.mkv"
                    className="hidden"
                    onClick={() => mediaLifecycle.beginPicker("gallery")}
                    onChange={handleFileSelect}
                  />
                </label>
                <FieldError message={errors.file} />
              </TabsContent>

              <TabsContent value="record">
                <div className="space-y-3">
                  <button
                    onClick={() => { mediaLifecycle.saveDraft({ description, categoryId, county, city, allowDownloads }); stopCamera(); onOpenChange(false); navigate("/videos/record"); }}
                    className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-2xl border-primary/40 hover:border-primary/70 bg-gradient-to-br from-primary/10 to-primary/5 transition-colors"
                  >
                    <Maximize2 className="w-8 h-8 text-primary/70 mb-2" />
                    <p className="text-sm font-semibold text-primary">Open full-screen recorder</p>
                    <p className="text-xs text-muted-foreground mt-1">Immersive camera with flash & flip</p>
                  </button>

                  {!stream ? (
                    <button
                      onClick={() => startCamera()}
                      className="flex flex-col items-center justify-center w-full h-24 border border-dashed rounded-xl border-border hover:border-primary/40 bg-muted/30 transition-colors"
                    >
                      <Camera className="w-5 h-5 text-muted-foreground mb-1" />
                      <p className="text-xs text-muted-foreground">Or quick-record here</p>
                    </button>
                  ) : (
                    <div className="relative rounded-2xl overflow-hidden bg-black">
                      <video
                        ref={liveVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-48 object-cover"
                        style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
                      />
                      {/* Flip camera button */}
                      {!recording && (
                        <button
                          onClick={flipCamera}
                          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-colors"
                        >
                          <SwitchCamera className="w-4 h-4 text-white" />
                        </button>
                      )}
                      {recording && (
                        <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 rounded-full px-3 py-1">
                          <div className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />
                          <span className="text-white text-xs font-mono">{formatTime(recordingTime)}</span>
                        </div>
                      )}
                      <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-3">
                        {!recording ? (
                          <Button onClick={startRecording} size="sm" variant="destructive" className="rounded-full gap-1.5">
                            <CircleDot className="w-4 h-4" /> Start Recording
                          </Button>
                        ) : (
                          <Button onClick={stopRecording} size="sm" variant="destructive" className="rounded-full gap-1.5">
                            <Square className="w-3 h-3" /> Stop
                          </Button>
                        )}
                        <Button onClick={stopCamera} size="sm" variant="outline" className="rounded-full bg-white/10 border-white/20 text-white hover:bg-white/20">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                <FieldError message={errors.file} />
              </TabsContent>
            </Tabs>
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

          {/* County */}
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

          {/* City */}
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

          {/* Allow downloads toggle */}
          <div className="flex items-start justify-between gap-3 rounded-xl border border-border p-3">
            <div className="flex-1">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Download className="w-4 h-4" /> Allow downloads
              </Label>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Let viewers save your video. Off by default to protect your content.
              </p>
            </div>
            <Switch checked={allowDownloads} onCheckedChange={setAllowDownloads} />
          </div>

          {uploading && (
            <div className="space-y-1.5">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                {progressLabel} {progress > 0 && progress < 100 ? `${progress}%` : ""}
              </p>
            </div>
          )}

          <Button onClick={handleUpload} disabled={uploading} className="w-full rounded-xl">
            {uploading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading...</>) : (<><Upload className="w-4 h-4 mr-2" />Upload Video</>)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
