import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, CreditCard, CheckCircle, Smartphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type BookingDetail = {
  id: string;
  service_id: string;
  provider_id: string;
  client_id: string;
  status: string;
  booking_date: string | null;
  service_title?: string;
  provider_name?: string;
  service_price?: number | null;
};

const PaymentScreen = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [method, setMethod] = useState("mpesa");

  useEffect(() => {
    if (!authLoading && !user) { navigate("/welcome"); return; }
    if (user) fetchBooking();
  }, [authLoading, user]);

  const fetchBooking = async () => {
    const { data: b } = await supabase
      .from("bookings").select("*").eq("id", bookingId!).eq("client_id", user!.id).maybeSingle();
    if (!b) { setLoading(false); return; }

    const [svcRes, provRes] = await Promise.all([
      supabase.from("services").select("title, price").eq("id", b.service_id).maybeSingle(),
      supabase.from("provider_profiles").select("business_name").eq("user_id", b.provider_id).maybeSingle(),
    ]);

    setBooking({
      ...b,
      service_title: svcRes.data?.title || "Service",
      provider_name: provRes.data?.business_name || "Provider",
      service_price: svcRes.data?.price ?? null,
    });
    setLoading(false);
  };

  const handlePay = async () => {
    if (!booking) return;
    setPaying(true);
    const amount = booking.service_price || 0;

    const { error } = await supabase.from("payments").insert({
      booking_id: booking.id,
      client_id: user!.id,
      provider_id: booking.provider_id,
      amount,
      status: "completed",
      payment_method: method,
    });

    if (error) {
      toast({ title: "Payment failed", description: error.message, variant: "destructive" });
      setPaying(false);
    } else {
      setPaid(true);
      setPaying(false);
      toast({ title: "Payment successful!" });
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-background px-6 py-8 text-center">
        <p className="text-muted-foreground">Booking not found</p>
        <Button variant="link" onClick={() => navigate("/my-bookings")}>Back to bookings</Button>
      </div>
    );
  }

  if (paid) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-primary" />
          </div>
          <h2 className="font-display text-2xl font-bold text-foreground mb-2">Payment Complete!</h2>
          <p className="text-muted-foreground mb-6">
            KSh {(booking.service_price || 0).toLocaleString()} paid via {method === "mpesa" ? "M-Pesa" : "Card"}
          </p>
          <Button onClick={() => navigate("/my-bookings")} className="rounded-xl h-12 w-full font-semibold">
            Back to Bookings
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-6 py-6 pb-24">
      <div className="max-w-sm mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground mb-6">
          <ArrowLeft className="w-5 h-5" /> <span>Back</span>
        </button>

        <h1 className="font-display text-2xl font-bold text-foreground mb-6">Payment</h1>

        {/* Booking summary */}
        <Card className="mb-6">
          <CardContent className="p-4 space-y-2">
            <h3 className="font-semibold text-foreground">{booking.service_title}</h3>
            <p className="text-sm text-muted-foreground">Provider: {booking.provider_name}</p>
            {booking.booking_date && (
              <p className="text-sm text-muted-foreground">
                Date: {new Date(booking.booking_date).toLocaleDateString()}
              </p>
            )}
            <p className="text-xl font-bold text-primary mt-2">
              KSh {(booking.service_price || 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>

        {/* Payment method */}
        <h3 className="font-semibold text-foreground mb-3">Payment Method</h3>
        <div className="space-y-3 mb-8">
          <button
            onClick={() => setMethod("mpesa")}
            className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-colors ${method === "mpesa" ? "border-primary bg-primary/5" : "border-border"}`}
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5 text-primary" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-foreground">M-Pesa</p>
              <p className="text-xs text-muted-foreground">Pay via Safaricom M-Pesa</p>
            </div>
          </button>
          <button
            onClick={() => setMethod("card")}
            className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-colors ${method === "card" ? "border-primary bg-primary/5" : "border-border"}`}
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5 text-primary" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-foreground">Card</p>
              <p className="text-xs text-muted-foreground">Visa / Mastercard</p>
            </div>
          </button>
        </div>

        <Button
          onClick={handlePay}
          disabled={paying}
          className="w-full h-14 text-lg font-bold rounded-xl"
          size="lg"
        >
          {paying ? "Processing..." : `Pay KSh ${(booking.service_price || 0).toLocaleString()}`}
        </Button>
      </div>
    </div>
  );
};

export default PaymentScreen;
