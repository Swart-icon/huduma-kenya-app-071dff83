import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Briefcase, Video, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const slides = [
  {
    icon: MapPin,
    title: "Find Services",
    subtitle: "Discover trusted professionals near you",
    color: "text-primary",
  },
  {
    icon: Briefcase,
    title: "Hire or Get Hired",
    subtitle: "Post jobs or apply as a skilled professional",
    color: "text-accent",
  },
  {
    icon: Video,
    title: "Share Your Work",
    subtitle: "Post videos and stories to showcase your skills",
    color: "text-secondary",
  },
  {
    icon: ShieldCheck,
    title: "Secure Payments",
    subtitle: "Book and pay with confidence",
    color: "text-primary",
  },
];

const Onboarding = () => {
  const [current, setCurrent] = useState(0);
  const navigate = useNavigate();
  const touchStart = useRef(0);
  const touchEnd = useRef(0);

  const complete = useCallback(() => {
    localStorage.setItem("servio-onboarded", "true");
    navigate("/welcome", { replace: true });
  }, [navigate]);

  const next = () => {
    if (current < slides.length - 1) setCurrent(current + 1);
    else complete();
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = e.targetTouches[0].clientX;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    touchEnd.current = e.targetTouches[0].clientX;
  };
  const onTouchEnd = () => {
    const diff = touchStart.current - touchEnd.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && current < slides.length - 1) setCurrent(current + 1);
      if (diff < 0 && current > 0) setCurrent(current - 1);
    }
  };

  const slide = slides[current];
  const Icon = slide.icon;
  const isLast = current === slides.length - 1;

  return (
    <div
      className="min-h-screen bg-background flex flex-col select-none"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Skip */}
      <div className="flex justify-end p-4">
        {!isLast && (
          <button onClick={complete} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Skip
          </button>
        )}
      </div>

      {/* Slide content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-6">
        <div className={`w-24 h-24 rounded-full bg-muted flex items-center justify-center ${slide.color}`}>
          <Icon className="w-12 h-12" />
        </div>
        <h1 className="text-2xl font-bold text-foreground font-display">{slide.title}</h1>
        <p className="text-muted-foreground text-base max-w-xs">{slide.subtitle}</p>
      </div>

      {/* Dots + button */}
      <div className="pb-12 px-8 flex flex-col items-center gap-6">
        <div className="flex gap-2">
          {slides.map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === current ? "w-8 bg-primary" : "w-2 bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>
        <Button onClick={next} className="w-full max-w-xs h-12 text-base font-semibold">
          {isLast ? "Get Started" : "Next"}
        </Button>
      </div>
    </div>
  );
};

export default Onboarding;
