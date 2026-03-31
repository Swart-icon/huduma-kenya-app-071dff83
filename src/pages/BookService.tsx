import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Calendar, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Service = {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  price_type: string;
  provider_id: string;
  city: string | null;
  county: string | null;
};

const BookService = () => {
  const { serviceId } = useParams<{ serviceId: string }>();
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [service, setService] = useState<Service | null>(null);
  const [notes, setNotes] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && (!user || role !== "client")) {
      navigate("/dashboard");
      return;
    }
    if (serviceId) {
      supabase.from("services").select("*").eq("id", serviceId).maybeSingle()
        .then(({ data }) => { setService(data); setLoading(false); });
    }
  }, [authLoading, user, role, serviceId]);

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!service || !user) return;

    setSubmitting(true);
    const { error } = await supabase.from("bookings").insert({
      client_id: user.id,
      provider_id: service.provider_id,
      service_id: service.id,
      notes: notes.trim() || null,
      booking_date: bookingDate || null,
    });
    setSubmitting(false);

    if (error) {
      toast({ title: "Booking failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Booking request sent! 🎉" });
      navigate("/my-bookings");
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!service) return null;

  return (
    <div className="min-h-screen bg-background px-6 py-6 pb-24">
      <div className="max-w-sm mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground mb-6">
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        <h1 className="font-display text-2xl font-bold text-foreground mb-4">Book Service</h1>

        <Card className="mb-6">
          <CardContent className="p-4">
            <h3 className="font-semibold text-foreground">{service.title}</h3>
            {service.price && (
              <p className="text-sm text-primary font-bold mt-1">
                KSh {service.price.toLocaleString()} <span className="text-muted-foreground font-normal capitalize">({service.price_type})</span>
              </p>
            )}
            {(service.city || service.county) && (
              <p className="text-xs text-muted-foreground mt-1">{[service.city, service.county].filter(Boolean).join(", ")}</p>
            )}
          </CardContent>
        </Card>

        <form onSubmit={handleBook} className="space-y-5">
          <div>
            <Label className="text-sm font-semibold">Preferred Date</Label>
            <Input type="datetime-local" value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} className="h-12 rounded-xl mt-1.5" />
          </div>

          <div>
            <Label className="text-sm font-semibold">Notes for the Provider</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any special requirements or details..." className="rounded-xl mt-1.5 min-h-[100px]" maxLength={1000} />
          </div>

          <Button type="submit" disabled={submitting} className="w-full h-14 text-lg font-bold rounded-xl" size="lg">
            <Calendar className="w-5 h-5 mr-2" />
            {submitting ? "Booking..." : "Confirm Booking"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default BookService;
