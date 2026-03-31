import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useUnreadCount = () => {
  const { user } = useAuth();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const fetchCounts = async () => {
    if (!user) return;

    // Get conversation IDs for this user
    const { data: convos } = await supabase
      .from("conversations")
      .select("id")
      .or(`participant_one.eq.${user.id},participant_two.eq.${user.id}`);

    if (convos && convos.length > 0) {
      const ids = convos.map((c) => c.id);
      const { count } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .in("conversation_id", ids)
        .eq("read", false)
        .neq("sender_id", user.id);
      setUnreadMessages(count || 0);
    }

    const { count: notifCount } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("read", false);
    setUnreadNotifications(notifCount || 0);
  };

  useEffect(() => {
    if (!user) return;
    fetchCounts();

    const channel = supabase
      .channel("unread-counts")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => fetchCounts())
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => fetchCounts())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  return { unreadMessages, unreadNotifications, total: unreadMessages + unreadNotifications };
};
