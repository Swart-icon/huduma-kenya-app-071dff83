import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { App as CapApp } from "@capacitor/app";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

/**
 * Listens for new notifications (admin broadcasts + reminders) and:
 *  - shows in-app toast when foreground
 *  - schedules a Capacitor LocalNotification when app is backgrounded
 *  - tapping the local notification routes to /inbox
 */
export const useBroadcastNotifications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const initialized = useRef(false);

  useEffect(() => {
    if (!user || initialized.current) return;
    initialized.current = true;

    const isNative = Capacitor.isNativePlatform();
    let appActive = true;

    // Track app foreground/background
    if (isNative) {
      LocalNotifications.requestPermissions().catch(() => {});
      const stateListener = CapApp.addListener("appStateChange", ({ isActive }) => {
        appActive = isActive;
      });
      const tapListener = LocalNotifications.addListener(
        "localNotificationActionPerformed",
        (action) => {
          const data = action.notification?.extra;
          if (data?.type === "broadcast" || data?.type === "broadcast_reminder") {
            navigate("/inbox");
          }
        },
      );
      return () => {
        stateListener.then((l) => l.remove());
        tapListener.then((l) => l.remove());
      };
    }

    return undefined;
  }, [user, navigate]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("user-notifications-push")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const notif: any = payload.new;
          if (notif.type !== "broadcast" && notif.type !== "broadcast_reminder") return;

          // Check user prefs (enabled by default)
          const { data: prefs } = await supabase
            .from("notification_preferences")
            .select("broadcasts_enabled, reminders_enabled")
            .eq("user_id", user.id)
            .maybeSingle();

          if (prefs) {
            if (notif.type === "broadcast" && prefs.broadcasts_enabled === false) return;
            if (notif.type === "broadcast_reminder" && prefs.reminders_enabled === false) return;
          }

          const title = notif.title || "New announcement";
          const body = notif.body || "";

          // Always show in-app toast
          toast({
            title,
            description: body,
            duration: 6000,
          });

          // On native, also schedule a local system notification
          if (Capacitor.isNativePlatform()) {
            try {
              await LocalNotifications.schedule({
                notifications: [
                  {
                    id: Math.floor(Math.random() * 2_000_000_000),
                    title: `Servio: ${title}`,
                    body,
                    schedule: { at: new Date(Date.now() + 200) },
                    extra: { type: notif.type, broadcastId: notif.reference_id },
                  },
                ],
              });
            } catch {
              // ignore – permissions may be denied
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);
};
