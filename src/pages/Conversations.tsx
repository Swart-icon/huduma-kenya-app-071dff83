import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { format } from "date-fns";
import { ConversationSkeleton, ListSkeletons } from "@/components/Skeletons";

interface ConversationItem {
  id: string;
  other_user_id: string;
  other_user_name: string;
  last_message_at: string;
  unread_count: number;
}

const Conversations = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    const { data: convos } = await supabase
      .from("conversations")
      .select("*")
      .or(`participant_one.eq.${user.id},participant_two.eq.${user.id}`)
      .order("last_message_at", { ascending: false });

    if (!convos) { setLoading(false); return; }

    // Batch fetch all profiles and unread counts
    const otherIds = convos.map((c) =>
      c.participant_one === user.id ? c.participant_two : c.participant_one
    );
    const convoIds = convos.map((c) => c.id);

    const [profilesRes, unreadRes] = await Promise.all([
      otherIds.length > 0
        ? supabase.from("profiles").select("user_id, full_name").in("user_id", otherIds)
        : Promise.resolve({ data: [] }),
      convoIds.length > 0
        ? supabase
            .from("messages")
            .select("conversation_id")
            .in("conversation_id", convoIds)
            .eq("read", false)
            .neq("sender_id", user.id)
        : Promise.resolve({ data: [] }),
    ]);

    const profileMap = new Map(
      (profilesRes.data || []).map((p) => [p.user_id, p.full_name || "User"])
    );

    const unreadMap = new Map<string, number>();
    (unreadRes.data || []).forEach((m) => {
      unreadMap.set(m.conversation_id, (unreadMap.get(m.conversation_id) || 0) + 1);
    });

    const items: ConversationItem[] = convos.map((c) => {
      const otherId = c.participant_one === user.id ? c.participant_two : c.participant_one;
      return {
        id: c.id,
        other_user_id: otherId,
        other_user_name: profileMap.get(otherId) || "User",
        last_message_at: c.last_message_at || c.created_at,
        unread_count: unreadMap.get(c.id) || 0,
      };
    });

    setConversations(items);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/welcome");
    if (user) {
      setLoading(true);
      loadConversations();
    }
  }, [authLoading, user, navigate, loadConversations]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("conversations-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        loadConversations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadConversations]);

  return (
    <div className="min-h-screen bg-background px-4 py-4">
      <div className="max-w-sm mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="rounded-xl">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-display font-bold text-xl text-foreground">Messages</h1>
        </div>

        {(authLoading || loading) ? (
          <ListSkeletons Component={ConversationSkeleton} count={4} />
        ) : conversations.length === 0 ? (
          <div className="text-center py-16">
            <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No conversations yet</p>
            <p className="text-xs text-muted-foreground mt-1">Start a conversation from a service or booking</p>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((c) => (
              <Card
                key={c.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/chat/${c.id}`)}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-primary">
                      {c.other_user_name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground truncate">{c.other_user_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(c.last_message_at), "MMM d")}
                      </span>
                    </div>
                    {c.unread_count > 0 && (
                      <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold rounded-full bg-primary text-primary-foreground mt-1">
                        {c.unread_count}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Conversations;
