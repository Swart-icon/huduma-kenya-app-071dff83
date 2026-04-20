import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Radio, Eye, Heart, Send, X, Mic, MicOff, Camera, CameraOff, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  createPeerConnection, sendSignal, subscribeToSignals, type SignalRow,
} from "@/lib/liveStreaming";

type ChatMsg = { id: string; user_id: string; content: string; created_at: string; name?: string };

const GoLive = () => {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const videoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  // viewer userId -> RTCPeerConnection
  const peerConnsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const cleanupRef = useRef<(() => void) | null>(null);

  const [title, setTitle] = useState("");
  const [streamId, setStreamId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [viewers, setViewers] = useState(0);
  const [likes, setLikes] = useState(0);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);

  // Access guard
  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/welcome"); return; }
    if (role !== "provider" && role !== "job_seeker") {
      toast({ title: "Not allowed", description: "Only providers and job seekers can go live.", variant: "destructive" });
      navigate("/videos");
    }
  }, [authLoading, user, role, navigate, toast]);

  // Cleanup on unmount
  useEffect(() => () => { void teardown(false); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startStream = async () => {
    if (!user) return;
    setStarting(true);
    try {
      // Get camera+mic
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 720 }, facingMode: "user" },
        audio: true,
      });
      localStreamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;

      // Create stream row
      const { data: row, error } = await supabase
        .from("live_streams")
        .insert({ broadcaster_id: user.id, title: title.trim() || "Live Stream" })
        .select()
        .single();
      if (error || !row) throw error || new Error("Failed to create stream");

      setStreamId(row.id);
      setupBroadcasterChannels(row.id);
      toast({ title: "🔴 You are live!" });
    } catch (e) {
      toast({
        title: "Could not start stream",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
      // cleanup partial
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    } finally {
      setStarting(false);
    }
  };

  const setupBroadcasterChannels = (sid: string) => {
    if (!user) return;
    const cleanups: Array<() => void> = [];

    // Listen for incoming signals (request_offer, answer, ice from viewers)
    cleanups.push(
      subscribeToSignals(sid, user.id, async (sig: SignalRow) => {
        const viewerId = sig.from_user_id;

        if (sig.signal_type === "request_offer") {
          // New viewer joined → create peer connection and send offer
          const pc = createPeerConnection((candidate) => {
            void sendSignal(sid, user.id, viewerId, "ice", candidate);
          });
          // Add tracks
          localStreamRef.current?.getTracks().forEach((track) => {
            pc.addTrack(track, localStreamRef.current!);
          });
          peerConnsRef.current.set(viewerId, pc);

          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await sendSignal(sid, user.id, viewerId, "offer", offer);
        } else if (sig.signal_type === "answer") {
          const pc = peerConnsRef.current.get(viewerId);
          if (pc && !pc.currentRemoteDescription) {
            await pc.setRemoteDescription(new RTCSessionDescription(sig.payload));
          }
        } else if (sig.signal_type === "ice") {
          const pc = peerConnsRef.current.get(viewerId);
          if (pc) {
            try { await pc.addIceCandidate(new RTCIceCandidate(sig.payload)); } catch {}
          }
        }
      })
    );

    // Subscribe to chat
    void supabase.from("live_chat_messages").select("*, profiles:user_id(full_name)").eq("stream_id", sid).order("created_at").limit(100)
      .then(({ data }) => {
        if (data) setChat(data.map((m: any) => ({ ...m, name: m.profiles?.full_name })));
      });
    const chatChannel = supabase.channel(`live-chat-${sid}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_chat_messages", filter: `stream_id=eq.${sid}` },
        (payload) => setChat((prev) => [...prev, payload.new as ChatMsg].slice(-100)))
      .subscribe();
    cleanups.push(() => { void supabase.removeChannel(chatChannel); });

    // Subscribe to viewer count + likes (poll every 3s — simpler than presence)
    const interval = setInterval(async () => {
      const { count: vCount } = await supabase
        .from("live_viewers").select("*", { count: "exact", head: true })
        .eq("stream_id", sid)
        .gte("last_seen_at", new Date(Date.now() - 15000).toISOString());
      const { data: streamRow } = await supabase
        .from("live_streams").select("like_count, viewer_count").eq("id", sid).maybeSingle();
      const v = vCount || 0;
      setViewers(v);
      setLikes(streamRow?.like_count || 0);
      // Update viewer_count + peak on row
      await supabase.from("live_streams").update({
        viewer_count: v,
      }).eq("id", sid);
    }, 3000);
    cleanups.push(() => clearInterval(interval));

    cleanupRef.current = () => cleanups.forEach((c) => c());
  };

  const toggleMute = () => {
    const tracks = localStreamRef.current?.getAudioTracks() || [];
    tracks.forEach((t) => (t.enabled = !t.enabled));
    setMuted((m) => !m);
  };

  const toggleCamera = () => {
    const tracks = localStreamRef.current?.getVideoTracks() || [];
    tracks.forEach((t) => (t.enabled = !t.enabled));
    setCameraOff((c) => !c);
  };

  const endStream = async () => {
    setEnding(true);
    await teardown(true);
    setEnding(false);
    toast({ title: "Live ended" });
    navigate("/videos");
  };

  const teardown = async (markEnded: boolean) => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    peerConnsRef.current.forEach((pc) => pc.close());
    peerConnsRef.current.clear();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (markEnded && streamId) {
      await supabase.from("live_streams").update({
        status: "ended", ended_at: new Date().toISOString(),
      }).eq("id", streamId);
    }
  };

  if (authLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  // Pre-stream setup screen
  if (!streamId) {
    return (
      <div className="min-h-screen bg-background px-6 py-6 pb-24">
        <div className="max-w-sm mx-auto">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground mb-6">
            <ArrowLeft className="w-5 h-5" /> <span>Back</span>
          </button>
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <Radio className="w-8 h-8 text-destructive" />
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground mb-1">Go Live</h1>
            <p className="text-muted-foreground">Showcase your skills in real-time</p>
          </div>
          <Card className="p-4 mb-4">
            <label className="text-sm font-semibold mb-2 block">Stream title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Live plumbing demo"
              maxLength={80}
              className="rounded-xl h-12"
            />
            <p className="text-xs text-muted-foreground mt-3">
              By going live you agree to our community guidelines. Inappropriate content will be removed and your account may be suspended.
            </p>
          </Card>
          <Button
            onClick={startStream}
            disabled={starting}
            className="w-full h-14 text-lg font-bold rounded-xl bg-destructive hover:bg-destructive/90"
          >
            {starting ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Requesting camera…</> : <><Radio className="w-5 h-5 mr-2" /> Start Live Stream</>}
          </Button>
        </div>
      </div>
    );
  }

  // Live broadcasting screen
  return (
    <div className="min-h-screen bg-black flex flex-col">
      <div className="relative flex-1">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent">
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 rounded-md bg-destructive text-destructive-foreground text-xs font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
            </span>
            <span className="px-2 py-1 rounded-md bg-black/50 text-white text-xs font-semibold flex items-center gap-1">
              <Eye className="w-3 h-3" /> {viewers}
            </span>
            <span className="px-2 py-1 rounded-md bg-black/50 text-white text-xs font-semibold flex items-center gap-1">
              <Heart className="w-3 h-3" /> {likes}
            </span>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="icon" variant="ghost" className="rounded-full bg-black/50 text-white hover:bg-black/70 h-10 w-10">
                <X className="w-5 h-5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>End live stream?</AlertDialogTitle>
                <AlertDialogDescription>This will disconnect all viewers and stop your broadcast.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep streaming</AlertDialogCancel>
                <AlertDialogAction onClick={endStream} disabled={ending} className="bg-destructive hover:bg-destructive/90">
                  {ending ? <Loader2 className="w-4 h-4 animate-spin" /> : "End live"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Chat overlay */}
        <div className="absolute bottom-24 left-0 right-0 max-h-48 overflow-y-auto px-4 space-y-1.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {chat.slice(-15).map((m) => (
            <div key={m.id} className="text-white text-sm bg-black/40 backdrop-blur-sm rounded-xl px-3 py-1.5 inline-block max-w-full">
              <span className="font-semibold mr-2">{m.name || "User"}</span>
              <span className="opacity-90">{m.content}</span>
            </div>
          ))}
        </div>

        {/* Bottom controls */}
        <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center justify-center gap-3 bg-gradient-to-t from-black/60 to-transparent">
          <Button onClick={toggleMute} size="icon" className="rounded-full h-12 w-12 bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm">
            {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </Button>
          <Button onClick={toggleCamera} size="icon" className="rounded-full h-12 w-12 bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm">
            {cameraOff ? <CameraOff className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default GoLive;
