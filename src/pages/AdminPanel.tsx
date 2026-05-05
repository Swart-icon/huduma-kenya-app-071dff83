import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Shield, Users, Briefcase, AlertTriangle, DollarSign,
  BarChart3, Ban, Clock, CheckCircle, XCircle, UserPlus, Trash2,
  Eye, Search, Loader2, TrendingUp, Activity, Megaphone,
} from "lucide-react";
import AnalyticsDashboard from "@/components/admin/AnalyticsDashboard";
import BroadcastTab from "@/components/admin/BroadcastTab";

/* ─── Analytics (extracted to separate component) ─── */

/* ─── Users Management ─── */
type RoleFilter = "all" | "provider" | "client" | "job_seeker";

const UsersTab = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<Record<string, string[]>>({});
  const [suspensions, setSuspensions] = useState<Record<string, any>>({});
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    setLoading(true);
    const [profR, rolesR, susR] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("*"),
      supabase.from("user_suspensions").select("*").eq("is_active", true),
    ]);
    setProfiles(profR.data || []);
    const roleMap: Record<string, string[]> = {};
    (rolesR.data || []).forEach((r: any) => {
      if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
      roleMap[r.user_id].push(r.role);
    });
    setRoles(roleMap);
    const susMap: Record<string, any> = {};
    (susR.data || []).forEach((s: any) => { susMap[s.user_id] = s; });
    setSuspensions(susMap);
    setLoading(false);
  };

  const handleSuspend = async (userId: string, type: "temporary" | "permanent") => {
    if (!user) return;
    const { error } = await supabase.from("user_suspensions").insert({
      user_id: userId, suspended_by: user.id, reason: "Admin action", suspension_type: type,
      suspended_until: type === "temporary" ? new Date(Date.now() + 7 * 86400000).toISOString() : null,
    });
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { toast({ title: type === "permanent" ? "User banned" : "Suspended 7 days" }); loadUsers(); }
  };

  const handleLift = async (userId: string) => {
    const sus = suspensions[userId];
    if (!sus) return;
    const { error } = await supabase.from("user_suspensions").update({ is_active: false }).eq("id", sus.id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Suspension lifted" }); loadUsers(); }
  };

  const filtered = profiles.filter((p) => {
    const matchesSearch = !search || (p.full_name || "").toLowerCase().includes(search.toLowerCase()) || p.user_id.includes(search);
    const userRoles = roles[p.user_id] || [];
    const matchesRole = roleFilter === "all" || userRoles.includes(roleFilter);
    return matchesSearch && matchesRole;
  });

  const roleCounts = {
    all: profiles.length,
    provider: profiles.filter(p => (roles[p.user_id] || []).includes("provider")).length,
    client: profiles.filter(p => (roles[p.user_id] || []).includes("client")).length,
    job_seeker: profiles.filter(p => (roles[p.user_id] || []).includes("job_seeker")).length,
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-3">
      {/* Role filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {([
          { key: "all", label: "All", icon: Users },
          { key: "provider", label: "Providers", icon: Briefcase },
          { key: "client", label: "Clients", icon: Users },
          { key: "job_seeker", label: "Job Seekers", icon: Search },
        ] as const).map(({ key, label, icon: Icon }) => (
          <Button
            key={key}
            size="sm"
            variant={roleFilter === key ? "default" : "outline"}
            className="text-xs h-8 rounded-full whitespace-nowrap"
            onClick={() => setRoleFilter(key)}
          >
            <Icon className="w-3 h-3 mr-1" />
            {label} ({roleCounts[key]})
          </Button>
        ))}
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..." className="h-9 pl-9 rounded-lg text-sm" />
      </div>
      <p className="text-xs text-muted-foreground">{filtered.length} users</p>
      {filtered.map((p) => {
        const userRoles = roles[p.user_id] || [];
        const isSus = !!suspensions[p.user_id];
        return (
          <Card key={p.id}>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{p.full_name || "No name"}</p>
                  <p className="text-[11px] text-muted-foreground">{p.phone || p.user_id.slice(0, 12) + "..."}</p>
                </div>
                {isSus && <Badge variant="destructive" className="text-[10px]">Suspended</Badge>}
              </div>
              <div className="flex flex-wrap gap-1">
                {userRoles.map((r) => (
                  <Badge key={r} variant="outline" className="text-[10px] capitalize">{r}</Badge>
                ))}
              </div>
              <div className="flex gap-2 flex-wrap">
                {isSus ? (
                  <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleLift(p.user_id)}>Lift Ban</Button>
                ) : (
                  <>
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleSuspend(p.user_id, "temporary")}>
                      <Clock className="w-3 h-3 mr-1" />7d
                    </Button>
                    <Button size="sm" variant="destructive" className="text-xs h-7" onClick={() => handleSuspend(p.user_id, "permanent")}>
                      <Ban className="w-3 h-3 mr-1" />Ban
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

/* ─── Services Management ─── */
const ServicesTab = () => {
  const { toast } = useToast();
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => { loadServices(); }, []);

  const loadServices = async () => {
    setLoading(true);
    const { data } = await supabase.from("services").select("*").order("created_at", { ascending: false });
    setServices(data || []);
    setLoading(false);
  };

  const handleToggle = async (id: string, currentActive: boolean) => {
    const { error } = await supabase.from("services").update({ is_active: !currentActive }).eq("id", id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { toast({ title: currentActive ? "Service deactivated" : "Service activated" }); loadServices(); }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Service removed" }); loadServices(); }
  };

  const filtered = services.filter((s) =>
    !search || s.title.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search services..." className="h-9 pl-9 rounded-lg text-sm" />
      </div>
      <p className="text-xs text-muted-foreground">{filtered.length} services</p>
      {filtered.map((svc) => (
        <Card key={svc.id}>
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">{svc.title}</p>
              <Badge variant={svc.is_active ? "default" : "secondary"} className="text-[10px]">
                {svc.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
            {svc.price && (
              <p className="text-xs text-muted-foreground">KSh {Number(svc.price).toLocaleString()} • {svc.price_type}</p>
            )}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleToggle(svc.id, svc.is_active)}>
                {svc.is_active ? "Deactivate" : "Activate"}
              </Button>
              <Button size="sm" variant="destructive" className="text-xs h-7" onClick={() => handleDelete(svc.id)}>
                <Trash2 className="w-3 h-3 mr-1" />Remove
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

/* ─── Reports ─── */
const ReportsTab = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadReports(); }, []);

  const loadReports = async () => {
    setLoading(true);
    const { data } = await supabase.from("user_reports").select("*").order("created_at", { ascending: false });
    setReports(data || []);
    setLoading(false);
  };

  const handleResolve = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from("user_reports")
      .update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_by: user.id })
      .eq("id", id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Report resolved" }); loadReports(); }
  };

  const handleSuspendFromReport = async (userId: string, type: "temporary" | "permanent") => {
    if (!user) return;
    await supabase.from("user_suspensions").insert({
      user_id: userId, suspended_by: user.id, reason: "Report action", suspension_type: type,
      suspended_until: type === "temporary" ? new Date(Date.now() + 7 * 86400000).toISOString() : null,
    });
    toast({ title: type === "permanent" ? "User banned" : "Suspended 7 days" });
    loadReports();
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const pending = reports.filter((r) => r.status === "pending");
  const resolved = reports.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-destructive">{pending.length} pending</p>
      {pending.map((r) => (
        <Card key={r.id} className="border-destructive/30">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground capitalize">{r.reason.replace(/_/g, " ")}</p>
              <span className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
            </div>
            {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
            <p className="text-[10px] text-muted-foreground">Reported: {r.reported_user_id.slice(0, 10)}...</p>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleResolve(r.id)}>Resolve</Button>
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleSuspendFromReport(r.reported_user_id, "temporary")}>
                <Clock className="w-3 h-3 mr-1" />7d
              </Button>
              <Button size="sm" variant="destructive" className="text-xs h-7" onClick={() => handleSuspendFromReport(r.reported_user_id, "permanent")}>
                <Ban className="w-3 h-3 mr-1" />Ban
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
      {resolved.length > 0 && (
        <>
          <p className="text-xs font-medium text-muted-foreground pt-2">Resolved ({resolved.length})</p>
          {resolved.slice(0, 10).map((r) => (
            <Card key={r.id}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground capitalize">{r.reason.replace(/_/g, " ")}</p>
                  <Badge variant="secondary" className="text-[10px]">Resolved</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </div>
  );
};

/* ─── Verification ─── */
const VerifyTab = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [verifications, setVerifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("provider_verifications").select("*").order("created_at", { ascending: false });
    setVerifications(data || []);
    setLoading(false);
  };

  const handle = async (id: string, status: "approved" | "rejected", userId: string) => {
    if (!user) return;
    const { error } = await supabase.from("provider_verifications")
      .update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString(), admin_notes: `${status} by admin` })
      .eq("id", id);
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    if (status === "approved") {
      await supabase.from("provider_profiles").update({ is_verified: true }).eq("user_id", userId);
    }
    toast({ title: status === "approved" ? "Provider verified ✅" : "Rejected" });
    load();
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const pending = verifications.filter((v) => v.status === "pending");

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-muted-foreground">{pending.length} pending</p>
      {verifications.map((v) => (
        <Card key={v.id}>
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Badge variant={v.status === "pending" ? "secondary" : v.status === "approved" ? "default" : "destructive"} className="text-[10px]">
                {v.status}
              </Badge>
              <span className="text-[10px] text-muted-foreground">{new Date(v.created_at).toLocaleDateString()}</span>
            </div>
            <p className="text-sm font-medium text-foreground capitalize">{v.document_type.replace(/_/g, " ")}</p>
            <a href={v.document_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">View Document</a>
            {v.status === "pending" && (
              <div className="flex gap-2">
                <Button size="sm" className="text-xs h-7 flex-1" onClick={() => handle(v.id, "approved", v.user_id)}>
                  <CheckCircle className="w-3 h-3 mr-1" />Approve
                </Button>
                <Button size="sm" variant="destructive" className="text-xs h-7 flex-1" onClick={() => handle(v.id, "rejected", v.user_id)}>
                  <XCircle className="w-3 h-3 mr-1" />Reject
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

/* ─── Transactions ─── */
const TransactionsTab = () => {
  const [txs, setTxs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "success" | "pending" | "failed">("all");
  const [providerFilter, setProviderFilter] = useState<"all" | "mpesa" | "paystack">("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    let query = supabase
      .from("mpesa_transactions")
      .select("id, amount_kes, status, purpose, external_reference, mpesa_receipt, phone_number, result_desc, created_at, user_id, provider, payment_channel, paystack_reference, email")
      .order("created_at", { ascending: false })
      .limit(300);
    if (filter !== "all") query = query.eq("status", filter);
    if (providerFilter !== "all") query = query.eq("provider", providerFilter);
    const { data } = await query;
    setTxs(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter, providerFilter]);

  const filtered = search.trim()
    ? txs.filter((t) => {
        const q = search.toLowerCase();
        return (
          (t.mpesa_receipt || "").toLowerCase().includes(q) ||
          (t.phone_number || "").toLowerCase().includes(q) ||
          (t.email || "").toLowerCase().includes(q) ||
          (t.external_reference || "").toLowerCase().includes(q) ||
          (t.paystack_reference || "").toLowerCase().includes(q)
        );
      })
    : txs;

  const totals = txs.reduce(
    (acc, t) => {
      acc.count += 1;
      if (t.status === "success") acc.revenue += Number(t.amount_kes || 0);
      return acc;
    },
    { count: 0, revenue: 0 }
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Card><CardContent className="p-3"><p className="text-[10px] text-muted-foreground">Records</p><p className="font-bold">{totals.count}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-[10px] text-muted-foreground">Verified Revenue</p><p className="font-bold">KSh {totals.revenue.toLocaleString()}</p></CardContent></Card>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {(["all", "success", "pending", "failed"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"}
            className="h-8 text-xs capitalize rounded-full" onClick={() => setFilter(f)}>
            {f}
          </Button>
        ))}
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {(["all", "mpesa", "paystack"] as const).map((p) => (
          <Button key={p} size="sm" variant={providerFilter === p ? "default" : "outline"}
            className="h-8 text-xs capitalize rounded-full" onClick={() => setProviderFilter(p)}>
            {p === "mpesa" ? "M-Pesa" : p === "paystack" ? "Paystack" : "All providers"}
          </Button>
        ))}
      </div>

      <Input
        placeholder="Search receipt, phone, email or reference…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-9 text-sm"
      />

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground text-sm py-8">No transactions</p>
      ) : (
        filtered.map((p) => (
          <Card key={p.id}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-foreground">KSh {Number(p.amount_kes).toLocaleString()}</span>
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {p.provider === "paystack" ? "Paystack" : "M-Pesa"}
                  </Badge>
                  <Badge variant={p.status === "success" ? "default" : p.status === "pending" ? "secondary" : "destructive"} className="text-[10px] capitalize">
                    {p.status}
                  </Badge>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {(p.purpose || p.external_reference || "payment")} • {p.phone_number || p.email || "—"} • {new Date(p.created_at).toLocaleString()}
              </p>
              {p.mpesa_receipt && <p className="text-[10px] font-mono text-muted-foreground mt-0.5">Ref: {p.mpesa_receipt}</p>}
              {p.payment_channel && <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">Channel: {p.payment_channel}</p>}
              {p.status === "failed" && p.result_desc && (
                <p className="text-[10px] text-destructive mt-0.5 line-clamp-2">{p.result_desc}</p>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};

/* ─── Admin Management ─── */
const AdminsTab = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [admins, setAdmins] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [newEmail, setNewEmail] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase.from("user_roles").select("*").eq("role", "admin");
    setAdmins(data || []);
    // Fetch names
    const ids = (data || []).map((a: any) => a.user_id);
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id,full_name").in("user_id", ids);
      const map: Record<string, string> = {};
      (profs || []).forEach((p: any) => { map[p.user_id] = p.full_name || "Unknown"; });
      setProfiles(map);
    }
  };

  const handleAdd = async () => {
    if (!newEmail.trim()) return;
    setAdding(true);
    const { data, error } = await supabase.functions.invoke("add-admin", { body: { email: newEmail.trim() } });
    setAdding(false);
    if (error || data?.error) {
      toast({ title: "Failed", description: data?.error || error?.message, variant: "destructive" });
    } else {
      toast({ title: "Admin added!" }); setNewEmail(""); load();
    }
  };

  const handleRemove = async (roleId: string, userId: string) => {
    if (userId === user?.id) { toast({ title: "Cannot remove yourself", variant: "destructive" }); return; }
    const { error } = await supabase.from("user_roles").delete().eq("id", roleId);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Admin removed" }); load(); }
  };

  return (
    <div className="space-y-3">
      {admins.map((a) => (
        <Card key={a.id}>
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{profiles[a.user_id] || "Loading..."}</p>
              <p className="text-[10px] text-muted-foreground">{a.user_id === user?.id ? "You" : a.user_id.slice(0, 12) + "..."}</p>
            </div>
            {a.user_id !== user?.id && (
              <Button size="sm" variant="ghost" className="text-xs h-7 text-destructive" onClick={() => handleRemove(a.id, a.user_id)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
      <div className="flex gap-2">
        <Input placeholder="User email..." value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="h-9 rounded-lg text-sm" />
        <Button size="sm" className="h-9 rounded-lg px-3" onClick={handleAdd} disabled={adding}>
          <UserPlus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

/* ─── Main Admin Panel ─── */
const AdminPanel = () => {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate("/dashboard");
  }, [loading, user, isAdmin, navigate]);

  if (loading || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background border-b border-border px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-muted-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Shield className="w-5 h-5 text-destructive" />
          <h1 className="font-display text-lg font-bold text-foreground">Admin Panel</h1>
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="max-w-lg mx-auto">
          <Tabs defaultValue="analytics">
            <TabsList className="w-full mb-4 flex-wrap h-auto gap-1 p-1">
              <TabsTrigger value="analytics" className="text-xs flex-1">
                <BarChart3 className="w-3 h-3 mr-1" />Stats
              </TabsTrigger>
              <TabsTrigger value="users" className="text-xs flex-1">
                <Users className="w-3 h-3 mr-1" />Users
              </TabsTrigger>
              <TabsTrigger value="services" className="text-xs flex-1">
                <Briefcase className="w-3 h-3 mr-1" />Services
              </TabsTrigger>
              <TabsTrigger value="reports" className="text-xs flex-1">
                <AlertTriangle className="w-3 h-3 mr-1" />Reports
              </TabsTrigger>
              <TabsTrigger value="verify" className="text-xs flex-1">
                <CheckCircle className="w-3 h-3 mr-1" />Verify
              </TabsTrigger>
              <TabsTrigger value="transactions" className="text-xs flex-1">
                <DollarSign className="w-3 h-3 mr-1" />Txns
              </TabsTrigger>
              <TabsTrigger value="admins" className="text-xs flex-1">
                <Shield className="w-3 h-3 mr-1" />Admins
              </TabsTrigger>
              <TabsTrigger value="broadcast" className="text-xs flex-1">
                <Megaphone className="w-3 h-3 mr-1" />Broadcast
              </TabsTrigger>
            </TabsList>

            <TabsContent value="analytics"><AnalyticsDashboard /></TabsContent>
            <TabsContent value="users"><UsersTab /></TabsContent>
            <TabsContent value="services"><ServicesTab /></TabsContent>
            <TabsContent value="reports"><ReportsTab /></TabsContent>
            <TabsContent value="verify"><VerifyTab /></TabsContent>
            <TabsContent value="transactions"><TransactionsTab /></TabsContent>
            <TabsContent value="admins"><AdminsTab /></TabsContent>
            <TabsContent value="broadcast"><BroadcastTab /></TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
