import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, CheckCircle, Clock, XCircle, CreditCard, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Booking = {
  id: string;
  client_id: string;
  provider_id: string;
  service_id: string;
  status: string;
  notes: string | null;
  booking_date: string | null;
  created_at: string;
  service_title?: string;
  other_name?: string;
};

const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
  pending: { color: "bg-accent/10 text-accent-foreground border-accent/20", icon: <Clock className="w-3 h-3" /> },
  accepted: { color: "bg-primary/10 text-primary border-primary/20", icon: <CheckCircle className="w-3 h-3" /> },
  completed: { color: "bg-muted text-muted-foreground border-border", icon: <CheckCircle className="w-3 h-3" /> },
  cancelled: { color: "bg-destructive/10 text-destructive border-destructive/20", icon: <XCircle className="w-3 h-3" /> },
};

const MyBookings = () => {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) { navigate("/welcome"); return; }
    if (user) fetchBookings();
  }, [authLoading, user]);

  const fetchBookings = async () => {
    const isProvider = role === "provider";
    const column = isProvider ? "provider_id" : "client_id";

    const { data: bookingsData } = await supabase
      .from("bookings").select("*").eq(column, user!.id).order("created_at", { ascending: false });

    if (!bookingsData || bookingsData.length === 0) { setBookings([]); setLoading(false); return; }

    // Fetch service titles
    const serviceIds = [...new Set(bookingsData.map(b => b.service_id))];
    const { data: services } = await supabase.from("services").select("id, title").in("id", serviceIds);
    const serviceMap: Record<string, string> = {};
    (services || []).forEach((s: { id: string; title: string }) => { serviceMap[s.id] = s.title; });

    // Fetch other party names
    const otherIds = [...new Set(bookingsData.map(b => isProvider ? b.client_id : b.provider_id))];
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", otherIds);
    const nameMap: Record<string, string> = {};
    (profiles || []).forEach((p: { user_id: string; full_name: string | null }) => { nameMap[p.user_id] = p.full_name || "User"; });

    setBookings(bookingsData.map(b => ({
      ...b,
      service_title: serviceMap[b.service_id] || "Service",
      other_name: nameMap[isProvider ? b.client_id : b.provider_id] || "User",
    })));
    setLoading(false);
  };

  const updateStatus = async (bookingId: string, newStatus: string) => {
    const { error } = await supabase.from("bookings").update({ status: newStatus }).eq("id", bookingId);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Booking ${newStatus}` });
      fetchBookings();
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
    <div className="min-h-screen bg-background px-6 py-6 pb-24">
      <div className="max-w-sm mx-auto">
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2 text-muted-foreground mb-6">
          <ArrowLeft className="w-5 h-5" />
          <span>Dashboard</span>
        </button>

        <h1 className="font-display text-2xl font-bold text-foreground mb-6">My Bookings</h1>

        {bookings.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No bookings yet</p>
              {role === "client" && (
                <Button onClick={() => navigate("/categories")} className="rounded-xl mt-4">Browse Services</Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {bookings.map((b) => {
              const sc = statusConfig[b.status] || statusConfig.pending;
              return (
                <Card key={b.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-foreground text-sm">{b.service_title}</h3>
                      <Badge variant="outline" className={`${sc.color} flex items-center gap-1`}>
                        {sc.icon} {b.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">
                      {role === "provider" ? "Client" : "Provider"}: {b.other_name}
                    </p>
                    {b.booking_date && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {new Date(b.booking_date).toLocaleString()}
                      </p>
                    )}
                    {b.notes && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{b.notes}</p>}

                    {/* Provider actions */}
                    {role === "provider" && b.status === "pending" && (
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" className="rounded-xl flex-1" onClick={() => updateStatus(b.id, "accepted")}>
                          <CheckCircle className="w-3 h-3 mr-1" /> Accept
                        </Button>
                        <Button size="sm" variant="outline" className="rounded-xl flex-1" onClick={() => updateStatus(b.id, "cancelled")}>
                          <XCircle className="w-3 h-3 mr-1" /> Decline
                        </Button>
                      </div>
                    )}
                    {role === "provider" && b.status === "accepted" && (
                      <Button size="sm" className="rounded-xl mt-3 w-full" onClick={() => updateStatus(b.id, "completed")}>
                        Mark Completed
                      </Button>
                    )}
                    {role === "client" && b.status === "pending" && (
                      <Button size="sm" variant="outline" className="rounded-xl mt-3" onClick={() => updateStatus(b.id, "cancelled")}>
                        <XCircle className="w-3 h-3 mr-1" /> Cancel
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyBookings;
