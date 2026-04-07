import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowLeft,
  Search,
  MessageCircle,
  Mail,
  HelpCircle,
  CreditCard,
  Briefcase,
  Calendar,
  TrendingUp,
  Video,
  ShieldCheck,
  User,
} from "lucide-react";

const faqCategories = [
  {
    id: "booking",
    icon: Calendar,
    title: "Booking Services",
    faqs: [
      {
        q: "How do I book a service?",
        a: "Browse or search for a service, tap on it to view details, then tap 'Book Now'. Choose your preferred date, add any notes, and confirm your booking.",
      },
      {
        q: "Can I cancel a booking?",
        a: "Yes. Go to 'My Bookings', find the booking you want to cancel, and tap the cancel option. Please note that cancellation policies may vary by provider.",
      },
      {
        q: "How do I contact my service provider?",
        a: "After booking, a chat conversation is automatically created. Go to 'Messages' to communicate directly with your provider.",
      },
    ],
  },
  {
    id: "jobs",
    icon: Briefcase,
    title: "Jobs & Hiring",
    faqs: [
      {
        q: "How do I post a job?",
        a: "From your dashboard, tap 'Post a Job'. Fill in the job title, description, category, budget, and location, then submit. Providers and job seekers can then apply.",
      },
      {
        q: "How do I apply for a job?",
        a: "Browse the Job Board, tap on a job that interests you, and tap 'Apply'. Add a cover message explaining why you're a good fit.",
      },
      {
        q: "How do I manage applications?",
        a: "Go to 'My Jobs' to see all applications for your posted jobs. You can accept, reject, or message applicants directly.",
      },
    ],
  },
  {
    id: "payments",
    icon: CreditCard,
    title: "Payments",
    faqs: [
      {
        q: "How do payments work?",
        a: "After a service is completed, you can make a payment through M-Pesa. Go to your booking, tap 'Pay', enter the amount, and complete the M-Pesa transaction.",
      },
      {
        q: "Is my payment secure?",
        a: "Yes. All payments are processed through trusted payment channels. We never store your M-Pesa PIN or sensitive financial details.",
      },
      {
        q: "Can I get a refund?",
        a: "Refund policies depend on the service provider. Contact the provider through chat first. If unresolved, reach out to our support team.",
      },
    ],
  },
  {
    id: "boost",
    icon: TrendingUp,
    title: "Status & Boost",
    faqs: [
      {
        q: "How do I boost my status?",
        a: "Post a story/status, then tap the 'Boost' button. Choose between Moderate (KES 50, 6 hours) or Premium (KES 100, 12 hours) boost tiers and complete payment.",
      },
      {
        q: "What does boosting do?",
        a: "Boosting puts your status at the top of the story bar with a special highlight, increasing visibility to potential clients in your area.",
      },
      {
        q: "How long does a boost last?",
        a: "Moderate boosts last 6 hours and Premium boosts last 12 hours from the time of payment confirmation.",
      },
    ],
  },
  {
    id: "videos",
    icon: Video,
    title: "Videos",
    faqs: [
      {
        q: "How do I upload a video?",
        a: "Go to the Videos section and tap the upload button. Select a video from your device (max 1GB), add a caption and category, then upload.",
      },
      {
        q: "Who can upload videos?",
        a: "Service providers and job seekers can upload videos to showcase their work and skills. Clients can view but not upload videos.",
      },
    ],
  },
  {
    id: "account",
    icon: User,
    title: "Account & Security",
    faqs: [
      {
        q: "How do I edit my profile?",
        a: "Tap the profile icon on your dashboard, then tap 'Edit Profile'. Update your details and save changes.",
      },
      {
        q: "How do I change my password?",
        a: "Go to the login screen and tap 'Forgot Password'. Enter your email to receive a password reset link.",
      },
      {
        q: "How do I switch between roles?",
        a: "If you have multiple roles (e.g., Provider and Client), use the role switcher on your dashboard to toggle between them.",
      },
    ],
  },
];

const HelpCenter = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? faqCategories
        .map((cat) => ({
          ...cat,
          faqs: cat.faqs.filter(
            (f) =>
              f.q.toLowerCase().includes(search.toLowerCase()) ||
              f.a.toLowerCase().includes(search.toLowerCase())
          ),
        }))
        .filter((cat) => cat.faqs.length > 0)
    : faqCategories;

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="flex items-center gap-3 px-4 py-3 max-w-lg mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-xl h-9 w-9">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-display font-bold text-lg text-foreground">Help Center</h1>
            <p className="text-xs text-muted-foreground">Find answers & get support</p>
          </div>
        </div>
      </div>

      <div className="px-4 max-w-lg mx-auto pt-4 space-y-5">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search help topics..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 rounded-xl"
          />
        </div>

        {/* FAQ Categories */}
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <HelpCircle className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No results found</p>
            <p className="text-xs text-muted-foreground mt-1">Try different keywords or contact support below</p>
          </div>
        ) : (
          filtered.map((cat) => {
            const Icon = cat.icon;
            return (
              <div key={cat.id}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <h2 className="font-display font-bold text-sm text-foreground">{cat.title}</h2>
                </div>
                <Accordion type="single" collapsible className="space-y-1">
                  {cat.faqs.map((faq, i) => (
                    <AccordionItem
                      key={i}
                      value={`${cat.id}-${i}`}
                      className="border rounded-xl px-3 bg-card"
                    >
                      <AccordionTrigger className="text-sm font-medium text-foreground py-3 hover:no-underline">
                        {faq.q}
                      </AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground pb-3 leading-relaxed">
                        {faq.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            );
          })
        )}

        {/* Contact Support */}
        <div className="pt-2">
          <h2 className="font-display font-bold text-sm text-foreground mb-3">Still need help?</h2>
          <div className="grid grid-cols-2 gap-3">
            <Card
              className="border-0 shadow-sm rounded-2xl cursor-pointer card-hover"
              onClick={() => navigate("/conversations")}
            >
              <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-primary" />
                </div>
                <span className="text-xs font-bold text-foreground">Chat Support</span>
                <span className="text-[10px] text-muted-foreground">Message us directly</span>
              </CardContent>
            </Card>
            <Card
              className="border-0 shadow-sm rounded-2xl cursor-pointer card-hover"
              onClick={() => window.open("mailto:support@hudumahub.ke", "_blank")}
            >
              <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
                <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-accent-foreground" />
                </div>
                <span className="text-xs font-bold text-foreground">Email Support</span>
                <span className="text-[10px] text-muted-foreground">support@hudumahub.ke</span>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpCenter;
