import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Heart, Send, Eye, Zap, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { BoostStatusDialog } from "./BoostStatusDialog";
import { ScrollArea } from "@/components/ui/scroll-area";

type Status = {
  id: string;
  image_url: string | null;
  text_content: string | null;
  created_at: string;
  view_count: number;
  isBoosted?: boolean;
  boostTier?: string | null;
};

type ProviderStory = {
  user_id: string;
  business_name: string;
  profile_image_url: string | null;
  isBoosted?: boolean;
  statuses: Status[];
};

interface Props {
  stories: ProviderStory[];
  initialIndex: number;
  onClose: () => void;
  currentUserId: string | null;
  onRefresh?: () => void;
}

type Viewer = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  viewed_at: string;
  type: "like" | "reply";
  reply_content?: string;
};

const STORY_DURATION_MS = 30000;
const TICK_INTERVAL_MS = 100;
const PROGRESS_INCREMENT = (TICK_INTERVAL_MS / STORY_DURATION_MS) * 100;
const isStoryVideoUrl = (url: string) => /\.(mp4|m4v|mov|webm|3gp|3gpp)(\?|#|$)/i.test(url);

export const StoryViewer = ({ stories, initialIndex, onClose, currentUserId, onRefresh }: Props) => {
  const { toast } = useToast();
  const [groupIdx, setGroupIdx] = useState(initialIndex);
  const [statusIdx, setStatusIdx] = useState(0);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [reply, setReply] = useState("");
  const [progress, setProgress] = useState(0);
  const [boostOpen, setBoostOpen] = useState(false);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [viewersLoading, setViewersLoading] = useState(false);
  const [replyFocused, setReplyFocused] = useState(false);
  const [liveViewCount, setLiveViewCount] = useState(0);

  const group = stories[groupIdx];
  const status = group?.statuses[statusIdx];

  const fetchLikeState = useCallback(async () => {
    if (!status || !currentUserId) return;
    const [myLike, counts] = await Promise.all([
      supabase.from("status_likes").select("id").eq("status_id", status.id).eq("user_id", currentUserId).maybeSingle(),
      supabase.from("status_likes").select("id", { count: "exact", head: true }).eq("status_id", status.id),
    ]);
    setLiked(!!myLike.data);
    setLikeCount(counts.count || 0);
  }, [status?.id, currentUserId]);

  // Fetch fresh view count from DB
  const fetchViewCount = useCallback(async () => {
    if (!status) return;
    const { data } = await supabase
      .from("provider_statuses")
      .select("view_count")
      .eq("id", status.id)
      .maybeSingle();
    if (data) setLiveViewCount(data.view_count);
  }, [status?.id]);

  useEffect(() => {
    fetchLikeState();
    fetchViewCount();
    setProgress(0);
  }, [fetchLikeState, fetchViewCount]);

  // Record view for non-own stories
  useEffect(() => {
    if (!status || !currentUserId || !group) return;
    if (currentUserId === group.user_id) return;
    supabase.rpc("increment_view_count", { status_id: status.id }).then(() => {});
  }, [status?.id, currentUserId, group?.user_id]);

  const shouldAdvanceRef = useRef(false);
  const isPaused = boostOpen || viewersOpen || replyFocused;

  // Auto-advance timer — pauses when any dialog is open or reply input is focused
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + PROGRESS_INCREMENT;
        if (next >= 100) {
          shouldAdvanceRef.current = true;
          return 100;
        }
        return next;
      });
    }, TICK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [groupIdx, statusIdx, stories.length, isPaused]);

  // Handle advance in a separate effect
  useEffect(() => {
    if (progress >= 100 && shouldAdvanceRef.current) {
      shouldAdvanceRef.current = false;
      goNext();
    }
  }, [progress]);

  const goNext = () => {
    if (!group) return;
    if (statusIdx < group.statuses.length - 1) {
      setStatusIdx((i) => i + 1);
    } else if (groupIdx < stories.length - 1) {
      setGroupIdx((i) => i + 1);
      setStatusIdx(0);
    } else {
      onClose();
    }
    setProgress(0);
  };

  const goPrev = () => {
    if (statusIdx > 0) {
      setStatusIdx((i) => i - 1);
    } else if (groupIdx > 0) {
      setGroupIdx((i) => i - 1);
      setStatusIdx(stories[groupIdx - 1].statuses.length - 1);
    }
    setProgress(0);
  };

  const toggleLike = async () => {
    if (!status || !currentUserId) return;
    if (liked) {
      await supabase.from("status_likes").delete().eq("status_id", status.id).eq("user_id", currentUserId);
    } else {
      await supabase.from("status_likes").insert({ status_id: status.id, user_id: currentUserId });
    }
    setLiked(!liked);
    setLikeCount((c) => (liked ? c - 1 : c + 1));
  };

  const sendReply = async () => {
    if (!reply.trim() || !status || !currentUserId || !group) return;
    const replyText = reply.trim();

    // Save as status reply
    const { error } = await supabase.from("status_replies").insert({
      status_id: status.id,
      user_id: currentUserId,
      content: replyText,
    });
    if (error) {
      toast({ title: "Failed to send reply", variant: "destructive" });
      return;
    }

    toast({ title: "Reply sent!" });
    setReply("");
    setReplyFocused(false);
  };

  const openViewers = async () => {
    if (!status) return;
    setViewersOpen(true);
    setViewersLoading(true);

    // Fetch fresh view count
    fetchViewCount();

    // Fetch likes and replies with content
    const [likesRes, repliesRes] = await Promise.all([
      supabase.from("status_likes").select("user_id, created_at").eq("status_id", status.id),
      supabase.from("status_replies").select("user_id, created_at, content").eq("status_id", status.id).order("created_at", { ascending: false }),
    ]);

    const viewerList: Viewer[] = [];
    const seenUsers = new Set<string>();

    // Add replies first (more engagement)
    (repliesRes.data || []).forEach((r) => {
      viewerList.push({
        user_id: r.user_id,
        full_name: null,
        avatar_url: null,
        viewed_at: r.created_at,
        type: "reply",
        reply_content: r.content,
      });
      seenUsers.add(r.user_id);
    });

    // Add likes (skip if user already has a reply)
    (likesRes.data || []).forEach((l) => {
      if (!seenUsers.has(l.user_id)) {
        viewerList.push({
          user_id: l.user_id,
          full_name: null,
          avatar_url: null,
          viewed_at: l.created_at,
          type: "like",
        });
        seenUsers.add(l.user_id);
      }
    });

    // Fetch profiles
    const userIds = [...seenUsers];
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", userIds);

      viewerList.forEach((v) => {
        const prof = (profiles || []).find((p) => p.user_id === v.user_id);
        v.full_name = prof?.full_name || "User";
        v.avatar_url = prof?.avatar_url || null;
      });
    }

    setViewers(viewerList);
    setViewersLoading(false);
  };

  if (!group || !status) return null;

  const isOwn = currentUserId === group.user_id;
  const displayViewCount = liveViewCount || status.view_count;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* Progress bars */}
      <div className="flex gap-1 px-3 pt-3 pb-1">
        {group.statuses.map((_, i) => (
          <div key={i} className="flex-1 h-0.5 rounded-full bg-white/30 overflow-hidden">
            <div
              className="h-full bg-white transition-all duration-100"
              style={{
                width: i < statusIdx ? "100%" : i === statusIdx ? `${progress}%` : "0%",
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full overflow-hidden bg-muted">
            {group.profile_image_url ? (
              <img src={group.profile_image_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white/60">
                {group.business_name.charAt(0)}
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-white text-sm font-bold">{group.business_name}</p>
              {status.isBoosted && (
                <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[9px] px-1.5 py-0 h-4">
                  ⚡ Sponsored
                </Badge>
              )}
            </div>
            <p className="text-white/50 text-[10px]">
              {formatDistanceToNow(new Date(status.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isOwn && !status.isBoosted && (
            <button
              onClick={() => setBoostOpen(true)}
              className="flex items-center gap-1 bg-yellow-500/20 text-yellow-400 rounded-full px-3 py-1.5 text-xs font-bold"
            >
              <Zap className="w-3.5 h-3.5" /> Boost
            </button>
          )}
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center">
            <X className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>

      {/* Story content */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {/* Tap areas */}
        <button className="absolute left-0 top-0 w-1/3 h-full z-10" onClick={goPrev} />
        <button className="absolute right-0 top-0 w-1/3 h-full z-10" onClick={goNext} />

        {status.image_url ? (
          isStoryVideoUrl(status.image_url) ? (
            <video src={status.image_url} className="w-full h-full object-contain" controls playsInline autoPlay muted loop />
          ) : (
            <img src={status.image_url} alt="" className="w-full h-full object-contain" />
          )
        ) : (
          <div className="px-8 text-center">
            <p className="text-white text-xl font-bold leading-relaxed">{status.text_content}</p>
          </div>
        )}

        {/* Text overlay on image */}
        {status.image_url && status.text_content && (
          <div className="absolute bottom-24 left-0 right-0 px-6">
            <p className="text-white text-lg font-semibold text-center drop-shadow-lg">{status.text_content}</p>
          </div>
        )}

        {/* View count */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          {status.isBoosted && (
            <span className="bg-yellow-500/80 text-white text-[10px] font-bold rounded-full px-2 py-0.5">
              ⚡ {status.boostTier === "high" ? "High Boost" : "Boosted"}
            </span>
          )}
          <button
            onClick={isOwn ? openViewers : undefined}
            className={`flex items-center gap-1 bg-black/40 rounded-full px-2.5 py-1 ${isOwn ? "cursor-pointer active:bg-black/60" : "cursor-default"}`}
          >
            <Eye className="w-3.5 h-3.5 text-white/70" />
            <span className="text-[11px] text-white/70">{displayViewCount}</span>
          </button>
        </div>

        {/* Paused indicator */}
        {replyFocused && (
          <div className="absolute top-3 left-3 bg-black/40 rounded-full px-2.5 py-1">
            <span className="text-[10px] text-white/70">⏸ Paused</span>
          </div>
        )}
      </div>

      {/* Bottom interaction bar */}
      {currentUserId && !isOwn && (
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="flex-1 relative">
            <Input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  sendReply();
                }
              }}
              onFocus={() => setReplyFocused(true)}
              onBlur={() => {
                if (!reply.trim()) setReplyFocused(false);
              }}
              placeholder="Reply to story..."
              className="h-10 rounded-full bg-white/10 border-white/20 text-white placeholder:text-white/40 pr-10"
            />
            {reply.trim() && (
              <button onClick={sendReply} className="absolute right-2 top-1/2 -translate-y-1/2">
                <Send className="w-4 h-4 text-primary" />
              </button>
            )}
          </div>
          <button onClick={toggleLike} className="shrink-0 flex items-center gap-1">
            <Heart className={`w-6 h-6 ${liked ? "text-red-500 fill-red-500" : "text-white"}`} />
            {likeCount > 0 && <span className="text-white/70 text-xs">{likeCount}</span>}
          </button>
        </div>
      )}

      {/* Own story bottom bar */}
      {currentUserId && isOwn && (
        <div className="px-4 py-3 flex items-center justify-center">
          <button
            onClick={openViewers}
            className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-2 active:bg-white/20"
          >
            <Eye className="w-4 h-4 text-white/70" />
            <span className="text-white/70 text-sm">{displayViewCount} views</span>
          </button>
        </div>
      )}

      {/* Viewers/Engagement dialog */}
      {viewersOpen && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setViewersOpen(false)} />
          <div className="relative w-full max-w-sm bg-card rounded-t-2xl p-5 pb-8 max-h-[60vh] flex flex-col animate-in slide-in-from-bottom">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-foreground">Story Engagement</h3>
              <button onClick={() => setViewersOpen(false)}>
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="text-center mb-4 pb-3 border-b">
              <p className="text-2xl font-bold text-foreground">{displayViewCount}</p>
              <p className="text-xs text-muted-foreground">Total views</p>
            </div>
            {viewersLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : viewers.length === 0 ? (
              <div className="text-center py-6">
                <Eye className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No interactions yet</p>
                <p className="text-xs text-muted-foreground mt-1">Users who like or reply will appear here</p>
              </div>
            ) : (
              <ScrollArea className="flex-1">
                <div className="space-y-3">
                  {viewers.map((v, idx) => (
                    <div key={`${v.user_id}-${idx}`} className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full overflow-hidden bg-muted shrink-0 mt-0.5">
                        {v.avatar_url ? (
                          <img src={v.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs font-bold text-muted-foreground">
                            {(v.full_name || "U").charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{v.full_name}</p>
                        {v.type === "reply" && v.reply_content && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            💬 {v.reply_content}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {formatDistanceToNow(new Date(v.viewed_at), { addSuffix: true })}
                        </p>
                      </div>
                      {v.type === "like" ? (
                        <Heart className="w-4 h-4 text-red-400 fill-red-400 shrink-0 mt-1" />
                      ) : (
                        <MessageCircle className="w-4 h-4 text-primary shrink-0 mt-1" />
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      )}

      {/* Boost dialog */}
      {boostOpen && status && (
        <div className="fixed inset-0 z-[110]">
          <BoostStatusDialog
            open={boostOpen}
            onClose={() => setBoostOpen(false)}
            statusId={status.id}
            onBoosted={() => {
              setBoostOpen(false);
              onRefresh?.();
            }}
          />
        </div>
      )}
    </div>
  );
};
