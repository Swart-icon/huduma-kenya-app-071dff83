import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Receipt, RefreshCw, Crown, Zap, Briefcase } from "lucide-react";

type Tx = {
  id: string;
  amount_kes: number;
  status: string;
  purpose: string | null;
  external_reference: string | null;
  mpesa_receipt: string | null;
  result_desc: string | null;
  phone_number: string | null;
  created_at: string;
  provider?: string | null;
  payment_channel?: string | null;
  paystack_reference?: string | null;
  currency?: string | null;
};

const statusVariant = (s: string): "default" | "secondary" | "destructive" => {
  if (s === "success") return "default";
  if (s === "pending" || s === "initiated") return "secondary";
  return "destructive";
};

const purposeLabel = (p: string | null, ref: string | null) => {
  const v = p ?? (ref?.startsWith("boost_") || ref?.startsWith("ps_boost") ? "status_boost" :
    (ref?.startsWith("sub_") || ref?.startsWith("ps_sub")) ? "subscription" : "payment");
  if (v === "provider_subscription") return { label: "Provider Premium", icon: Crown };
  if (v === "job_seeker_subscription") return { label: "Job Seeker Premium", icon: Briefcase };
  if (v === "status_boost") return { label: "Status Boost", icon: Zap };
  return { label: "Payment", icon: Receipt };
};

const providerLabel = (p?: string | null) =>
  p === "paystack" ? "Paystack" : "M-Pesa";

const PaymentHistory = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    if (!user) return;
    setRefreshing(true);
    const { data } = await supabase
      .from("mpesa_transactions")
      .select("id, amount_kes, status, purpose, external_reference, mpesa_receipt, result_desc, phone_number, created_at, provider, payment_channel, paystack_reference, currency")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    setTxs((data as Tx[]) || []);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    if (!authLoading && !user) { navigate("/welcome"); return; }
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-5 py-6 pb-24">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground">
            <ArrowLeft className="w-5 h-5" /> <span>Back</span>
          </button>
          <Button variant="ghost" size="sm" onClick={load} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <h1 className="font-display text-2xl font-bold text-foreground mb-1">Payment History</h1>
        <p className="text-sm text-muted-foreground mb-6">All your M-Pesa transactions, verified by our backend.</p>

        {txs.length === 0 ? (
          <div className="text-center py-16">
            <Receipt className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">No payments yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {txs.map((tx) => {
              const { label, icon: Icon } = purposeLabel(tx.purpose, tx.external_reference);
              return (
                <Card key={tx.id} className="rounded-2xl">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <Icon className="w-5 h-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">{label}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(tx.created_at).toLocaleString()}
                          </p>
                          {tx.mpesa_receipt && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Receipt: <span className="font-mono">{tx.mpesa_receipt}</span>
                            </p>
                          )}
                          {tx.status === "failed" && tx.result_desc && (
                            <p className="text-xs text-destructive mt-0.5 line-clamp-2">{tx.result_desc}</p>
                          )}
                          {tx.status === "pending" && (
                            <p className="text-xs text-muted-foreground mt-0.5">Awaiting M-Pesa confirmation…</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-foreground">KSh {Number(tx.amount_kes).toLocaleString()}</p>
                        <Badge variant={statusVariant(tx.status)} className="text-[10px] mt-1 capitalize">
                          {tx.status}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentHistory;
