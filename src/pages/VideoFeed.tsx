import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useProfile } from "@/hooks/useProfile";
import { useLocation } from "@/contexts/LocationContext";
import { KENYAN_LOCATIONS } from "@/lib/kenyanLocations";
import { getDistanceKm } from "@/hooks/useGeolocation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Home, Plus, MessageCircle, User, Loader2, Video, Search, X, LogIn, MapPin, Radio, ArrowDown,
} from "lucide-react";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { UploadVideoDialog } from "@/components/video/UploadVideoDialog";
import { CommentsSheet } from "@/components/video/CommentsSheet";
import { VideoSlide } from "@/components/video/VideoSlide";
import type { VideoItem, FeedTab } from "@/components/video/types";
import { VideoSearchSuggestions, saveSearchTerm } from "@/components/video/VideoSearchSuggestions";
import { toast } from "sonner";

const PAGE_SIZE = 10;
const GUEST_VIDEO_LIMIT = 5;

const TABS: { key: FeedTab; label: string; icon?: React.ReactNode }[] = [
  { key: "all", label: "For You" },
  { key: "nearby", label: "Near You", icon: <MapPin className="w-3 h-3" /> },
  { key: "service", label: "Services" },
  { key: "jobseeker", label: "Jobseekers" },
  { key: "client", label: "Clients" },
];

