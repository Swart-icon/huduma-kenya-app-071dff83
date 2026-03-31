import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Star, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ReviewForm = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [providerId, setProviderId] = useState<string | null>(null);
  const [serviceName, setServiceName] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) { navigate("/welcome"); return; }
    if (user) fetchBooking();
  }, [authLoading, user]);

  const fetchBooking = async () => {
    const { data: b } = await supabase
      .from("bookings").select("*").eq("id", bookingId!).eq("client_id", user!.id).eq("status", "completed").maybeSingle();
    if (!b) { setLoading(false); return; }
    setProviderId(b.provider_id);

    // Check if already reviewed
    const { data: existing } = await supabase.from("reviews").select("id").eq("booking_id", b.id).maybeSingle();
    if (existing) { setSubmitted(true); setLoading(false); return; }

    const { data: svc } = await supabase.from("services").select("title").eq("id", b.service_id).maybeSingle();
    setServiceName(svc?.title || "Service");
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (rating === 0) { toast({ title: "Please select a rating", variant: "destructive" }); return; }
    if (!providerId) return;
    setSubmitting(true);

    const { error } = await supabase.from("reviews").insert({
      booking_id: bookingId!,
      client_id: user!.id,
      provider_id: providerId,
      rating,
      comment: comment.trim() || null,
    });

    if (error) {
      toast({ title: "Failed to submit review", description: error.message, variant: "destructive" });
      setSubmitting(false);
    } else {
      setSubmitted(true);
      setSubmitting(false);
      toast({ title: "Review submitted!" });
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-primary" />
          </div>
          <h2 className="font-display text-2xl font-bold text-foreground mb-2">Thank you!</h2>
          <p className="text-muted-foreground mb-6">Your review has been submitted.</p>
          <Button onClick={() => navigate("/my-bookings")} className="rounded-xl h-12 w-full font-semibold">
            Back to Bookings
          </Button>
        </div>
      </div>
    );
  }

  if (!providerId) {
    return (
      <div className="min-h-screen bg-background px-6 py-8 text-center">
        <p className="text-muted-foreground">Booking not found or not completed</p>
        <Button variant="link" onClick={() => navigate("/my-bookings")}>Back to bookings</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-6 py-6 pb-24">
      <div className="max-w-sm mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground mb-6">
          <ArrowLeft className="w-5 h-5" /> <span>Back</span>
        </button>

        <h1 className="font-display text-2xl font-bold text-foreground mb-2">Leave a Review</h1>
        <p className="text-muted-foreground mb-8">{serviceName}</p>

        {/* Star rating */}
        <div className="flex justify-center gap-2 mb-8">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              className="p-1 transition-transform active:scale-110"
            >
              <Star
                className={`w-10 h-10 ${star <= rating ? "text-accent fill-accent" : "text-muted-foreground"}`}
              />
            </button>
          ))}
        </div>
        <p className="text-center text-sm text-muted-foreground mb-6">
          {rating === 0 ? "Tap to rate" : `${rating} out of 5 stars`}
        </p>

        {/* Comment */}
        <Textarea
          placeholder="Tell others about your experience (optional)..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="rounded-xl mb-6 min-h-[120px]"
          maxLength={500}
        />

        <Button
          onClick={handleSubmit}
          disabled={submitting || rating === 0}
          className="w-full h-14 text-lg font-bold rounded-xl"
          size="lg"
        >
          {submitting ? "Submitting..." : "Submit Review"}
        </Button>
      </div>
    </div>
  );
};

export default ReviewForm;
