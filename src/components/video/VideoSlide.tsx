import { useState, useRef, useEffect, memo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { AppRole } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import {
  Play, Heart, MessageCircle, User, Phone, MapPin, Briefcase, Wrench, Flag,
  MoreVertical, Download, Share2, Trash2, TrendingUp,
} from "lucide-react";
import { BoostVideoDialog } from "./BoostVideoDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import type { VideoItem } from "./types";

export const VideoSlide = memo(({
  video, isActive, isMuted, onToggleMute, onOpenComments, globalIndex, onAuthRequired, activeRole,
}: {
  video: VideoItem; isActive: boolean; isMuted: boolean;
  onToggleMute: () => void; onOpenComments: (id: string) => void; globalIndex: number;
  onAuthRequired?: (targetRole?: string) => void;
  activeRole?: AppRole | null;
}) => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  const [liked, setLiked] = useState(false);
  const [localLikeCount, setLocalLikeCount] = useState(video.like_count);
  const [showHeart, setShowHeart] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [boostOpen, setBoostOpen] = useState(false);
  const impressionCountedRef = useRef(false);

  // Tap detection
  const lastTapRef = useRef<number>(0);
  const singleTapTimerRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);

  const isOwner = !!user && user.id === video.user_id;
  const canDelete = isOwner || isAdmin;

  const requireAuth = () => {
    if (!user && onAuthRequired) { onAuthRequired(); return true; }
    return false;
  };

  useEffect(() => {
    if (!user) return;
    supabase.from("video_likes").select("id").eq("video_id", video.id).eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setLiked(!!data));
  }, [user, video.id]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (isActive) {
      setPaused(false);
      el.currentTime = 0;
      el.play().catch(() => {});
      try { (window as any).__servio_trackAction?.(); } catch {}
      // Boost impression tracking — fire after 2.5s of active playback
      impressionCountedRef.current = false;
      if (video.activeBoostId && user && user.id !== video.user_id) {
        const boostId = video.activeBoostId;
        const t = window.setTimeout(() => {
          if (!impressionCountedRef.current && videoRef.current && !videoRef.current.paused) {
            impressionCountedRef.current = true;
            supabase.rpc("record_boost_impression", { _boost_id: boostId }).then(() => {});
          }
        }, 2500);
        return () => window.clearTimeout(t);
      }
    } else {
      el.pause();
    }
  }, [isActive, video.activeBoostId, video.user_id, user]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = isMuted;
  }, [isMuted]);

  const togglePause = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) { el.play().catch(() => {}); setPaused(false); }
    else { el.pause(); setPaused(true); }
  };

  const toggleLike = async (forceLike = false) => {
    if (requireAuth()) return;
    if (!user) { toast.error("Sign in to like"); return; }
    const wasLiked = liked;
    if (forceLike && wasLiked) return; // double-tap is "like only", never unlike
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

  const triggerHeartAnim = () => {
    setShowHeart(true);
    window.setTimeout(() => setShowHeart(false), 700);
  };

  const handleVideoTap = () => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // Double tap → like
      if (singleTapTimerRef.current) {
        window.clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      lastTapRef.current = 0;
      triggerHeartAnim();
      toggleLike(true);
      return;
    }
    lastTapRef.current = now;
    // Defer single-tap (pause toggle) so a follow-up tap can be detected
    if (singleTapTimerRef.current) window.clearTimeout(singleTapTimerRef.current);
    singleTapTimerRef.current = window.setTimeout(() => {
      togglePause();
      singleTapTimerRef.current = null;
    }, 280);
  };

  const handlePressStart = () => {
    longPressTriggeredRef.current = false;
    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      // cancel pending single-tap pause
      if (singleTapTimerRef.current) {
        window.clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      setMenuOpen(true);
    }, 550);
  };

  const handlePressEnd = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleDownload = async () => {
    if (!isOwner && !video.allow_downloads) {
      toast.error("The owner has disabled downloads for this video");
      return;
    }
    setMenuOpen(false);
    setDownloading(true);
    try {
      const res = await fetch(video.video_url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeTitle = (video.title || "video").replace(/[^a-z0-9]+/gi, "_").slice(0, 40);
      a.download = `${safeTitle || "video"}.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Download started");
    } catch {
      toast.error("Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    setMenuOpen(false);
    const shareUrl = `${window.location.origin}/videos?v=${video.id}`;
    const shareData = {
      title: video.title || "Watch this video",
      text: video.title || "Check out this video on HudumaHub.ke",
      url: shareUrl,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Link copied to clipboard");
      }
    } catch {
      // user cancelled — silent
    }
  };

  const handleDelete = async () => {
    if (!canDelete) return;
    setConfirmDelete(false);
    setMenuOpen(false);
    const { error } = await supabase.from("videos").delete().eq("id", video.id);
    if (error) { toast.error("Could not delete video"); return; }
    setDeleted(true);
    toast.success("Video deleted");
  };

  const handleComment = () => {
    if (requireAuth()) return;
    onOpenComments(video.id);
  };

  const handleCall = () => {
    if (requireAuth()) return;
    if (video.providerPhone) {
      window.location.href = `tel:${video.providerPhone}`;
    } else {
      toast.info("No phone number available");
    }
  };

  const handleProfile = () => {
    navigate(`/user/${video.user_id}/videos`);
  };

  const handleServices = () => {
    if (requireAuth()) return;
    if (activeRole === "provider") {
      navigate("/my-services");
    } else {
      if (video.category_id) {
        navigate(`/categories/${video.category_id}`);
      } else {
        navigate("/categories");
      }
    }
  };

  const handleJobs = () => {
    if (requireAuth()) return;
    if (activeRole === "client") {
      navigate("/my-jobs");
    } else {
      if (video.category_id) {
        navigate(`/jobs?category=${video.category_id}`);
      } else {
        navigate("/jobs");
      }
    }
  };

  const location = video.providerCity
    ? `${video.providerCity}${video.providerCounty ? `, ${video.providerCounty}` : ""}`
    : null;

  if (deleted) return null;

  return (
    <div className="relative w-full h-full snap-start snap-always bg-black flex items-center justify-center">
      <video
        ref={videoRef}
        src={video.video_url}
        poster={video.thumbnail_url ?? undefined}
        className="w-full h-full object-contain select-none"
        loop
        playsInline
        muted={isMuted}
        preload={Math.abs(globalIndex) <= 1 ? "auto" : "none"}
        controlsList="nodownload"
        disablePictureInPicture
        onContextMenu={(e) => e.preventDefault()}
        onClick={handleVideoTap}
        onPointerDown={handlePressStart}
        onPointerUp={handlePressEnd}
        onPointerLeave={handlePressEnd}
        onPointerCancel={handlePressEnd}
      />

      {paused && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center">
            <Play className="w-8 h-8 text-white ml-1" />
          </div>
        </div>
      )}

      {/* Double-tap heart animation */}
      {showHeart && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Heart className="w-28 h-28 text-red-500 fill-red-500 drop-shadow-2xl animate-[ping_0.7s_ease-out]" />
        </div>
      )}

      {/* Top-right more menu */}
      <button
        onClick={() => setMenuOpen(true)}
        className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center z-10"
        aria-label="More options"
      >
        <MoreVertical className="w-5 h-5 text-white" />
      </button>

      {/* Right action bar */}
      <div className="absolute right-3 bottom-[140px] flex flex-col items-center gap-2.5">
        <button onClick={handleProfile} className="relative mb-1">
          <div className="w-10 h-10 rounded-full border-2 border-white overflow-hidden bg-white/10">
            {video.profile?.avatar_url ? (
              <img src={video.profile.avatar_url} className="w-full h-full object-cover" alt="" />
            ) : (
              <div className="w-full h-full flex items-center justify-center"><User className="w-5 h-5 text-white" /></div>
            )}
          </div>
        </button>

        <button onClick={() => toggleLike(false)} className="flex flex-col items-center">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center ${liked ? "bg-red-500/20" : "bg-white/10"}`}>
            <Heart className={`w-5 h-5 ${liked ? "text-red-500 fill-red-500" : "text-white"}`} />
          </div>
          <span className="text-white text-[10px] font-bold mt-0.5">{localLikeCount}</span>
        </button>

        <button onClick={handleComment} className="flex flex-col items-center">
          <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <span className="text-white text-[10px] font-bold mt-0.5">{video.comment_count}</span>
        </button>

        <button onClick={handleServices} className="flex flex-col items-center">
          <div className="w-9 h-9 rounded-full bg-blue-500/20 flex items-center justify-center">
            <Wrench className="w-4 h-4 text-blue-400" />
          </div>
          <span className="text-white text-[10px] mt-0.5">Services</span>
        </button>

        <button onClick={handleJobs} className="flex flex-col items-center">
          <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center">
            <Briefcase className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-white text-[10px] mt-0.5">Jobs</span>
        </button>

        <button onClick={handleCall} className="flex flex-col items-center">
          <div className="w-9 h-9 rounded-full bg-green-500/20 flex items-center justify-center">
            <Phone className="w-4 h-4 text-green-400" />
          </div>
          <span className="text-white text-[10px] mt-0.5">Call</span>
        </button>

        <button
          onClick={() => {
            if (requireAuth()) return;
            navigate(`/report/${video.user_id}`);
          }}
          className="flex flex-col items-center"
        >
          <div className="w-9 h-9 rounded-full bg-red-500/20 flex items-center justify-center">
            <Flag className="w-4 h-4 text-red-400" />
          </div>
          <span className="text-white text-[10px] mt-0.5">Report</span>
        </button>
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-[72px] left-3 right-16">
        <button onClick={() => navigate(`/user/${video.user_id}/videos`)} className="text-left">
          <p className="text-white font-bold text-sm drop-shadow-lg">
            @{video.profile?.full_name || "User"}
          </p>
        </button>
        {video.title && (
          <p className="text-white/90 text-sm mt-1 line-clamp-2 drop-shadow">{video.title}</p>
        )}
        {location && (
          <div className="flex items-center gap-1 mt-1.5">
            <MapPin className="w-3 h-3 text-white/60" />
            <p className="text-white/60 text-[11px]">{location}</p>
          </div>
        )}
        {video.category && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <Badge className="bg-white/20 text-white border-0 text-[10px] backdrop-blur-sm">
              {video.category.icon && <span className="mr-1">{video.category.icon}</span>}
              {video.category.name}
            </Badge>
          </div>
        )}
      </div>

      {/* Long-press / more options sheet */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Video options</SheetTitle>
          </SheetHeader>
          <div className="mt-3 space-y-1">
            {(isOwner || video.allow_downloads) ? (
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted text-left disabled:opacity-50"
              >
                <Download className="w-5 h-5 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{downloading ? "Downloading..." : "Download video"}</p>
                  <p className="text-[11px] text-muted-foreground">Save to your device</p>
                </div>
              </button>
            ) : (
              <div className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/40 opacity-70">
                <Download className="w-5 h-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Download disabled</p>
                  <p className="text-[11px] text-muted-foreground">The owner has not enabled downloads</p>
                </div>
              </div>
            )}

            <button
              onClick={handleShare}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted text-left"
            >
              <Share2 className="w-5 h-5 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium">Share</p>
                <p className="text-[11px] text-muted-foreground">Send link to others</p>
              </div>
            </button>

            {canDelete && (
              <button
                onClick={() => { setMenuOpen(false); setConfirmDelete(true); }}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-destructive/10 text-left"
              >
                <Trash2 className="w-5 h-5 text-destructive" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-destructive">Delete video</p>
                  <p className="text-[11px] text-muted-foreground">
                    {isOwner ? "Permanently remove this video" : "Admin: remove this video"}
                  </p>
                </div>
              </button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this video?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the video, its likes, and comments. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});
VideoSlide.displayName = "VideoSlide";
