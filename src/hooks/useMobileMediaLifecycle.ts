import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";
import { isImageFile, isVideoFile } from "@/lib/mobileUpload";

export type MobileMediaKind = "image" | "video" | "unknown";
export type MobileMediaSource = "gallery" | "camera" | "file-picker" | "recorder" | string;

type StoredUploadFile = {
  file: File;
  objectUrl: string;
  source: MobileMediaSource;
  kind: MobileMediaKind;
  savedAt: number;
};

type ActiveFlow = {
  sessionKey: string;
  route: string;
  source: MobileMediaSource;
  startedAt: number;
};

declare global {
  interface Window {
    __servioUploadSessions?: Record<string, StoredUploadFile>;
  }
}

const STORAGE_PREFIX = "servio_upload_session";
const ACTIVE_FLOW_KEY = "servio_active_media_flow";
const FLOW_TTL_MS = 10 * 60 * 1000;
const SELECTION_CLOSE_GUARD_MS = 2500;

const storageKey = (sessionKey: string, suffix: string) => `${STORAGE_PREFIX}:${sessionKey}:${suffix}`;

const setSelectionCloseGuard = (sessionKey: string) => {
  const until = Date.now() + SELECTION_CLOSE_GUARD_MS;
  sessionStorage.setItem(storageKey(sessionKey, "closeGuardUntil"), String(until));
  return until;
};

const getSelectionCloseGuard = (sessionKey: string) =>
  Number(sessionStorage.getItem(storageKey(sessionKey, "closeGuardUntil")) || 0);

export const mediaSessionHasRecentSelection = (sessionKey: string) =>
  Date.now() < getSelectionCloseGuard(sessionKey);

const inferKind = (file: File): MobileMediaKind => {
  if (isVideoFile(file)) return "video";
  if (isImageFile(file)) return "image";
  return "unknown";
};

const safeParse = <T,>(raw: string | null): T | null => {
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
};

export const logMobileMediaEvent = (event: string, details: Record<string, unknown> = {}) => {
  console.log(`[mobile-media] ${event}`, {
    route: window.location.pathname,
    visibility: document.visibilityState,
    native: Capacitor.isNativePlatform(),
    ...details,
  });
};

export const storeUploadSessionFile = (
  sessionKey: string,
  file: File,
  source: MobileMediaSource,
  kind: MobileMediaKind = inferKind(file),
) => {
  window.__servioUploadSessions ||= {};
  const existing = window.__servioUploadSessions[sessionKey];
  if (existing?.objectUrl) URL.revokeObjectURL(existing.objectUrl);

  const objectUrl = URL.createObjectURL(file);
  window.__servioUploadSessions[sessionKey] = {
    file,
    objectUrl,
    source,
    kind,
    savedAt: Date.now(),
  };
  sessionStorage.setItem(storageKey(sessionKey, "fileMeta"), JSON.stringify({
    name: file.name,
    type: file.type,
    size: file.size,
    source,
    kind,
    savedAt: Date.now(),
    routeAtSelection: window.location.pathname,
  }));
  setSelectionCloseGuard(sessionKey);
  logMobileMediaEvent("file-stored-preview-ready", { sessionKey, source, kind, name: file.name, size: file.size, type: file.type });
  window.dispatchEvent(new CustomEvent("servio-media-selected", { detail: { sessionKey, source, kind } }));
  return window.__servioUploadSessions[sessionKey];
};

export const getUploadSessionFile = (sessionKey: string) =>
  window.__servioUploadSessions?.[sessionKey] ?? null;

export const hasUploadSessionState = (sessionKey: string) =>
  Boolean(
    getUploadSessionFile(sessionKey) ||
    sessionStorage.getItem(storageKey(sessionKey, "fileMeta")) ||
    sessionStorage.getItem(storageKey(sessionKey, "draft"))
  );

export const clearUploadSessionFile = (sessionKey: string) => {
  const existing = window.__servioUploadSessions?.[sessionKey];
  if (existing?.objectUrl) URL.revokeObjectURL(existing.objectUrl);
  if (window.__servioUploadSessions) delete window.__servioUploadSessions[sessionKey];
  sessionStorage.removeItem(storageKey(sessionKey, "fileMeta"));
  sessionStorage.removeItem(storageKey(sessionKey, "closeGuardUntil"));
};

export const setActiveMediaFlow = (flow: ActiveFlow) => {
  sessionStorage.setItem(ACTIVE_FLOW_KEY, JSON.stringify(flow));
  logMobileMediaEvent("flow-start", flow);
};

export const clearActiveMediaFlow = (sessionKey?: string) => {
  const active = safeParse<ActiveFlow>(sessionStorage.getItem(ACTIVE_FLOW_KEY));
  if (!sessionKey || active?.sessionKey === sessionKey) {
    sessionStorage.removeItem(ACTIVE_FLOW_KEY);
    logMobileMediaEvent("flow-clear", { sessionKey });
  }
};

export const getActiveMediaFlow = () =>
  safeParse<ActiveFlow>(sessionStorage.getItem(ACTIVE_FLOW_KEY));

export const hasActiveMediaUploadFlow = () => {
  const flow = getActiveMediaFlow();
  return Boolean(flow && Date.now() - flow.startedAt <= FLOW_TTL_MS);
};

