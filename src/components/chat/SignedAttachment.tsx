import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves a chat-attachments storage path (or legacy public URL) into a
 * short-lived signed URL. Returns the URL via render prop so callers can
 * use it on <img>, <a>, <audio>, etc.
 */
export const useSignedChatAttachment = (urlOrPath: string | undefined) => {
  const [signed, setSigned] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!urlOrPath) { setSigned(undefined); return; }

    // Legacy public URLs already point to the bucket — extract the path.
    const marker = "/chat-attachments/";
    let path = urlOrPath;
    const idx = urlOrPath.indexOf(marker);
    if (idx !== -1) {
      path = urlOrPath.slice(idx + marker.length).split("?")[0];
    }

    let cancelled = false;
    supabase.storage
      .from("chat-attachments")
      .createSignedUrl(path, 60 * 60) // 1 hour
      .then(({ data }) => {
        if (!cancelled) setSigned(data?.signedUrl);
      });
    return () => { cancelled = true; };
  }, [urlOrPath]);

  return signed;
};

export const SignedImage = ({ url, alt, className }: { url?: string; alt?: string; className?: string }) => {
  const signed = useSignedChatAttachment(url);
  if (!signed) return <div className={`${className ?? ""} bg-muted animate-pulse`} />;
  return <img src={signed} alt={alt} className={className} />;
};

export const SignedFileLink = ({ url, children, className }: { url?: string; children: React.ReactNode; className?: string }) => {
  const signed = useSignedChatAttachment(url);
  return (
    <a
      href={signed || "#"}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={(e) => { if (!signed) e.preventDefault(); }}
    >
      {children}
    </a>
  );
};
