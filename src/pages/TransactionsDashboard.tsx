import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, isWithinInterval, parseISO, startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths } from "date-fns";
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
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Search,
  Save,
  Trash2,
  X,
  BookmarkCheck,
  CalendarIcon,
  SlidersHorizontal,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";
import ContactCardDialog from "@/components/ContactCardDialog";

// ─── Types ───────────────────────────────────────────────────────────
interface Transaction {
  id: string;
  contact_id: string;
  date: string;
  name: string;
  phone: string;
  email: string;
  category: string;
  description: string;
  amount: number;
  status: string;
}

interface SavedView {
  id: string;
  name: string;
  categoryFilter: string;
  dateFrom?: string;
  dateTo?: string;
  search: string;
}

// ─── Constants ───────────────────────────────────────────────────────
const categories = ["All", "Hardcover Book", "Digital Book", "Live", "Velocity", "Summit", "Course"];

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const categoryColors: Record<string, string> = {
  "Hardcover Book": "bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 border-cyan-500/30",
  "Digital Book": "bg-sky-500/20 text-sky-700 dark:text-sky-400 border-sky-500/30",
  Live: "bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-500/30",
  Velocity: "bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/30",
  Summit: "bg-pink-500/20 text-pink-700 dark:text-pink-400 border-pink-500/30",
  Course: "bg-teal-500/20 text-teal-700 dark:text-teal-400 border-teal-500/30",
};

const statusColors: Record<string, string> = {
  Delivered: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  "In Transit": "bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30",
  "Pre-Transit": "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  Active: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  Canceled: "bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30",
  Paused: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  Enrolled: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  "Not Enrolled": "bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30",
  "No Show": "bg-steel/20 text-steel border-steel/30",
  Bundled: "bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-500/30",
};

function fmtDate(d: string) {
  if (!d) return "—";
  try {
    const date = new Date(d);
    return date.toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
      month: "2-digit",
      day: "2-digit",
      year: "2-digit",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return d;
  }
}

function formatDateLabel(iso: string) {
  try {
    return format(parseISO(iso), "MM/dd/yy");
  } catch {
    return iso;
  }
}

// ─── Component ───────────────────────────────────────────────────────
// Column visibility config
const allColumns = [
  { key: "date", label: "Date" },
  { key: "name", label: "Name" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "category", label: "Product" },
  { key: "amount", label: "Amount" },
  { key: "status", label: "Status" },
] as const;

type ColumnKey = typeof allColumns[number]["key"];
const allColumnKeys = allColumns.map((c) => c.key);

