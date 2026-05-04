import { useRef, useState } from "react";
import { Camera as CameraIcon, ImagePlus, User as UserIcon, Loader2, X } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  userId: string;
  imageUrl: string | null;
  onUploaded: (url: string) => void;
  size?: "sm" | "md" | "lg";
  bucket?: string;
  /** Called after upload, before/instead of writing to profiles table. If omitted, writes profiles.avatar_url. */
  onPersist?: (url: string) => Promise<void> | void;
}

const SIZE_CLASS = {
  sm: "w-16 h-16",
  md: "w-24 h-24",
  lg: "w-28 h-28",
};

const ACCEPTED = /\.(jpe?g|png|webp)$/i;
const MAX_BYTES = 5 * 1024 * 1024;

const compressImage = (file: File, maxDim = 800, quality = 0.85): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      if (width > height && width > maxDim) {
        height = (height * maxDim) / width;
        width = maxDim;
      } else if (height > maxDim) {
        width = (width * maxDim) / height;
        height = maxDim;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas unavailable"));
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Compression failed"))),
        "image/jpeg",
        quality,
      );
    };
    img.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(file);
  });

const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
  const res = await fetch(dataUrl);
  return res.blob();
};

export const AvatarUploader = ({
  userId,
  imageUrl,
  onUploaded,
  size = "md",
  bucket = "avatars",
  onPersist,
}: Props) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showSheet, setShowSheet] = useState(false);

  const isNative = Capacitor.isNativePlatform();

  const uploadBlob = async (blob: Blob, ext = "jpg") => {
    setUploading(true);
    try {
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(path, blob, { upsert: true, contentType: blob.type || "image/jpeg" });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
      const url = pub.publicUrl;

      if (onPersist) {
        await onPersist(url);
      } else {
        const { error: dbErr } = await supabase
          .from("profiles")
          .update({ avatar_url: url })
          .eq("user_id", userId);
        if (dbErr) throw dbErr;
      }

      onUploaded(url);
      toast({ title: "Profile picture updated ✅" });
    } catch (err: any) {
      toast({
        title: "Upload failed",
        description: err.message || "Try a smaller image",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleFile = async (file: File) => {
    if (!ACCEPTED.test(file.name) && !file.type.match(/^image\/(jpeg|jpg|png|webp)$/i)) {
      toast({ title: "Use JPG, PNG or WEBP", variant: "destructive" });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast({ title: "Image too large", description: "Max 5MB", variant: "destructive" });
      return;
    }
    try {
      const compressed = await compressImage(file);
      await uploadBlob(compressed, "jpg");
    } catch {
      await uploadBlob(file, file.name.split(".").pop() || "jpg");
    }
  };

  const onFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) await handleFile(f);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const pickFromCamera = async () => {
    setShowSheet(false);
    try {
      const photo = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        width: 800,
      });
      if (photo.dataUrl) {
        const blob = await dataUrlToBlob(photo.dataUrl);
        await uploadBlob(blob, photo.format || "jpg");
      }
    } catch (err: any) {
      if (err?.message && !/cancel/i.test(err.message)) {
        toast({ title: "Camera error", description: err.message, variant: "destructive" });
      }
    }
  };

  const pickFromGallery = async () => {
    setShowSheet(false);
    if (isNative) {
      try {
        const photo = await Camera.getPhoto({
          quality: 80,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Photos,
          width: 800,
        });
        if (photo.dataUrl) {
          const blob = await dataUrlToBlob(photo.dataUrl);
          await uploadBlob(blob, photo.format || "jpg");
        }
      } catch (err: any) {
        if (err?.message && !/cancel/i.test(err.message)) {
          toast({ title: "Gallery error", description: err.message, variant: "destructive" });
        }
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleClick = () => {
    if (uploading) return;
    if (isNative) {
      setShowSheet(true);
    } else {
      fileInputRef.current?.click();
    }
  };

  return (
    <>
      <div className="relative inline-block">
        <button
          type="button"
          onClick={handleClick}
          disabled={uploading}
          className={`${SIZE_CLASS[size]} relative rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center overflow-hidden group transition-transform active:scale-95`}
          aria-label="Change profile picture"
        >
          {imageUrl ? (
            <img src={imageUrl} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <UserIcon className="w-1/2 h-1/2 text-primary" />
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
            <CameraIcon className="w-5 h-5 text-white" />
          </div>
          {uploading && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            </div>
          )}
        </button>
        <button
          type="button"
          onClick={handleClick}
          disabled={uploading}
          className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary text-primary-foreground border-2 border-background flex items-center justify-center shadow-md active:scale-90 transition"
          aria-label="Edit profile picture"
        >
          <CameraIcon className="w-4 h-4" />
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="user"
        className="hidden"
        onChange={onFileInput}
      />

      {showSheet && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center"
          onClick={() => setShowSheet(false)}
        >
          <div
            className="w-full max-w-sm bg-card rounded-t-3xl p-4 pb-8 space-y-2 animate-in slide-in-from-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-foreground">Change profile picture</h3>
              <button onClick={() => setShowSheet(false)} className="p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <button
              onClick={pickFromCamera}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-muted hover:bg-muted/70 transition active:scale-[0.98]"
            >
              <CameraIcon className="w-5 h-5 text-primary" />
              <span className="font-medium text-foreground">Take photo</span>
            </button>
            <button
              onClick={pickFromGallery}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-muted hover:bg-muted/70 transition active:scale-[0.98]"
            >
              <ImagePlus className="w-5 h-5 text-primary" />
              <span className="font-medium text-foreground">Choose from gallery</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default AvatarUploader;
