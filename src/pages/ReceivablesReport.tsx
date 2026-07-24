import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, MoreHorizontal } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ContactCardDialog from "@/components/ContactCardDialog";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from "recharts";

const PRODUCT_FILTERS = ["All", "Financial Velocity", "Financial Increase LIVE", "Financial Increase Trial"] as const;
type ProductFilter = typeof PRODUCT_FILTERS[number];

function fmt(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  if (key === "Unknown") return "Unknown";
  const [y, m] = key.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
}

// Add `n` months to a Date (UTC), clamping day-of-month if needed.
function addMonths(d: Date, n: number): Date {
  const nd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  const lastDay = new Date(Date.UTC(nd.getUTCFullYear(), nd.getUTCMonth() + 1, 0)).getUTCDate();
  nd.setUTCDate(Math.min(d.getUTCDate(), lastDay));
  return nd;
}

interface Subscription {
  id: string;
  contact_id: string | null;
  contact_name: string;
  amount: number;
  status: string;
  recurring_interval: string | null;
  recurring_interval_count: number;
  recurring_product_name: string | null;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  trial_end_date: string | null;
  is_late: boolean;
  late_since: string | null;
  last_failed_payment_at: string | null;
  resolved_at: string | null;
}

interface ProjectedCharge {
  sub_id: string;
  contact_id: string;
  contact_name: string;
  product: string;
  amount: number;
  due_date: Date;
  status: "collected" | "outstanding"; // collected = past charge of active sub, outstanding = future
}

