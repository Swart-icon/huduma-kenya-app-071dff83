import { useState, useRef, useEffect, useCallback, memo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { useCategories } from "@/hooks/useCategories";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  ArrowLeft, Play, Upload, Heart, MessageCircle, Eye, User, Video, Plus,
  Loader2, X, Volume2, VolumeX, Send, Music2,
} from "lucide-react";
import { toast } from "sonner";

const MAX_VIDEO_SIZE_MB = 1024;
const ALLOWED_FORMATS = ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"];
const PAGE_SIZE = 10;

type VideoItem = {
  id: string;
  user_id: string;
  title: string;
  category_id: string | null;
  video_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  view_count: number;
  like_count: number;
  comment_count: number;
  status: string;
  created_at: string;
  profile?: { full_name: string | null; avatar_url: string | null } | null;
  category?: { name: string; icon: string | null } | null;
};

type CommentItem = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: { full_name: string | null; avatar_url: string | null } | null;
};

/* ────────────────── Upload Dialog ────────────────── */
const UploadVideoDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) => {
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
              <p className="text-xs text-muted-foreground mt-1">MP4, WebM, MOV • Max {MAX_VIDEO_SIZE_MB}MB</p>
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

/* ────────────────── Comments Sheet ────────────────── */
const CommentsSheet = ({
  open, onOpenChange, videoId,
}: { open: boolean; onOpenChange: (o: boolean) => void; videoId: string | null }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");

  const { data: comments, isLoading } = useQuery({
    queryKey: ["video-comments", videoId],
    queryFn: async () => {
      if (!videoId) return [];
      const { data, error } = await supabase
        .from("video_comments")
        .select("*")
        .eq("video_id", videoId)
        .order("created_at", { ascending: true })
        .limit(100);
      if (error) throw error;
      const items = data || [];
      const userIds = [...new Set(items.map((c) => c.user_id))];
      if (userIds.length === 0) return [];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", userIds);
      const pMap = new Map((profiles || []).map((p) => [p.user_id, p]));
      return items.map((c) => ({ ...c, profile: pMap.get(c.user_id) || null })) as CommentItem[];
    },
    enabled: !!videoId && open,
  });

  const sendComment = useMutation({
    mutationFn: async () => {
      if (!user || !videoId || !text.trim()) return;
      const { error } = await supabase.from("video_comments").insert({
        video_id: videoId, user_id: user.id, content: text.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: ["video-comments", videoId] });
      queryClient.invalidateQueries({ queryKey: ["videos-feed"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-3xl px-0">
        <SheetHeader className="px-4 pb-2 border-b border-border">
          <SheetTitle className="text-center text-sm">
            Comments {comments?.length ? `(${comments.length})` : ""}
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ maxHeight: "calc(70vh - 120px)" }}>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : !comments?.length ? (
            <p className="text-center text-sm text-muted-foreground py-8">No comments yet. Be the first!</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex gap-2.5">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  {c.profile?.avatar_url ? (
                    <img src={c.profile.avatar_url} className="w-8 h-8 rounded-full object-cover" alt="" />
                  ) : (
                    <User className="w-4 h-4 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold">{c.profile?.full_name || "User"}</p>
                  <p className="text-sm text-foreground mt-0.5">{c.content}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(c.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
        {user && (
          <div className="absolute bottom-0 left-0 right-0 px-4 py-3 bg-background border-t border-border flex gap-2">
            <Input
              placeholder="Add a comment..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !sendComment.isPending && sendComment.mutate()}
              className="flex-1 rounded-full"
            />
            <Button
              size="icon"
              className="rounded-full shrink-0"
              disabled={!text.trim() || sendComment.isPending}
              onClick={() => sendComment.mutate()}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

/* ────────────────── Single Video Slide ────────────────── */
const VideoSlide = memo(({
  video, isActive, isMuted, onToggleMute, onOpenComments, globalIndex,
}: {
  video: VideoItem; isActive: boolean; isMuted: boolean;
  onToggleMute: () => void; onOpenComments: (id: string) => void; globalIndex: number;
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  const [liked, setLiked] = useState(false);
  const [localLikeCount, setLocalLikeCount] = useState(video.like_count);

  // Check if user liked this video
  useEffect(() => {
    if (!user) return;
    supabase.from("video_likes").select("id").eq("video_id", video.id).eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setLiked(!!data));
  }, [user, video.id]);

  // Auto-play/pause based on isActive
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (isActive) {
      setPaused(false);
      el.currentTime = 0;
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [isActive]);

  // Sync mute
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = isMuted;
  }, [isMuted]);

  const togglePause = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) { el.play().catch(() => {}); setPaused(false); }
    else { el.pause(); setPaused(true); }
  };

  const toggleLike = async () => {
    if (!user) { toast.error("Sign in to like"); return; }
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLocalLikeCount((c) => c + (wasLiked ? -1 : 1));
    try {
      if (wasLiked) {
        await supabase.from("video_likes").delete().eq("video_id", video.id).eq("user_id", user.id);
      } else {
        await supabase.from("video_likes").insert({ video_id: video.id, user_id: user.id });
      }
    } catch {
      setLiked(wasLiked);
      setLocalLikeCount((c) => c + (wasLiked ? 1 : -1));
    }
  };

  return (
    <div className="relative w-full h-full snap-start snap-always bg-black flex items-center justify-center">
      <video
        ref={videoRef}
        src={video.video_url}
        className="w-full h-full object-contain"
        loop
        playsInline
        muted={isMuted}
        preload={Math.abs(globalIndex) <= 1 ? "auto" : "none"}
        onClick={togglePause}
      />

      {/* Pause overlay */}
      {paused && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center">
            <Play className="w-8 h-8 text-white ml-1" />
          </div>
        </div>
      )}

      {/* Right action bar */}
      <div className="absolute right-3 bottom-32 flex flex-col items-center gap-5">
        {/* Profile pic */}
        <div className="relative mb-2">
          <div className="w-11 h-11 rounded-full border-2 border-white overflow-hidden bg-primary/20">
            {video.profile?.avatar_url ? (
              <img src={video.profile.avatar_url} className="w-full h-full object-cover" alt="" />
            ) : (
              <div className="w-full h-full flex items-center justify-center"><User className="w-5 h-5 text-white" /></div>
            )}
          </div>
        </div>

        {/* Like */}
        <button onClick={toggleLike} className="flex flex-col items-center">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${liked ? "bg-red-500/20" : "bg-white/10"}`}>
            <Heart className={`w-6 h-6 ${liked ? "text-red-500 fill-red-500" : "text-white"}`} />
          </div>
          <span className="text-white text-[11px] font-bold mt-1">{localLikeCount}</span>
        </button>

        {/* Comment */}
        <button onClick={() => onOpenComments(video.id)} className="flex flex-col items-center">
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          <span className="text-white text-[11px] font-bold mt-1">{video.comment_count}</span>
        </button>

        {/* Views */}
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
            <Eye className="w-5 h-5 text-white" />
          </div>
          <span className="text-white text-[11px] font-bold mt-1">{video.view_count}</span>
        </div>

        {/* Mute */}
        <button onClick={onToggleMute} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
          {isMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
        </button>
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-6 left-4 right-20">
        <p className="text-white font-bold text-sm drop-shadow-lg">
          @{video.profile?.full_name || "User"}
        </p>
        {video.title && (
          <p className="text-white/90 text-sm mt-1 line-clamp-2 drop-shadow">{video.title}</p>
        )}
        {video.category && (
          <div className="mt-2 flex items-center gap-1.5">
            <Badge className="bg-white/20 text-white border-0 text-[10px] backdrop-blur-sm">
              {video.category.icon && <span className="mr-1">{video.category.icon}</span>}
              {video.category.name}
            </Badge>
          </div>
        )}
        <div className="flex items-center gap-1.5 mt-2">
          <Music2 className="w-3 h-3 text-white/60" />
          <p className="text-white/60 text-[10px]">Original sound</p>
        </div>
      </div>
    </div>
  );
});
VideoSlide.displayName = "VideoSlide";

/* ────────────────── Main Feed ────────────────── */
const VideoFeed = () => {
  const { user, role, roles } = useAuth();
  const navigate = useNavigate();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [commentVideoId, setCommentVideoId] = useState<string | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const canUpload = roles.includes("provider") || roles.includes("job_seeker");

  const { data: videos, isLoading, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: ["videos-feed"],
    queryFn: async ({ pageParam = 0 }) => {
      const { data, error } = await supabase
        .from("videos")
        .select("*, service_categories(name, icon)")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);
      if (error) throw error;
      const items = (data || []) as any[];
      const userIds = [...new Set(items.map((v: any) => v.user_id))];
      let profileMap = new Map();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", userIds);
        profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));
      }
      return items.map((v: any) => ({
        ...v,
        profile: profileMap.get(v.user_id) || null,
        category: v.service_categories || null,
      })) as VideoItem[];
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.flat().length;
    },
    initialPageParam: 0,
    staleTime: 1000 * 60 * 2,
  });

  const allVideos = videos?.pages.flat() || [];

  // Snap scroll observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.getAttribute("data-index"));
            if (!isNaN(idx)) {
              setActiveIndex(idx);
              // Preload next page when near the end
              if (idx >= allVideos.length - 3 && hasNextPage) {
                fetchNextPage();
              }
            }
          }
        });
      },
      { root: container, threshold: 0.6 }
    );

    container.querySelectorAll("[data-index]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [allVideos.length, hasNextPage, fetchNextPage]);

  const openComments = (videoId: string) => {
    setCommentVideoId(videoId);
    setCommentsOpen(true);
  };

  if (isLoading) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  if (!allVideos.length) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center text-center px-8">
        <Video className="w-16 h-16 text-white/30 mb-4" />
        <p className="text-white font-bold text-lg">No videos yet</p>
        <p className="text-white/60 text-sm mt-2">
          {canUpload ? "Be the first to share your work!" : "Videos from providers will appear here"}
        </p>
        {canUpload && (
          <Button className="mt-6 rounded-full" onClick={() => setUploadOpen(true)}>
            <Upload className="w-4 h-4 mr-2" /> Upload First Video
          </Button>
        )}
        <Button variant="ghost" className="mt-3 text-white/60" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
        </Button>
        {canUpload && <UploadVideoDialog open={uploadOpen} onOpenChange={setUploadOpen} />}
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black relative overflow-hidden">
      {/* Top bar - floating */}
      <div className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-4 pt-3 pb-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="rounded-full h-9 w-9 bg-black/30 backdrop-blur text-white hover:bg-black/50">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-white font-bold text-base drop-shadow">Videos</h1>
        {canUpload ? (
          <Button variant="ghost" size="icon" onClick={() => setUploadOpen(true)} className="rounded-full h-9 w-9 bg-black/30 backdrop-blur text-white hover:bg-black/50">
            <Plus className="w-5 h-5" />
          </Button>
        ) : (
          <div className="w-9" />
        )}
      </div>

      {/* Snap scroll container */}
      <div
        ref={containerRef}
        className="h-full w-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
        style={{ scrollSnapType: "y mandatory", WebkitOverflowScrolling: "touch" }}
      >
        {allVideos.map((v, i) => (
          <div key={v.id} data-index={i} className="h-screen w-full" style={{ scrollSnapAlign: "start" }}>
            <VideoSlide
              video={v}
              isActive={i === activeIndex}
              isMuted={isMuted}
              onToggleMute={() => setIsMuted((m) => !m)}
              onOpenComments={openComments}
              globalIndex={i - activeIndex}
            />
          </div>
        ))}
      </div>

      <CommentsSheet open={commentsOpen} onOpenChange={setCommentsOpen} videoId={commentVideoId} />
      {canUpload && <UploadVideoDialog open={uploadOpen} onOpenChange={setUploadOpen} />}
    </div>
  );
};

export default VideoFeed;
