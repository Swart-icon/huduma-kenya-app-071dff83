import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

const requestMediaPermissions = async (): Promise<MediaStream> => {
  // Directly call getUserMedia - the browser/webview will prompt for permission
  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  return stream;
};

const VideoCall = ({ conversationId, currentUserId, otherUserName, onClose, isIncoming, offer }: VideoCallProps) => {
  const [callState, setCallState] = useState<"requesting-permissions" | "connecting" | "ringing" | "connected" | "ended" | "permission-denied">(
    isIncoming ? "ringing" : "requesting-permissions"
  );
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const { toast } = useToast();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const cleanedUpRef = useRef(false);

  const cleanup = useCallback(() => {
    if (cleanedUpRef.current) return;
    cleanedUpRef.current = true;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    pcRef.current = null;
    localStreamRef.current = null;
  }, []);

  const setupMedia = useCallback(async () => {
    const stream = await requestMediaPermissions();
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
      const state = pc.iceConnectionState;
      if (state === "connected" || state === "completed") {
        setCallState("connected");
      }
      if (state === "disconnected" || state === "failed" || state === "closed") {
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

  // Returns a promise that resolves when channel is subscribed
  const setupSignaling = useCallback((): Promise<ReturnType<typeof supabase.channel>> => {
    return new Promise((resolve, reject) => {
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
          try {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.answer));
            setCallState("connected");
          } catch (e) {
            console.error("Failed to set remote description from answer", e);
          }
        }
      });

      channel.on("broadcast", { event: "offer" }, async ({ payload }) => {
        if (payload.from !== currentUserId && pcRef.current) {
          try {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.offer));
            const answer = await pcRef.current.createAnswer();
            await pcRef.current.setLocalDescription(answer);
            channel.send({
              type: "broadcast",
              event: "answer",
              payload: { answer, from: currentUserId },
            });
          } catch (e) {
            console.error("Failed to handle incoming offer", e);
          }
        }
      });

      channel.on("broadcast", { event: "hangup" }, ({ payload }) => {
        if (payload.from !== currentUserId) {
          setCallState("ended");
          setTimeout(() => { cleanup(); onClose(); }, 1500);
        }
      });

      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          channelRef.current = channel;
          resolve(channel);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          reject(new Error(`Channel subscription failed: ${status}`));
        }
      });
    });
  }, [conversationId, currentUserId, cleanup, onClose]);

  // Start call (caller)
  const startCall = useCallback(async () => {
    try {
      // Step 1: Get media (triggers permission prompt)
      setCallState("requesting-permissions");
      const stream = await setupMedia();

      // Step 2: Wait for signaling channel to be fully subscribed
      setCallState("connecting");
      const channel = await setupSignaling();

      // Step 3: Create peer connection and offer
      const pc = createPeerConnection(stream);
      const offerDesc = await pc.createOffer();
      await pc.setLocalDescription(offerDesc);
      setCallState("ringing");

      // Step 4: Send offer (channel is guaranteed to be subscribed now)
      channel.send({
        type: "broadcast",
        event: "offer",
        payload: { offer: offerDesc, from: currentUserId },
      });

      channel.send({
        type: "broadcast",
        event: "call-invite",
        payload: { from: currentUserId, conversationId },
      });
    } catch (err: any) {
      console.error("Call start failed:", err);
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        setCallState("permission-denied");
        toast({
          title: "Camera/Microphone Permission Required",
          description: "Please allow camera and microphone access in your device settings to make video calls.",
          variant: "destructive",
        });
      } else {
        setCallState("ended");
        toast({
          title: "Call Failed",
          description: "Could not start the call. Please check your connection and try again.",
          variant: "destructive",
        });
      }
      setTimeout(() => { cleanup(); onClose(); }, 2500);
    }
  }, [setupMedia, setupSignaling, createPeerConnection, currentUserId, conversationId, cleanup, onClose, toast]);

  // Answer call (callee)
  const answerCall = useCallback(async () => {
    try {
      const stream = await setupMedia();
      const channel = await setupSignaling();
      const pc = createPeerConnection(stream);

      if (offer) {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        channel.send({
          type: "broadcast",
          event: "answer",
          payload: { answer, from: currentUserId },
        });
      }
      setCallState("connected");
    } catch (err: any) {
      console.error("Answer call failed:", err);
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        setCallState("permission-denied");
        toast({
          title: "Camera/Microphone Permission Required",
          description: "Please allow camera and microphone access in your device settings.",
          variant: "destructive",
        });
      } else {
        setCallState("ended");
      }
      setTimeout(() => { cleanup(); onClose(); }, 2500);
    }
  }, [setupMedia, setupSignaling, createPeerConnection, offer, currentUserId, cleanup, onClose, toast]);

  useEffect(() => {
    if (!isIncoming) {
      startCall();
    }
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
              {callState === "requesting-permissions" && "Requesting camera & mic access..."}
              {callState === "connecting" && "Connecting..."}
              {callState === "ringing" && (isIncoming ? "Incoming call..." : "Ringing...")}
              {callState === "ended" && "Call ended"}
              {callState === "permission-denied" && "Camera/Mic permission denied"}
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
            {callState === "permission-denied" && (
              <p className="text-white/40 text-xs mt-4 px-8 text-center">
                Go to your device Settings → App Permissions and enable Camera & Microphone for this app.
              </p>
            )}
          </div>
        )}

        {/* Local video PiP */}
        <video ref={localVideoRef} autoPlay playsInline muted className="absolute top-4 right-4 w-28 h-40 rounded-xl object-cover border-2 border-white/20" />
      </div>

      {/* Controls */}
      {(callState === "connected" || callState === "connecting" || callState === "ringing") && !(callState === "ringing" && isIncoming) && (
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
      )}
    </div>
  );
};

export default VideoCall;
