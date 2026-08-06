import { useState, useMemo, useRef, useEffect, useCallback } from "react";
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
import { Search, ChevronDown, ChevronRight, ChevronLeft } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────
interface Installment {
  number: number;
  amount: number;
  due_date: string;
  status: "Paid" | "Upcoming" | "Late" | "Failed";
  paid_date?: string;
}

interface PaymentPlan {
  id: string;
  name: string;
  email: string;
  product: string;
  total_sale: number;
  deposit: number;
  deposit_date: string;
  deposit_status: "Paid" | "Failed";
  installments: Installment[];
}

// ─── Mock data ───────────────────────────────────────────────────────
const plans: PaymentPlan[] = [
  {
    id: "p1", name: "Angela Rivera", email: "angela@email.com", product: "Velocity Program",
    total_sale: 10000, deposit: 5000, deposit_date: "2026-03-25", deposit_status: "Paid",
    installments: [
      { number: 1, amount: 1000, due_date: "2026-04-25", status: "Paid", paid_date: "2026-04-24" },
      { number: 2, amount: 1000, due_date: "2026-05-25", status: "Upcoming" },
      { number: 3, amount: 1000, due_date: "2026-06-25", status: "Upcoming" },
      { number: 4, amount: 1000, due_date: "2026-07-25", status: "Upcoming" },
      { number: 5, amount: 1000, due_date: "2026-08-25", status: "Upcoming" },
    ],
  },
  {
    id: "p2", name: "Robert Kim", email: "robert.k@email.com", product: "Velocity Program",
    total_sale: 8000, deposit: 3800, deposit_date: "2026-04-01", deposit_status: "Paid",
    installments: [
      { number: 1, amount: 1050, due_date: "2026-05-01", status: "Upcoming" },
      { number: 2, amount: 1050, due_date: "2026-06-01", status: "Upcoming" },
      { number: 3, amount: 1050, due_date: "2026-07-01", status: "Upcoming" },
      { number: 4, amount: 1050, due_date: "2026-08-01", status: "Upcoming" },
    ],
  },
  {
    id: "p3", name: "Brandon Lewis", email: "brandon@email.com", product: "Velocity Program",
    total_sale: 8500, deposit: 4200, deposit_date: "2026-04-01", deposit_status: "Paid",
    installments: [
      { number: 1, amount: 1075, due_date: "2026-05-01", status: "Upcoming" },
      { number: 2, amount: 1075, due_date: "2026-06-01", status: "Upcoming" },
      { number: 3, amount: 1075, due_date: "2026-07-01", status: "Upcoming" },
      { number: 4, amount: 1075, due_date: "2026-08-01", status: "Upcoming" },
    ],
  },
  {
    id: "p4", name: "Lisa Thompson", email: "lisa.t@email.com", product: "Velocity Program",
    total_sale: 6000, deposit: 3000, deposit_date: "2026-02-15", deposit_status: "Paid",
    installments: [
      { number: 1, amount: 1000, due_date: "2026-03-15", status: "Late" },
      { number: 2, amount: 1000, due_date: "2026-04-15", status: "Upcoming" },
      { number: 3, amount: 1000, due_date: "2026-05-15", status: "Upcoming" },
    ],
  },
  {
    id: "p5", name: "Carlos Mendez", email: "carlos@email.com", product: "Velocity Program",
    total_sale: 7500, deposit: 3500, deposit_date: "2026-03-01", deposit_status: "Paid",
    installments: [
      { number: 1, amount: 1000, due_date: "2026-04-01", status: "Failed" },
      { number: 2, amount: 1000, due_date: "2026-05-01", status: "Upcoming" },
      { number: 3, amount: 1000, due_date: "2026-06-01", status: "Upcoming" },
      { number: 4, amount: 1000, due_date: "2026-07-01", status: "Upcoming" },
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────
function formatDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${m}/${day}/${y.slice(2)}`;
}

function fmt(n: number) {
  return `$${n.toLocaleString()}`;
}

const statusColors: Record<string, string> = {
  Paid: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  Upcoming: "bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30",
  Late: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  Failed: "bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30",
};

const productColors: Record<string, string> = {
  "Velocity Program": "bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/30",
  "FIU Membership": "bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-500/30",
};

function getPlanStats(plan: PaymentPlan) {
  const paidInstallments = plan.installments.filter((i) => i.status === "Paid");
  const depositPaid = plan.deposit_status === "Paid" ? plan.deposit : 0;
  const installmentsPaid = paidInstallments.reduce((s, i) => s + i.amount, 0);
  const collected = depositPaid + installmentsPaid;
  const remaining = plan.total_sale - collected;
  const progress = (collected / plan.total_sale) * 100;
  const lateCount = plan.installments.filter((i) => i.status === "Late").length;
  const failedCount = plan.installments.filter((i) => i.status === "Failed").length;
  return { collected, remaining, progress, lateCount, failedCount, paidCount: paidInstallments.length, totalInstallments: plan.installments.length };
}

// ─── Component ───────────────────────────────────────────────────────
export default function PaymentsDashboard() {
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return plans;
    const q = search.toLowerCase();
    return plans.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.product.toLowerCase().includes(q)
    );
  }, [search]);

  const totalSale = useMemo(() => filtered.reduce((s, p) => s + p.total_sale, 0), [filtered]);
  const totalCollected = useMemo(() => filtered.reduce((s, p) => s + getPlanStats(p).collected, 0), [filtered]);
  const totalRemaining = totalSale - totalCollected;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading text-xl text-gold tracking-wide">Payments</h2>
        <p className="text-xs text-steel mt-1">
          Payment plan tracker — {filtered.length} plans · {fmt(totalCollected)} collected · {fmt(totalRemaining)} remaining
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-steel" />
        <Input
          placeholder="Search name, email, product…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-card border-border text-foreground text-sm h-9"
        />
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="whitespace-nowrap text-xs font-semibold text-steel w-8"></TableHead>
                <TableHead className="whitespace-nowrap text-xs font-semibold text-steel min-w-[150px]">Name</TableHead>
                <TableHead className="whitespace-nowrap text-xs font-semibold text-steel min-w-[180px]">Email</TableHead>
                <TableHead className="whitespace-nowrap text-xs font-semibold text-steel min-w-[130px]">Product</TableHead>
                <TableHead className="whitespace-nowrap text-xs font-semibold text-steel min-w-[100px] text-right">Total Sale</TableHead>
                <TableHead className="whitespace-nowrap text-xs font-semibold text-steel min-w-[90px] text-right">Deposit</TableHead>
                <TableHead className="whitespace-nowrap text-xs font-semibold text-steel min-w-[100px] text-right">Collected</TableHead>
                <TableHead className="whitespace-nowrap text-xs font-semibold text-steel min-w-[100px] text-right">Remaining</TableHead>
                <TableHead className="whitespace-nowrap text-xs font-semibold text-steel min-w-[180px]">Progress</TableHead>
                <TableHead className="whitespace-nowrap text-xs font-semibold text-steel min-w-[80px]">Alerts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((plan) => {
                const stats = getPlanStats(plan);
                const isExpanded = expandedIds.has(plan.id);
                return (
                  <>
                    <TableRow
                      key={plan.id}
                      className="border-border hover:bg-muted/20 cursor-pointer transition-colors"
                      onClick={() => toggleExpand(plan.id)}
                    >
                      <TableCell className="text-steel">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm font-medium text-foreground">{plan.name}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-foreground">{plan.email}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${productColors[plan.product] || ""}`}>
                          {plan.product}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-foreground text-right">{fmt(plan.total_sale)}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-foreground text-right">{fmt(plan.deposit)}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-foreground text-right">{fmt(stats.collected)}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-foreground text-right">{fmt(stats.remaining)}</TableCell>
                      <TableCell className="whitespace-nowrap min-w-[180px]">
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
                    {/* Expanded installment detail */}
                    {isExpanded && (
                      <TableRow key={`${plan.id}-detail`} className="bg-muted/10">
                        <TableCell colSpan={10} className="p-0">
                          <div className="px-8 py-3 space-y-2">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-[10px] uppercase tracking-wider text-steel font-semibold">Deposit</span>
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusColors[plan.deposit_status]}`}>
                                {plan.deposit_status}
                              </Badge>
                              <span className="text-xs text-foreground">{fmt(plan.deposit)}</span>
                              <span className="text-[10px] text-steel">on {formatDate(plan.deposit_date)}</span>
                            </div>
                            <div className="text-[10px] uppercase tracking-wider text-steel font-semibold mb-1">
                              Installments ({stats.paidCount}/{stats.totalInstallments} paid)
                            </div>
                            <div className="grid gap-1">
                              {plan.installments.map((inst) => (
                                <div
                                  key={inst.number}
                                  className="flex items-center gap-3 text-xs py-1 px-2 rounded bg-card/50"
                                >
                                  <span className="text-steel w-4">#{inst.number}</span>
                                  <span className="text-foreground w-16">{fmt(inst.amount)}</span>
                                  <span className="text-steel w-20">Due {formatDate(inst.due_date)}</span>
                                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusColors[inst.status]}`}>
                                    {inst.status}
                                  </Badge>
                                  {inst.paid_date && (
                                    <span className="text-[10px] text-steel">Paid {formatDate(inst.paid_date)}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-steel text-sm py-8">
                    No payment plans found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
