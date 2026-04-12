import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useProfile } from "@/hooks/useProfile";
import { Input } from "@/components/ui/input";
import {
  Home, Plus, MessageCircle, User, Loader2, Video, Search, X,
} from "lucide-react";
import { UploadVideoDialog } from "@/components/video/UploadVideoDialog";
import { CommentsSheet } from "@/components/video/CommentsSheet";
import { VideoSlide } from "@/components/video/VideoSlide";
import type { VideoItem, FeedTab } from "@/components/video/types";

const PAGE_SIZE = 10;

const TABS: { key: FeedTab; label: string }[] = [
  { key: "all", label: "For You" },
  { key: "service", label: "Services" },
  { key: "jobseeker", label: "Jobseekers" },
  { key: "client", label: "Clients" },
];

const VideoFeed = () => {
  const { user, roles } = useAuth();
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [commentVideoId, setCommentVideoId] = useState<string | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<FeedTab>("all");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const canUpload = roles.includes("provider") || roles.includes("job_seeker");

  const { data: videos, isLoading, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: ["videos-feed", activeTab, searchQuery],
    queryFn: async ({ pageParam = 0 }) => {
      let query = supabase
        .from("videos")
        .select("*, service_categories(name, icon)")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);

      if (searchQuery.trim()) {
        query = query.ilike("title", `%${searchQuery.trim()}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      const items = (data || []) as any[];
      const userIds = [...new Set(items.map((v: any) => v.user_id))];
      let profileMap = new Map();
      let providerMap = new Map();
      let rolesMap = new Map<string, string[]>();

      if (userIds.length > 0) {
        const [profilesRes, providersRes, rolesRes] = await Promise.all([
          supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", userIds),
          supabase.from("provider_profiles").select("user_id, contact_phone, city, county").in("user_id", userIds),
          supabase.from("user_roles").select("user_id, role").in("user_id", userIds),
        ]);
        profileMap = new Map((profilesRes.data || []).map((p) => [p.user_id, p]));
        providerMap = new Map((providersRes.data || []).map((p) => [p.user_id, p]));
        (rolesRes.data || []).forEach((r) => {
          const existing = rolesMap.get(r.user_id) || [];
          existing.push(r.role);
          rolesMap.set(r.user_id, existing);
        });
      }

      let mapped = items.map((v: any) => {
        const prov = providerMap.get(v.user_id);
        return {
          ...v,
          profile: profileMap.get(v.user_id) || null,
          category: v.service_categories || null,
          providerPhone: prov?.contact_phone || null,
          providerCity: prov?.city || null,
          providerCounty: prov?.county || null,
          _roles: rolesMap.get(v.user_id) || [],
        } as VideoItem & { _roles: string[] };
      });

      // Filter by tab
      if (activeTab === "service") {
        mapped = mapped.filter((v) => v._roles.includes("provider"));
      } else if (activeTab === "jobseeker") {
        mapped = mapped.filter((v) => v._roles.includes("job_seeker"));
      } else if (activeTab === "client") {
        mapped = mapped.filter((v) => v._roles.includes("client"));
      }

      return mapped as VideoItem[];
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.flat().length;
    },
    initialPageParam: 0,
    staleTime: 1000 * 60 * 2,
  });

  const allVideos = videos?.pages.flat() || [];

  // Reset active index when tab/search changes
  useEffect(() => {
    setActiveIndex(0);
    containerRef.current?.scrollTo({ top: 0 });
  }, [activeTab, searchQuery]);

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
              if (idx >= allVideos.length - 3 && hasNextPage) fetchNextPage();
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

  return (
    <div className="h-screen w-screen bg-black relative overflow-hidden flex flex-col">
      {/* ─── Top Header ─── */}
      <div className="absolute top-0 left-0 right-0 z-40">
        {/* Search bar row */}
        <div className="flex items-center gap-2 px-3 pt-3 pb-1">
          {searchOpen ? (
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                <Input
                  autoFocus
                  placeholder="Search videos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-white/10 border-0 text-white placeholder:text-white/40 rounded-full h-9 text-sm"
                />
              </div>
              <button onClick={() => { setSearchOpen(false); setSearchQuery(""); }} className="text-white/70 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-white font-bold text-lg flex-1">Huduma</h1>
              <button onClick={() => setSearchOpen(true)} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
                <Search className="w-4 h-4 text-white" />
              </button>
              <button onClick={() => navigate("/profile")} className="w-9 h-9 rounded-full overflow-hidden bg-white/10 flex items-center justify-center ml-1">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} className="w-full h-full object-cover" alt="" />
                ) : (
                  <User className="w-4 h-4 text-white" />
                )}
              </button>
            </>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-3 pb-2 overflow-x-auto scrollbar-hide">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === tab.key
                  ? "bg-white text-black"
                  : "bg-white/10 text-white/70 hover:bg-white/20"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Video Feed ─── */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-white" />
        </div>
      ) : !allVideos.length ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
          <Video className="w-16 h-16 text-white/20 mb-4" />
          <p className="text-white font-bold text-lg">No videos found</p>
          <p className="text-white/50 text-sm mt-2">
            {searchQuery ? "Try a different search" : "Be the first to share!"}
          </p>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="flex-1 overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
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
      )}

      {/* ─── Bottom Navigation ─── */}
      <div className="absolute bottom-0 left-0 right-0 z-40 bg-black/80 backdrop-blur-md border-t border-white/10">
        <div className="flex items-center justify-around py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <button
            onClick={() => { setActiveIndex(0); containerRef.current?.scrollTo({ top: 0, behavior: "smooth" }); }}
            className="flex flex-col items-center gap-0.5 text-white/70 hover:text-white transition-colors"
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px]">Home</span>
          </button>

          {canUpload && (
            <button
              onClick={() => setUploadOpen(true)}
              className="flex flex-col items-center gap-0.5"
            >
              <div className="w-10 h-7 rounded-lg bg-primary flex items-center justify-center">
                <Plus className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-[10px] text-white/70">Upload</span>
            </button>
          )}

          <button
            onClick={() => navigate("/conversations")}
            className="flex flex-col items-center gap-0.5 text-white/70 hover:text-white transition-colors"
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-[10px]">Messages</span>
          </button>

          <button
            onClick={() => navigate("/profile")}
            className="flex flex-col items-center gap-0.5 text-white/70 hover:text-white transition-colors"
          >
            <User className="w-5 h-5" />
            <span className="text-[10px]">Me</span>
          </button>
        </div>
      </div>

      <CommentsSheet open={commentsOpen} onOpenChange={setCommentsOpen} videoId={commentVideoId} />
      {canUpload && <UploadVideoDialog open={uploadOpen} onOpenChange={setUploadOpen} />}
    </div>
  );
};

export default VideoFeed;
