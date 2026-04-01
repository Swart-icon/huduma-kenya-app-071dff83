import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface VideoCallProps {
  conversationId: string;
  currentUserId: string;
  otherUserName: string;
  onClose: () => void;
  isIncoming?: boolean;
  offer?: RTCSessionDescriptionInit;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

const VideoCall = ({ conversationId, currentUserId, otherUserName, onClose, isIncoming, offer }: VideoCallProps) => {
  const [callState, setCallState] = useState<"connecting" | "ringing" | "connected" | "ended">(isIncoming ? "ringing" : "connecting");
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const cleanup = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    pcRef.current = null;
    localStreamRef.current = null;
  }, []);

  const setupMedia = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    return stream;
  }, []);

  const createPeerConnection = useCallback((stream: MediaStream) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "connected") setCallState("connected");
      if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
        setCallState("ended");
        setTimeout(() => { cleanup(); onClose(); }, 1500);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "ice-candidate",
          payload: { candidate: event.candidate, from: currentUserId },
        });
      }
    };

    return pc;
  }, [currentUserId, cleanup, onClose]);

  const setupSignaling = useCallback(() => {
    const channel = supabase.channel(`videocall-${conversationId}`, {
      config: { broadcast: { self: false } },
    });

    channel.on("broadcast", { event: "ice-candidate" }, ({ payload }) => {
      if (payload.from !== currentUserId && pcRef.current) {
        pcRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(() => {});
      }
    });

    channel.on("broadcast", { event: "answer" }, async ({ payload }) => {
      if (payload.from !== currentUserId && pcRef.current) {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.answer));
        setCallState("connected");
      }
    });

    channel.on("broadcast", { event: "offer" }, async ({ payload }) => {
      if (payload.from !== currentUserId && pcRef.current) {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.offer));
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        channel.send({
          type: "broadcast",
          event: "answer",
          payload: { answer, from: currentUserId },
        });
      }
    });

    channel.on("broadcast", { event: "hangup" }, ({ payload }) => {
      if (payload.from !== currentUserId) {
        setCallState("ended");
        setTimeout(() => { cleanup(); onClose(); }, 1500);
      }
    });

    channel.subscribe();
    channelRef.current = channel;
    return channel;
  }, [conversationId, currentUserId, cleanup, onClose]);

  // Start call (caller)
  const startCall = useCallback(async () => {
    try {
      const stream = await setupMedia();
      setupSignaling();
      const pc = createPeerConnection(stream);
      const offerDesc = await pc.createOffer();
      await pc.setLocalDescription(offerDesc);
      setCallState("ringing");

      // Send offer via broadcast
      channelRef.current?.send({
        type: "broadcast",
        event: "offer",
        payload: { offer: offerDesc, from: currentUserId },
      });

      // Also send a call-signal message so the other user gets notified
      channelRef.current?.send({
        type: "broadcast",
        event: "call-invite",
        payload: { from: currentUserId, conversationId },
      });
    } catch {
      setCallState("ended");
      setTimeout(() => { cleanup(); onClose(); }, 1500);
    }
  }, [setupMedia, setupSignaling, createPeerConnection, currentUserId, conversationId, cleanup, onClose]);

  // Answer call (callee)
  const answerCall = useCallback(async () => {
    try {
      const stream = await setupMedia();
      setupSignaling();
      const pc = createPeerConnection(stream);

      if (offer) {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        channelRef.current?.send({
          type: "broadcast",
          event: "answer",
          payload: { answer, from: currentUserId },
        });
      }
      setCallState("connected");
    } catch {
      setCallState("ended");
      setTimeout(() => { cleanup(); onClose(); }, 1500);
    }
  }, [setupMedia, setupSignaling, createPeerConnection, offer, currentUserId, cleanup, onClose]);

  useEffect(() => {
    if (!isIncoming) {
      startCall();
    }
    return cleanup;
  }, []);

  const hangUp = () => {
    channelRef.current?.send({
      type: "broadcast",
      event: "hangup",
      payload: { from: currentUserId },
    });
    setCallState("ended");
    setTimeout(() => { cleanup(); onClose(); }, 500);
  };

  const toggleMute = () => {
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
    setIsMuted(!isMuted);
  };

  const toggleVideo = () => {
    localStreamRef.current?.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
    setIsVideoOff(!isVideoOff);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Remote video */}
      <div className="flex-1 relative">
        <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
        {callState !== "connected" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mb-4">
              <span className="text-3xl font-bold text-primary">{otherUserName.charAt(0).toUpperCase()}</span>
            </div>
            <p className="text-white text-lg font-semibold">{otherUserName}</p>
            <p className="text-white/60 text-sm mt-2">
              {callState === "connecting" && "Connecting..."}
              {callState === "ringing" && (isIncoming ? "Incoming call..." : "Ringing...")}
              {callState === "ended" && "Call ended"}
            </p>
            {callState === "ringing" && isIncoming && (
              <div className="flex gap-6 mt-8">
                <Button size="icon" variant="destructive" className="w-14 h-14 rounded-full" onClick={hangUp}>
                  <PhoneOff className="w-6 h-6" />
                </Button>
                <Button size="icon" className="w-14 h-14 rounded-full bg-green-600 hover:bg-green-700" onClick={answerCall}>
                  <Phone className="w-6 h-6" />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Local video PiP */}
        <video ref={localVideoRef} autoPlay playsInline muted className="absolute top-4 right-4 w-28 h-40 rounded-xl object-cover border-2 border-white/20" />
      </div>

      {/* Controls */}
      {callState !== "ringing" || !isIncoming ? (
        <div className="flex items-center justify-center gap-6 py-6 bg-black/90">
          <Button size="icon" variant={isMuted ? "destructive" : "secondary"} className="w-12 h-12 rounded-full" onClick={toggleMute}>
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </Button>
          <Button size="icon" variant={isVideoOff ? "destructive" : "secondary"} className="w-12 h-12 rounded-full" onClick={toggleVideo}>
            {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </Button>
          <Button size="icon" variant="destructive" className="w-14 h-14 rounded-full" onClick={hangUp}>
            <PhoneOff className="w-6 h-6" />
          </Button>
        </div>
      ) : null}
    </div>
  );
};

export default VideoCall;
