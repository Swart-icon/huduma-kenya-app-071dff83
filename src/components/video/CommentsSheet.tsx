import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { User, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

type CommentItem = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: { full_name: string | null; avatar_url: string | null } | null;
};

export const CommentsSheet = ({
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