export const MobileMediaRecovery = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const recover = (reason: string) => {
      const flow = safeParse<ActiveFlow>(sessionStorage.getItem(ACTIVE_FLOW_KEY));
      if (!flow) return;
      if (Date.now() - flow.startedAt > FLOW_TTL_MS) {
        clearActiveMediaFlow(flow.sessionKey);
        return;
      }
      logMobileMediaEvent("recover-check", { reason, flowRoute: flow.route, currentRoute: window.location.pathname });
      // Only navigate back if the user was actually moved AWAY from the upload
      // route AND we have a file waiting to be processed. Otherwise leave the
      // dialog/page exactly where it is — forcing a navigate(replace) here can
      // unmount the open upload dialog and discard the user's selection.
      const hasPendingFile = Boolean(window.__servioUploadSessions?.[flow.sessionKey]);
      if (hasPendingFile && flow.route && window.location.pathname !== flow.route) {
        logMobileMediaEvent("recover-navigate-to-upload-host", { sessionKey: flow.sessionKey, from: window.location.pathname, to: flow.route });
        navigate(flow.route, { replace: true, state: { restoreUploadSession: flow.sessionKey } });
      }
    };

    const onVisibility = () => {
      logMobileMediaEvent(document.visibilityState === "hidden" ? "app-pause" : "app-resume", { source: "visibilitychange" });
      if (document.visibilityState === "visible") recover("visibilitychange");
    };
    const onPageShow = () => recover("pageshow");
    const onFocus = () => recover("focus");

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("focus", onFocus);
    recover("mount");

    let stateSub: Promise<{ remove: () => void }> | null = null;
    if (Capacitor.isNativePlatform()) {
      stateSub = App.addListener("appStateChange", ({ isActive }) => {
        logMobileMediaEvent(isActive ? "native-resume" : "native-pause", { source: "appStateChange" });
        if (isActive) recover("native-resume");
      });
    }

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("focus", onFocus);
      stateSub?.then((sub) => sub.remove());
    };
  }, [location.pathname, navigate]);

  return null;
};

export const useMobileMediaLifecycle = <TDraft extends Record<string, unknown>>(sessionKey: string, active: boolean) => {
  const location = useLocation();
  const [selecting, setSelecting] = useState(false);

  const api = useMemo(() => ({
    beginPicker: (source: MobileMediaSource) => {
      setSelecting(true);
      logMobileMediaEvent("picker-open", { sessionKey, source, routeBeforePicker: location.pathname });
      setActiveMediaFlow({ sessionKey, route: location.pathname, source, startedAt: Date.now() });
    },
    endPicker: (reason: string) => {
      setSelecting(false);
      clearActiveMediaFlow(sessionKey);
      logMobileMediaEvent("picker-end", { sessionKey, reason, routeAfterPicker: window.location.pathname });
    },
    rememberFile: (file: File, source: MobileMediaSource, kind?: MobileMediaKind) => {
      const stored = storeUploadSessionFile(sessionKey, file, source, kind);
      setSelecting(false);
      return stored;
    },
    restoreFile: () => getUploadSessionFile(sessionKey),
    hasInterruptedFile: () => Boolean(sessionStorage.getItem(storageKey(sessionKey, "fileMeta")) && !getUploadSessionFile(sessionKey)),
    saveDraft: (draft: TDraft) => {
      sessionStorage.setItem(storageKey(sessionKey, "draft"), JSON.stringify(draft));
    },
    loadDraft: () => safeParse<Partial<TDraft>>(sessionStorage.getItem(storageKey(sessionKey, "draft"))),
    clearAll: () => {
      clearUploadSessionFile(sessionKey);
      sessionStorage.removeItem(storageKey(sessionKey, "draft"));
      clearActiveMediaFlow(sessionKey);
    },
    shouldBlockClose: () => {
      const activeForThisSession = safeParse<ActiveFlow>(sessionStorage.getItem(ACTIVE_FLOW_KEY))?.sessionKey === sessionKey;
      const block = selecting || mediaSessionHasRecentSelection(sessionKey) || (activeForThisSession && !getUploadSessionFile(sessionKey));
      if (block) {
        logMobileMediaEvent("close-blocked-during-media-flow", { sessionKey, selecting, recentSelection: mediaSessionHasRecentSelection(sessionKey) });
        toast.info("Returning to upload…");
      }
      return block;
    },
  }), [location.pathname, selecting, sessionKey]);

  const recoverFromCancel = useCallback((reason: string) => {
    if (!active || !selecting) return;
    window.setTimeout(() => {
      if (!getUploadSessionFile(sessionKey)) {
        setSelecting(false);
        clearActiveMediaFlow(sessionKey);
        logMobileMediaEvent("picker-cancel-or-no-file", { sessionKey, reason });
      }
    }, 900);
  }, [active, selecting, sessionKey]);

  useEffect(() => {
    if (!active) return;
    const onVisibility = () => {
      logMobileMediaEvent(document.visibilityState === "hidden" ? "picker-pause" : "picker-resume", { sessionKey });
      if (document.visibilityState === "visible") recoverFromCancel("visibilitychange");
    };
    const onPageShow = () => recoverFromCancel("pageshow");
    const onFocus = () => recoverFromCancel("focus");

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("focus", onFocus);
    };
  }, [active, recoverFromCancel, sessionKey]);

  return { ...api, selecting };
};