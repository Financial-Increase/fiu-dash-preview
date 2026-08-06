import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import ContactNotes from "@/components/ContactNotes";
import ContactCardDialog from "@/components/ContactCardDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ChevronDown, ChevronRight, BookmarkCheck, Save, Trash2 } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────
interface Installment {
  number: number;
  amount: number;
  due_date: string;
  status: string;
  paid_date?: string;
}

interface VelocityMember {
  id: string;
  contact_id: string;
  name: string;
  email: string;
  phone: string;
  cohort: string;
  start_date: string;
  end_date: string;
  velocity_status: string;
  total_sale: number;
  deposit: number;
  deposit_date: string;
  deposit_status: string;
  installments: Installment[];
}

// ─── Helpers ─────────────────────────────────────────────────────────
function formatDate(d: string) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${m}/${day}/${y.slice(2)}`;
}

function fmt(n: number) {
  return `$${n.toLocaleString()}`;
}

const installmentStatusColors: Record<string, string> = {
  Paid: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  Upcoming: "bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30",
  Late: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  Failed: "bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30",
};

const memberStatusColors: Record<string, string> = {
  Active: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  Expired: "bg-steel/20 text-steel border-steel/30",
  Paused: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
};

function getStats(m: VelocityMember) {
  const paidInstallments = m.installments.filter((i) => i.status === "Paid");
  const depositPaid = m.deposit_status === "Paid" ? m.deposit : 0;
  const installmentsPaid = paidInstallments.reduce((s, i) => s + i.amount, 0);
  const collected = depositPaid + installmentsPaid;
  const remaining = m.total_sale - collected;
  const progress = m.total_sale > 0 ? (collected / m.total_sale) * 100 : 0;
  const lateCount = m.installments.filter((i) => i.status === "Late").length;
  const failedCount = m.installments.filter((i) => i.status === "Failed").length;
  return { collected, remaining, progress, lateCount, failedCount, paidCount: paidInstallments.length, totalInstallments: m.installments.length };
}

// ─── Filter state type ───────────────────────────────────────────────
interface FilterState {
  search: string;
  cohortFilter: string;
  statusFilter: string;
  paymentFilter: "All" | "Late" | "Failed" | "On Track";
}

// ─── Component ───────────────────────────────────────────────────────
export default function VelocityMembersDashboard() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [paymentFilter, setPaymentFilter] = useState<"All" | "Late" | "Failed" | "On Track">("All");
  const [cohortFilter, setCohortFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedContact, setSelectedContact] = useState<VelocityMember | null>(null);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveViewName, setSaveViewName] = useState("");

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["velocity-members-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("velocity_members")
        .select("*, contacts(id, name, email, phone), velocity_installments(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id,
        contact_id: r.contacts.id,
        name: r.contacts.name,
        email: r.contacts.email,
        phone: r.contacts.phone,
        cohort: r.cohort,
        start_date: r.start_date,
        end_date: r.end_date,
        velocity_status: r.velocity_status,
        total_sale: Number(r.total_sale),
        deposit: Number(r.deposit),
        deposit_date: r.deposit_date ?? "",
        deposit_status: r.deposit_status,
        installments: (r.velocity_installments ?? [])
          .sort((a: any, b: any) => a.installment_number - b.installment_number)
          .map((i: any) => ({
            number: i.installment_number,
            amount: Number(i.amount),
            due_date: i.due_date,
            status: i.status,
            paid_date: i.paid_date,
          })),
      })) as VelocityMember[];
    },
  });

  // ── Saved views ────────────────────────────────────────────────────
  const { data: savedViews = [] } = useQuery({
    queryKey: ["saved-views", "velocity-members", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("saved_filter_views")
        .select("*")
        .eq("user_id", user.id)
        .eq("dashboard", "velocity-members")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as { id: string; name: string; filters: FilterState }[];
    },
    enabled: !!user,
  });

  const saveViewMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!user) throw new Error("Not authenticated");
      const filters: FilterState = { search, cohortFilter, statusFilter, paymentFilter };
      const { error } = await supabase.from("saved_filter_views").insert({
        user_id: user.id,
        dashboard: "velocity-members",
        name,
        filters: filters as any,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-views", "velocity-members"] });
      setSaveViewName("");
      setSaveOpen(false);
    },
  });

  const deleteViewMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("saved_filter_views").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-views", "velocity-members"] });
      setActiveViewId(null);
    },
  });

  const loadView = (view: { id: string; name: string; filters: FilterState }) => {
    setSearch(view.filters.search ?? "");
    setCohortFilter(view.filters.cohortFilter ?? "All");
    setStatusFilter(view.filters.statusFilter ?? "All");
    setPaymentFilter(view.filters.paymentFilter ?? "All");
    setActiveViewId(view.id);
  };

  const hasActiveFilters = search.trim() || cohortFilter !== "All" || statusFilter !== "All" || paymentFilter !== "All";

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const paymentFilters = ["All", "Late", "Failed", "On Track"] as const;

  const cohorts = useMemo(() => ["All", ...Array.from(new Set(members.map((m) => m.cohort).filter(Boolean))).sort()], [members]);
  const statuses = useMemo(() => ["All", ...Array.from(new Set(members.map((m) => m.velocity_status).filter(Boolean))).sort()], [members]);

  const filtered = useMemo(() => {
    let data = members;
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          m.cohort.toLowerCase().includes(q) ||
          m.velocity_status.toLowerCase().includes(q)
      );
    }
    if (cohortFilter !== "All") {
      data = data.filter((m) => m.cohort === cohortFilter);
    }
    if (statusFilter !== "All") {
      data = data.filter((m) => m.velocity_status === statusFilter);
    }
    if (paymentFilter === "Late") {
      data = data.filter((m) => m.installments.some((i) => i.status === "Late"));
    } else if (paymentFilter === "Failed") {
      data = data.filter((m) => m.installments.some((i) => i.status === "Failed"));
    } else if (paymentFilter === "On Track") {
      data = data.filter((m) => {
        const stats = getStats(m);
        return stats.lateCount === 0 && stats.failedCount === 0;
      });
    }
    return data;
  }, [members, search, paymentFilter, cohortFilter, statusFilter]);

  const totalSale = useMemo(() => filtered.reduce((s, m) => s + m.total_sale, 0), [filtered]);
  const totalCollected = useMemo(() => filtered.reduce((s, m) => s + getStats(m).collected, 0), [filtered]);

  if (isLoading) return <div className="text-steel text-sm p-4">Loading…</div>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading text-xl text-gold tracking-wide">Velocity Members</h2>
        <p className="text-xs text-steel mt-1">
          {filtered.length} members · {fmt(totalSale)} total sales · {fmt(totalCollected)} collected · {fmt(totalSale - totalCollected)} remaining
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-steel" />
          <Input
            placeholder="Search name, email, cohort, status…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setActiveViewId(null); }}
            className="pl-9 bg-card border-border text-foreground text-sm h-9 w-64"
          />
        </div>
        <Select value={cohortFilter} onValueChange={(v) => { setCohortFilter(v); setActiveViewId(null); }}>
          <SelectTrigger className="h-9 w-36 bg-card border-border text-sm">
            <SelectValue placeholder="Cohort" />
          </SelectTrigger>
          <SelectContent>
            {cohorts.map((c) => (
              <SelectItem key={c} value={c}>{c === "All" ? "All Cohorts" : c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setActiveViewId(null); }}>
          <SelectTrigger className="h-9 w-36 bg-card border-border text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>{s === "All" ? "All Statuses" : s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          {paymentFilters.map((f) => (
            <button
              key={f}
              onClick={() => { setPaymentFilter(f); setActiveViewId(null); }}
              className={`text-[11px] font-medium px-2.5 py-1 rounded-sm transition-colors ${
                paymentFilter === f
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Save View */}
        {hasActiveFilters && (
          <Popover open={saveOpen} onOpenChange={setSaveOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs border-border text-muted-foreground hover:text-foreground hover:bg-muted">
                <Save className="w-3.5 h-3.5" />
                Save View
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3 bg-card border-border space-y-2" align="start">
              <p className="text-[10px] uppercase tracking-wider text-steel font-semibold">Name this view</p>
              <Input
                placeholder="e.g. Late Payments Q2"
                className="h-8 text-xs bg-muted border-border text-foreground"
                value={saveViewName}
                onChange={(e) => setSaveViewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveViewName.trim() && saveViewMutation.mutate(saveViewName.trim())}
                autoFocus
              />
              <Button
                size="sm"
                className="h-7 text-xs w-full"
                onClick={() => saveViewName.trim() && saveViewMutation.mutate(saveViewName.trim())}
                disabled={!saveViewName.trim() || saveViewMutation.isPending}
              >
                {saveViewMutation.isPending ? "Saving…" : "Save"}
              </Button>
            </PopoverContent>
          </Popover>
        )}

        {/* Saved Views */}
        {savedViews.length > 0 && (
          <div className="flex items-center gap-1 ml-auto">
            <BookmarkCheck className="w-3.5 h-3.5 text-steel" />
            {savedViews.map((v) => (
              <span key={v.id} className="inline-flex items-center gap-1">
                <button
                  onClick={() => loadView(v)}
                  className={`text-[11px] font-medium px-2.5 py-1 rounded-sm transition-colors ${
                    activeViewId === v.id
                      ? "bg-gold/20 text-gold"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {v.name}
                </button>
                <button
                  onClick={() => deleteViewMutation.mutate(v.id)}
                  className="p-0.5 text-steel hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="whitespace-nowrap text-xs font-semibold text-steel w-8"></TableHead>
                <TableHead className="whitespace-nowrap text-xs font-semibold text-steel min-w-[150px]">Name</TableHead>
                <TableHead className="whitespace-nowrap text-xs font-semibold text-steel min-w-[180px]">Email</TableHead>
                <TableHead className="whitespace-nowrap text-xs font-semibold text-steel min-w-[120px]">Phone</TableHead>
                <TableHead className="whitespace-nowrap text-xs font-semibold text-steel min-w-[90px]">Status</TableHead>
                <TableHead className="whitespace-nowrap text-xs font-semibold text-steel min-w-[80px]">Cohort</TableHead>
                <TableHead className="whitespace-nowrap text-xs font-semibold text-steel min-w-[90px]">Start</TableHead>
                <TableHead className="whitespace-nowrap text-xs font-semibold text-steel min-w-[90px]">End</TableHead>
                <TableHead className="whitespace-nowrap text-xs font-semibold text-steel min-w-[90px] text-right">Sale</TableHead>
                <TableHead className="whitespace-nowrap text-xs font-semibold text-steel min-w-[90px] text-right">Collected</TableHead>
                <TableHead className="whitespace-nowrap text-xs font-semibold text-steel min-w-[90px] text-right">Remaining</TableHead>
                <TableHead className="whitespace-nowrap text-xs font-semibold text-steel min-w-[160px]">Payment Progress</TableHead>
                <TableHead className="whitespace-nowrap text-xs font-semibold text-steel min-w-[80px]">Alerts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((member) => {
                const stats = getStats(member);
                const isExpanded = expandedIds.has(member.id);
                return (
                  <>
                    <TableRow
                      key={member.id}
                      className="border-border hover:bg-muted/20 cursor-pointer transition-colors"
                      onClick={() => toggleExpand(member.id)}
                    >
                      <TableCell className="text-steel">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedContact(member); }}
                          className="text-foreground hover:text-gold transition-colors text-left"
                        >
                          {member.name}
                        </button>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-foreground">{member.email}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-foreground">{member.phone}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${memberStatusColors[member.velocity_status] || ""}`}>
                          {member.velocity_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-foreground">{member.cohort}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-foreground">{formatDate(member.start_date)}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-foreground">{formatDate(member.end_date)}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-foreground text-right">{fmt(member.total_sale)}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-foreground text-right">{fmt(stats.collected)}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-foreground text-right">{fmt(stats.remaining)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Progress value={stats.progress} className="h-2 flex-1 bg-muted" />
                          <span className="text-[10px] text-steel w-8 text-right">{Math.round(stats.progress)}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex gap-1">
                          {stats.lateCount > 0 && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30">
                              {stats.lateCount} Late
                            </Badge>
                          )}
                          {stats.failedCount > 0 && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30">
                              {stats.failedCount} Failed
                            </Badge>
                          )}
                          {stats.lateCount === 0 && stats.failedCount === 0 && (
                            <span className="text-[10px] text-emerald-700 dark:text-emerald-400">On track</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`${member.id}-detail`} className="bg-muted/10">
                        <TableCell colSpan={13} className="p-0">
                          <div className="px-8 py-3 space-y-2">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-[10px] uppercase tracking-wider text-steel font-semibold">Deposit</span>
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${installmentStatusColors[member.deposit_status] || ""}`}>
                                {member.deposit_status}
                              </Badge>
                              <span className="text-xs text-foreground">{fmt(member.deposit)}</span>
                              <span className="text-[10px] text-steel">on {formatDate(member.deposit_date)}</span>
                            </div>
                            <div className="text-[10px] uppercase tracking-wider text-steel font-semibold mb-1">
                              Installments ({stats.paidCount}/{stats.totalInstallments} paid)
                            </div>
                            <div className="grid gap-1">
                              {member.installments.map((inst) => (
                                <div
                                  key={inst.number}
                                  className="flex items-center gap-3 text-xs py-1 px-2 rounded bg-card/50"
                                >
                                  <span className="text-steel w-4">#{inst.number}</span>
                                  <span className="text-foreground w-16">{fmt(inst.amount)}</span>
                                  <span className="text-steel w-20">Due {formatDate(inst.due_date)}</span>
                                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${installmentStatusColors[inst.status] || ""}`}>
                                    {inst.status}
                                  </Badge>
                                  {inst.paid_date && (
                                    <span className="text-[10px] text-steel">Paid {formatDate(inst.paid_date)}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                            <ContactNotes contactId={member.contact_id} contactName={member.name} />
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={13} className="text-center text-steel text-sm py-8">
                    No members found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {selectedContact && (
        <ContactCardDialog
          open={!!selectedContact}
          onOpenChange={(open) => !open && setSelectedContact(null)}
          contactId={selectedContact.contact_id}
          contactName={selectedContact.name}
          email={selectedContact.email}
          phone={selectedContact.phone}
        />
      )}
    </div>
  );
}
