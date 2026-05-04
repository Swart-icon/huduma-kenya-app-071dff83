/**
 * Mobile-first upload pipeline.
 *
 * Responsibilities:
 *   - Normalize files coming from Android/iOS pickers (MIME, extension, HEIC → JPEG)
 *   - Compress oversized images so phones on 3G actually finish uploading
 *   - Guard video size before the network call
 *   - Upload to Supabase Storage with progress + clear, user-friendly error messages
 */

import imageCompression from "browser-image-compression";
import { supabase } from "@/integrations/supabase/client";

// ---------- Limits ----------
export const MAX_IMAGE_MB = 20;
export const MAX_VIDEO_MB = 1024; // 1 GB hard cap matching the bucket
export const TARGET_IMAGE_MB = 1.5; // compress images larger than this

// ---------- Acceptable types ----------
const VIDEO_EXT_RE = /\.(mp4|m4v|mov|webm|mkv|avi|3gp|3gpp|qt|hevc)$/i;
const IMAGE_EXT_RE = /\.(jpg|jpeg|png|webp|gif|heic|heif|avif|bmp)$/i;
const HEIC_RE = /\.(heic|heif)$/i;

export const isVideoFile = (f: File) =>
  (f.type && f.type.startsWith("video/")) || VIDEO_EXT_RE.test(f.name);

export const isImageFile = (f: File) =>
  (f.type && f.type.startsWith("image/")) || IMAGE_EXT_RE.test(f.name);

const isHeic = (f: File) =>
  HEIC_RE.test(f.name) ||
  f.type === "image/heic" ||
  f.type === "image/heif" ||
  f.type === "image/heic-sequence" ||
  f.type === "image/heif-sequence";

// ---------- MIME normalization ----------
const EXT_TO_MIME: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  qt: "video/quicktime",
  webm: "video/webm",
  mkv: "video/x-matroska",
  "3gp": "video/3gpp",
  "3gpp": "video/3gpp",
  hevc: "video/mp4",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  avif: "image/avif",
  bmp: "image/bmp",
};

const extOf = (name: string) =>
  (name.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export const normalizedMime = (f: File): string => {
  if (f.type && (f.type.startsWith("image/") || f.type.startsWith("video/"))) {
    return f.type;
  }
  const ext = extOf(f.name);
  return EXT_TO_MIME[ext] || (isVideoFile(f) ? "video/mp4" : "application/octet-stream");
};

// ---------- HEIC conversion ----------
/** Converts HEIC/HEIF to JPEG so browsers can actually display the result. */
const convertHeicToJpeg = async (file: File): Promise<File> => {
  if (!isHeic(file)) return file;
  try {
    // Dynamic import keeps heic2any (~1.4 MB) out of the main bundle
    const { default: heic2any } = await import("heic2any");
    const blob = (await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: 0.9,
    })) as Blob;
    const newName = file.name.replace(/\.(heic|heif)$/i, ".jpg");
    return new File([blob], newName, { type: "image/jpeg", lastModified: Date.now() });
  } catch (err) {
    console.warn("[mobileUpload] HEIC conversion failed, uploading original", err);
    return file;
  }
};

// ---------- Image normalize + compress ----------
export interface ImagePrepOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
}

/**
 * Returns a JPEG/PNG-safe File ready for upload.
 * - HEIC → JPEG
 * - Large images are downscaled and recompressed
 */
export const prepareImageForUpload = async (
  file: File,
  opts: ImagePrepOptions = {}
): Promise<File> => {
  let working = await convertHeicToJpeg(file);

  const targetMB = opts.maxSizeMB ?? TARGET_IMAGE_MB;
  const sizeMB = working.size / (1024 * 1024);

  // Skip compression for already-small files
  if (sizeMB <= targetMB && !isHeic(file)) return working;

  try {
    const compressed = await imageCompression(working, {
      maxSizeMB: targetMB,
      maxWidthOrHeight: opts.maxWidthOrHeight ?? 1920,
      useWebWorker: true,
      initialQuality: 0.85,
    });
    // browser-image-compression returns a Blob; ensure it's a File with sane name
    const safeName = working.name.replace(/\.(heic|heif)$/i, ".jpg");
    return new File([compressed], safeName, {
      type: compressed.type || "image/jpeg",
      lastModified: Date.now(),
    });
  } catch (err) {
    console.warn("[mobileUpload] image compression failed, uploading original", err);
    return working;
  }
};

