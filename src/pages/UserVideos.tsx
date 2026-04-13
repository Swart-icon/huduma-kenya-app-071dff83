import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Play, Eye, Grid3X3 } from "lucide-react";
import { VideoSlide } from "@/components/video/VideoSlide";
import type { VideoItem } from "@/components/video/types";

const UserVideos = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [profile, setProfile] = useState<{ full_name: string | null; avatar_url: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    const fetchData = async () => {
      setLoading(true);
      const [videosRes, profileRes] = await Promise.all([
        supabase
          .from("videos")
          .select("*, profile:profiles!videos_user_id_fkey(full_name, avatar_url), category:service_categories(name, icon)")
          .eq("user_id", userId)
          .eq("status", "active")
          .order("created_at", { ascending: false }),
        supabase.from("profiles").select("full_name, avatar_url").eq("user_id", userId).maybeSingle(),
      ]);
      // Handle the join error gracefully — fallback to manual profile join
      let vids = (videosRes.data || []) as any[];
      if (videosRes.error) {
        // Fallback: fetch without foreign key join
        const { data } = await supabase
          .from("videos")
          .select("*")
          .eq("user_id", userId)
          .eq("status", "active")
          .order("created_at", { ascending: false });
        vids = (data || []).map((v: any) => ({ ...v, profile: profileRes.data, category: null }));
      }
      setVideos(vids as VideoItem[]);
      setProfile(profileRes.data);
      setLoading(false);
    };
    fetchData();
  }, [userId]);

  if (activeVideoId) {
    const video = videos.find((v) => v.id === activeVideoId);
    if (video) {
      return (
        <div className="fixed inset-0 z-50 bg-black">
          <button
            onClick={() => setActiveVideoId(null)}
            className="absolute top-4 left-4 z-50 w-9 h-9 rounded-full bg-black/50 flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <VideoSlide
            video={video}
            isActive
            isMuted={false}
            onToggleMute={() => {}}
            onOpenComments={() => {}}
            globalIndex={0}
          />
        </div>
      );
    }
  }

  const isOwnProfile = user?.id === userId;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <button onClick={() => navigate(-1)} className="text-muted-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-foreground truncate">
            {isOwnProfile ? "My Videos" : `${profile?.full_name || "User"}'s Videos`}
          </h1>
        </div>
      </div>

      {/* Profile summary */}
      <div className="flex flex-col items-center py-6 border-b border-border">
        <div className="w-16 h-16 rounded-full bg-muted overflow-hidden mb-3">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} className="w-full h-full object-cover" alt="" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-2xl font-bold">
              {(profile?.full_name || "U").charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <p className="font-bold text-foreground">{profile?.full_name || "User"}</p>
        <div className="flex items-center gap-1 mt-1 text-muted-foreground text-sm">
          <Grid3X3 className="w-4 h-4" />
          <span>{videos.length} video{videos.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Video grid */}
      <div className="max-w-lg mx-auto p-1">
        {loading ? (
          <div className="grid grid-cols-3 gap-0.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[9/16] bg-muted animate-pulse rounded-sm" />
            ))}
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Play className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No videos yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-0.5">
            {videos.map((v) => (
              <button
                key={v.id}
                onClick={() => setActiveVideoId(v.id)}
                className="relative aspect-[9/16] bg-black rounded-sm overflow-hidden group"
              >
                {v.thumbnail_url ? (
                  <img src={v.thumbnail_url} className="w-full h-full object-cover" alt="" />
                ) : (
                  <video src={v.video_url} className="w-full h-full object-cover" preload="metadata" muted />
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <Play className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="absolute bottom-1 left-1 flex items-center gap-0.5 text-white text-[10px] bg-black/50 rounded px-1">
                  <Eye className="w-3 h-3" />
                  {v.view_count}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserVideos;
