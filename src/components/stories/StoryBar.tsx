import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Plus } from "lucide-react";
import { StoryViewer } from "./StoryViewer";
import { CreateStoryDialog } from "./CreateStoryDialog";

type ProviderStory = {
  user_id: string;
  business_name: string;
  profile_image_url: string | null;
  isBoosted: boolean;
  statuses: {
    id: string;
    image_url: string | null;
    text_content: string | null;
    created_at: string;
    view_count: number;
    isBoosted: boolean;
    boostTier: string | null;
  }[];
};

export const StoryBar = () => {
  const { user, role } = useAuth();
  const [grouped, setGrouped] = useState<ProviderStory[]>([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchStories = async () => {
    const { data: statuses } = await supabase
      .from("provider_statuses")
      .select("*")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (!statuses || statuses.length === 0) {
      setGrouped([]);
      setLoading(false);
      return;
    }

    // Fetch active boosts
    const statusIds = statuses.map((s) => s.id);
    const { data: boosts } = await supabase
      .from("status_boosts")
      .select("status_id, boost_tier")
      .in("status_id", statusIds)
      .eq("is_active", true)
      .eq("payment_status", "completed")
      .gt("boost_end", new Date().toISOString());

    const boostMap = new Map(
      (boosts || []).map((b) => [b.status_id, b.boost_tier])
    );

    const userIds = [...new Set(statuses.map((s) => s.user_id))];
    const { data: profiles } = await supabase
      .from("provider_profiles")
      .select("user_id, business_name, profile_image_url")
      .in("user_id", userIds);

    const profileMap = new Map(
      (profiles || []).map((p) => [p.user_id, p])
    );

    const groups: ProviderStory[] = userIds.map((uid) => {
      const prof = profileMap.get(uid);
      const userStatuses = statuses.filter((s) => s.user_id === uid);
      const hasBoosted = userStatuses.some((s) => boostMap.has(s.id));
      return {
        user_id: uid,
        business_name: prof?.business_name || "Provider",
        profile_image_url: prof?.profile_image_url || null,
        isBoosted: hasBoosted,
        statuses: userStatuses.map((s) => ({
          id: s.id,
          image_url: s.image_url,
          text_content: s.text_content,
          created_at: s.created_at,
          view_count: s.view_count,
          isBoosted: boostMap.has(s.id),
          boostTier: boostMap.get(s.id) || null,
        })),
      };
    });

    // Sort: current user first, then boosted (high > moderate), then rest
    groups.sort((a, b) => {
      if (user && a.user_id === user.id) return -1;
      if (user && b.user_id === user.id) return 1;
      if (a.isBoosted && !b.isBoosted) return -1;
      if (!a.isBoosted && b.isBoosted) return 1;
      // High boost before moderate
      const aHigh = a.statuses.some((s) => s.boostTier === "high");
      const bHigh = b.statuses.some((s) => s.boostTier === "high");
      if (aHigh && !bHigh) return -1;
      if (!aHigh && bHigh) return 1;
      return 0;
    });

    setGrouped(groups);
    setLoading(false);
  };

  useEffect(() => {
    fetchStories();
  }, [user]);

  const openViewer = (idx: number) => {
    setViewerIndex(idx);
    setViewerOpen(true);
  };

  const hasMyStory = user && grouped.some((g) => g.user_id === user.id);
  const isProvider = role === "provider";

  if (loading && grouped.length === 0) return null;
  if (!isProvider && grouped.length === 0) return null;

  return (
    <>
      <div className="mb-5">
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {/* Add Story button for providers */}
          {isProvider && (
            <button
              onClick={() => setCreateOpen(true)}
              className="flex flex-col items-center gap-1.5 shrink-0"
            >
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-primary/50 flex items-center justify-center bg-primary/5">
                <Plus className="w-6 h-6 text-primary" />
              </div>
              <span className="text-[10px] font-semibold text-muted-foreground w-16 text-center truncate">
                {hasMyStory ? "Add more" : "Your story"}
              </span>
            </button>
          )}

          {/* Story circles */}
          {grouped.map((group, idx) => (
            <button
              key={group.user_id}
              onClick={() => openViewer(idx)}
              className="flex flex-col items-center gap-1.5 shrink-0 relative"
            >
              <div className={`w-16 h-16 rounded-full p-[3px] ${
                group.isBoosted
                  ? "bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500"
                  : "bg-gradient-to-br from-primary to-accent"
              }`}>
                <div className="w-full h-full rounded-full overflow-hidden bg-background border-2 border-background">
                  {group.profile_image_url ? (
                    <img
                      src={group.profile_image_url}
                      alt={group.business_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                      {group.business_name.charAt(0)}
                    </div>
                  )}
                </div>
              </div>
              {group.isBoosted && (
                <span className="absolute -top-1 -right-1 text-[9px] bg-yellow-500 text-white font-bold rounded-full px-1.5 py-0.5">
                  ⚡
                </span>
              )}
              <span className="text-[10px] font-semibold text-foreground w-16 text-center truncate">
                {user?.id === group.user_id ? "You" : group.business_name.split(" ")[0]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {viewerOpen && grouped.length > 0 && (
        <StoryViewer
          stories={grouped}
          initialIndex={viewerIndex}
          onClose={() => setViewerOpen(false)}
          currentUserId={user?.id || null}
          onRefresh={fetchStories}
        />
      )}

      {createOpen && (
        <CreateStoryDialog
          open={createOpen}
          onClose={() => {
            setCreateOpen(false);
            fetchStories();
          }}
        />
      )}
    </>
  );
};
