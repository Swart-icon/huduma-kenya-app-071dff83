import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ShieldAlert, Mail, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const DeleteAccount = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (confirm.trim().toUpperCase() !== "DELETE") {
      toast.error("Please type DELETE to confirm");
      return;
    }
    if (!email) {
      toast.error("Email is required");
      return;
    }
    setSubmitting(true);
    const subject = encodeURIComponent("Account Deletion Request - Servio");
    const body = encodeURIComponent(
      `Account Deletion Request\n\nEmail: ${email}\nPhone: ${phone}\nReason: ${reason || "Not provided"}\n\nI confirm I want my Servio account and all associated data permanently deleted.`
    );
    window.location.href = `mailto:privacy@servioafrica.com?subject=${subject}&body=${body}`;
    setTimeout(() => {
      setSubmitting(false);
      toast.success("Request prepared. Please send the email to complete your request.");
    }, 800);
  };

  return (
    <div className="min-h-screen bg-background px-5 py-6 pb-12">
      <div className="max-w-lg mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground mb-6">
          <ArrowLeft className="w-5 h-5" /> <span>Back</span>
        </button>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-destructive" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">Delete Your Account</h1>
        </div>
        <p className="text-xs text-muted-foreground mb-6">Servio — Account &amp; Data Deletion Request</p>

        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 mb-6 flex gap-3">
          <ShieldAlert className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div className="text-sm text-foreground">
            <p className="font-semibold mb-1">This action is permanent.</p>
            <p className="text-muted-foreground">
              Deleting your account removes your profile, listings, messages, bookings, videos, stories, reviews
              and saved items within 30 days. Some financial records are retained up to 7 years where required by Kenyan law.
            </p>
          </div>
        </div>

        <section className="mb-6 space-y-2">
          <h2 className="font-bold text-foreground">What gets deleted</h2>
          <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
            <li>Profile, photos, business info and verification documents</li>
            <li>Service listings, goods, jobs and applications</li>
            <li>Bookings, messages, voice notes and call history</li>
            <li>Videos, stories, comments, likes and bookmarks</li>
            <li>Notifications, sessions and device tokens</li>
          </ul>
        </section>

        <section className="mb-6 space-y-2">
          <h2 className="font-bold text-foreground">What is retained (and why)</h2>
          <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
            <li>Transaction records (M-Pesa / Paystack) — kept up to 7 years for tax and fraud prevention</li>
            <li>Anonymised analytics that cannot identify you</li>
            <li>Records required by court order or legal obligation</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="font-bold text-foreground mb-2">Option 1 — Delete from the app</h2>
          <p className="text-sm text-muted-foreground">
            Open Servio → <span className="font-semibold">Profile → Settings → Delete Account</span>, then confirm.
          </p>
        </section>

        <section className="mb-4">
          <h2 className="font-bold text-foreground mb-2">Option 2 — Request via this form</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Fill in your details below. We will verify ownership of the email and complete deletion within 30 days.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Account email *</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div>
              <Label htmlFor="phone">Phone number (optional)</Label>
              <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+254 7XX XXX XXX" />
            </div>
            <div>
              <Label htmlFor="reason">Reason (optional)</Label>
              <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Help us improve — why are you leaving?" rows={3} />
            </div>
            <div>
              <Label htmlFor="confirm">Type <span className="font-mono font-bold">DELETE</span> to confirm *</Label>
              <Input id="confirm" required value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="DELETE" />
            </div>
            <Button type="submit" variant="destructive" className="w-full rounded-2xl" disabled={submitting}>
              <Mail className="w-4 h-4 mr-2" />
              {submitting ? "Preparing..." : "Send Deletion Request"}
            </Button>
          </form>
        </section>

        <section className="mb-6 text-sm text-muted-foreground">
          <p>
            Or email us directly at{" "}
            <a href="mailto:privacy@servioafrica.com" className="font-semibold text-foreground underline">
              privacy@servioafrica.com
            </a>{" "}
            with the subject <span className="font-semibold">"Account Deletion"</span>.
          </p>
          <p className="mt-2">
            You may also lodge a complaint with the Office of the Data Protection Commissioner (ODPC) Kenya at{" "}
            <span className="font-semibold">www.odpc.go.ke</span>.
          </p>
        </section>
      </div>
    </div>
  );
};

export default DeleteAccount;
