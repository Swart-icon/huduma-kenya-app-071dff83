import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Self-healing video thumbnail.
 *
 * Behavior:
 *  1. If `thumbnailUrl` is provided → render it directly (fast path).
 *  2. Otherwise, load the video element off-screen, seek to ~1.5s, draw the
 *     frame to a canvas, and display the resulting JPEG data URL.
 *  3. If the current user owns the video, opportunistically upload the
 *     generated frame to `user-videos` storage and patch `videos.thumbnail_url`
 *     so subsequent loads (and other users) get the fast path.
 *
 * No generic play-icon placeholder is ever shown permanently — while the
 * thumbnail is being generated we render a subtle shimmer.
 */

const generatedCache = new Map<string, string>();
const inflight = new Set<string>();

interface Props {
  videoId: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  ownerId: string;
  className?: string;
  alt?: string;
}

export const VideoThumbnail = ({
  videoId,
  videoUrl,
  thumbnailUrl,
  ownerId,
  className,
  alt = "",
}: Props) => {
  const { user } = useAuth();
  const [generated, setGenerated] = useState<string | null>(
    () => generatedCache.get(videoId) ?? null,
  );
  const [errored, setErrored] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    if (thumbnailUrl) return;
    if (generated) return;
    if (inflight.has(videoId)) return;
    if (!videoUrl) return;

    inflight.add(videoId);
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    (video as any).playsInline = true;
    video.preload = "metadata";
    video.src = videoUrl;

    const cleanup = () => {
      inflight.delete(videoId);
      video.removeAttribute("src");
      try { video.load(); } catch {}
    };

    const draw = (): string | null => {
      try {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (!w || !h) return null;
        const targetW = Math.min(480, w);
        const targetH = Math.round((h / w) * targetW);
        const canvas = document.createElement("canvas");
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        ctx.drawImage(video, 0, 0, targetW, targetH);
        return canvas.toDataURL("image/jpeg", 0.78);
      } catch {
        return null;
      }
    };

    const persistIfOwner = async (dataUrl: string) => {
      if (!user || user.id !== ownerId) return;
      try {
        const blob = await (await fetch(dataUrl)).blob();
        const path = `${ownerId}/${videoId}_thumb.jpg`;
        const { error: upErr } = await supabase.storage
          .from("user-videos")
          .upload(path, blob, {
            contentType: "image/jpeg",
            cacheControl: "31536000",
            upsert: true,
          });
        if (upErr) return;
        const publicUrl = supabase.storage.from("user-videos").getPublicUrl(path).data.publicUrl;
        await supabase.from("videos").update({ thumbnail_url: publicUrl }).eq("id", videoId);
      } catch {
        // non-fatal
      }
    };

    const onSeeked = () => {
      const dataUrl = draw();
      if (cancelledRef.current) { cleanup(); return; }
      if (dataUrl) {
        generatedCache.set(videoId, dataUrl);
        setGenerated(dataUrl);
        void persistIfOwner(dataUrl);
      } else {
        setErrored(true);
      }
      cleanup();
    };

    const onLoaded = () => {
      const target = Math.min(1.5, Math.max(0.1, (video.duration || 2) * 0.25));
      try { video.currentTime = target; } catch { onSeeked(); }
    };

    const onError = () => {
      setErrored(true);
      cleanup();
    };

    video.addEventListener("loadeddata", onLoaded, { once: true });
    video.addEventListener("seeked", onSeeked, { once: true });
    video.addEventListener("error", onError, { once: true });

    return () => {
      cancelledRef.current = true;
      video.removeEventListener("loadeddata", onLoaded);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      cleanup();
    };
  }, [videoId, videoUrl, thumbnailUrl, generated, ownerId, user]);

  const src = thumbnailUrl || generated;

  if (src) {
    return <img src={src} alt={alt} className={className} loading="lazy" decoding="async" />;
  }

  // No thumbnail yet (loading or errored). Show ONLY a neutral shimmer —
  // never an icon, never a static placeholder, never a <video> poster.
  return (
    <div
      className={`${className ?? ""} bg-muted animate-pulse`}
      aria-label={errored ? "Thumbnail unavailable" : "Loading thumbnail"}
    />
  );
};
