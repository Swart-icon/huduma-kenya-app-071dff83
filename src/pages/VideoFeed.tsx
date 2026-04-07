import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCategories } from "@/hooks/useCategories";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Play,
  Pause,
  Upload,
  Heart,
  Eye,
  User,
  Video,
  Plus,
  Loader2,
  X,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";

const MAX_VIDEO_SIZE_MB = 50;
const ALLOWED_FORMATS = ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"];

type VideoItem = {
  id: string;
  user_id: string;
  title: string;
  category_id: string | null;
  video_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  view_count: number;
  status: string;
  created_at: string;
  profiles?: { full_name: string | null; avatar_url: string | null } | null;
  service_categories?: { name: string; icon: string | null } | null;
};

/* ────────── Upload Dialog ────────── */
const UploadVideoDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: categories } = useCategories();
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const resetForm = () => {
    setFile(null);
    setCaption("");
    setCategoryId("");
    setPreview(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    if (!ALLOWED_FORMATS.includes(f.type)) {
      toast.error("Unsupported format. Use MP4, WebM, or MOV.");
      return;
    }
    if (f.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
      toast.error(`Video must be under ${MAX_VIDEO_SIZE_MB}MB`);
      return;
    }

    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleUpload = async () => {
    if (!file || !user) return;

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "mp4";
      const path = `${user.id}/${Date.now()}.${ext}`;

      const { error: storageError } = await supabase.storage
        .from("user-videos")
        .upload(path, file, { contentType: file.type });

      if (storageError) throw storageError;

      const { data: urlData } = supabase.storage
        .from("user-videos")
        .getPublicUrl(path);

      const { error: dbError } = await supabase.from("videos").insert({
        user_id: user.id,
        title: caption.trim() || "Untitled",
        category_id: categoryId || null,
        video_url: urlData.publicUrl,
        status: "active",
      });

      if (dbError) throw dbError;

      toast.success("Video uploaded successfully! 🎬");
      queryClient.invalidateQueries({ queryKey: ["videos"] });
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
            <Video className="w-5 h-5 text-primary" />
            Upload Video
          </DialogTitle>
          <DialogDescription>
            Share your work, skills, or services with the community
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {!file ? (
            <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-primary/30 rounded-2xl cursor-pointer hover:border-primary/60 bg-primary/5 transition-colors">
              <Upload className="w-8 h-8 text-primary/60 mb-2" />
              <p className="text-sm font-medium text-primary">Tap to select video</p>
              <p className="text-xs text-muted-foreground mt-1">
                MP4, WebM, MOV • Max {MAX_VIDEO_SIZE_MB}MB
              </p>
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/x-m4v"
                className="hidden"
                onChange={handleFileSelect}
              />
            </label>
          ) : (
            <div className="relative rounded-2xl overflow-hidden bg-black">
              <video
                src={preview!}
                className="w-full max-h-48 object-contain"
                controls
              />
              <button
                onClick={() => {
                  setFile(null);
                  setPreview(null);
                }}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          )}

          <div>
            <Label>Caption</Label>
            <Textarea
              placeholder="Describe your video..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={300}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground text-right mt-1">
              {caption.length}/300
            </p>
          </div>

          <div>
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full rounded-xl"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload Video
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/* ────────── Video Card ────────── */
const VideoCard = ({ video }: { video: VideoItem }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setPlaying(!playing);
  };

  return (
    <Card className="rounded-2xl overflow-hidden border-0 shadow-md">
      {/* Header */}
      <div className="flex items-center gap-2.5 p-3 pb-0">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          {video.profiles?.avatar_url ? (
            <img
              src={video.profiles.avatar_url}
              className="w-8 h-8 rounded-full object-cover"
              alt=""
            />
          ) : (
            <User className="w-4 h-4 text-primary" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate">
            {video.profiles?.full_name || "User"}
          </p>
          {video.service_categories && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
              {video.service_categories.name}
            </Badge>
          )}
        </div>
      </div>

      {/* Video */}
      <div className="relative mt-2 bg-black cursor-pointer" onClick={togglePlay}>
        <video
          ref={videoRef}
          src={video.video_url}
          className="w-full aspect-[9/16] max-h-[400px] object-contain"
          muted={muted}
          loop
          playsInline
          preload="metadata"
          onEnded={() => setPlaying(false)}
        />
        {!playing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="w-14 h-14 rounded-full bg-white/30 backdrop-blur flex items-center justify-center">
              <Play className="w-7 h-7 text-white ml-1" />
            </div>
          </div>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMuted(!muted);
          }}
          className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center"
        >
          {muted ? (
            <VolumeX className="w-4 h-4 text-white" />
          ) : (
            <Volume2 className="w-4 h-4 text-white" />
          )}
        </button>
      </div>

      {/* Footer */}
      <div className="p-3 pt-2">
        {video.title && (
          <p className="text-sm mb-1.5">{video.title}</p>
        )}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" />
            {video.view_count}
          </span>
          <span>
            {new Date(video.created_at).toLocaleDateString("en-KE", {
              day: "numeric",
              month: "short",
            })}
          </span>
        </div>
      </div>
    </Card>
  );
};

/* ────────── Main Feed ────────── */
const VideoFeed = () => {
  const { user, role, roles } = useAuth();
  const navigate = useNavigate();
  const [uploadOpen, setUploadOpen] = useState(false);

  const canUpload =
    roles.includes("provider") || roles.includes("job_seeker");

  const { data: videos, isLoading } = useQuery({
    queryKey: ["videos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("videos")
        .select("*, service_categories(name, icon)")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      const items = (data || []) as any[];

      // Fetch profiles for all unique user_ids
      const userIds = [...new Set(items.map((v) => v.user_id))];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url")
          .in("user_id", userIds);
        const profileMap = new Map(
          (profiles || []).map((p) => [p.user_id, p])
        );
        return items.map((v) => ({
          ...v,
          profiles: profileMap.get(v.user_id) || null,
        })) as VideoItem[];
      }

      return items as VideoItem[];
    },
    staleTime: 1000 * 60 * 2,
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
              className="rounded-xl h-9 w-9"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-display font-bold text-lg flex items-center gap-2">
                <Video className="w-5 h-5 text-primary" />
                Videos
              </h1>
              <p className="text-[11px] text-muted-foreground">
                Discover services & skills
              </p>
            </div>
          </div>
          {canUpload && (
            <Button
              size="sm"
              onClick={() => setUploadOpen(true)}
              className="rounded-xl gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Upload
            </Button>
          )}
        </div>
      </div>

      <div className="px-4 max-w-lg mx-auto pt-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !videos?.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Video className="w-12 h-12 text-muted-foreground/40 mb-3" />
            <p className="font-bold text-foreground">No videos yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              {canUpload
                ? "Be the first to share your work!"
                : "Videos from providers will appear here"}
            </p>
            {canUpload && (
              <Button
                className="mt-4 rounded-xl"
                onClick={() => setUploadOpen(true)}
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload First Video
              </Button>
            )}
          </div>
        ) : (
          videos.map((v) => <VideoCard key={v.id} video={v} />)
        )}
      </div>

      {canUpload && (
        <UploadVideoDialog open={uploadOpen} onOpenChange={setUploadOpen} />
      )}
    </div>
  );
};

export default VideoFeed;
