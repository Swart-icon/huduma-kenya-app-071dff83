import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, LogOut, Shield, Smartphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SessionManagement = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOutAllDevices = async () => {
    setSigningOut(true);
    const { error } = await supabase.auth.signOut({ scope: "global" });
    setSigningOut(false);
    if (error) {
      toast({ title: "Failed to sign out", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Signed out from all devices" });
      navigate("/login");
    }
  };

  const handleSignOutCurrent = async () => {
    await signOut();
    navigate("/login");
  };

  const handleChangePassword = () => {
    navigate("/forgot-password");
  };

  return (
    <div className="min-h-screen bg-background px-6 py-8 pb-24">
      <div className="max-w-sm mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground mb-6">
          <ArrowLeft className="w-5 h-5" />
          <span>Profile</span>
        </button>

        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-7 h-7 text-primary" />
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Security</h1>
            <p className="text-sm text-muted-foreground">Manage your sessions & security</p>
          </div>
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Smartphone className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">Current Device</h3>
                  <p className="text-sm text-muted-foreground">This device • Active now</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={handleChangePassword}>
            <CardContent className="p-5">
              <h3 className="font-semibold text-foreground mb-1">Change Password</h3>
              <p className="text-sm text-muted-foreground">Update your password via email reset</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-3">
              <h3 className="font-semibold text-foreground">Sign Out</h3>
              <Button
                variant="outline"
                className="w-full h-12 rounded-xl"
                onClick={handleSignOutCurrent}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign out this device
              </Button>
              <Button
                variant="destructive"
                className="w-full h-12 rounded-xl"
                onClick={handleSignOutAllDevices}
                disabled={signingOut}
              >
                <LogOut className="w-4 h-4 mr-2" />
                {signingOut ? "Signing out..." : "Sign out all devices"}
              </Button>
            </CardContent>
          </Card>

          <div className="pt-4">
            <p className="text-xs text-muted-foreground text-center">
              Logged in as {user?.email}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionManagement;