export default function ReceivablesReport() {
  const queryClient = useQueryClient();
  const [productFilter, setProductFilter] = useState<ProductFilter>("All");

  const resolveLate = useMutation({
    mutationFn: async (subId: string) => {
      const { error } = await supabase
        .from("highlevel_subscriptions")
        .update({ is_late: false, late_since: null, resolved_at: new Date().toISOString() })
        .eq("id", subId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receivables-subscriptions"] });
      toast.success("Marked as resolved");
    },
    onError: (e: Error) => toast.error(`Failed to mark resolved: ${e.message}`),
  });

  const { data: allSubscriptions = [], isLoading } = useQuery({
    queryKey: ["receivables-subscriptions"],
    queryFn: async () => {
      // No status filter here — we need canceled subs visible in the Late
      // Payment ledger as resolved history. The projection logic below
      // skips non-active/trialing rows so they don't pollute the chart.
      const { data, error } = await supabase
        .from("highlevel_subscriptions")
        .select("id, contact_id, contact_name, amount, status, recurring_interval, recurring_interval_count, recurring_product_name, subscription_start_date, subscription_end_date, trial_end_date, is_late, late_since, last_failed_payment_at, resolved_at")
        .order("subscription_start_date", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id,
        contact_id: r.contact_id,
        contact_name: r.contact_name ?? "Unknown",
        amount: Number(r.amount ?? 0),
        status: r.status,
        recurring_interval: r.recurring_interval,
        recurring_interval_count: r.recurring_interval_count ?? 1,
        recurring_product_name: r.recurring_product_name,
        subscription_start_date: r.subscription_start_date,
        subscription_end_date: r.subscription_end_date,
        trial_end_date: r.trial_end_date,
        is_late: !!r.is_late,
        late_since: r.late_since,
        last_failed_payment_at: r.last_failed_payment_at,
        resolved_at: r.resolved_at,
      })) as Subscription[];
    },
  });

  const subscriptions = useMemo(
    () => productFilter === "All"
      ? allSubscriptions
      : allSubscriptions.filter((s) => s.recurring_product_name === productFilter),
    [allSubscriptions, productFilter]
  );

  // Projection horizon for subs without an end_date: 12 months forward.
  // For subs with end_date, project until end_date.
  const PROJECTION_HORIZON_MONTHS = 12;

  const charges = useMemo<ProjectedCharge[]>(() => {
    const now = new Date();
    const out: ProjectedCharge[] = [];

    for (const sub of subscriptions) {
      // Project only live subs; canceled/expired won't bill again.
      if (sub.status !== "active" && sub.status !== "trialing") continue;
      if (!sub.subscription_start_date) continue;
      if (!sub.amount || sub.amount <= 0) continue;
      if (sub.recurring_interval !== "month") continue; // only monthly handled for now
      const intervalCount = sub.recurring_interval_count || 1;

      const start = new Date(sub.subscription_start_date);
      const end = sub.subscription_end_date
        ? new Date(sub.subscription_end_date)
        : addMonths(now, PROJECTION_HORIZON_MONTHS);

      // For trialing subs, first real charge is at trial_end_date (no charge during trial)
      const firstChargeDate = sub.status === "trialing" && sub.trial_end_date
        ? new Date(sub.trial_end_date)
        : start;

      let cursor = new Date(firstChargeDate);
      let safety = 0;
      while (cursor <= end && safety < 240) {
        const isPast = cursor <= now;
        out.push({
          sub_id: sub.id,
          contact_id: sub.contact_id ?? "",
          contact_name: sub.contact_name,
          product: sub.recurring_product_name ?? "Subscription",
          amount: sub.amount,
          due_date: new Date(cursor),
          status: isPast ? "collected" : "outstanding",
        });
        cursor = addMonths(cursor, intervalCount);
        safety++;
      }
    }
    return out;
  }, [subscriptions]);

  interface PersonDetail {
    name: string;
    contact_id: string;
    paid: number;
    unpaid: number;
    items: number;
    label: string;
    due_date: string;
  }

  const monthlyData = useMemo(() => {
    const map = new Map<string, { expected: number; paid: number; unpaid: number; items: number; people: Map<string, PersonDetail> }>();

    const getEntry = (mk: string) => {
      if (!map.has(mk)) map.set(mk, { expected: 0, paid: 0, unpaid: 0, items: 0, people: new Map() });
      return map.get(mk)!;
    };
    const getPerson = (people: Map<string, PersonDetail>, key: string, name: string, contact_id: string) => {
      if (!people.has(key)) people.set(key, { name, contact_id, paid: 0, unpaid: 0, items: 0, label: "", due_date: "" });
      return people.get(key)!;
    };

    for (const c of charges) {
      const mk = monthKey(c.due_date);
      const entry = getEntry(mk);
      const personKey = `${c.sub_id}-${mk}`;
      const person = getPerson(entry.people, personKey, c.contact_name, c.contact_id);
      entry.expected += c.amount;
      entry.items++;
      person.items++;
      person.label = c.product;
      person.due_date = c.due_date.toISOString();
      if (c.status === "collected") {
        entry.paid += c.amount;
        person.paid += c.amount;
      } else {
        entry.unpaid += c.amount;
        person.unpaid += c.amount;
      }
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => ({
        month: key,
        label: monthLabel(key),
        expected: val.expected,
        paid: val.paid,
        unpaid: val.unpaid,
        items: val.items,
        people: Array.from(val.people.values()).sort((a, b) => (a.due_date || "").localeCompare(b.due_date || "")),
      }));
  }, [charges]);

  const totals = useMemo(() => {
    return monthlyData.reduce(
      (acc, m) => ({
        expected: acc.expected + m.expected,
        paid: acc.paid + m.paid,
        unpaid: acc.unpaid + m.unpaid,
      }),
      { expected: 0, paid: 0, unpaid: 0 }
    );
  }, [monthlyData]);

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [selectedContact, setSelectedContact] = useState<{ id: string; name: string } | null>(null);

  // Late ledger: every subscription that has ever gone late, current state
  // (Late vs Resolved) shown per-row. Currently-late rows sort first by oldest
  // late_since (most urgent), resolved rows after by most-recent resolved_at.
  const lateOrResolvedSubs = useMemo(() => {
    const ever = subscriptions.filter((s) => s.last_failed_payment_at !== null);
    return ever.slice().sort((a, b) => {
      if (a.is_late !== b.is_late) return a.is_late ? -1 : 1;
      if (a.is_late) {
        const aT = a.late_since ? new Date(a.late_since).getTime() : 0;
        const bT = b.late_since ? new Date(b.late_since).getTime() : 0;
        return aT - bT;
      }
      const aT = a.resolved_at ? new Date(a.resolved_at).getTime() : 0;
      const bT = b.resolved_at ? new Date(b.resolved_at).getTime() : 0;
      return bT - aT;
    });
  }, [subscriptions]);

  const currentlyLateCount = useMemo(
    () => lateOrResolvedSubs.filter((s) => s.is_late).length,
    [lateOrResolvedSubs]
  );

  const currentlyLateAmount = useMemo(
    () => lateOrResolvedSubs.filter((s) => s.is_late).reduce((sum, s) => sum + s.amount, 0),
    [lateOrResolvedSubs]
  );

  const resolvedCount = useMemo(
    () => lateOrResolvedSubs.filter((s) => !s.is_late).length,
    [lateOrResolvedSubs]
  );

  const currentAndFuture = useMemo(() => {
    const data = monthlyData.filter((m) => m.month >= currentMonthKey);
    return data.sort((a, b) => {
      if (a.month === currentMonthKey) return -1;
      if (b.month === currentMonthKey) return 1;
      return a.month.localeCompare(b.month);
    });
  }, [monthlyData, currentMonthKey]);

  const pastMonths = useMemo(() => {
    return monthlyData.filter((m) => m.month < currentMonthKey).sort((a, b) => b.month.localeCompare(a.month));
  }, [monthlyData, currentMonthKey]);

  const toggleMonth = (month: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  };

  if (isLoading) return <div className="text-steel text-sm p-4">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-heading text-xl text-gold tracking-wide">Receivables</h2>
          <p className="text-xs text-steel mt-1">
            Recurring subscription cash flow by month — past charges of active/trialing subs counted as collected, future charges projected to subscription end date.
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider text-steel font-semibold">Product</label>
          <Select value={productFilter} onValueChange={(v) => setProductFilter(v as ProductFilter)}>
            <SelectTrigger className="h-9 w-[220px] bg-card border-border text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRODUCT_FILTERS.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-[10px] uppercase tracking-wider text-steel font-semibold">Total Expected</p>
          <p className="text-xl font-heading text-foreground mt-1">{fmt(totals.expected)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-[10px] uppercase tracking-wider text-steel font-semibold">Collected</p>
          <p className="text-xl font-heading text-emerald mt-1">{fmt(totals.paid)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-[10px] uppercase tracking-wider text-steel font-semibold">Outstanding</p>
          <p className="text-xl font-heading text-gold mt-1">{fmt(totals.unpaid)}</p>
        </div>
      </div>

      {/* Bar chart - last 3 months and next 6 months from current */}
      {monthlyData.length > 0 && (() => {
        const nowD = new Date();
        const startKey = monthKey(new Date(Date.UTC(nowD.getFullYear(), nowD.getMonth() - 3, 1)));
        const endKey = monthKey(new Date(Date.UTC(nowD.getFullYear(), nowD.getMonth() + 6, 1)));
        const chartData = monthlyData.filter((m) => m.month >= startKey && m.month <= endKey);
        return (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-[10px] uppercase tracking-wider text-steel font-semibold mb-3">Monthly Subscription Cash Flow</p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 25, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value: number, name: string) => [fmt(value), name === "paid" ? "Collected" : "Outstanding"]}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Bar dataKey="paid" stackId="a" fill="hsl(var(--emerald))" name="paid" />
              <Bar dataKey="unpaid" stackId="a" fill="hsl(var(--gold))" name="unpaid" radius={[2, 2, 0, 0]}>
                <LabelList
                  valueAccessor={(entry: any) => entry.paid + entry.unpaid}
                  position="top"
                  formatter={(value: number) => value > 0 ? `$${(value / 1000).toFixed(1)}k` : ""}
                  style={{ fontSize: 10, fill: "hsl(var(--muted-foreground))", fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        );
      })()}

      <Tabs defaultValue="current" className="w-full">
        <TabsList>
          <TabsTrigger value="current">Current &amp; Upcoming</TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
          <TabsTrigger value="late">
            Late Payment{currentlyLateCount > 0 ? ` (${currentlyLateCount})` : ""}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="current">{renderMonthTable(currentAndFuture)}</TabsContent>
        <TabsContent value="past">{renderMonthTable(pastMonths)}</TabsContent>
        <TabsContent value="late">
          {lateOrResolvedSubs.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-8 text-center text-steel text-sm">
              No subscribers have been late on payment. 🎉
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <p className="text-[10px] uppercase tracking-wider font-semibold">
                  <span className={currentlyLateCount > 0 ? "text-red-700 dark:text-red-400" : "text-steel"}>
                    {currentlyLateCount} currently late
                  </span>
                  <span className="text-steel"> &middot; </span>
                  <span className="text-emerald-700 dark:text-emerald-400">
                    {resolvedCount} resolved
                  </span>
                </p>
                {currentlyLateCount > 0 && (
                  <p className="text-xs text-red-700 dark:text-red-400">
                    {fmt(currentlyLateAmount)} owed
                  </p>
                )}
              </div>
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr className="text-left text-[10px] uppercase tracking-wider text-steel">
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 font-semibold">Customer</th>
                    <th className="px-3 py-2 font-semibold">Product</th>
                    <th className="px-3 py-2 font-semibold text-right">Amount</th>
                    <th className="px-3 py-2 font-semibold">Late Since</th>
                    <th className="px-3 py-2 font-semibold">Last Failed</th>
                  </tr>
                </thead>
                <tbody>
                  {lateOrResolvedSubs.map((s) => (
                    <tr
                      key={s.id}
                      className={`border-t ${s.is_late ? "border-red-500/20 bg-red-500/[0.04]" : "border-border"}`}
                    >
                      <td className="px-3 py-2 whitespace-nowrap">
                        {s.is_late ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="inline-flex items-center gap-1.5"
                                disabled={resolveLate.isPending && resolveLate.variables === s.id}
                              >
                                <Badge
                                  variant="outline"
                                  className="bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/40 cursor-pointer hover:bg-red-500/25"
                                >
                                  Late
                                  <MoreHorizontal className="w-3 h-3 ml-1" />
                                </Badge>
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="min-w-[140px]">
                              <DropdownMenuItem onClick={() => resolveLate.mutate(s.id)}>
                                Mark Resolved
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/40">
                            Resolved {s.resolved_at ? format(parseISO(s.resolved_at), "MM/dd/yy") : ""}
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => s.contact_id && setSelectedContact({ id: s.contact_id, name: s.contact_name })}
                          className="text-foreground hover:text-gold transition-colors text-left"
                        >
                          {s.contact_name}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-steel">{s.recurring_product_name ?? "—"}</td>
                      <td className={`px-3 py-2 text-right font-heading ${s.is_late ? "text-red-700 dark:text-red-400" : "text-foreground"}`}>
                        {fmt(s.amount)}
                      </td>
                      <td className="px-3 py-2 text-steel text-xs whitespace-nowrap">
                        {s.late_since ? format(parseISO(s.late_since), "MM/dd/yy") : "—"}
                      </td>
                      <td className="px-3 py-2 text-steel text-xs whitespace-nowrap">
                        {s.last_failed_payment_at ? format(parseISO(s.last_failed_payment_at), "MM/dd/yy h:mm a") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {selectedContact && (
        <ContactCardDialog
          open={!!selectedContact}
          onOpenChange={(open) => !open && setSelectedContact(null)}
          contactId={selectedContact.id}
          contactName={selectedContact.name}
        />
      )}
    </div>
  );

  function renderMonthTable(rows: typeof monthlyData) {
    return (
      <div className="rounded-lg border border-border overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-steel text-[10px] uppercase tracking-wider font-semibold">Month</TableHead>
                <TableHead className="text-steel text-[10px] uppercase tracking-wider font-semibold text-right">Expected</TableHead>
                <TableHead className="text-steel text-[10px] uppercase tracking-wider font-semibold text-right">Collected</TableHead>
                <TableHead className="text-steel text-[10px] uppercase tracking-wider font-semibold text-right">Outstanding</TableHead>
                <TableHead className="text-steel text-[10px] uppercase tracking-wider font-semibold text-right"># Charges</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-steel py-8 text-sm">No data</TableCell>
                </TableRow>
              ) : (
                rows.map((row) => {
                  const isCurrent = row.month === currentMonthKey;
                  const isExpanded = expandedMonths.has(row.month);
                  return (
                    <>
                      <TableRow
                        key={row.month}
                        className={`border-border transition-colors cursor-pointer ${isCurrent ? "bg-gold/5" : "hover:bg-muted/30"}`}
                        onClick={() => toggleMonth(row.month)}
                      >
                        <TableCell className="text-sm font-medium text-foreground whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-steel" /> : <ChevronRight className="w-3.5 h-3.5 text-steel" />}
                            {row.label}
                            {isCurrent && (
                              <Badge variant="outline" className="ml-1 text-[9px] px-1.5 py-0 bg-gold/20 text-gold border-gold/30">
                                Current
                              </Badge>
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-foreground text-right font-mono">{fmt(row.expected)}</TableCell>
                        <TableCell className="text-sm text-emerald text-right font-mono">{fmt(row.paid)}</TableCell>
                        <TableCell className="text-sm text-gold text-right font-mono">{fmt(row.unpaid)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground text-right">{row.items}</TableCell>
                      </TableRow>
                      {isExpanded && row.people.map((p, i) => {
                        const dueDay = p.due_date ? new Date(p.due_date).getUTCDate() : null;
                        const dueLabel = p.due_date ? new Date(p.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" }) : "";
                        return (
                        <TableRow key={`${row.month}-${p.name}-${i}`} className="border-border/30 bg-muted/10">
                          <TableCell className="text-xs pl-8 whitespace-nowrap text-steel">
                            <button
                              type="button"
                              className="text-gold hover:underline cursor-pointer"
                              onClick={(e) => { e.stopPropagation(); setSelectedContact({ id: p.contact_id, name: p.name }); }}
                            >
                              {p.name}
                            </button>
                            <span className="ml-2 text-muted-foreground">{p.label}</span>
                            {dueLabel && (
                              <span className="ml-2 text-steel/70">({dueLabel})</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-foreground text-right font-mono">{fmt(p.paid + p.unpaid)}</TableCell>
                          <TableCell className="text-xs text-emerald text-right font-mono">{fmt(p.paid)}</TableCell>
                          <TableCell className="text-xs text-gold text-right font-mono">{fmt(p.unpaid)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground text-right">{p.items}</TableCell>
                        </TableRow>
                        );
                      })}
                    </>
                  );
                })
              )}
              {rows.length > 0 && (
                <TableRow className="border-border bg-muted/20 font-semibold">
                  <TableCell className="text-sm text-foreground">Total</TableCell>
                  <TableCell className="text-sm text-foreground text-right font-mono">
                    {fmt(rows.reduce((s, r) => s + r.expected, 0))}
                  </TableCell>
                  <TableCell className="text-sm text-emerald text-right font-mono">
                    {fmt(rows.reduce((s, r) => s + r.paid, 0))}
                  </TableCell>
                  <TableCell className="text-sm text-gold text-right font-mono">
                    {fmt(rows.reduce((s, r) => s + r.unpaid, 0))}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground text-right">
                    {rows.reduce((s, r) => s + r.items, 0)}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }
}