/* ─── Auth Prompt Dialog ─── */
const AuthPromptDialog = ({ open, onOpenChange, targetRole }: { open: boolean; onOpenChange: (o: boolean) => void; targetRole?: string }) => {
  const navigate = useNavigate();
  const roleParam = targetRole ? `?role=${targetRole}` : "";
  const roleLabels: Record<string, string> = { provider: "Service Provider", job_seeker: "Job Seeker", client: "Client" };
  const roleLabel = targetRole ? roleLabels[targetRole] || "" : "";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto text-center">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-center gap-2 text-lg">
            <LogIn className="w-5 h-5 text-primary" /> Join Servio{roleLabel ? ` as ${roleLabel}` : ""}
          </DialogTitle>
          <DialogDescription>
            {roleLabel
              ? `Sign up or log in as a ${roleLabel} to access this section.`
              : "Sign up or log in to like, comment, call providers, and upload videos."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 mt-4">
          <Button className="w-full rounded-xl" onClick={() => { onOpenChange(false); navigate(`/register${roleParam}`); }}>
            Create Account
          </Button>
          <Button variant="outline" className="w-full rounded-xl" onClick={() => { onOpenChange(false); navigate(`/login${roleParam}`); }}>
            Sign In
          </Button>
          <button className="text-sm text-muted-foreground hover:text-foreground transition-colors" onClick={() => onOpenChange(false)}>
            Continue watching
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/* ─── Guest Overlay (shown after 3 videos) ─── */
const GuestLimitOverlay = () => {
  const navigate = useNavigate();
  return (
    <div className="h-screen w-full bg-black flex flex-col items-center justify-center text-center px-8" style={{ scrollSnapAlign: "start" }}>
      <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mb-6">
        <LogIn className="w-10 h-10 text-primary" />
      </div>
      <h2 className="text-white font-bold text-xl mb-2">Want to see more?</h2>
      <p className="text-white/60 text-sm mb-8 max-w-xs">
        Sign up to unlock unlimited videos, like, comment, and connect with service providers.
      </p>
      <Button className="w-full max-w-xs rounded-xl mb-3" onClick={() => navigate("/register")}>
        Create Free Account
      </Button>
      <Button variant="outline" className="w-full max-w-xs rounded-xl border-white/30 text-white bg-transparent hover:bg-white/10" onClick={() => navigate("/login")}>
        Sign In
      </Button>
    </div>
  );
};

const VideoFeed = () => {
  const { user, roles, role: activeRole, switchRole, addRole } = useAuth();
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const { location: userLocation, status: locationStatus, requestLocation } = useLocation();
  const [uploadOpen, setUploadOpen] = useState(false);

  // Auto-open the upload dialog after returning from the full-screen recorder
  useEffect(() => {
    if (sessionStorage.getItem("open_upload_dialog") === "1") {
      sessionStorage.removeItem("open_upload_dialog");
      setUploadOpen(true);
    }
  }, []);
  const [commentVideoId, setCommentVideoId] = useState<string | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<FeedTab>("all");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [authPromptOpen, setAuthPromptOpen] = useState(false);
  const [authPromptRole, setAuthPromptRole] = useState<string | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["videos-feed"] });
    toast.success("Feed updated");
  };

  const { pull, refreshing, progress } = usePullToRefresh(containerRef, {
    onRefresh: handleRefresh,
  });

  const isGuest = !user;
  const canUpload = !isGuest && (roles.includes("provider") || roles.includes("job_seeker"));

  // Find nearest city name from user's GPS coordinates
  const nearestCity = userLocation
    ? KENYAN_LOCATIONS.reduce((closest, loc) => {
        const dist = getDistanceKm(userLocation.latitude, userLocation.longitude, loc.lat, loc.lng);
        return dist < closest.dist ? { name: loc.name, county: loc.county, dist } : closest;
      }, { name: "", county: "", dist: Infinity })
    : null;

  const { data: videos, isLoading, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: ["videos-feed", activeTab, searchQuery, nearestCity?.name, nearestCity?.county],
    queryFn: async ({ pageParam = 0 }) => {
      const trimmed = searchQuery.trim();

      // If searching, find matching category IDs first
      let matchingCategoryIds: string[] = [];
      if (trimmed) {
        const { data: cats } = await supabase
          .from("service_categories")
          .select("id")
          .ilike("name", `%${trimmed}%`);
        matchingCategoryIds = (cats || []).map((c) => c.id);
      }

      // Region-ranked path: default "For You" tab without search → use ranked_videos RPC
      // so videos in the user's city/county float to the top.
      const useRanked = activeTab === "all" && !trimmed && !!nearestCity;

      let items: any[] = [];

      if (useRanked) {
        const { data, error } = await supabase.rpc("ranked_videos", {
          _user_city: nearestCity!.name || null,
          _user_county: nearestCity!.county || null,
          _category_id: null,
          _limit_count: PAGE_SIZE,
          _offset_count: pageParam,
        });
        if (error) throw error;
        // RPC doesn't include the joined service_categories — fetch separately
        const rows = (data || []) as any[];
        const catIds = [...new Set(rows.map((r) => r.category_id).filter(Boolean))];
        let catMap = new Map();
        if (catIds.length > 0) {
          const { data: cats } = await supabase
            .from("service_categories")
            .select("id, name, icon")
            .in("id", catIds);
          catMap = new Map((cats || []).map((c) => [c.id, c]));
        }
        // ranked_videos RPC doesn't return allow_downloads — fetch it
        const ids = rows.map((r) => r.id);
        let dlMap = new Map<string, boolean>();
        if (ids.length > 0) {
          const { data: extras } = await supabase
            .from("videos")
            .select("id, allow_downloads")
            .in("id", ids);
          dlMap = new Map((extras || []).map((e: any) => [e.id, !!e.allow_downloads]));
        }
        items = rows.map((r) => ({
          ...r,
          allow_downloads: dlMap.get(r.id) ?? false,
          service_categories: catMap.get(r.category_id) || null,
        }));
      } else {
        let query = supabase
          .from("videos")
          .select("*, service_categories(name, icon)")
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .range(pageParam, pageParam + PAGE_SIZE - 1);

        if (trimmed) {
          const filters = [`title.ilike.%${trimmed}%`, `city.ilike.%${trimmed}%`, `county.ilike.%${trimmed}%`];
          if (matchingCategoryIds.length > 0) {
            filters.push(`category_id.in.(${matchingCategoryIds.join(",")})`);
          }
          query = query.or(filters.join(","));
        }

        const { data, error } = await query;
        if (error) throw error;
        items = (data || []) as any[];
      }
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
          providerCity: v.city || prov?.city || null,
          providerCounty: v.county || prov?.county || null,
          _roles: rolesMap.get(v.user_id) || [],
        } as VideoItem & { _roles: string[] };
      });

      if (activeTab === "service") {
        mapped = mapped.filter((v) => v._roles.includes("provider"));
      } else if (activeTab === "jobseeker") {
        mapped = mapped.filter((v) => v._roles.includes("job_seeker"));
      } else if (activeTab === "client") {
        mapped = mapped.filter((v) => v._roles.includes("client"));
      } else if (activeTab === "nearby" && nearestCity) {
        mapped = mapped.filter((v) => {
          const vCity = (v.providerCity || "").toLowerCase();
          const vCounty = (v.providerCounty || "").toLowerCase();
          return vCity === nearestCity.name.toLowerCase() || vCounty === nearestCity.county.toLowerCase();
        });
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
  // Limit guest users to 3 videos
  const displayVideos = isGuest ? allVideos.slice(0, GUEST_VIDEO_LIMIT) : allVideos;

  // Persist & restore feed position (tab + active video index + scroll) so
  // returning to /videos via the browser back button keeps the user where they
  // were instead of jumping to the top.
  const FEED_STATE_KEY = "servio-video-feed-state";

  // Restore tab once on mount (before queries fire)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(FEED_STATE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { tab?: FeedTab };
      if (saved.tab && saved.tab !== activeTab) setActiveTab(saved.tab);
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset to top when tab/search changes — but skip the very first render so we
  // can restore scroll position from sessionStorage instead.
  const didInitialReset = useRef(false);
  useEffect(() => {
    if (!didInitialReset.current) {
      didInitialReset.current = true;
      return;
    }
    setActiveIndex(0);
    containerRef.current?.scrollTo({ top: 0 });
  }, [activeTab, searchQuery]);

  // Restore scroll position once the first batch of videos is rendered
  const didRestoreScroll = useRef(false);
  useEffect(() => {
    if (didRestoreScroll.current) return;
    if (!displayVideos.length || !containerRef.current) return;
    try {
      const raw = sessionStorage.getItem(FEED_STATE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { scrollTop?: number; activeIndex?: number; tab?: FeedTab };
        if (saved.tab === activeTab && typeof saved.scrollTop === "number") {
          containerRef.current.scrollTo({ top: saved.scrollTop });
          if (typeof saved.activeIndex === "number") setActiveIndex(saved.activeIndex);
        }
      }
    } catch { /* ignore */ }
    didRestoreScroll.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayVideos.length]);

  // Save state on scroll & before unmount/navigate-away
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const save = () => {
      try {
        sessionStorage.setItem(
          FEED_STATE_KEY,
          JSON.stringify({
            tab: activeTab,
            activeIndex,
            scrollTop: container.scrollTop,
          })
        );
      } catch { /* quota / private mode */ }
    };

    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(save);
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", save);
    return () => {
      container.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", save);
      save();
    };
  }, [activeTab, activeIndex]);

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
              if (!isGuest && idx >= allVideos.length - 3 && hasNextPage) fetchNextPage();
            }
          }
        });
      },
      { root: container, threshold: 0.6 }
    );
    container.querySelectorAll("[data-index]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [allVideos.length, hasNextPage, fetchNextPage, isGuest]);

  const openComments = (videoId: string) => {
    setCommentVideoId(videoId);
    setCommentsOpen(true);
  };

  const handleAuthRequired = (targetRole?: string) => {
    setAuthPromptRole(targetRole);
    setAuthPromptOpen(true);
  };

  return (
    <div className="h-screen w-screen bg-black relative overflow-hidden flex flex-col">
      {/* ─── Top Header ─── */}
      <div className="absolute top-0 left-0 right-0 z-40 video-top-chrome">
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
                <VideoSearchSuggestions
                  query={searchQuery}
                  visible={searchOpen}
                  onSelect={(val) => { saveSearchTerm(val); setSearchQuery(val); }}
                />
              </div>
              <button onClick={() => { setSearchOpen(false); setSearchQuery(""); }} className="text-white/70 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-white font-bold text-lg flex-1">Servio</h1>
              <button onClick={() => setSearchOpen(true)} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
                <Search className="w-4 h-4 text-white" />
              </button>
              {canUpload && (
                <button
                  onClick={() => toast.info("Live streaming coming soon!")}
                  className="ml-1 px-2.5 h-9 rounded-full bg-white/10 text-white/80 text-xs font-bold flex items-center gap-1.5"
                  aria-label="Live coming soon"
                >
                  <Radio className="w-3.5 h-3.5" />
                  Coming Soon
                </button>
              )}
              {isGuest ? (
                <button onClick={() => navigate("/login")} className="ml-1 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                  Sign In
                </button>
              ) : (
                <button onClick={() => navigate("/profile")} className="w-9 h-9 rounded-full overflow-hidden bg-white/10 flex items-center justify-center ml-1">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <User className="w-4 h-4 text-white" />
                  )}
                </button>
              )}
            </>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-3 pb-2 overflow-x-auto scrollbar-hide">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={async () => {
                if (tab.key === "service") {
                  if (isGuest) { handleAuthRequired("provider"); }
                  else if (activeRole === "provider") { navigate("/dashboard"); }
                  else { navigate("/categories"); }
                } else if (tab.key === "jobseeker") {
                  if (isGuest) { handleAuthRequired("job_seeker"); }
                  else { navigate("/job-seeker"); }
                } else if (tab.key === "client") {
                  if (isGuest) { handleAuthRequired("client"); }
                  else {
                    if (!roles.includes("client")) {
                      await addRole("client");
                    }
                    switchRole("client");
                    navigate("/dashboard");
                  }
                } else if (tab.key === "nearby") {
                  if (!userLocation) { requestLocation(); }
                  setActiveTab("nearby");
                } else {
                  setActiveTab(tab.key);
                }
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1 ${
                activeTab === tab.key
                  ? "bg-white text-black"
                  : "bg-white/10 text-white/70 hover:bg-white/20"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Live now bar disabled — feature coming soon */}

      {/* ─── Video Feed ─── */}
      {activeTab === "nearby" && !userLocation ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
          <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mb-6">
            <MapPin className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-white font-bold text-xl mb-2">Find Trusted Services Near You</h2>
          <p className="text-white/60 text-sm mb-6 max-w-xs">
            Enable your location to discover videos from service providers and professionals around you.
          </p>
          <Button className="rounded-xl px-6" onClick={requestLocation}>
            {locationStatus === "requesting" ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Getting Location...</>
            ) : (
              <><MapPin className="w-4 h-4 mr-2" /> Enable Location</>
            )}
          </Button>
          {locationStatus === "denied" && (
            <p className="text-red-400 text-xs mt-3">Location access was denied. Please enable it in your browser settings.</p>
          )}
        </div>
      ) : isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-white" />
        </div>
      ) : !allVideos.length ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
          <Video className="w-16 h-16 text-white/20 mb-4" />
          <p className="text-white font-bold text-lg">
            {activeTab === "nearby" ? "No videos near you yet" : "No videos found"}
          </p>
          <p className="text-white/50 text-sm mt-2">
            {activeTab === "nearby" && nearestCity
              ? `No videos from ${nearestCity.name}, ${nearestCity.county} area yet`
              : searchQuery ? "Try a different search" : "Be the first to share!"}
          </p>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="flex-1 overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
          style={{ scrollSnapType: "y mandatory", WebkitOverflowScrolling: "touch" }}
        >
          {displayVideos.map((v, i) => (
            <div key={v.id} data-index={i} className="h-screen w-full" style={{ scrollSnapAlign: "start" }}>
              <VideoSlide
                video={v}
                isActive={i === activeIndex}
                isMuted={isMuted}
                onToggleMute={() => setIsMuted((m) => !m)}
                onOpenComments={openComments}
                globalIndex={i - activeIndex}
                onAuthRequired={isGuest ? handleAuthRequired : undefined}
                activeRole={activeRole}
              />
            </div>
          ))}
          {/* Guest limit: show signup CTA after last preview video */}
          {isGuest && displayVideos.length > 0 && (
            <div data-index={displayVideos.length}>
              <GuestLimitOverlay />
            </div>
          )}
        </div>
      )}

      {/* ─── Bottom Navigation ─── */}
      <div className="absolute bottom-0 left-0 right-0 z-40 video-bottom-chrome backdrop-blur-md">
      <div className="flex items-center justify-around py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <button
            onClick={() => {
              if (isGuest) { handleAuthRequired(); }
              else { navigate("/dashboard"); }
            }}
            className="flex flex-col items-center gap-0.5 text-white/70 hover:text-white transition-colors"
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px]">Home</span>
          </button>

          <button
            onClick={() => { setActiveIndex(0); containerRef.current?.scrollTo({ top: 0, behavior: "smooth" }); }}
            className="flex flex-col items-center gap-0.5 text-white/70 hover:text-white transition-colors"
          >
            <Video className="w-5 h-5" />
            <span className="text-[10px]">Videos</span>
          </button>

          <button
            onClick={() => { if (isGuest) { handleAuthRequired(); } else if (canUpload) { setUploadOpen(true); } else { handleAuthRequired(); } }}
            className="flex flex-col items-center gap-0.5"
          >
            <div className="w-10 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Plus className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-[10px] text-white/70">Upload</span>
          </button>

          <button
            onClick={() => { if (isGuest) handleAuthRequired(); else navigate("/conversations"); }}
            className="flex flex-col items-center gap-0.5 text-white/70 hover:text-white transition-colors"
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-[10px]">Messages</span>
          </button>

          <button
            onClick={() => { if (isGuest) handleAuthRequired(); else navigate("/profile"); }}
            className="flex flex-col items-center gap-0.5 text-white/70 hover:text-white transition-colors"
          >
            <User className="w-5 h-5" />
            <span className="text-[10px]">Me</span>
          </button>
        </div>
      </div>

      <AuthPromptDialog open={authPromptOpen} onOpenChange={setAuthPromptOpen} targetRole={authPromptRole} />
      <CommentsSheet open={commentsOpen} onOpenChange={setCommentsOpen} videoId={commentVideoId} />
      {canUpload && <UploadVideoDialog open={uploadOpen} onOpenChange={setUploadOpen} />}
    </div>
  );
};

export default VideoFeed;
