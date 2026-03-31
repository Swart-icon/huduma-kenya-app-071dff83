import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import {
  Users,
  Briefcase,
  Activity,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Loader2,
  Calendar,
  BarChart3,
  PieChart as PieIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

/* ─── Types ─── */
type Stats = {
  users: number;
  services: number;
  bookings: number;
  revenue: number;
  pendingReports: number;
  activeProviders: number;
  completedBookings: number;
  pendingBookings: number;
};

type TimeSeriesPoint = { label: string; value: number };
type CategoryStat = { name: string; count: number };

/* ─── Helpers ─── */
const getLast7Days = () => {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split("T")[0]);
  }
  return days;
};

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en", { weekday: "short" });
};

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--secondary))",
  "hsl(var(--destructive))",
  "hsl(142 76% 36%)",
  "hsl(262 83% 58%)",
  "hsl(24 95% 53%)",
  "hsl(199 89% 48%)",
];

/* ─── Stat Card ─── */
const StatCard = ({
  label,
  value,
  icon: Icon,
  trend,
  color = "text-primary",
}: {
  label: string;
  value: string | number;
  icon: any;
  trend?: string;
  color?: string;
}) => (
  <Card className="rounded-2xl border-0 shadow-sm">
    <CardContent className="p-3.5">
      <div className="flex items-center justify-between mb-1.5">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color.replace("text-", "bg-")}/10`}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
        {trend && (
          <Badge variant="secondary" className="text-[9px] px-1.5 h-4 font-mono">
            {trend}
          </Badge>
        )}
      </div>
      <p className="text-lg font-bold text-foreground">{value}</p>
      <p className="text-[10px] text-muted-foreground font-medium">{label}</p>
    </CardContent>
  </Card>
);

/* ─── Chart Configs ─── */
const signupChartConfig: ChartConfig = {
  signups: { label: "Signups", color: "hsl(var(--primary))" },
};
const bookingChartConfig: ChartConfig = {
  bookings: { label: "Bookings", color: "hsl(var(--primary))" },
};
const revenueChartConfig: ChartConfig = {
  revenue: { label: "Revenue (KSh)", color: "hsl(142 76% 36%)" },
};
const categoryChartConfig: ChartConfig = {
  count: { label: "Services", color: "hsl(var(--primary))" },
};

/* ─── Main Component ─── */
const AnalyticsDashboard = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [signupTrend, setSignupTrend] = useState<TimeSeriesPoint[]>([]);
  const [bookingTrend, setBookingTrend] = useState<TimeSeriesPoint[]>([]);
  const [revenueTrend, setRevenueTrend] = useState<TimeSeriesPoint[]>([]);
  const [topCategories, setTopCategories] = useState<CategoryStat[]>([]);
  const [bookingStatuses, setBookingStatuses] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const days = getLast7Days();

    const [
      profilesR,
      servicesR,
      bookingsR,
      paymentsR,
      reportsR,
      providersR,
      allProfiles,
      allBookings,
      allPayments,
      allServices,
      categories,
    ] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("services").select("id", { count: "exact", head: true }),
      supabase.from("bookings").select("id", { count: "exact", head: true }),
      supabase.from("payments").select("amount").eq("status", "completed"),
      supabase.from("user_reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("provider_profiles").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("created_at"),
      supabase.from("bookings").select("created_at, status"),
      supabase.from("payments").select("created_at, amount, status"),
      supabase.from("services").select("category_id"),
      supabase.from("service_categories").select("id, name"),
    ]);

    const revenue = (paymentsR.data || []).reduce((s, p) => s + Number(p.amount), 0);
    const allBookingsData = allBookings.data || [];
    const completedBookings = allBookingsData.filter((b) => b.status === "completed").length;
    const pendingBookings = allBookingsData.filter((b) => b.status === "pending").length;

    setStats({
      users: profilesR.count || 0,
      services: servicesR.count || 0,
      bookings: bookingsR.count || 0,
      revenue,
      pendingReports: reportsR.count || 0,
      activeProviders: providersR.count || 0,
      completedBookings,
      pendingBookings,
    });

    // Signup trend (last 7 days)
    const profileDates = (allProfiles.data || []).map((p) => p.created_at.split("T")[0]);
    setSignupTrend(
      days.map((d) => ({
        label: dayLabel(d),
        value: profileDates.filter((pd) => pd === d).length,
      }))
    );

    // Booking trend
    const bookingDates = allBookingsData.map((b) => b.created_at.split("T")[0]);
    setBookingTrend(
      days.map((d) => ({
        label: dayLabel(d),
        value: bookingDates.filter((bd) => bd === d).length,
      }))
    );

    // Revenue trend
    const completedPayments = (allPayments.data || []).filter((p) => p.status === "completed");
    setRevenueTrend(
      days.map((d) => ({
        label: dayLabel(d),
        value: completedPayments
          .filter((p) => p.created_at.split("T")[0] === d)
          .reduce((s, p) => s + Number(p.amount), 0),
      }))
    );

    // Top categories
    const catMap = new Map<string, string>();
    (categories.data || []).forEach((c) => catMap.set(c.id, c.name));
    const catCount: Record<string, number> = {};
    (allServices.data || []).forEach((s) => {
      const name = catMap.get(s.category_id) || "Other";
      catCount[name] = (catCount[name] || 0) + 1;
    });
    setTopCategories(
      Object.entries(catCount)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6)
    );

    // Booking statuses
    const statusCount: Record<string, number> = {};
    allBookingsData.forEach((b) => {
      statusCount[b.status] = (statusCount[b.status] || 0) + 1;
    });
    setBookingStatuses(
      Object.entries(statusCount).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
      }))
    );

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!stats) return null;

  const conversionRate = stats.bookings > 0 ? ((stats.completedBookings / stats.bookings) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-5">
      {/* ─── Overview Cards ─── */}
      <div className="grid grid-cols-2 gap-2.5">
        <StatCard label="Total Users" value={stats.users} icon={Users} color="text-primary" />
        <StatCard label="Active Services" value={stats.services} icon={Briefcase} color="text-primary" />
        <StatCard label="Total Bookings" value={stats.bookings} icon={Activity} color="text-primary" />
        <StatCard
          label="Revenue"
          value={`KSh ${stats.revenue.toLocaleString()}`}
          icon={DollarSign}
          color="text-primary"
        />
        <StatCard label="Providers" value={stats.activeProviders} icon={TrendingUp} color="text-primary" />
        <StatCard
          label="Conversion Rate"
          value={`${conversionRate}%`}
          icon={BarChart3}
          trend={`${stats.completedBookings}/${stats.bookings}`}
          color="text-primary"
        />
      </div>

      {/* ─── Pending Alerts ─── */}
      {stats.pendingReports > 0 && (
        <Card className="border-destructive/30 bg-destructive/5 rounded-2xl">
          <CardContent className="p-3 flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
            <p className="text-xs font-semibold text-destructive">
              {stats.pendingReports} pending report{stats.pendingReports > 1 ? "s" : ""} need attention
            </p>
          </CardContent>
        </Card>
      )}

      {/* ─── Charts Tabs ─── */}
      <Tabs defaultValue="signups">
        <TabsList className="w-full h-auto flex-wrap gap-1 p-1 mb-3">
          <TabsTrigger value="signups" className="text-[10px] flex-1 gap-1">
            <Users className="w-3 h-3" /> Signups
          </TabsTrigger>
          <TabsTrigger value="bookings" className="text-[10px] flex-1 gap-1">
            <Calendar className="w-3 h-3" /> Bookings
          </TabsTrigger>
          <TabsTrigger value="revenue" className="text-[10px] flex-1 gap-1">
            <DollarSign className="w-3 h-3" /> Revenue
          </TabsTrigger>
          <TabsTrigger value="categories" className="text-[10px] flex-1 gap-1">
            <PieIcon className="w-3 h-3" /> Categories
          </TabsTrigger>
        </TabsList>

        {/* Signups Chart */}
        <TabsContent value="signups">
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardContent className="p-3">
              <p className="text-xs font-bold text-foreground mb-3">User Signups (Last 7 Days)</p>
              <ChartContainer config={signupChartConfig} className="h-[200px] w-full">
                <BarChart data={signupTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" name="signups" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bookings Chart */}
        <TabsContent value="bookings">
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardContent className="p-3">
              <p className="text-xs font-bold text-foreground mb-3">Bookings (Last 7 Days)</p>
              <ChartContainer config={bookingChartConfig} className="h-[200px] w-full">
                <AreaChart data={bookingTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    name="bookings"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>

              {/* Booking status breakdown */}
              {bookingStatuses.length > 0 && (
                <div className="mt-4">
                  <p className="text-[10px] font-semibold text-muted-foreground mb-2">Status Breakdown</p>
                  <div className="flex flex-wrap gap-2">
                    {bookingStatuses.map((s) => (
                      <Badge key={s.name} variant="outline" className="text-[10px] gap-1">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{
                            backgroundColor:
                              s.name === "Completed"
                                ? "hsl(142 76% 36%)"
                                : s.name === "Pending"
                                ? "hsl(var(--primary))"
                                : "hsl(var(--muted-foreground))",
                          }}
                        />
                        {s.name}: {s.value}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Revenue Chart */}
        <TabsContent value="revenue">
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardContent className="p-3">
              <p className="text-xs font-bold text-foreground mb-3">Revenue (Last 7 Days)</p>
              <ChartContainer config={revenueChartConfig} className="h-[200px] w-full">
                <LineChart data={revenueTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    name="revenue"
                    stroke="hsl(142 76% 36%)"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "hsl(142 76% 36%)" }}
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Categories Chart */}
        <TabsContent value="categories">
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardContent className="p-3">
              <p className="text-xs font-bold text-foreground mb-3">Popular Categories</p>
              {topCategories.length > 0 ? (
                <>
                  <ChartContainer config={categoryChartConfig} className="h-[200px] w-full">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                      <Pie
                        data={topCategories}
                        dataKey="count"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={80}
                        paddingAngle={3}
                      >
                        {topCategories.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {topCategories.map((cat, i) => (
                      <Badge key={cat.name} variant="outline" className="text-[10px] gap-1">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: COLORS[i % COLORS.length] }}
                        />
                        {cat.name}: {cat.count}
                      </Badge>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No services yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AnalyticsDashboard;
