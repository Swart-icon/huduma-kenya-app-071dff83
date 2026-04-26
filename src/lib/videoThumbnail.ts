/**
 * Client-side video thumbnail extraction.
 * Picks a non-blank frame near 1–2 seconds (or earlier for short clips),
 * encodes it as a small JPEG, and returns a File ready for upload.
 */

export interface ThumbnailOptions {
  /** Target seek position in seconds (default 1.5). Will fall back if blank. */
  preferredTime?: number;
  /** Max width in px (default 720). Height scales to preserve aspect ratio. */
  maxWidth?: number;
  /** JPEG quality 0..1 (default 0.8). */
  quality?: number;
  /** Filename for the resulting File (default `thumbnail.jpg`). */
  fileName?: string;
}

/** Average luminance (0–255) of an RGBA buffer; used to skip black frames. */
const averageLuminance = (data: Uint8ClampedArray): number => {
  let total = 0;
  // Sample every 4th pixel for speed
  const step = 16;
  let count = 0;
  for (let i = 0; i < data.length; i += step) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    total += 0.2126 * r + 0.7152 * g + 0.0722 * b;
    count++;
  }
  return total / Math.max(1, count);
};

const seekVideo = (video: HTMLVideoElement, time: number) =>
  new Promise<void>((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      resolve();
    };
    const onError = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      reject(new Error("Seek failed"));
    };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    try {
      video.currentTime = time;
    } catch (e) {
      onError();
    }
  });

const loadVideo = (file: File): Promise<HTMLVideoElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    (video as any).playsInline = true;
    video.crossOrigin = "anonymous";
    video.src = url;

    const cleanup = () => URL.revokeObjectURL(url);

    video.onloadeddata = () => resolve(video);
    video.onerror = () => {
      cleanup();
      reject(new Error("Could not read video metadata"));
    };
  });

/**
 * Extract a thumbnail from a video file.
 * Returns null if the browser cannot decode the video (e.g., codec issue) so
 * the upload flow can continue without blocking.
 */
export const extractVideoThumbnail = async (
  file: File,
  options: ThumbnailOptions = {},
): Promise<File | null> => {
  const {
    preferredTime = 1.5,
    maxWidth = 720,
    quality = 0.8,
    fileName = "thumbnail.jpg",
  } = options;

  let video: HTMLVideoElement | null = null;
  try {
    video = await loadVideo(file);
    const duration = isFinite(video.duration) ? video.duration : 0;

    // Build candidate seek times, skipping past black intros.
    const candidates: number[] = [];
    const target = Math.min(preferredTime, Math.max(0.1, duration * 0.25));
    candidates.push(target);
    if (duration > 3) candidates.push(Math.min(2.5, duration * 0.4));
    if (duration > 5) candidates.push(Math.min(4, duration * 0.6));
    candidates.push(0.1);

    const ratio = video.videoWidth ? video.videoHeight / video.videoWidth : 16 / 9;
    const width = Math.min(maxWidth, video.videoWidth || maxWidth);
    const height = Math.round(width * ratio);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    let bestBlob: Blob | null = null;
    let bestLuma = -1;

    for (const t of candidates) {
      try {
        await seekVideo(video, Math.min(t, Math.max(0, duration - 0.1)));
        ctx.drawImage(video, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        const luma = averageLuminance(imageData.data);

        // Acceptable frame: not near-black (>16) and reasonably bright.
        if (luma > 24) {
          const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, "image/jpeg", quality),
          );
          if (blob) {
            return new File([blob], fileName, { type: "image/jpeg" });
          }
        }

        // Track best fallback frame in case all are dim
        if (luma > bestLuma) {
          bestLuma = luma;
          bestBlob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, "image/jpeg", quality),
          );
        }
      } catch {
        // Try the next candidate
      }
    }

    if (bestBlob) {
      return new File([bestBlob], fileName, { type: "image/jpeg" });
    }
    return null;
  } catch {
    return null;
  } finally {
    if (video?.src) {
      URL.revokeObjectURL(video.src);
      video.removeAttribute("src");
      video.load();
    }
  }
};
