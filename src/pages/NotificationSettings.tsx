import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Bell, Megaphone, AlarmClock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const NotificationSettings = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [broadcasts, setBroadcasts] = useState(true);
  const [reminders, setReminders] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/welcome");
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("notification_preferences")
      .select("broadcasts_enabled, reminders_enabled")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setBroadcasts(data.broadcasts_enabled);
          setReminders(data.reminders_enabled);
        }
        setLoading(false);
      });
  }, [user]);

  const save = async (next: { broadcasts: boolean; reminders: boolean }) => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("notification_preferences")
      .upsert(
        {
          user_id: user.id,
          broadcasts_enabled: next.broadcasts,
          reminders_enabled: next.reminders,
        },
        { onConflict: "user_id" },
      );
    setSaving(false);
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Preferences saved ✅" });
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-5 py-5">
      <div className="max-w-md mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground mb-5">
          <ArrowLeft className="w-5 h-5" /> Back
        </button>

        <h1 className="font-display text-2xl font-bold text-foreground mb-1 flex items-center gap-2">
          <Bell className="w-6 h-6 text-primary" /> Notifications
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          Manage which alerts reach your phone.
        </p>

        <Card className="rounded-2xl mb-3">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
              <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                <Megaphone className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Admin announcements</p>
                <p className="text-xs text-muted-foreground">
                  Important news, updates, and alerts from the Servio team.
                </p>
              </div>
            </div>
            <Switch
              checked={broadcasts}
              disabled={saving}
              onCheckedChange={(v) => {
                setBroadcasts(v);
                save({ broadcasts: v, reminders });
              }}
            />
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
              <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                <AlarmClock className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Unread reminders</p>
                <p className="text-xs text-muted-foreground">
                  Re-notify me 12 hours later if I haven't opened an announcement.
                </p>
              </div>
            </div>
            <Switch
              checked={reminders}
              disabled={saving || !broadcasts}
              onCheckedChange={(v) => {
                setReminders(v);
                save({ broadcasts, reminders: v });
              }}
            />
          </CardContent>
        </Card>

        <Button
          variant="outline"
          onClick={() => navigate("/inbox")}
          className="w-full h-12 rounded-xl mt-6"
        >
          Open Inbox
        </Button>
      </div>
    </div>
  );
};

export default NotificationSettings;