// ---------- Friendly error mapper ----------
export const friendlyUploadError = (err: any): string => {
  const msg = (err?.message || err?.error_description || String(err) || "").toLowerCase();
  if (!msg) return "Upload failed. Please try again.";
  if (msg.includes("permission") || msg.includes("denied") || msg.includes("not authorized")) {
    return "Permission denied. Please sign in again or check your role.";
  }
  if (msg.includes("payload too large") || msg.includes("entity too large") || msg.includes("413")) {
    return "File too large for the server. Try a shorter or lower-quality video.";
  }
  if (msg.includes("network") || msg.includes("failed to fetch") || msg.includes("load failed") || msg.includes("timeout")) {
    return "Network error. Check your connection and try again.";
  }
  if (msg.includes("mime") || msg.includes("content-type") || msg.includes("invalid format")) {
    return "Unsupported file type. Use MP4, MOV, JPG, or PNG.";
  }
  if (msg.includes("duplicate") || msg.includes("already exists")) {
    return "A file with this name already exists. Please try again.";
  }
  return err?.message || "Upload failed. Please try again.";
};

// ---------- Validation ----------
export interface ValidationResult { ok: boolean; error?: string; }

export const validateImageFile = (f: File): ValidationResult => {
  if (!isImageFile(f)) return { ok: false, error: "Unsupported file type. Use JPG, PNG, WEBP, or HEIC." };
  if (f.size > MAX_IMAGE_MB * 1024 * 1024) {
    return { ok: false, error: `Image too large (${(f.size / 1024 / 1024).toFixed(1)} MB). Max ${MAX_IMAGE_MB} MB.` };
  }
  return { ok: true };
};

export const validateVideoFile = (f: File): ValidationResult => {
  if (!isVideoFile(f)) return { ok: false, error: "Unsupported file type. Use MP4, MOV, or WebM." };
  if (f.size > MAX_VIDEO_MB * 1024 * 1024) {
    return { ok: false, error: `Video too large (${(f.size / 1024 / 1024).toFixed(0)} MB). Max ${MAX_VIDEO_MB} MB.` };
  }
  return { ok: true };
};

// ---------- Upload with progress ----------
export interface UploadOptions {
  bucket: string;
  path: string;
  file: File | Blob;
  contentType?: string;
  onProgress?: (pct: number) => void;
  upsert?: boolean;
}

/**
 * Uploads via a signed upload URL so we get real XHR progress events.
 * Falls back to the standard SDK upload if signed URLs fail.
 */
export const uploadWithProgress = async ({
  bucket, path, file, contentType, onProgress, upsert = false,
}: UploadOptions): Promise<{ path: string }> => {
  const ct = contentType || (file instanceof File ? normalizedMime(file) : "application/octet-stream");

  // 1. Try signed upload URL (gives us XHR progress)
  try {
    const { data: signed, error: signErr } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(path, { upsert });

    if (signErr || !signed?.signedUrl) throw signErr || new Error("no signed url");

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", signed.signedUrl, true);
      xhr.setRequestHeader("Content-Type", ct);
      xhr.setRequestHeader("x-upsert", upsert ? "true" : "false");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress?.(100);
          resolve();
        } else {
          reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText || "unknown error"}`));
        }
      };
      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.ontimeout = () => reject(new Error("Upload timed out"));
      xhr.send(file);
    });

    return { path };
  } catch (signedErr) {
    console.warn("[mobileUpload] signed upload failed, falling back to SDK", signedErr);
  }

  // 2. Fallback — standard SDK upload (no progress, but reliable)
  onProgress?.(10);
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { contentType: ct, upsert });
  if (error) throw error;
  onProgress?.(100);
  return { path };
};

// ---------- Debug helper ----------
export const logFileMeta = (tag: string, f: File) => {
  console.log(`[${tag}] file selected`, {
    name: f.name,
    sizeMB: +(f.size / 1024 / 1024).toFixed(2),
    type: f.type || "(empty MIME)",
    normalizedMime: normalizedMime(f),
    lastModified: new Date(f.lastModified).toISOString(),
  });
};
