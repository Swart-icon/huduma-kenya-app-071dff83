import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Heart, Send, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

type Status = {
  id: string;
  image_url: string | null;
  text_content: string | null;
  created_at: string;
  view_count: number;
};

type ProviderStory = {
  user_id: string;
  business_name: string;
  profile_image_url: string | null;
  statuses: Status[];
};

interface Props {
  stories: ProviderStory[];
  initialIndex: number;
  onClose: () => void;
  currentUserId: string | null;
}

export const StoryViewer = ({ stories, initialIndex, onClose, currentUserId }: Props) => {
  const { toast } = useToast();
  const [groupIdx, setGroupIdx] = useState(initialIndex);
  const [statusIdx, setStatusIdx] = useState(0);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [reply, setReply] = useState("");
  const [progress, setProgress] = useState(0);

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

  useEffect(() => {
    fetchLikeState();
    setProgress(0);
  }, [fetchLikeState]);

  // Auto-advance timer
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          goNext();
          return 0;
        }
        return prev + 2;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [groupIdx, statusIdx, stories.length]);

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
    if (!reply.trim() || !status || !currentUserId) return;
    const { error } = await supabase.from("status_replies").insert({
      status_id: status.id,
      user_id: currentUserId,
      content: reply.trim(),
    });
    if (error) {
      toast({ title: "Failed to send reply", variant: "destructive" });
    } else {
      toast({ title: "Reply sent!" });
      setReply("");
    }
  };

  if (!group || !status) return null;

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
            <p className="text-white text-sm font-bold">{group.business_name}</p>
            <p className="text-white/50 text-[10px]">
              {formatDistanceToNow(new Date(status.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center">
          <X className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Story content */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {/* Tap areas */}
        <button className="absolute left-0 top-0 w-1/3 h-full z-10" onClick={goPrev} />
        <button className="absolute right-0 top-0 w-1/3 h-full z-10" onClick={goNext} />

        {status.image_url ? (
          <img
            src={status.image_url}
            alt=""
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="px-8 text-center">
            <p className="text-white text-xl font-bold leading-relaxed">
              {status.text_content}
            </p>
          </div>
        )}

        {/* Text overlay on image */}
        {status.image_url && status.text_content && (
          <div className="absolute bottom-24 left-0 right-0 px-6">
            <p className="text-white text-lg font-semibold text-center drop-shadow-lg">
              {status.text_content}
            </p>
          </div>
        )}

        {/* View count */}
        <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/40 rounded-full px-2.5 py-1">
          <Eye className="w-3.5 h-3.5 text-white/70" />
          <span className="text-[11px] text-white/70">{status.view_count}</span>
        </div>
      </div>

      {/* Bottom interaction bar */}
      {currentUserId && currentUserId !== group.user_id && (
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="flex-1 relative">
            <Input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendReply()}
              placeholder="Reply to story..."
              className="h-10 rounded-full bg-white/10 border-white/20 text-white placeholder:text-white/40 pr-10"
            />
            {reply.trim() && (
              <button
                onClick={sendReply}
                className="absolute right-2 top-1/2 -translate-y-1/2"
              >
                <Send className="w-4 h-4 text-primary" />
              </button>
            )}
          </div>
          <button onClick={toggleLike} className="shrink-0 flex items-center gap-1">
            <Heart
              className={`w-6 h-6 ${liked ? "text-red-500 fill-red-500" : "text-white"}`}
            />
            {likeCount > 0 && (
              <span className="text-white/70 text-xs">{likeCount}</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
