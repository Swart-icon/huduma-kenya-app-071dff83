import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { format } from "date-fns";

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

  useEffect(() => {
    if (!authLoading && !user) navigate("/welcome");
    if (user) {
      setLoading(true);
      loadConversations();
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    loadConversations();

    const channel = supabase
      .channel("conversations-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        loadConversations();
      })
      .subscribe();

    const handleFocus = () => loadConversations();
    window.addEventListener("focus", handleFocus);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("focus", handleFocus);
    };
  }, [user]);

  const loadConversations = async () => {
    if (!user) return;
    const { data: convos } = await supabase
      .from("conversations")
      .select("*")
      .or(`participant_one.eq.${user.id},participant_two.eq.${user.id}`)
      .order("last_message_at", { ascending: false });

    if (!convos) { setLoading(false); return; }

    const items: ConversationItem[] = [];
    for (const c of convos) {
      const otherId = c.participant_one === user.id ? c.participant_two : c.participant_one;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", otherId)
        .maybeSingle();

      const { count } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("conversation_id", c.id)
        .eq("read", false)
        .neq("sender_id", user.id);

      items.push({
        id: c.id,
        other_user_id: otherId,
        other_user_name: profile?.full_name || "User",
        last_message_at: c.last_message_at || c.created_at,
        unread_count: count || 0,
      });
    }

    setConversations(items);
    setLoading(false);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-4">
      <div className="max-w-sm mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="rounded-xl">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-display font-bold text-xl text-foreground">Messages</h1>
        </div>

        {conversations.length === 0 ? (
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
