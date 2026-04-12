import { useState, useRef, useEffect, memo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import {
  Play, Heart, MessageCircle, Eye, User, Phone, MapPin,
} from "lucide-react";
import { toast } from "sonner";
import type { VideoItem } from "./types";

export const VideoSlide = memo(({
  video, isActive, isMuted, onToggleMute, onOpenComments, globalIndex, onAuthRequired,
}: {
  video: VideoItem; isActive: boolean; isMuted: boolean;
  onToggleMute: () => void; onOpenComments: (id: string) => void; globalIndex: number;
  onAuthRequired?: () => void;
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  const [liked, setLiked] = useState(false);
  const [localLikeCount, setLocalLikeCount] = useState(video.like_count);

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
    } else {
      el.pause();
    }
  }, [isActive]);

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
    if (requireAuth()) return;
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
    if (requireAuth()) return;
    navigate(`/provider/${video.user_id}`);
  };

  const location = video.providerCity
    ? `${video.providerCity}${video.providerCounty ? `, ${video.providerCounty}` : ""}`
    : null;

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

      {paused && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center">
            <Play className="w-8 h-8 text-white ml-1" />
          </div>
        </div>
      )}

      {/* Right action bar */}
      <div className="absolute right-3 bottom-[140px] flex flex-col items-center gap-3">
        <button onClick={handleProfile} className="relative mb-1">
          <div className="w-10 h-10 rounded-full border-2 border-white overflow-hidden bg-white/10">
            {video.profile?.avatar_url ? (
              <img src={video.profile.avatar_url} className="w-full h-full object-cover" alt="" />
            ) : (
              <div className="w-full h-full flex items-center justify-center"><User className="w-5 h-5 text-white" /></div>
            )}
          </div>
        </button>

        <button onClick={toggleLike} className="flex flex-col items-center">
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

        <div className="flex flex-col items-center">
          <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
            <Eye className="w-5 h-5 text-white" />
          </div>
          <span className="text-white text-[10px] font-bold mt-0.5">{video.view_count}</span>
        </div>

        <button onClick={handleCall} className="flex flex-col items-center">
          <div className="w-9 h-9 rounded-full bg-green-500/20 flex items-center justify-center">
            <Phone className="w-4 h-4 text-green-400" />
          </div>
          <span className="text-white text-[10px] mt-0.5">Call</span>
        </button>
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-[72px] left-3 right-16">
        <p className="text-white font-bold text-sm drop-shadow-lg">
          @{video.profile?.full_name || "User"}
        </p>
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
    </div>
  );
});
VideoSlide.displayName = "VideoSlide";
