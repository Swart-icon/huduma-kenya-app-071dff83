import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useInfiniteQuery } from "@tanstack/react-query";
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
  Home, Plus, MessageCircle, User, Loader2, Video, Search, X, LogIn, MapPin,
} from "lucide-react";
import { UploadVideoDialog } from "@/components/video/UploadVideoDialog";
import { CommentsSheet } from "@/components/video/CommentsSheet";
import { VideoSlide } from "@/components/video/VideoSlide";
import type { VideoItem, FeedTab } from "@/components/video/types";
import { VideoSearchSuggestions, saveSearchTerm } from "@/components/video/VideoSearchSuggestions";

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
            <LogIn className="w-5 h-5 text-primary" /> Join Huduma{roleLabel ? ` as ${roleLabel}` : ""}
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
  const { user, roles, role: activeRole } = useAuth();
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const { location: userLocation, status: locationStatus, requestLocation } = useLocation();
  const [uploadOpen, setUploadOpen] = useState(false);
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

  useEffect(() => {
    setActiveIndex(0);
    containerRef.current?.scrollTo({ top: 0 });
  }, [activeTab, searchQuery]);

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
      <div className="absolute top-0 left-0 right-0 z-40">
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
              <h1 className="text-white font-bold text-lg flex-1">Huduma</h1>
              <button onClick={() => setSearchOpen(true)} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
                <Search className="w-4 h-4 text-white" />
              </button>
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
              onClick={() => {
                if (tab.key === "service") {
                  if (isGuest) { handleAuthRequired("provider"); }
                  else if (activeRole === "provider") { navigate("/dashboard"); }
                  else { navigate("/categories"); }
                } else if (tab.key === "jobseeker") {
                  if (isGuest) { handleAuthRequired("job_seeker"); }
                  else { navigate("/job-seeker"); }
                } else if (tab.key === "client") {
                  if (isGuest) { handleAuthRequired("client"); }
                  else if (activeRole === "client") { navigate("/dashboard"); }
                  else { navigate("/dashboard"); }
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
      <div className="absolute bottom-0 left-0 right-0 z-40 bg-black/80 backdrop-blur-md border-t border-white/10">
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
