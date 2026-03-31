import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Shield, AlertTriangle, Ban, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const AdminPanel = () => {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [reports, setReports] = useState<any[]>([]);
  const [suspensions, setSuspensions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (role !== "admin") {
      navigate("/dashboard");
      return;
    }
    loadData();
  }, [role]);

  const loadData = async () => {
    setLoading(true);
    const [reportsRes, suspensionsRes] = await Promise.all([
      supabase.from("user_reports").select("*").order("created_at", { ascending: false }),
      supabase.from("user_suspensions").select("*").order("created_at", { ascending: false }),
    ]);
    setReports(reportsRes.data || []);
    setSuspensions(suspensionsRes.data || []);
    setLoading(false);
  };

  const handleSuspendUser = async (userId: string, type: "temporary" | "permanent") => {
    if (!user) return;
    const suspendedUntil = type === "temporary"
      ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { error } = await supabase.from("user_suspensions").insert({
      user_id: userId,
      suspended_by: user.id,
      reason: "Admin action",
      suspension_type: type,
      suspended_until: suspendedUntil,
    });

    if (error) {
      toast({ title: "Failed to suspend user", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `User ${type === "permanent" ? "banned" : "suspended"} successfully` });
      loadData();
    }
  };

  const handleResolveReport = async (reportId: string) => {
    if (!user) return;
    const { error } = await supabase.from("user_reports")
      .update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_by: user.id })
      .eq("id", reportId);

    if (error) {
      toast({ title: "Failed to resolve report", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Report resolved" });
      loadData();
    }
  };

  const handleLiftSuspension = async (suspensionId: string) => {
    const { error } = await supabase.from("user_suspensions")
      .update({ is_active: false })
      .eq("id", suspensionId);

    if (error) {
      toast({ title: "Failed to lift suspension", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Suspension lifted" });
      loadData();
    }
  };

  if (role !== "admin") return null;

  return (
    <div className="min-h-screen bg-background px-4 py-6 pb-24">
      <div className="max-w-lg mx-auto">
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2 text-muted-foreground mb-4">
          <ArrowLeft className="w-5 h-5" />
          <span>Dashboard</span>
        </button>

        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-7 h-7 text-primary" />
          <h1 className="font-display text-2xl font-bold text-foreground">Admin Panel</h1>
        </div>

        <Tabs defaultValue="reports">
          <TabsList className="w-full mb-4">
            <TabsTrigger value="reports" className="flex-1">
              Reports ({reports.filter(r => r.status === "pending").length})
            </TabsTrigger>
            <TabsTrigger value="suspensions" className="flex-1">
              Suspensions ({suspensions.filter(s => s.is_active).length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reports" className="space-y-3">
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Loading...</p>
            ) : reports.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No reports yet</p>
            ) : (
              reports.map((report) => (
                <Card key={report.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant={report.status === "pending" ? "destructive" : "secondary"}>
                        {report.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(report.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="font-medium text-foreground capitalize">{report.reason.replace("_", " ")}</p>
                    {report.description && (
                      <p className="text-sm text-muted-foreground">{report.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Reported user: {report.reported_user_id.slice(0, 8)}...
                    </p>
                    {report.status === "pending" && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleResolveReport(report.id)}>
                          Resolve
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleSuspendUser(report.reported_user_id, "temporary")}>
                          <Clock className="w-4 h-4 mr-1" /> Suspend 7d
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleSuspendUser(report.reported_user_id, "permanent")}>
                          <Ban className="w-4 h-4 mr-1" /> Ban
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="suspensions" className="space-y-3">
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Loading...</p>
            ) : suspensions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No suspensions</p>
            ) : (
              suspensions.map((s) => (
                <Card key={s.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant={s.is_active ? "destructive" : "secondary"}>
                        {s.is_active ? (s.suspension_type === "permanent" ? "Banned" : "Suspended") : "Lifted"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(s.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-foreground">{s.reason}</p>
                    <p className="text-xs text-muted-foreground">
                      User: {s.user_id.slice(0, 8)}...
                    </p>
                    {s.suspension_type === "temporary" && s.suspended_until && (
                      <p className="text-xs text-muted-foreground">
                        Until: {new Date(s.suspended_until).toLocaleDateString()}
                      </p>
                    )}
                    {s.is_active && (
                      <Button size="sm" variant="outline" onClick={() => handleLiftSuspension(s.id)}>
                        Lift Suspension
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminPanel;
