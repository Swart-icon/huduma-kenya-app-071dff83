import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, Mic, Square, Paperclip, FileText, Image as ImageIcon, Play, Pause, Download } from "lucide-react";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read: boolean;
}

type ParsedContent = {
  type: "text" | "voice" | "file" | "image";
  text?: string;
  url?: string;
  fileName?: string;
  mimeType?: string;
  duration?: number;
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

const VoicePlayer = ({ url, isMe }: { url: string; isMe: boolean }) => {
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

const Chat = () => {
  const { conversationId } = useParams<{ conversationId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [otherUserName, setOtherUserName] = useState("Chat");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

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
          if (msg.sender_id !== user.id) void markConversationAsRead();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, conversationId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cleanup recording on unmount
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

  // Voice recording
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
        if (blob.size < 1000) { setRecording(false); setRecordingDuration(0); return; } // too short
        await uploadAndSendFile(blob, `voice_${Date.now()}.webm`, mediaRecorder.mimeType, "voice");
        setRecording(false);
        setRecordingDuration(0);
      };

      mediaRecorder.start();
      setRecording(true);
      setRecordingDuration(0);
      timerRef.current = setInterval(() => setRecordingDuration((d) => d + 1), 1000);
    } catch {
      toast({ title: "Microphone access denied", description: "Please allow microphone access to record voice notes.", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
  };

  // File upload
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
            <img src={parsed.url} alt={parsed.fileName || "Image"} className="max-w-full rounded-lg max-h-48 object-cover" />
            {parsed.fileName && <p className="text-[10px] mt-1 opacity-60 truncate">{parsed.fileName}</p>}
          </div>
        );
      case "file":
        return (
          <a href={parsed.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 min-w-[140px]">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isMe ? "bg-primary-foreground/20" : "bg-primary/10"}`}>
              <FileText className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{parsed.fileName || "File"}</p>
              <p className="text-[10px] opacity-60">Tap to download</p>
            </div>
            <Download className="w-4 h-4 shrink-0 opacity-60" />
          </a>
        );
      default:
        return <p className="text-sm break-words">{parsed.text}</p>;
    }
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
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-card">
        <Button variant="ghost" size="icon" onClick={() => navigate("/conversations")} className="rounded-xl shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-primary">{otherUserName.charAt(0).toUpperCase()}</span>
        </div>
        <span className="font-display font-bold text-foreground truncate">{otherUserName}</span>
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
          {/* File attach */}
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
