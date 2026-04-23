import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState, useRef, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, Mic, Square, Paperclip, FileText, Image as ImageIcon, Play, Pause, Download, Video } from "lucide-react";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useNotificationSound } from "@/hooks/useNotificationSound";

const VideoCall = lazy(() => import("@/components/chat/VideoCall"));
import { useSignedChatAttachment, SignedImage, SignedFileLink } from "@/components/chat/SignedAttachment";

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read: boolean;
}

type ParsedContent = {
  type: "text" | "voice" | "file" | "image" | "story_reply";
  text?: string;
  url?: string;
  fileName?: string;
  mimeType?: string;
  duration?: number;
  storyImageUrl?: string;
  storyText?: string;
};

const parseMessageContent = (content: string): ParsedContent => {
  try {
    const parsed = JSON.parse(content);
    if (parsed && parsed.__type) return parsed as ParsedContent;
  } catch {
    // plain text
  }
  return { type: "text", text: content };
};

// eslint-disable-next-line react-refresh/only-export-components
const VoicePlayerInner = ({ url, isMe }: { url: string; isMe: boolean }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setProgress(audio.currentTime);
    const onMeta = () => setDuration(audio.duration);
    const onEnd = () => { setPlaying(false); setProgress(0); };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
    };
  }, []);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); } else { audioRef.current.play(); }
    setPlaying(!playing);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      <audio ref={audioRef} src={url} preload="metadata" />
      <button onClick={toggle} className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isMe ? "bg-primary-foreground/20" : "bg-primary/10"}`}>
        {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="h-1.5 rounded-full bg-current/20 overflow-hidden">
          <div className="h-full rounded-full bg-current/60 transition-all" style={{ width: `${duration ? (progress / duration) * 100 : 0}%` }} />
        </div>
        <p className="text-[10px] mt-0.5 opacity-60">{formatTime(progress)} / {formatTime(duration || 0)}</p>
      </div>
    </div>
  );
};

// Resolves the (possibly legacy) URL to a signed URL before mounting the audio element
const VoicePlayer = ({ url, isMe }: { url: string; isMe: boolean }) => {
  const signed = useSignedChatAttachment(url);
  if (!signed) return <div className="h-8 w-[180px] bg-current/10 rounded-full animate-pulse" />;
  return <VoicePlayerInner url={signed} isMe={isMe} />;
};

const Chat = () => {
  const { conversationId } = useParams<{ conversationId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { playSound } = useNotificationSound();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [otherUserName, setOtherUserName] = useState("Chat");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Video call
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [incomingCall, setIncomingCall] = useState(false);
  const [incomingOffer, setIncomingOffer] = useState<RTCSessionDescriptionInit | undefined>();

  // Voice recording
  const [recording, setRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // File upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/welcome");
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user || !conversationId) return;
    void loadConversationInfo();
    void loadMessages();

    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const msg = payload.new as Message;
          setMessages((prev) => prev.some((e) => e.id === msg.id) ? prev : [...prev, msg]);
          if (msg.sender_id !== user.id) {
            playSound();
            void markConversationAsRead();
          }
        }
      )
      .subscribe();

    // Listen for incoming video calls
    const callChannel = supabase.channel(`videocall-${conversationId}`, {
      config: { broadcast: { self: false } },
    });
    callChannel.on("broadcast", { event: "call-invite" }, ({ payload }) => {
      if (payload.from !== user.id) {
        setIncomingCall(true);
      }
    });
    callChannel.on("broadcast", { event: "offer" }, ({ payload }) => {
      if (payload.from !== user.id) {
        setIncomingOffer(payload.offer);
        setIncomingCall(true);
      }
    });
    callChannel.subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(callChannel);
    };
  }, [user, conversationId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    };
  }, []);

  const loadConversationInfo = async () => {
    if (!user || !conversationId) return;
    const { data: convo } = await supabase.from("conversations").select("*").eq("id", conversationId).maybeSingle();
    if (!convo) return;
    const otherId = convo.participant_one === user.id ? convo.participant_two : convo.participant_one;
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", otherId).maybeSingle();
    setOtherUserName(profile?.full_name || "User");
  };

  const loadMessages = async () => {
    if (!user || !conversationId) return;
    const { data } = await supabase.from("messages").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true });
    if (data) {
      setMessages(data);
      if (data.some((m) => !m.read && m.sender_id !== user.id)) await markConversationAsRead();
    }
    setLoading(false);
  };

  const markConversationAsRead = async () => {
    if (!user || !conversationId) return;
    const { error } = await supabase.from("messages").update({ read: true }).eq("conversation_id", conversationId).neq("sender_id", user.id).eq("read", false);
    if (!error) setMessages((prev) => prev.map((m) => m.sender_id === user.id || m.read ? m : { ...m, read: true }));
  };

  const sendContent = async (content: string) => {
    if (!user || !conversationId) return;
    await supabase.from("messages").insert({ conversation_id: conversationId, sender_id: user.id, content });
    await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversationId);
  };

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;
    setSending(true);
    const text = newMessage.trim();
    setNewMessage("");
    await sendContent(text);
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // Voice recording - directly request mic, browser handles permission prompt
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        if (blob.size < 1000) { setRecording(false); setRecordingDuration(0); return; }
        await uploadAndSendFile(blob, `voice_${Date.now()}.webm`, mediaRecorder.mimeType, "voice");
        setRecording(false);
        setRecordingDuration(0);
      };

      mediaRecorder.start();
      setRecording(true);
      setRecordingDuration(0);
      timerRef.current = setInterval(() => setRecordingDuration((d) => d + 1), 1000);
    } catch (err: any) {
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        toast({ title: "Microphone Permission Required", description: "Please go to your device Settings → App Permissions and enable Microphone for this app, then try again.", variant: "destructive" });
      } else {
        toast({ title: "Microphone not available", description: "Could not access the microphone. Please check your device settings.", variant: "destructive" });
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 20MB.", variant: "destructive" });
      return;
    }
    const isImage = file.type.startsWith("image/");
    await uploadAndSendFile(file, file.name, file.type, isImage ? "image" : "file");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadAndSendFile = async (fileOrBlob: Blob, fileName: string, mimeType: string, type: "voice" | "file" | "image") => {
    if (!user) return;
    setUploading(true);
    const ext = fileName.split(".").pop() || "bin";
    const path = `${user.id}/${conversationId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabase.storage.from("chat-attachments").upload(path, fileOrBlob, { contentType: mimeType });
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("chat-attachments").getPublicUrl(path);
    // Store the canonical (legacy public) URL — useSignedChatAttachment extracts
    // the storage path from it and signs at render time. Old messages keep working too.
    const content = JSON.stringify({ __type: true, type, url: urlData.publicUrl, fileName, mimeType });
    await sendContent(content);
    setUploading(false);
  };

  const renderMessageContent = (content: string, isMe: boolean) => {
    const parsed = parseMessageContent(content);
    switch (parsed.type) {
      case "voice":
        return (
          <div className="flex items-center gap-2">
            <Mic className="w-4 h-4 shrink-0 opacity-60" />
            <VoicePlayer url={parsed.url!} isMe={isMe} />
          </div>
        );
      case "image":
        return (
          <div>
            <SignedImage url={parsed.url} alt={parsed.fileName || "Image"} className="max-w-full rounded-lg max-h-48 object-cover" />
            {parsed.fileName && <p className="text-[10px] mt-1 opacity-60 truncate">{parsed.fileName}</p>}
          </div>
        );
      case "file":
        return (
          <SignedFileLink url={parsed.url} className="flex items-center gap-2 min-w-[140px]">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isMe ? "bg-primary-foreground/20" : "bg-primary/10"}`}>
              <FileText className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{parsed.fileName || "File"}</p>
              <p className="text-[10px] opacity-60">Tap to download</p>
            </div>
            <Download className="w-4 h-4 shrink-0 opacity-60" />
          </SignedFileLink>
        );
      case "story_reply":
        return (
          <div>
            {/* Quoted story context */}
            <div className={`rounded-lg overflow-hidden mb-1.5 ${isMe ? "bg-primary-foreground/10" : "bg-background/60"} border-l-4 ${isMe ? "border-primary-foreground/40" : "border-primary/40"}`}>
              <div className="flex items-start gap-2 p-2">
                {parsed.storyImageUrl && (
                  <img
                    src={parsed.storyImageUrl}
                    alt="Story"
                    className="w-12 h-12 rounded object-cover shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-[10px] font-semibold ${isMe ? "text-primary-foreground/70" : "text-primary/70"}`}>
                    Replied to story
                  </p>
                  {parsed.storyText && (
                    <p className={`text-xs line-clamp-2 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                      {parsed.storyText}
                    </p>
                  )}
                </div>
              </div>
            </div>
            {/* Reply text */}
            <p className="text-sm break-words">{parsed.text}</p>
          </div>
        );
      default:
        return <p className="text-sm break-words">{parsed.text}</p>;
    }
  };

  const handleStartVideoCall = () => {
    setShowVideoCall(true);
    setIncomingCall(false);
  };

  const handleAnswerCall = () => {
    setShowVideoCall(true);
    setIncomingCall(false);
  };

  const handleDeclineCall = () => {
    setIncomingCall(false);
    setIncomingOffer(undefined);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Video Call */}
      {showVideoCall && user && conversationId && (
        <Suspense fallback={<div className="fixed inset-0 z-50 bg-black flex items-center justify-center text-white">Loading...</div>}>
          <VideoCall
            conversationId={conversationId}
            currentUserId={user.id}
            otherUserName={otherUserName}
            onClose={() => { setShowVideoCall(false); setIncomingOffer(undefined); }}
            isIncoming={!!incomingOffer}
            offer={incomingOffer}
          />
        </Suspense>
      )}

      {/* Incoming call banner */}
      {incomingCall && !showVideoCall && (
        <div className="absolute top-16 left-4 right-4 z-40 bg-card border border-border rounded-2xl p-4 shadow-lg flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Video className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-foreground text-sm">{otherUserName}</p>
            <p className="text-xs text-muted-foreground">Incoming video call...</p>
          </div>
          <Button size="sm" variant="destructive" className="rounded-full" onClick={handleDeclineCall}>
            Decline
          </Button>
          <Button size="sm" className="rounded-full bg-green-600 hover:bg-green-700 text-white" onClick={handleAnswerCall}>
            Answer
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-card">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-xl shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-primary">{otherUserName.charAt(0).toUpperCase()}</span>
        </div>
        <span className="font-display font-bold text-foreground truncate flex-1">{otherUserName}</span>
        <Button variant="ghost" size="icon" className="rounded-xl shrink-0" onClick={handleStartVideoCall}>
          <Video className="w-5 h-5 text-primary" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-4">
        <div className="space-y-3 max-w-sm mx-auto">
          {messages.map((msg) => {
            const isMe = msg.sender_id === user?.id;
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                    isMe ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted text-foreground rounded-bl-md"
                  }`}
                >
                  {renderMessageContent(msg.content, isMe)}
                  <p className={`text-[10px] mt-1 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    {format(new Date(msg.created_at), "HH:mm")}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="px-4 py-3 border-t bg-card">
        <div className="flex items-center gap-2 max-w-sm mx-auto">
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip" />
          <Button variant="ghost" size="icon" className="rounded-full shrink-0" onClick={() => fileInputRef.current?.click()} disabled={uploading || recording}>
            <Paperclip className="w-5 h-5 text-muted-foreground" />
          </Button>

          {recording ? (
            <div className="flex-1 flex items-center gap-3 px-3">
              <div className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />
              <span className="text-sm font-medium text-destructive">
                {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, "0")}
              </span>
              <span className="text-xs text-muted-foreground">Recording...</span>
            </div>
          ) : (
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="flex-1 rounded-full"
              disabled={uploading}
            />
          )}

          {recording ? (
            <Button size="icon" variant="destructive" className="rounded-full shrink-0" onClick={stopRecording}>
              <Square className="w-4 h-4" />
            </Button>
          ) : newMessage.trim() ? (
            <Button size="icon" onClick={handleSend} disabled={sending || uploading} className="rounded-full shrink-0">
              <Send className="w-4 h-4" />
            </Button>
          ) : (
            <Button size="icon" variant="secondary" className="rounded-full shrink-0" onClick={startRecording} disabled={uploading}>
              <Mic className="w-4 h-4" />
            </Button>
          )}
        </div>
        {uploading && <p className="text-xs text-muted-foreground text-center mt-2">Uploading...</p>}
      </div>
    </div>
  );
};

export default Chat;
