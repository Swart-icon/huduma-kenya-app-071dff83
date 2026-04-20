import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Eye, Radio } from "lucide-react";

type LiveItem = {
  id: string;
  broadcaster_id: string;
  title: string;
  viewer_count: number;
  name?: string;
  avatar?: string;
};

export const LiveNowBar = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<LiveItem[]>([]);

  useEffect(() => {
    const fetchLive = async () => {
      const { data: streams } = await supabase
        .from("live_streams")
        .select("id, broadcaster_id, title, viewer_count")
        .eq("status", "live")
        .order("started_at", { ascending: false })
        .limit(20);
      if (!streams || !streams.length) { setItems([]); return; }
      const ids = streams.map((s) => s.broadcaster_id);
      const { data: profs } = await supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", ids);
      const profMap = new Map((profs || []).map((p) => [p.user_id, p]));
      setItems(streams.map((s) => ({
        ...s,
        name: profMap.get(s.broadcaster_id)?.full_name || "Live",
        avatar: profMap.get(s.broadcaster_id)?.avatar_url || undefined,
      })));
    };
    void fetchLive();

    const channel = supabase
      .channel("live-now-bar")
      .on("postgres_changes", { event: "*", schema: "public", table: "live_streams" }, () => { void fetchLive(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="px-4 py-3 border-b border-border/50 bg-background/95 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
        Live now
      </div>
      <div className="flex gap-3 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => navigate(`/live/${it.id}`)}
            className="flex flex-col items-center shrink-0 w-16"
          >
            <div className="relative">
              <Avatar className="w-14 h-14 border-2 border-destructive">
                <AvatarImage src={it.avatar} />
                <AvatarFallback>{it.name?.charAt(0) || "L"}</AvatarFallback>
              </Avatar>
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-destructive text-destructive-foreground">
                LIVE
              </span>
            </div>
            <p className="text-[11px] mt-2 text-foreground truncate w-full text-center">{it.name}</p>
            <p className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <Eye className="w-2.5 h-2.5" /> {it.viewer_count}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
};
