import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getActiveMediaFlow, hasActiveMediaUploadFlow, logMobileMediaEvent } from "@/hooks/useMobileMediaLifecycle";

const Index = () => {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (hasActiveMediaUploadFlow()) {
      const flow = getActiveMediaFlow();
      if (flow?.route && flow.route !== "/") {
        logMobileMediaEvent("root-redirect-blocked-active-upload", { sessionKey: flow.sessionKey, to: flow.route });
        navigate(flow.route, { replace: true, state: { restoreUploadSession: flow.sessionKey } });
        return;
      }
    }
    // Always land on the video feed — it's the primary entry point
    navigate("/videos", { replace: true });
  }, [loading, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
};

export default Index;
