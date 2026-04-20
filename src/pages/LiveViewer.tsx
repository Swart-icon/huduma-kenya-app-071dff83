import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Eye, Heart, Send, Flag, Loader2, X, Radio,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  createPeerConnection, sendSignal, subscribeToSignals, type SignalRow,
} from "@/lib/liveStreaming";

type ChatMsg = { id: string; user_id: string; content: string; created_at: string; name?: string };

const REPORT_REASONS = [
  "Inappropriate content",
  "Harassment or hate",
  "Spam or scam",
  "Violence",
  "Other",
];

const LiveViewer = () => {
  const { streamId } = useParams<{ streamId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [stream, setStream] = useState<any>(null);
  const [broadcaster, setBroadcaster] = useState<{ id: string; name: string; avatar?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewers, setViewers] = useState(0);
  const [likes, setLikes] = useState(0);
  const [hasLiked, setHasLiked] = useState(false);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [reportDesc, setReportDesc] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);
  const [connecting, setConnecting] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) { navigate("/welcome"); return; }
    if (user && streamId) void init();
    return () => { void teardown(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, streamId]);

  const init = async () => {
    if (!user || !streamId) return;
    setLoading(true);

    // Fetch stream
    const { data: s } = await supabase.from("live_streams").select("*").eq("id", streamId).maybeSingle();
    if (!s) {
      toast({ title: "Stream not found", variant: "destructive" });
      navigate("/videos");
      return;
    }
    if (s.status !== "live") {
      toast({ title: "Stream has ended" });
      setStream(s);
      setLoading(false);
      return;
    }
    setStream(s);
    setLikes(s.like_count);

    // Fetch broadcaster profile
    const { data: prof } = await supabase
      .from("profiles").select("full_name, avatar_url").eq("user_id", s.broadcaster_id).maybeSingle();
    setBroadcaster({
      id: s.broadcaster_id,
      name: prof?.full_name || "Broadcaster",
      avatar: prof?.avatar_url || undefined,
    });

    // Check existing like
    const { data: existingLike } = await supabase
      .from("live_likes").select("id").eq("stream_id", streamId).eq("user_id", user.id).maybeSingle();
    setHasLiked(!!existingLike);

    // Join as viewer
    await supabase.from("live_viewers").upsert({
      stream_id: streamId,
      user_id: user.id,
      last_seen_at: new Date().toISOString(),
    }, { onConflict: "stream_id,user_id" });

    // Heartbeat to keep viewer count fresh
    heartbeatRef.current = setInterval(() => {
      void supabase.from("live_viewers").update({ last_seen_at: new Date().toISOString() })
        .eq("stream_id", streamId).eq("user_id", user.id);
    }, 5000);

    setupRealtime(s.id, s.broadcaster_id);
    await connectToBroadcaster(s.id, s.broadcaster_id);

    setLoading(false);
  };

  const setupRealtime = (sid: string, broadcasterId: string) => {
    const cleanups: Array<() => void> = [];

    // Chat history + subscription
    void supabase.from("live_chat_messages").select("*, profiles:user_id(full_name)").eq("stream_id", sid).order("created_at").limit(100)
      .then(({ data }) => {
        if (data) setChat(data.map((m: any) => ({ ...m, name: m.profiles?.full_name })));
      });
    const chatChannel = supabase.channel(`live-chat-view-${sid}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_chat_messages", filter: `stream_id=eq.${sid}` },
        (payload) => setChat((prev) => [...prev, payload.new as ChatMsg].slice(-100)))
      .subscribe();
    cleanups.push(() => { void supabase.removeChannel(chatChannel); });

    // Stream row updates (likes, status, viewer_count)
    const streamChannel = supabase.channel(`live-stream-${sid}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "live_streams", filter: `id=eq.${sid}` },
        (payload) => {
          const next = payload.new as any;
          setLikes(next.like_count);
          setViewers(next.viewer_count);
          if (next.status !== "live") {
            toast({ title: next.status === "force_ended" ? "Stream removed by admin" : "Stream ended" });
            setStream((prev: any) => ({ ...prev, ...next }));
          }
        })
      .subscribe();
    cleanups.push(() => { void supabase.removeChannel(streamChannel); });

    cleanupRef.current = () => cleanups.forEach((c) => c());
  };

  const connectToBroadcaster = async (sid: string, broadcasterId: string) => {
    if (!user) return;
    setConnecting(true);

    const pc = createPeerConnection(
      (candidate) => { void sendSignal(sid, user.id, broadcasterId, "ice", candidate); },
      (mediaStream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          setConnecting(false);
        }
      }
    );
    pcRef.current = pc;

    // Listen for offer + ice from broadcaster
    const unsub = subscribeToSignals(sid, user.id, async (sig: SignalRow) => {
      if (sig.from_user_id !== broadcasterId) return;
      if (sig.signal_type === "offer") {
        await pc.setRemoteDescription(new RTCSessionDescription(sig.payload));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendSignal(sid, user.id, broadcasterId, "answer", answer);
      } else if (sig.signal_type === "ice") {
        try { await pc.addIceCandidate(new RTCIceCandidate(sig.payload)); } catch {}
      }
    });
    const prevCleanup = cleanupRef.current;
    cleanupRef.current = () => { prevCleanup?.(); unsub(); };

    // Request offer from broadcaster
    await sendSignal(sid, user.id, broadcasterId, "request_offer", {});
  };

  const teardown = async () => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    if (videoRef.current) videoRef.current.srcObject = null;
    if (user && streamId) {
      await supabase.from("live_viewers").delete().eq("stream_id", streamId).eq("user_id", user.id);
    }
  };

  const handleLike = async () => {
    if (!user || !streamId || hasLiked) return;
    setHasLiked(true);
    setLikes((l) => l + 1);
    const { error } = await supabase.from("live_likes").insert({ stream_id: streamId, user_id: user.id });
    if (error) {
      setHasLiked(false);
      setLikes((l) => Math.max(l - 1, 0));
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !streamId || !chatInput.trim() || sending) return;
    setSending(true);
    const content = chatInput.trim().slice(0, 500);
    setChatInput("");
    const { error } = await supabase.from("live_chat_messages").insert({
      stream_id: streamId, user_id: user.id, content,
    });
    setSending(false);
    if (error) toast({ title: "Could not send", description: error.message, variant: "destructive" });
  };

  const handleReport = async () => {
    if (!user || !streamId) return;
    setSubmittingReport(true);
    const { error } = await supabase.from("live_reports").insert({
      stream_id: streamId,
      reporter_id: user.id,
      reason: reportReason,
      description: reportDesc.trim() || null,
    });
    setSubmittingReport(false);
    if (error) {
      const msg = /duplicate/i.test(error.message) ? "You already reported this stream." : error.message;
      toast({ title: "Report failed", description: msg, variant: "destructive" });
      return;
    }
    toast({ title: "Report submitted", description: "Our team will review this stream." });
    setReportOpen(false);
    setReportDesc("");
  };

  if (authLoading || loading) {
    return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary-foreground" /></div>;
  }

  if (stream && stream.status !== "live") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
          <Radio className="w-10 h-10 text-muted-foreground" />
        </div>
        <h1 className="font-display text-2xl font-bold mb-2">Stream ended</h1>
        <p className="text-muted-foreground mb-6">{broadcaster?.name} is no longer live.</p>
        <Button onClick={() => navigate("/videos")} className="rounded-xl">Back to videos</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <div className="relative flex-1">
        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />

        {connecting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-black/40">
            <Loader2 className="w-8 h-8 animate-spin mb-2" />
            <p className="text-sm">Connecting to live stream…</p>
          </div>
        )}

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent">
          <div className="flex items-center gap-2 min-w-0">
            <Button size="icon" variant="ghost" onClick={() => navigate(-1)} className="rounded-full bg-black/40 text-white hover:bg-black/60 h-9 w-9 shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <Avatar className="w-9 h-9 border-2 border-destructive shrink-0">
              <AvatarImage src={broadcaster?.avatar} />
              <AvatarFallback>{broadcaster?.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-white text-sm font-semibold truncate">{broadcaster?.name}</p>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="px-1.5 py-0.5 rounded bg-destructive text-destructive-foreground font-bold flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-white animate-pulse" /> LIVE
                </span>
                <span className="text-white/80 flex items-center gap-1"><Eye className="w-3 h-3" /> {viewers}</span>
              </div>
            </div>
          </div>

          <Sheet open={reportOpen} onOpenChange={setReportOpen}>
            <SheetTrigger asChild>
              <Button size="icon" variant="ghost" className="rounded-full bg-black/40 text-white hover:bg-black/60 h-9 w-9">
                <Flag className="w-4 h-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl">
              <SheetHeader><SheetTitle>Report this stream</SheetTitle></SheetHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <label className="text-sm font-semibold mb-2 block">Reason</label>
                  <div className="space-y-2">
                    {REPORT_REASONS.map((r) => (
                      <button
                        key={r}
                        onClick={() => setReportReason(r)}
                        className={`w-full text-left p-3 rounded-xl border-2 transition-colors ${reportReason === r ? "border-destructive bg-destructive/5" : "border-border"}`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold mb-2 block">Details (optional)</label>
                  <Textarea value={reportDesc} onChange={(e) => setReportDesc(e.target.value)} className="rounded-xl" maxLength={500} />
                </div>
                <Button onClick={handleReport} disabled={submittingReport} className="w-full h-12 rounded-xl bg-destructive hover:bg-destructive/90">
                  {submittingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit report"}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Chat overlay */}
        <div className="absolute bottom-32 left-0 right-16 max-h-48 overflow-y-auto px-4 space-y-1.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {chat.slice(-15).map((m) => (
            <div key={m.id} className="text-white text-sm bg-black/40 backdrop-blur-sm rounded-xl px-3 py-1.5 inline-block max-w-full">
              <span className="font-semibold mr-2">{m.name || "User"}</span>
              <span className="opacity-90">{m.content}</span>
            </div>
          ))}
        </div>

        {/* Right action rail */}
        <div className="absolute right-3 bottom-32 flex flex-col gap-3 items-center">
          <button onClick={handleLike} className="flex flex-col items-center gap-1">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-sm ${hasLiked ? "bg-destructive" : "bg-white/20"}`}>
              <Heart className={`w-6 h-6 ${hasLiked ? "fill-white text-white" : "text-white"}`} />
            </div>
            <span className="text-white text-xs font-semibold">{likes}</span>
          </button>
        </div>

        {/* Chat input */}
        <form onSubmit={handleSendChat} className="absolute bottom-0 left-0 right-0 p-3 flex gap-2 bg-gradient-to-t from-black/80 to-transparent">
          <Input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Say something…"
            maxLength={500}
            className="rounded-full h-11 bg-white/15 border-white/20 text-white placeholder:text-white/60 backdrop-blur-sm"
          />
          <Button type="submit" disabled={sending || !chatInput.trim()} size="icon" className="rounded-full h-11 w-11 shrink-0">
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default LiveViewer;
