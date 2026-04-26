import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Send, Megaphone, Users, MapPin, Loader2 } from "lucide-react";
import { format } from "date-fns";

type Audience = "all" | "role" | "location";

const BroadcastTab = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Audience>("all");
  const [targetRole, setTargetRole] = useState<"client" | "provider" | "job_seeker">("client");
  const [targetCity, setTargetCity] = useState("");
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => { loadHistory(); }, []);

  const loadHistory = async () => {
    const { data } = await supabase
      .from("broadcast_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    setHistory(data || []);
  };

  const send = async () => {
    if (!user) return;
    if (title.trim().length < 3 || body.trim().length < 5) {
      toast({ title: "Fill title and message", variant: "destructive" });
      return;
    }
    if (audience === "location" && !targetCity.trim()) {
      toast({ title: "Enter a city or county", variant: "destructive" });
      return;
    }

    setSending(true);
    const { error } = await supabase.from("broadcast_messages").insert({
      sender_id: user.id,
      title: title.trim().slice(0, 200),
      body: body.trim().slice(0, 2000),
      audience_type: audience,
      target_role: audience === "role" ? targetRole : null,
      target_city: audience === "location" ? targetCity.trim() : null,
    });
    setSending(false);

    if (error) {
      toast({ title: "Failed to send", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Broadcast sent" });
    setTitle(""); setBody(""); setTargetCity("");
    loadHistory();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">Compose broadcast</h2>
          </div>

          <Input
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
          />
          <Textarea
            placeholder="Message body..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            maxLength={2000}
          />

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Audience</label>
            <Select value={audience} onValueChange={(v) => setAudience(v as Audience)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                <SelectItem value="role">By role</SelectItem>
                <SelectItem value="location">By location</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {audience === "role" && (
            <Select value={targetRole} onValueChange={(v) => setTargetRole(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="client">Clients</SelectItem>
                <SelectItem value="provider">Service Providers</SelectItem>
                <SelectItem value="job_seeker">Job Seekers</SelectItem>
              </SelectContent>
            </Select>
          )}

          {audience === "location" && (
            <Input
              placeholder="City or county (e.g., Nairobi)"
              value={targetCity}
              onChange={(e) => setTargetCity(e.target.value)}
            />
          )}

          <Button onClick={send} disabled={sending} className="w-full">
            {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Send broadcast
          </Button>
          <p className="text-[10px] text-muted-foreground text-center">
            Limit: 5 broadcasts per hour to avoid spamming users.
          </p>
        </CardContent>
      </Card>

      <div>
        <h3 className="text-sm font-semibold mb-2 px-1">Recent broadcasts</h3>
        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No broadcasts yet</p>
        ) : (
          <div className="space-y-2">
            {history.map((b) => (
              <Card key={b.id}>
                <CardContent className="p-3">
                  <div className="flex justify-between items-start gap-2">
                    <p className="font-medium text-sm flex-1">{b.title}</p>
                    <Badge variant="secondary" className="text-[10px]">
                      {b.recipient_count} users
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{b.body}</p>
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                    {b.audience_type === "all" && <><Users className="w-3 h-3" /> All users</>}
                    {b.audience_type === "role" && <><Users className="w-3 h-3" /> {b.target_role}</>}
                    {b.audience_type === "location" && <><MapPin className="w-3 h-3" /> {b.target_city}</>}
                    <span>· {format(new Date(b.created_at), "MMM d, HH:mm")}</span>
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

export default BroadcastTab;
