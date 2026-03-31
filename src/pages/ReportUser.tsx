import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, AlertTriangle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const reasons = [
  { value: "spam", label: "Spam or fake account" },
  { value: "harassment", label: "Harassment or abuse" },
  { value: "fraud", label: "Fraud or scam" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "other", label: "Other" },
];

const ReportUser = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedReason, setSelectedReason] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason) {
      toast({ title: "Please select a reason", variant: "destructive" });
      return;
    }
    if (!user || !userId) return;

    setSubmitting(true);
    const { error } = await supabase.from("user_reports").insert({
      reporter_id: user.id,
      reported_user_id: userId,
      reason: selectedReason,
      description: description.trim() || null,
    });
    setSubmitting(false);

    if (error) {
      toast({ title: "Failed to submit report", description: error.message, variant: "destructive" });
    } else {
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background px-6 py-8">
        <div className="max-w-sm mx-auto flex flex-col items-center justify-center min-h-[70vh] text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <CheckCircle className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">Report submitted</h1>
          <p className="text-muted-foreground mb-8">Thank you. We'll review this report and take appropriate action.</p>
          <Button onClick={() => navigate(-1)} className="w-full h-14 text-lg font-bold rounded-xl" size="lg">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-6 py-8">
      <div className="max-w-sm mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground mb-6">
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Report User</h1>
            <p className="text-sm text-muted-foreground">Help us keep the community safe</p>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <Label className="text-sm font-semibold">Reason for report</Label>
          {reasons.map((r) => (
            <Card
              key={r.value}
              className={`cursor-pointer transition-all ${
                selectedReason === r.value ? "ring-2 ring-primary border-primary" : "hover:border-primary/50"
              }`}
              onClick={() => setSelectedReason(r.value)}
            >
              <CardContent className="p-4">
                <span className="font-medium text-foreground">{r.label}</span>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mb-6">
          <Label htmlFor="description" className="text-sm font-semibold">Additional details (optional)</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the issue..."
            className="mt-1.5 rounded-xl"
            rows={4}
            maxLength={1000}
          />
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!selectedReason || submitting}
          className="w-full h-14 text-lg font-bold rounded-xl"
          size="lg"
        >
          {submitting ? "Submitting..." : "Submit Report"}
        </Button>
      </div>
    </div>
  );
};

export default ReportUser;
