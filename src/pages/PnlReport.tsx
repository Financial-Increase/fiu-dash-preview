import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TrendingUp, TrendingDown, DollarSign, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Digits P&L tree types ───────────────────────────────────────────
type DigitsAmount = { amount: number; code: string };
type DigitsPnlRow = {
  label: string;
  total: DigitsAmount;
  summary?: { kind: string };
  category?: { id: string };
  children?: DigitsPnlRow[];
};
type DigitsPnlResponse = { rows: DigitsPnlRow[] };

function flattenTree(
  rows: DigitsPnlRow[],
  depth = 0,
  acc: { row: DigitsPnlRow; depth: number; key: string }[] = [],
  prefix = "",
) {
  rows.forEach((row, i) => {
    const key = `${prefix}${depth}-${i}-${row.label}`;
    acc.push({ row, depth, key });
    if (row.children?.length) flattenTree(row.children, depth + 1, acc, `${key}.`);
  });
  return acc;
}

function centsToDollars(cents: number): number {
  return cents / 100;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatAccountingCurrency(dollars: number): string {
  const formatted = currencyFormatter.format(Math.abs(dollars));
  return dollars < 0 ? `(${formatted})` : formatted;
}

function fmtDigits(cents: number): string {
  return formatAccountingCurrency(centsToDollars(cents));
}

// ─── Types ───────────────────────────────────────────────────────────
interface LineItem {
  label: string;
  amounts: number[];
  isBold?: boolean;
  isTotal?: boolean;
  indent?: boolean;
}

interface Section {
  title: string;
  items: LineItem[];
  total: LineItem;
}

// ─── Mock P&L Data ───────────────────────────────────────────────────
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
const quarters = ["Q1", "Q2"];

const salesSection: Section = {
  title: "Sales",
  items: [
    { label: "Velocity Program", amounts: [30000, 20000, 12000, 40000, 0, 0], indent: true },
    { label: "FIU Live Memberships", amounts: [970, 970, 970, 970, 970, 970], indent: true },
    { label: "Hardcover Book", amounts: [0, 0, 599.80, 449.85, 0, 0], indent: true },
    { label: "Summit Tickets", amounts: [0, 0, 0, 0, 0, 0], indent: true },
    { label: "Course", amounts: [0, 0, 0, 0, 0, 0], indent: true },
  ],
  total: { label: "Total Gross Sales", amounts: [30970, 20970, 13569.80, 41419.85, 970, 970], isBold: true, isTotal: true },
};

const revenueSection: Section = {
  title: "Revenue",
  items: [
    { label: "Velocity Program Sales", amounts: [28000, 18000, 10000, 36500, 0, 0], indent: true },
    { label: "FIU Live Memberships", amounts: [776, 776, 776, 776, 776, 776], indent: true },
    { label: "Hardcover Book Sales", amounts: [0, 0, 449.85, 329.89, 0, 0], indent: true },
    { label: "Summit Ticket Sales", amounts: [0, 0, 0, 0, 0, 0], indent: true },
    { label: "Course Revenue", amounts: [0, 0, 0, 0, 0, 0], indent: true },
  ],
  total: { label: "Total Revenue", amounts: [28776, 18776, 11225.85, 37605.89, 776, 776], isBold: true, isTotal: true },
};

const cogsSection: Section = {
  title: "Cost of Goods Sold",
  items: [
    { label: "Book Printing & Fulfillment", amounts: [0, 0, 225, 165, 0, 0], indent: true },
    { label: "Payment Processing Fees (3.5%)", amounts: [1007.16, 657.16, 392.90, 1316.21, 27.16, 27.16], indent: true },
    { label: "Summit Venue & Catering", amounts: [0, 0, 0, 2500, 0, 0], indent: true },
  ],
  total: { label: "Total COGS", amounts: [1007.16, 657.16, 617.90, 3981.21, 27.16, 27.16], isBold: true, isTotal: true },
};

const opexSection: Section = {
  title: "Operating Expenses",
  items: [
    { label: "Marketing & Advertising", amounts: [3500, 4200, 5100, 6200, 2800, 2800], indent: true },
    { label: "Software & Tools", amounts: [450, 450, 450, 450, 450, 450], indent: true },
    { label: "Contractor / Coaching Staff", amounts: [2000, 2000, 2000, 3500, 2000, 2000], indent: true },
    { label: "Office & Admin", amounts: [300, 300, 300, 300, 300, 300], indent: true },
    { label: "Travel & Events", amounts: [0, 500, 0, 1200, 0, 0], indent: true },
  ],
  total: { label: "Total Operating Expenses", amounts: [6250, 7450, 7850, 11650, 5550, 5550], isBold: true, isTotal: true },
};

const sections = [salesSection, revenueSection, cogsSection, opexSection];

function fmt(n: number) {
  return formatAccountingCurrency(n);
}

const MONTH_KEYS = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"];

// ─── Component ───────────────────────────────────────────────────────
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function yearStartIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-01-01`;
}

function DigitsPnlTable({ response }: { response: DigitsPnlResponse }) {
  const flat = flattenTree(response.rows);
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead className="text-xs font-semibold text-steel">Category</TableHead>
            <TableHead className="text-xs font-semibold text-steel text-right w-[140px]">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {flat.map(({ row, depth, key }) => {
            const isSummary = !!row.summary;
            const isLeaf = !row.children?.length;
            const amount = row.total.amount;
            const isNegative = amount < 0;
            return (
              <TableRow
                key={key}
                className={`hover:bg-muted/20 ${
                  depth === 0 ? "bg-muted/30 border-t-2 border-gold/30" : ""
                }`}
              >
                <TableCell
                  className={
                    depth === 0
                      ? "text-sm font-bold text-gold"
                      : isSummary
                        ? "text-sm font-semibold text-foreground"
                        : isLeaf
                          ? "text-sm text-steel"
                          : "text-sm text-foreground"
                  }
                  style={{ paddingLeft: `${0.75 + depth * 1.25}rem` }}
                >
                  {row.label}
                </TableCell>
                <TableCell
                  className={`text-right tabular-nums ${
                    depth === 0
                      ? `text-sm font-bold ${isNegative ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`
                      : isSummary
                        ? `text-sm font-semibold ${isNegative ? "text-red-700 dark:text-red-400" : "text-foreground"}`
                        : `text-sm ${isNegative ? "text-red-700 dark:text-red-400" : "text-foreground"}`
                  }`}
                >
                  {fmtDigits(amount)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export default function PnlReport() {
  const [view, setView] = useState<"monthly" | "quarterly">("monthly");
  const [digitsExpanded, setDigitsExpanded] = useState(true);
  const [digitsStart, setDigitsStart] = useState(yearStartIso());
  const [digitsEnd, setDigitsEnd] = useState(todayIso());
  const [digitsInterval, setDigitsInterval] = useState<"Month" | "Quarter" | "Year">("Month");

  const digitsQuery = useQuery({
    queryKey: ["digits-pnl", digitsStart, digitsEnd, digitsInterval],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("digits-pnl", {
        body: { startDate: digitsStart, endDate: digitsEnd, interval: digitsInterval },
      });
      if (error) throw new Error(error.message);
      if ((data as { error?: string })?.error) {
        throw new Error((data as { error: string }).error);
      }
      return data as { ok: boolean; pnl: unknown };
    },
    retry: false,
  });

  // Fetch outstanding receivables from velocity installments + deposits
  const { data: receivablesAmounts = [0, 0, 0, 0, 0, 0] } = useQuery({
    queryKey: ["pnl-receivables"],
    queryFn: async () => {
      // Fetch unpaid installments
      const { data: installments, error: iErr } = await supabase
        .from("velocity_installments")
        .select("amount, due_date, status")
        .neq("status", "Paid");
      if (iErr) throw iErr;

      // Fetch unpaid deposits
      const { data: deposits, error: dErr } = await supabase
        .from("velocity_members")
        .select("deposit, deposit_date, deposit_status")
        .neq("deposit_status", "Paid");
      if (dErr) throw dErr;

      const amounts = [0, 0, 0, 0, 0, 0];
      const now = new Date();
      const currentMK = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      for (const inst of installments ?? []) {
        if (!inst.due_date) continue;
        const mk = inst.due_date.slice(0, 7); // "YYYY-MM"
        if (mk < currentMK) continue; // only current + future
        const idx = MONTH_KEYS.indexOf(mk);
        if (idx >= 0) amounts[idx] += Number(inst.amount);
      }

      for (const dep of deposits ?? []) {
        if (!dep.deposit_date) continue;
        const mk = (dep.deposit_date as string).slice(0, 7);
        if (mk < currentMK) continue;
        const idx = MONTH_KEYS.indexOf(mk);
        if (idx >= 0) amounts[idx] += Number(dep.deposit);
      }

      return amounts;
    },
  });

  const columns = view === "monthly" ? months : quarters;

  const getAmount = (amounts: number[], colIdx: number) => {
    if (view === "monthly") return amounts[colIdx] ?? 0;
    // Quarterly: sum 3 months
    const start = colIdx * 3;
    return (amounts[start] ?? 0) + (amounts[start + 1] ?? 0) + (amounts[start + 2] ?? 0);
  };

  const grossProfit = useMemo(() => {
    return columns.map((_, i) => getAmount(revenueSection.total.amounts, i) - getAmount(cogsSection.total.amounts, i));
  }, [view]);

  const netIncome = useMemo(() => {
    return columns.map((_, i) => grossProfit[i] - getAmount(opexSection.total.amounts, i));
  }, [view, grossProfit]);

  const totalRevenue = columns.reduce((s, _, i) => s + getAmount(revenueSection.total.amounts, i), 0);
  const totalNetIncome = netIncome.reduce((s, n) => s + n, 0);

  return (
    <div className="space-y-4">
      {/* Digits Live Data panel (debug view — will be normalized once response shape is confirmed) */}
      <div className="rounded-lg border border-border bg-card">
        <button
          type="button"
          onClick={() => setDigitsExpanded((v) => !v)}
          className="w-full flex items-center gap-2 px-4 py-2 hover:bg-muted/20"
        >
          {digitsExpanded ? (
            <ChevronDown className="w-4 h-4 text-steel" />
          ) : (
            <ChevronRight className="w-4 h-4 text-steel" />
          )}
          <span className="font-heading text-sm tracking-wider text-gold uppercase">
            Digits Live P&amp;L
          </span>
          {digitsQuery.isFetching && (
            <RefreshCw className="w-3.5 h-3.5 text-steel animate-spin ml-2" />
          )}
          {digitsQuery.isError && (
            <span className="text-xs text-red-700 dark:text-red-400 ml-auto">
              {(digitsQuery.error as Error)?.message ?? "Error"}
            </span>
          )}
          {digitsQuery.data && !digitsQuery.isFetching && (
            <span className="text-xs text-emerald-700 dark:text-emerald-400 ml-auto">Connected</span>
          )}
        </button>
        {digitsExpanded && (
          <div className="p-4 border-t border-border space-y-3">
            <div className="flex flex-wrap gap-2 items-end">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-steel mb-1 block">
                  Start
                </label>
                <input
                  type="date"
                  value={digitsStart}
                  onChange={(e) => setDigitsStart(e.target.value)}
                  className="h-8 text-sm bg-background border border-border rounded px-2"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-steel mb-1 block">
                  End
                </label>
                <input
                  type="date"
                  value={digitsEnd}
                  onChange={(e) => setDigitsEnd(e.target.value)}
                  className="h-8 text-sm bg-background border border-border rounded px-2"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-steel mb-1 block">
                  Interval
                </label>
                <Select
                  value={digitsInterval}
                  onValueChange={(v) =>
                    setDigitsInterval(v as "Month" | "Quarter" | "Year")
                  }
                >
                  <SelectTrigger className="h-8 text-sm bg-background w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Month">Month</SelectItem>
                    <SelectItem value="Quarter">Quarter</SelectItem>
                    <SelectItem value="Year">Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => digitsQuery.refetch()}
                disabled={digitsQuery.isFetching}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </Button>
            </div>
            {digitsQuery.isError && (
              <pre className="text-xs text-red-700 dark:text-red-400 bg-background border border-border rounded p-3 overflow-x-auto">
                {(digitsQuery.error as Error)?.message}
              </pre>
            )}
            {digitsQuery.data && (
              <DigitsPnlTable response={digitsQuery.data.pnl as DigitsPnlResponse} />
            )}
          </div>
        )}
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-heading text-xl text-gold tracking-wide">Profit & Loss Statement</h2>
          <p className="text-xs text-steel mt-1">
            2026 YTD · {fmt(totalRevenue)} revenue · {fmt(totalNetIncome)} net income
          </p>
        </div>
        <Select value={view} onValueChange={(v) => setView(v as "monthly" | "quarterly")}>
          <SelectTrigger className="w-32 h-8 text-xs bg-card border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="quarterly">Quarterly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-1.5 text-steel text-[10px] uppercase tracking-wider font-semibold">
            <DollarSign className="w-3 h-3" /> Total Revenue
          </div>
          <p className="text-lg font-heading text-gold mt-1">{fmt(totalRevenue)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-1.5 text-steel text-[10px] uppercase tracking-wider font-semibold">
            <TrendingUp className="w-3 h-3" /> Gross Profit
          </div>
          <p className="text-lg font-heading text-emerald-700 dark:text-emerald-400 mt-1">{fmt(grossProfit.reduce((s, n) => s + n, 0))}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-1.5 text-steel text-[10px] uppercase tracking-wider font-semibold">
            {totalNetIncome >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            Net Income
          </div>
          <p className={`text-lg font-heading mt-1 ${totalNetIncome >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
            {fmt(totalNetIncome)}
          </p>
        </div>
      </div>

      {/* P&L Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs font-semibold text-steel min-w-[240px]">Account</TableHead>
                {columns.map((col) => (
                  <TableHead key={col} className="text-xs font-semibold text-steel text-right min-w-[100px]">{col}</TableHead>
                ))}
                <TableHead className="text-xs font-semibold text-gold text-right min-w-[100px]">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sections.map((section) => (
                <>
                  {/* Receivables row — inserted above Revenue */}
                  {section.title === "Revenue" && (
                    <>
                      <TableRow className="bg-muted/10">
                        <TableCell colSpan={columns.length + 2} className="text-[10px] uppercase tracking-wider text-steel font-semibold py-2">
                          Receivables
                        </TableCell>
                      </TableRow>
                      <TableRow className="hover:bg-muted/20">
                        <TableCell className="text-sm text-foreground pl-8">
                          Outstanding Velocity Receivables
                        </TableCell>
                        {columns.map((col, i) => {
                          const amt = getAmount(receivablesAmounts, i);
                          return (
                            <TableCell key={col} className={`text-sm text-right tabular-nums ${amt > 0 ? "text-gold" : "text-foreground"}`}>
                              {fmt(amt)}
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-sm text-gold text-right font-medium tabular-nums">
                          {fmt(columns.reduce((s, _, i) => s + getAmount(receivablesAmounts, i), 0))}
                        </TableCell>
                      </TableRow>
                      <TableRow className="border-t border-border">
                        <TableCell className="text-sm font-semibold text-foreground">
                          Total Receivables
                        </TableCell>
                        {columns.map((col, i) => {
                          const amt = getAmount(receivablesAmounts, i);
                          return (
                            <TableCell key={col} className="text-sm font-semibold text-foreground text-right tabular-nums">
                              {fmt(amt)}
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-sm font-bold text-gold text-right tabular-nums">
                          {fmt(columns.reduce((s, _, i) => s + getAmount(receivablesAmounts, i), 0))}
                        </TableCell>
                      </TableRow>
                    </>
                  )}

                  {/* Section header */}
                  <TableRow key={section.title} className="bg-muted/10">
                    <TableCell colSpan={columns.length + 2} className="text-[10px] uppercase tracking-wider text-steel font-semibold py-2">
                      {section.title}
                    </TableCell>
                  </TableRow>
                  {/* Line items */}
                  {section.items.map((item) => {
                    const rowTotal = columns.reduce((s, _, i) => s + getAmount(item.amounts, i), 0);
                    return (
                      <TableRow key={item.label} className="hover:bg-muted/20">
                        <TableCell className={`text-sm text-foreground ${item.indent ? "pl-8" : ""}`}>
                          {item.label}
                        </TableCell>
                        {columns.map((col, i) => (
                          <TableCell key={col} className="text-sm text-foreground text-right tabular-nums">
                            {fmt(getAmount(item.amounts, i))}
                          </TableCell>
                        ))}
                        <TableCell className="text-sm text-foreground text-right font-medium tabular-nums">
                          {fmt(rowTotal)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {/* Section total */}
                  <TableRow key={`${section.title}-total`} className="border-t border-border">
                    <TableCell className="text-sm font-semibold text-foreground">
                      {section.total.label}
                    </TableCell>
                    {columns.map((col, i) => (
                      <TableCell key={col} className="text-sm font-semibold text-foreground text-right tabular-nums">
                        {fmt(getAmount(section.total.amounts, i))}
                      </TableCell>
                    ))}
                    <TableCell className="text-sm font-bold text-gold text-right tabular-nums">
                      {fmt(columns.reduce((s, _, i) => s + getAmount(section.total.amounts, i), 0))}
                    </TableCell>
                  </TableRow>
                </>
              ))}

              {/* Gross Profit */}
              <TableRow className="bg-muted/20 border-t-2 border-border">
                <TableCell className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Gross Profit</TableCell>
                {grossProfit.map((gp, i) => (
                  <TableCell key={i} className="text-sm font-bold text-emerald-700 dark:text-emerald-400 text-right tabular-nums">
                    {fmt(gp)}
                  </TableCell>
                ))}
                <TableCell className="text-sm font-bold text-emerald-700 dark:text-emerald-400 text-right tabular-nums">
                  {fmt(grossProfit.reduce((s, n) => s + n, 0))}
                </TableCell>
              </TableRow>

              {/* Net Income */}
              <TableRow className="bg-muted/30 border-t-2 border-gold/30">
                <TableCell className="text-sm font-bold text-gold">Net Income</TableCell>
                {netIncome.map((ni, i) => (
                  <TableCell key={i} className={`text-sm font-bold text-right tabular-nums ${ni >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                    {fmt(ni)}
                  </TableCell>
                ))}
                <TableCell className={`text-sm font-bold text-right tabular-nums ${totalNetIncome >= 0 ? "text-gold" : "text-red-700 dark:text-red-400"}`}>
                  {fmt(totalNetIncome)}
                </TableCell>
              </TableRow>

              {/* Margin */}
              <TableRow className="bg-muted/10">
                <TableCell className="text-[11px] text-steel italic">Net Margin</TableCell>
                {netIncome.map((ni, i) => {
                  const rev = getAmount(revenueSection.total.amounts, i);
                  const margin = rev > 0 ? (ni / rev) * 100 : 0;
                  return (
                    <TableCell key={i} className={`text-[11px] text-right italic ${margin >= 0 ? "text-steel" : "text-red-700 dark:text-red-400"}`}>
                      {rev > 0 ? `${margin.toFixed(1)}%` : "—"}
                    </TableCell>
                  );
                })}
                <TableCell className="text-[11px] text-right italic text-steel">
                  {totalRevenue > 0 ? `${((totalNetIncome / totalRevenue) * 100).toFixed(1)}%` : "—"}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
