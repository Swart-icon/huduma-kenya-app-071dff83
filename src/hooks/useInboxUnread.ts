import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useInboxUnread = () => {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const load = async () => {
    if (!user) { setCount(0); return; }
    const { count: c } = await supabase
      .from("broadcast_recipients")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("read", false);
    setCount(c || 0);
  };

  useEffect(() => {
    if (!user) return;
    load();
    const channel = supabase
      .channel("inbox-unread")
      .on("postgres_changes", { event: "*", schema: "public", table: "broadcast_recipients", filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  return count;
};
