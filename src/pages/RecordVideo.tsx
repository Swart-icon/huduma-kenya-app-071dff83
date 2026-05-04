import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, CircleDot, Square, SwitchCamera, Zap, ZapOff, X, RotateCcw, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const MAX_DURATION_SEC = 60;
const MIN_DURATION_SEC = 1;

const RecordVideo = () => {
  const navigate = useNavigate();
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordedMimeRef = useRef<string>("video/webm");
  const recordedExtRef = useRef<string>("webm");

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [flashOn, setFlashOn] = useState(false);
  const [flashSupported, setFlashSupported] = useState(false);
  const [starting, setStarting] = useState(true);
  const [proceeding, setProceeding] = useState(false);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStream(null);
    }
  }, []);

  const startCamera = useCallback(
    async (mode: "user" | "environment") => {
      setStarting(true);
      stopStream();
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: mode, width: { ideal: 1080 }, height: { ideal: 1920 } },
          audio: true,
        });
        streamRef.current = mediaStream;
        setStream(mediaStream);
        setFacingMode(mode);

        // Detect torch / flash support
        const track = mediaStream.getVideoTracks()[0];
        const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
        setFlashSupported(Boolean(caps.torch));
        setFlashOn(false);
      } catch (err) {
        toast.error("Camera access denied. Please allow camera permissions.");
        navigate(-1);
      } finally {
        setStarting(false);
      }
    },
    [navigate, stopStream],
  );

  // Init on mount
  useEffect(() => {
    startCamera("environment");
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try { mediaRecorderRef.current.stop(); } catch {}
      }
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bind stream to live <video>
  useEffect(() => {
    if (stream && liveVideoRef.current) {
      liveVideoRef.current.srcObject = stream;
      liveVideoRef.current.play().catch(() => {});
    }
  }, [stream]);

  const toggleFlash = async () => {
    if (!flashSupported || !streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    try {
      await track.applyConstraints({ advanced: [{ torch: !flashOn } as any] });
      setFlashOn((v) => !v);
    } catch {
      toast.error("Flash not available");
    }
  };

  const flipCamera = () => {
    if (recording) return;
    startCamera(facingMode === "user" ? "environment" : "user");
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    // Try webm (Android/desktop), fall back to mp4 (iOS Safari has no webm support)
    const candidates = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4;codecs=h264,aac",
      "video/mp4",
    ];
    const mimeType = candidates.find((m) => MediaRecorder.isTypeSupported(m)) || "";
    const recorder = mimeType
      ? new MediaRecorder(streamRef.current, { mimeType, videoBitsPerSecond: 2_500_000 })
      : new MediaRecorder(streamRef.current, { videoBitsPerSecond: 2_500_000 });
    const outputType = mimeType || recorder.mimeType || "video/webm";
    recordedMimeRef.current = outputType;
    recordedExtRef.current = outputType.includes("mp4") ? "mp4" : "webm";
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: outputType });
      setRecordedBlob(blob);
      setPreviewUrl(URL.createObjectURL(blob));
      stopStream();
    };
    mediaRecorderRef.current = recorder;
    recorder.start(1000);
    setRecording(true);
    setElapsed(0);
    timerRef.current = setInterval(() => {
      setElapsed((t) => {
        const next = t + 1;
        if (next >= MAX_DURATION_SEC) {
          stopRecording();
        }
        return next;
      });
    }, 1000);
  };

  const stopRecording = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try { mediaRecorderRef.current.stop(); } catch {}
    }
    setRecording(false);
  };

  const handleRecordTap = () => {
    if (recording) {
      if (elapsed < MIN_DURATION_SEC) {
        toast.error("Hold a moment longer to record");
        return;
      }
      stopRecording();
    } else {
      startRecording();
    }
  };

  const retake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setRecordedBlob(null);
    setElapsed(0);
    startCamera(facingMode);
  };

  const proceed = async () => {
    if (!recordedBlob) return;
    setProceeding(true);
    try {
      // Stash the blob via a sessionStorage key + Blob URL handoff
      const ext = recordedExtRef.current || "webm";
      const mime = recordedMimeRef.current || "video/webm";
      const file = new File([recordedBlob], `recording-${Date.now()}.${ext}`, { type: mime });
      // Convert to base64 for safe handoff (small clips); fallback object URL if too large
      if (file.size < 8 * 1024 * 1024) {
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let bin = "";
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        const b64 = btoa(bin);
        sessionStorage.setItem(
          "pending_recorded_video",
          JSON.stringify({ name: file.name, type: file.type, size: file.size, data: b64 }),
        );
      } else {
        // Large file: fallback to in-memory window cache
        (window as any).__pendingRecordedVideo = file;
        sessionStorage.setItem("pending_recorded_video_ref", "memory");
      }
      sessionStorage.setItem("open_upload_dialog", "1");
      navigate("/videos");
    } finally {
      setProceeding(false);
    }
  };

  const close = () => {
    if (recording) stopRecording();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    stopStream();
    navigate(-1);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const progressPct = Math.min(100, (elapsed / MAX_DURATION_SEC) * 100);

  // ===== Preview state =====
  if (previewUrl) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <video
          ref={previewVideoRef}
          src={previewUrl}
          className="absolute inset-0 w-full h-full object-contain"
          controls
          autoPlay
          playsInline
          loop
        />
        {/* Top bar */}
        <div className="relative z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent">
          <button
            onClick={close}
            className="w-10 h-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-white" />
          </button>
          <span className="text-white text-sm font-medium">Preview</span>
          <div className="w-10" />
        </div>
        {/* Bottom action bar */}
        <div className="mt-auto relative z-10 p-6 pb-10 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-around">
          <Button
            onClick={retake}
            variant="outline"
            size="lg"
            className="rounded-full bg-white/10 border-white/30 text-white hover:bg-white/20 gap-2"
          >
            <RotateCcw className="w-4 h-4" /> Retake
          </Button>
          <Button
            onClick={proceed}
            disabled={proceeding}
            size="lg"
            className="rounded-full gap-2 px-6"
          >
            {proceeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Use Video
          </Button>
        </div>
      </div>
    );
  }

  // ===== Recording state =====
  return (
    <div className="fixed inset-0 z-50 bg-black overflow-hidden">
      {/* Live camera preview - full screen */}
      <video
        ref={liveVideoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
      />

      {starting && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <Loader2 className="w-10 h-10 text-white animate-spin" />
        </div>
      )}

      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-white/20">
        <div
          className="h-full bg-destructive transition-[width] duration-1000 ease-linear"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Top controls */}
      <div className="absolute top-4 left-0 right-0 px-4 flex items-center justify-between">
        <button
          onClick={close}
          className="w-10 h-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        {recording && (
          <div className="flex items-center gap-2 bg-black/50 backdrop-blur rounded-full px-3 py-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />
            <span className="text-white text-sm font-mono tabular-nums">{formatTime(elapsed)}</span>
            <span className="text-white/60 text-xs">/ {MAX_DURATION_SEC}s</span>
          </div>
        )}

        <button
          onClick={toggleFlash}
          disabled={!flashSupported || recording}
          className="w-10 h-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center disabled:opacity-30"
          aria-label="Toggle flash"
        >
          {flashOn ? <Zap className="w-5 h-5 text-yellow-300" /> : <ZapOff className="w-5 h-5 text-white" />}
        </button>
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 pb-10 pt-20 px-6 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center justify-around">
          {/* Spacer / placeholder */}
          <div className="w-14 h-14" />

          {/* Record button */}
          <button
            onClick={handleRecordTap}
            disabled={starting}
            className="relative w-20 h-20 rounded-full flex items-center justify-center disabled:opacity-50"
            aria-label={recording ? "Stop recording" : "Start recording"}
          >
            <span className="absolute inset-0 rounded-full border-4 border-white" />
            <span
              className={`transition-all duration-200 ${
                recording
                  ? "w-8 h-8 rounded-md bg-destructive"
                  : "w-16 h-16 rounded-full bg-destructive"
              }`}
            />
          </button>

          {/* Flip camera */}
          <button
            onClick={flipCamera}
            disabled={recording}
            className="w-14 h-14 rounded-full bg-black/40 backdrop-blur flex items-center justify-center disabled:opacity-30"
            aria-label="Flip camera"
          >
            <SwitchCamera className="w-6 h-6 text-white" />
          </button>
        </div>
        <p className="text-center text-white/70 text-xs mt-4">
          Tap to {recording ? "stop" : "record"} • Max {MAX_DURATION_SEC}s
        </p>
      </div>
    </div>
  );
};

export default RecordVideo;
