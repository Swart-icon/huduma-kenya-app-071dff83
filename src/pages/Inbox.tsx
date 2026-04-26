import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Inbox as InboxIcon, Megaphone } from "lucide-react";
import { format } from "date-fns";

interface InboxItem {
  id: string;
  read: boolean;
  created_at: string;
  broadcast: {
    id: string;
    title: string;
    body: string;
    created_at: string;
  } | null;
}

const Inbox = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/welcome");
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    load();

    const channel = supabase
      .channel("inbox-realtime")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "broadcast_recipients",
        filter: `user_id=eq.${user.id}`,
      }, () => load())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("broadcast_recipients")
      .select("id, read, created_at, broadcast:broadcast_messages(id, title, body, created_at)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    setItems((data as any) || []);
    setLoading(false);
  };

  const openMessage = async (item: InboxItem) => {
    setOpenId(openId === item.id ? null : item.id);
    if (!item.read) {
      await supabase
        .from("broadcast_recipients")
        .update({ read: true, read_at: new Date().toISOString() })
        .eq("id", item.id);
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, read: true } : i));
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const unread = items.filter((i) => !i.read).length;

  return (
    <div className="min-h-screen bg-background px-4 py-4">
      <div className="max-w-sm mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-xl">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-display font-bold text-xl text-foreground">Inbox</h1>
            <p className="text-xs text-muted-foreground">
              {unread > 0 ? `${unread} unread` : "All caught up"}
            </p>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-16">
            <InboxIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No messages yet</p>
            <p className="text-xs text-muted-foreground mt-1">Announcements from the team will appear here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              if (!item.broadcast) return null;
              const isOpen = openId === item.id;
              return (
                <Card
                  key={item.id}
                  className={`cursor-pointer transition-shadow ${!item.read ? "border-primary/40 bg-primary/5" : ""}`}
                  onClick={() => openMessage(item)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
                        <Megaphone className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm ${!item.read ? "font-semibold" : "font-medium"} text-foreground`}>
                            {item.broadcast.title}
                          </p>
                          {!item.read && <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                        </div>
                        <p className={`text-xs text-muted-foreground mt-1 ${isOpen ? "" : "line-clamp-2"}`}>
                          {item.broadcast.body}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-2">
                          {format(new Date(item.broadcast.created_at), "MMM d, HH:mm")}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Inbox;