export default function TransactionsDashboard() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [activeDateFrom, setActiveDateFrom] = useState<string | undefined>();
  const [activeDateTo, setActiveDateTo] = useState<string | undefined>();
  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  const [columnFilterOpen, setColumnFilterOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(new Set(allColumnKeys));
  const [selectedContact, setSelectedContact] = useState<{ contact_id: string; name: string; email: string; phone: string } | null>(null);

  const [savedViews, setSavedViews] = useState<SavedView[]>(() => {
    try {
      const stored = localStorage.getItem("fiu-transactions-views");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveViewName, setSaveViewName] = useState("");

  const hasFilters = categoryFilter !== "All" || !!activeDateFrom;

  const isAllVisible = visibleColumns.size === allColumnKeys.length;

  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        // Prevent empty — if nothing left, re-add all
        if (next.size === 0) return new Set(allColumnKeys);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (isAllVisible) {
      // Can't uncheck all — keep all
      return;
    }
    setVisibleColumns(new Set(allColumnKeys));
  };

  const isCol = (key: ColumnKey) => visibleColumns.has(key);

  // ── Fetch from DB ──────────────────────────────────────────────────
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["transactions-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*, contacts(id, name, email, phone)")
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id,
        contact_id: r.contacts?.id ?? r.contact_id,
        date: r.date,
        name: r.contacts?.name ?? "Unknown",
        phone: r.contacts?.phone ?? "",
        email: r.contacts?.email ?? "",
        category: r.category,
        description: r.description,
        amount: Number(r.amount),
        status: r.status,
      })) as Transaction[];
    },
  });

  // ── Apply date range ───────────────────────────────────────────────
  const applyDateRange = () => {
    if (!dateRange?.from) return;
    setActiveDateFrom(dateRange.from.toISOString());
    setActiveDateTo((dateRange.to ?? dateRange.from).toISOString());
    setDateFilterOpen(false);
    setActiveViewId(null);
  };

  const clearDateRange = () => {
    setActiveDateFrom(undefined);
    setActiveDateTo(undefined);
    setDateRange(undefined);
    setActiveViewId(null);
  };

  // ── Filtering ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let data = transactions;

    if (categoryFilter !== "All") {
      data = data.filter((t) => t.category === categoryFilter);
    }

    if (activeDateFrom) {
      const from = startOfDay(parseISO(activeDateFrom));
      const to = endOfDay(parseISO(activeDateTo ?? activeDateFrom));
      data = data.filter((t) => {
        const d = parseISO(t.date);
        return isWithinInterval(d, { start: from, end: to });
      });
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.email.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.status.toLowerCase().includes(q)
      );
    }

    return [...data].sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, search, categoryFilter, activeDateFrom, activeDateTo]);

  const totalRevenue = useMemo(() => filtered.reduce((s, t) => s + t.amount, 0), [filtered]);

  // ── Saved views ────────────────────────────────────────────────────
  const persistViews = (views: SavedView[]) => {
    setSavedViews(views);
    localStorage.setItem("fiu-transactions-views", JSON.stringify(views));
  };

  const saveCurrentView = () => {
    if (!saveViewName.trim() || !hasFilters) return;
    const view: SavedView = {
      id: crypto.randomUUID(),
      name: saveViewName.trim(),
      categoryFilter,
      dateFrom: activeDateFrom,
      dateTo: activeDateTo,
      search,
    };
    persistViews([...savedViews, view]);
    setActiveViewId(view.id);
    setSaveViewName("");
    setSaveOpen(false);
  };

  const loadView = (view: SavedView) => {
    setCategoryFilter(view.categoryFilter);
    setActiveDateFrom(view.dateFrom);
    setActiveDateTo(view.dateTo);
    setSearch(view.search);
    if (view.dateFrom) {
      setDateRange({ from: parseISO(view.dateFrom), to: view.dateTo ? parseISO(view.dateTo) : undefined });
    } else {
      setDateRange(undefined);
    }
    setActiveViewId(view.id);
  };

  const deleteView = (id: string) => {
    persistViews(savedViews.filter((v) => v.id !== id));
    if (activeViewId === id) setActiveViewId(null);
  };

  const clearAll = () => {
    setCategoryFilter("All");
    clearDateRange();
    setSearch("");
    setActiveViewId(null);
  };

  if (isLoading) return <div className="text-steel text-sm p-4">Loading…</div>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading text-xl text-gold tracking-wide">Transactions</h2>
        <p className="text-xs text-steel mt-1">
          Payment transactions received — {filtered.length}{hasFilters ? ` of ${transactions.length}` : ""} records · {currencyFormatter.format(totalRevenue)} collected
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-steel" />
          <Input
            placeholder="Search…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setActiveViewId(null); }}
            className="pl-8 w-48 bg-card border-border text-foreground text-xs h-8"
          />
        </div>

        <div className="flex items-center gap-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => { setCategoryFilter(cat); setActiveViewId(null); }}
              className={`text-[11px] font-medium px-2.5 py-1 rounded-sm transition-colors ${
                categoryFilter === cat
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <Popover open={dateFilterOpen} onOpenChange={setDateFilterOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs border-border text-muted-foreground hover:text-foreground hover:bg-muted">
              <CalendarIcon className="w-3.5 h-3.5" />
              Date Range
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3 bg-card border-border space-y-2" align="start">
            <p className="text-[10px] uppercase tracking-wider text-steel font-semibold">Transaction date range</p>
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px] flex-1 border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                onClick={() => {
                  const now = new Date();
                  setDateRange({ from: startOfMonth(now), to: endOfMonth(now) });
                }}
              >
                This Month
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px] flex-1 border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                onClick={() => {
                  const last = subMonths(new Date(), 1);
                  setDateRange({ from: startOfMonth(last), to: endOfMonth(last) });
                }}
              >
                Last Month
              </Button>
            </div>
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={1}
              className={cn("p-2 pointer-events-auto rounded-md border border-border bg-muted")}
            />
            {dateRange?.from && (
              <p className="text-[11px] text-gold">
                {format(dateRange.from, "MM/dd/yy")}
                {dateRange.to && dateRange.to.getTime() !== dateRange.from.getTime()
                  ? ` → ${format(dateRange.to, "MM/dd/yy")}`
                  : " (single day)"}
              </p>
            )}
            <Button
              size="sm"
              className="h-7 text-xs w-full"
              onClick={applyDateRange}
              disabled={!dateRange?.from}
            >
              Apply
            </Button>
          </PopoverContent>
        </Popover>

        {/* Column visibility filter */}
        <Popover open={columnFilterOpen} onOpenChange={setColumnFilterOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn(
              "h-8 gap-1.5 text-xs border-border hover:bg-muted",
              !isAllVisible ? "text-primary border-primary/30" : "text-muted-foreground hover:text-foreground"
            )}>
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Columns{!isAllVisible ? ` (${visibleColumns.size})` : ""}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-3 bg-card border-border space-y-1" align="start">
            <p className="text-[10px] uppercase tracking-wider text-steel font-semibold mb-2">Show columns</p>
            <label className="flex items-center gap-2 py-1 cursor-pointer border-b border-border/50 pb-2 mb-1">
              <Checkbox
                checked={isAllVisible}
                onCheckedChange={toggleAll}
              />
              <span className="text-xs text-foreground font-medium">All</span>
            </label>
            {allColumns.map((col) => (
              <label key={col.key} className="flex items-center gap-2 py-0.5 cursor-pointer">
                <Checkbox
                  checked={visibleColumns.has(col.key)}
                  onCheckedChange={() => toggleColumn(col.key)}
                />
                <span className="text-xs text-foreground">{col.label}</span>
              </label>
            ))}
          </PopoverContent>
        </Popover>

        {activeDateFrom && (
          <span className="inline-flex items-center gap-1 bg-emerald/30 text-gold text-[11px] font-medium px-2.5 py-1 rounded-sm whitespace-nowrap">
            <CalendarIcon className="w-3 h-3" />
            {formatDateLabel(activeDateFrom)}
            {activeDateTo && activeDateTo !== activeDateFrom
              ? ` → ${formatDateLabel(activeDateTo)}`
              : ""}
            <button onClick={clearDateRange} className="hover:text-destructive transition-colors">
              <X className="w-3 h-3" />
            </button>
          </span>
        )}

        {hasFilters && (
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
                placeholder="e.g. Velocity Q1"
                className="h-8 text-xs bg-muted border-border text-foreground"
                value={saveViewName}
                onChange={(e) => setSaveViewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveCurrentView()}
                autoFocus
              />
              <Button size="sm" className="h-7 text-xs w-full" onClick={saveCurrentView}>
                Save
              </Button>
            </PopoverContent>
          </Popover>
        )}

        {hasFilters && (
          <button onClick={clearAll} className="text-[10px] text-steel hover:text-destructive transition-colors underline">
            Clear all
          </button>
        )}

        {savedViews.length > 0 && (
          <div className="flex items-center gap-1 ml-auto">
            <BookmarkCheck className="w-3.5 h-3.5 text-steel" />
            {savedViews.map((v) => (
              <span key={v.id} className="inline-flex items-center gap-1">
                <button
                  onClick={() => loadView(v)}
                  className={`text-[11px] font-medium px-2.5 py-1 rounded-sm transition-colors ${
                    activeViewId === v.id
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {v.name}
                </button>
                <button onClick={() => deleteView(v.id)} className="text-steel hover:text-destructive transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="[&_th]:h-9 [&_th]:px-3 [&_td]:px-3 [&_td]:py-2">
            <TableHeader>
              <TableRow className="bg-muted/30">
                {isCol("date") && <TableHead className="whitespace-nowrap text-xs font-semibold text-steel min-w-[100px]">Date</TableHead>}
                {isCol("name") && <TableHead className="whitespace-nowrap text-xs font-semibold text-steel min-w-[150px]">Name</TableHead>}
                {isCol("phone") && <TableHead className="whitespace-nowrap text-xs font-semibold text-steel min-w-[120px]">Phone</TableHead>}
                {isCol("email") && <TableHead className="whitespace-nowrap text-xs font-semibold text-steel min-w-[180px]">Email</TableHead>}
                {isCol("category") && <TableHead className="whitespace-nowrap text-xs font-semibold text-steel min-w-[100px]">Product</TableHead>}
                {isCol("amount") && <TableHead className="whitespace-nowrap text-xs font-semibold text-steel min-w-[100px] text-right">Amount</TableHead>}
                {isCol("status") && <TableHead className="whitespace-nowrap text-xs font-semibold text-steel min-w-[110px]">Status</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.id} className="hover:bg-muted/20">
                  {isCol("date") && <TableCell className="whitespace-nowrap text-sm text-foreground">{fmtDate(t.date)}</TableCell>}
                  {isCol("name") && (
                    <TableCell className="whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => setSelectedContact({ contact_id: t.contact_id, name: t.name, email: t.email, phone: t.phone })}
                        className="text-foreground hover:text-gold transition-colors text-left"
                      >
                        {t.name}
                      </button>
                    </TableCell>
                  )}
                  {isCol("phone") && <TableCell className="whitespace-nowrap text-sm text-foreground">{t.phone || "—"}</TableCell>}
                  {isCol("email") && <TableCell className="whitespace-nowrap text-sm text-foreground">{t.email}</TableCell>}
                  {isCol("category") && (
                    <TableCell className="whitespace-nowrap">
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${categoryColors[t.category] || ""}`}>
                        {t.category}
                      </Badge>
                    </TableCell>
                  )}
                  {isCol("amount") && (
                    <TableCell className="whitespace-nowrap text-sm text-foreground text-right">
                      {currencyFormatter.format(t.amount)}
                    </TableCell>
                  )}
                  {isCol("status") && (
                    <TableCell className="whitespace-nowrap">
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusColors[t.status] || ""}`}>
                        {t.status}
                      </Badge>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={visibleColumns.size} className="text-center text-steel text-sm py-8">
                    No transactions found
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
