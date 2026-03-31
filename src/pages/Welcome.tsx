import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Briefcase, Users, Shield } from "lucide-react";

const Welcome = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-primary flex flex-col items-center justify-between px-6 py-12">
      {/* Top decorative pattern */}
      <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-secondary via-accent to-primary" />

      <div className="flex-1 flex flex-col items-center justify-center text-center max-w-sm w-full">
        {/* Logo / Brand */}
        <div className="mb-8 animate-fade-in">
          <div className="w-20 h-20 rounded-2xl bg-primary-foreground/20 flex items-center justify-center mb-6 mx-auto backdrop-blur-sm border border-primary-foreground/10">
            <Shield className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="font-display text-4xl font-bold text-primary-foreground mb-3">
            Huduma
          </h1>
          <p className="text-primary-foreground/80 text-lg font-medium">
            Kenya's Service Marketplace
          </p>
        </div>

        {/* Features */}
        <div className="space-y-4 mb-10 w-full animate-fade-in" style={{ animationDelay: "0.2s" }}>
          <div className="flex items-center gap-4 bg-primary-foreground/10 rounded-xl p-4 backdrop-blur-sm">
            <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center shrink-0">
              <Briefcase className="w-5 h-5 text-accent-foreground" />
            </div>
            <p className="text-primary-foreground/90 text-sm text-left">Find skilled service providers near you</p>
          </div>
          <div className="flex items-center gap-4 bg-primary-foreground/10 rounded-xl p-4 backdrop-blur-sm">
            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-secondary-foreground" />
            </div>
            <p className="text-primary-foreground/90 text-sm text-left">Post jobs and connect with talent</p>
          </div>
        </div>
      </div>

      {/* Bottom CTAs */}
      <div className="w-full max-w-sm space-y-3 animate-fade-in" style={{ animationDelay: "0.4s" }}>
        <Button
          onClick={() => navigate("/register")}
          className="w-full h-14 text-lg font-bold rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg"
          size="lg"
        >
          Get Started
        </Button>
        <Button
          onClick={() => navigate("/login")}
          variant="outline"
          className="w-full h-14 text-lg font-bold rounded-xl border-2 border-primary-foreground/30 text-primary-foreground bg-transparent hover:bg-primary-foreground/10"
          size="lg"
        >
          Sign In
        </Button>
      </div>
    </div>
  );
};

export default Welcome;
