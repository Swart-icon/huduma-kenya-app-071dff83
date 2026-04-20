import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Star, X, ExternalLink, MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=app.lovable.41ae626053c24d8093035aeae7a97ded";

type Step = "rate" | "feedback" | "thanks";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDismiss: () => void;
  onRated: () => void;
}

export const RateUsDialog = ({ open, onOpenChange, onDismiss, onRated }: Props) => {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [step, setStep] = useState<Step>("rate");
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleClose = () => {
    onDismiss();
    // Reset after close animation
    setTimeout(() => {
      setRating(0);
      setHoveredStar(0);
      setStep("rate");
      setFeedback("");
    }, 300);
  };

  const submitRating = async (stars: number, message?: string) => {
    if (!user) return;
    setSubmitting(true);
    try {
      await supabase.from("app_ratings").insert({
        user_id: user.id,
        star_rating: stars,
        feedback_message: message || null,
      });
    } catch {
      // Silent fail — don't block UX
    } finally {
      setSubmitting(false);
    }
  };

  const handleStarClick = (stars: number) => {
    setRating(stars);
  };

  const handleConfirmRating = async () => {
    if (rating === 0) return;
    if (rating >= 4) {
      await submitRating(rating);
      setStep("thanks");
      onRated();
    } else {
      setStep("feedback");
    }
  };

  const handleFeedbackSubmit = async () => {
    await submitRating(rating, feedback);
    onRated();
    toast.success("Thank you for your feedback!");
    handleClose();
  };

  const handlePlayStoreRedirect = () => {
    window.open(PLAY_STORE_URL, "_blank");
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(o); }}>
      <DialogContent className="max-w-sm mx-auto rounded-2xl p-0 overflow-hidden border-0 gap-0">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute right-3 top-3 z-10 w-8 h-8 rounded-full bg-muted/80 flex items-center justify-center hover:bg-muted transition-colors"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>

        {step === "rate" && (
          <div className="px-6 py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Star className="w-8 h-8 text-primary fill-primary" />
            </div>
            <DialogHeader className="space-y-1 mb-6">
              <DialogTitle className="text-xl font-bold">Enjoying Huduma?</DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm">
                Your feedback helps us improve the experience for everyone
              </DialogDescription>
            </DialogHeader>

            {/* Stars */}
            <div className="flex justify-center gap-2 mb-6">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  onMouseEnter={() => setHoveredStar(s)}
                  onMouseLeave={() => setHoveredStar(0)}
                  onClick={() => handleStarClick(s)}
                  className="transition-transform hover:scale-110 active:scale-95"
                >
                  <Star
                    className={`w-10 h-10 transition-colors ${
                      s <= (hoveredStar || rating)
                        ? "text-yellow-400 fill-yellow-400"
                        : "text-muted-foreground/30"
                    }`}
                  />
                </button>
              ))}
            </div>

            <button
              onClick={handleClose}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Remind me later
            </button>
          </div>
        )}

        {step === "thanks" && (
          <div className="px-6 py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <Star className="w-8 h-8 text-green-500 fill-green-500" />
            </div>
            <DialogHeader className="space-y-1 mb-2">
              <DialogTitle className="text-xl font-bold">Thank You! 🎉</DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm">
                We're glad you love Huduma! Would you mind rating us on the Play Store?
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3 mt-6">
              <Button className="w-full rounded-xl gap-2" onClick={handlePlayStoreRedirect}>
                <ExternalLink className="w-4 h-4" /> Rate on Play Store
              </Button>
              <button
                onClick={handleClose}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Maybe later
              </button>
            </div>
          </div>
        )}

        {step === "feedback" && (
          <div className="px-6 py-8">
            <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-8 h-8 text-orange-500" />
            </div>
            <DialogHeader className="space-y-1 mb-4 text-center">
              <DialogTitle className="text-xl font-bold">What can we improve?</DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm">
                Your feedback is valuable — help us make Huduma better
              </DialogDescription>
            </DialogHeader>

            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Tell us what we can do better..."
              className="min-h-[100px] rounded-xl resize-none mb-4"
              maxLength={500}
            />

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={handleClose}
              >
                Skip
              </Button>
              <Button
                className="flex-1 rounded-xl gap-2"
                onClick={handleFeedbackSubmit}
                disabled={submitting || !feedback.trim()}
              >
                <Send className="w-4 h-4" /> Submit
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
