import { useState, useMemo } from "react";
import ContactCardDialog from "@/components/ContactCardDialog";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

// ─── Types ───────────────────────────────────────────────────────────
interface Sale {
  id: string;
  date: string;
  name: string;
  email: string;
  contact_id: string;
  product: string;
  total_sale: number;
  collected: number;
  remaining: number;
  payment_plan: string;
  status: string;
}

interface SavedView {
  id: string;
  name: string;
  productFilter: string;
  dateFrom?: string;
  dateTo?: string;
  search: string;
}

// ─── Data ────────────────────────────────────────────────────────────
const allSales: Sale[] = [
  { id: "s1", date: "2026-03-25", name: "Angela Rivera", email: "angela@email.com", contact_id: "a1000000-0000-0000-0000-000000000007", product: "Velocity Program", total_sale: 10000, collected: 5000, remaining: 5000, payment_plan: "$5K deposit + 5×$1K/mo", status: "Active" },
  { id: "s2", date: "2026-04-01", name: "Robert Kim", email: "robert.k@email.com", contact_id: "a1000000-0000-0000-0000-000000000008", product: "Velocity Program", total_sale: 8000, collected: 3800, remaining: 4200, payment_plan: "$3.8K deposit + 4×$1,050/mo", status: "Active" },
  { id: "s3", date: "2026-01-15", name: "Monica Saunders", email: "monica@email.com", contact_id: "a1000000-0000-0000-0000-000000000009", product: "Velocity Program", total_sale: 10000, collected: 10000, remaining: 0, payment_plan: "Paid in full", status: "Completed" },
  { id: "s4", date: "2026-04-01", name: "Brandon Lewis", email: "brandon@email.com", contact_id: "a1000000-0000-0000-0000-000000000010", product: "Velocity Program", total_sale: 8500, collected: 4200, remaining: 4300, payment_plan: "$4.2K deposit + 4×$1,075/mo", status: "Active" },
  { id: "s5", date: "2025-08-12", name: "Derek Washington", email: "derek@email.com", contact_id: "a1000000-0000-0000-0000-000000000002", product: "FIU Live", total_sale: 97, collected: 776, remaining: 0, payment_plan: "$97/mo recurring", status: "Active" },
  { id: "s6", date: "2025-11-01", name: "Nina Hayes", email: "nina@email.com", contact_id: "a1000000-0000-0000-0000-000000000015", product: "FIU Live", total_sale: 97, collected: 485, remaining: 0, payment_plan: "$97/mo recurring", status: "Active" },
  { id: "s7", date: "2026-03-28", name: "Marcus Johnson", email: "marcus@email.com", contact_id: "a1000000-0000-0000-0000-000000000017", product: "Hardcover Book", total_sale: 29.99, collected: 29.99, remaining: 0, payment_plan: "One-time", status: "Completed" },
  { id: "s8", date: "2026-03-30", name: "Keisha Williams", email: "keisha@email.com", contact_id: "a1000000-0000-0000-0000-000000000018", product: "Hardcover Book", total_sale: 29.99, collected: 29.99, remaining: 0, payment_plan: "One-time", status: "Completed" },
  { id: "s9", date: "2026-04-01", name: "David Chen", email: "david.c@email.com", contact_id: "a1000000-0000-0000-0000-000000000019", product: "Hardcover Book", total_sale: 29.99, collected: 29.99, remaining: 0, payment_plan: "One-time", status: "Completed" },
  { id: "s10", date: "2026-03-15", name: "Angela Rivera", email: "angela@email.com", contact_id: "a1000000-0000-0000-0000-000000000007", product: "FIU Summit", total_sale: 0, collected: 0, remaining: 0, payment_plan: "Bundled w/ Velocity", status: "Bundled" },
  { id: "s11", date: "2026-03-18", name: "Marcus Johnson", email: "marcus@email.com", contact_id: "a1000000-0000-0000-0000-000000000017", product: "FIU Summit", total_sale: 0, collected: 0, remaining: 0, payment_plan: "Bundled w/ Velocity", status: "Bundled" },
];

const products = ["All", "Velocity Program", "FIU Live", "Hardcover Book", "FIU Summit", "Course"];

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const productColors: Record<string, string> = {
  "Velocity Program": "bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/30",
  "FIU Live": "bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-500/30",
  "Hardcover Book": "bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 border-cyan-500/30",
  "FIU Summit": "bg-pink-500/20 text-pink-700 dark:text-pink-400 border-pink-500/30",
  "Course": "bg-teal-500/20 text-teal-700 dark:text-teal-400 border-teal-500/30",
};

const statusColors: Record<string, string> = {
  Active: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  Completed: "bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30",
  Bundled: "bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-500/30",
  Defaulted: "bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30",
};

function fmtDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${m}/${day}/${y.slice(2)}`;
}

function fmt(n: number) {
  return currencyFormatter.format(n);
}

function formatDateLabel(iso: string) {
  try {
    return format(parseISO(iso), "MM/dd/yy");
  } catch {
    return iso;
  }
}

// ─── Component ───────────────────────────────────────────────────────
export default function SalesDashboard() {
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [search, setSearch] = useState("");
  const [productFilter, setProductFilter] = useState("All");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [activeDateFrom, setActiveDateFrom] = useState<string | undefined>();
  const [activeDateTo, setActiveDateTo] = useState<string | undefined>();
  const [dateFilterOpen, setDateFilterOpen] = useState(false);

  const [savedViews, setSavedViews] = useState<SavedView[]>(() => {
    try {
      const stored = localStorage.getItem("fiu-sales-views");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveViewName, setSaveViewName] = useState("");

  const hasFilters = productFilter !== "All" || !!activeDateFrom;

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

  const filtered = useMemo(() => {
    let data = allSales;

    if (productFilter !== "All") {
      data = data.filter((s) => s.product === productFilter);
    }

    if (activeDateFrom) {
      const from = startOfDay(parseISO(activeDateFrom));
      const to = endOfDay(parseISO(activeDateTo ?? activeDateFrom));
      data = data.filter((s) => {
        const d = parseISO(s.date);
        return isWithinInterval(d, { start: from, end: to });
      });
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          s.product.toLowerCase().includes(q) ||
          s.status.toLowerCase().includes(q)
      );
    }

    return data;
  }, [search, productFilter, activeDateFrom, activeDateTo]);

  const totalSaleValue = useMemo(() => filtered.reduce((s, t) => s + t.total_sale, 0), [filtered]);
  const totalCollected = useMemo(() => filtered.reduce((s, t) => s + t.collected, 0), [filtered]);

  const persistViews = (views: SavedView[]) => {
    setSavedViews(views);
    localStorage.setItem("fiu-sales-views", JSON.stringify(views));
  };

  const saveCurrentView = () => {
    if (!saveViewName.trim() || !hasFilters) return;
    const view: SavedView = {
      id: crypto.randomUUID(),
      name: saveViewName.trim(),
      productFilter,
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
    setProductFilter(view.productFilter);
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
    setProductFilter("All");
    clearDateRange();
    setSearch("");
    setActiveViewId(null);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading text-xl text-gold tracking-wide">Sales</h2>
        <p className="text-xs text-steel mt-1">
          Total contract value — {filtered.length}{hasFilters ? ` of ${allSales.length}` : ""} sales · {fmt(totalSaleValue)} sold · {fmt(totalCollected)} collected
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-steel" />
          <Input
            placeholder="Search…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setActiveViewId(null); }}
            className="pl-8 w-48 bg-card border-border text-foreground text-xs h-8"
          />
        </div>

        {/* Product filter pills */}
        <div className="flex items-center gap-1">
          {products.map((p) => (
            <button
              key={p}
              onClick={() => { setProductFilter(p); setActiveViewId(null); }}
              className={`text-[11px] font-medium px-2.5 py-1 rounded-sm transition-colors ${
                productFilter === p
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {p === "All" ? "All" : p.replace("FIU ", "")}
            </button>
          ))}
        </div>

        {/* Date range filter */}
        <Popover open={dateFilterOpen} onOpenChange={setDateFilterOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs border-border text-muted-foreground hover:text-foreground hover:bg-muted">
              <CalendarIcon className="w-3.5 h-3.5" />
              Date Range
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3 bg-card border-border space-y-2" align="start">
            <p className="text-[10px] uppercase tracking-wider text-steel font-semibold">Sale date range</p>
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

        {/* Active date chip */}
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

        {/* Save view */}
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

        {/* Saved views */}
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
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="whitespace-nowrap text-xs font-semibold text-steel min-w-[100px]">Date</TableHead>
                <TableHead className="whitespace-nowrap text-xs font-semibold text-steel min-w-[150px]">Name</TableHead>
                <TableHead className="whitespace-nowrap text-xs font-semibold text-steel min-w-[180px]">Email</TableHead>
                <TableHead className="whitespace-nowrap text-xs font-semibold text-steel min-w-[140px]">Product</TableHead>
                <TableHead className="whitespace-nowrap text-xs font-semibold text-steel min-w-[110px] text-right">Total Sale</TableHead>
                <TableHead className="whitespace-nowrap text-xs font-semibold text-steel min-w-[110px] text-right">Collected</TableHead>
                <TableHead className="whitespace-nowrap text-xs font-semibold text-steel min-w-[110px] text-right">Remaining</TableHead>
                <TableHead className="whitespace-nowrap text-xs font-semibold text-steel min-w-[220px]">Payment Plan</TableHead>
                <TableHead className="whitespace-nowrap text-xs font-semibold text-steel min-w-[100px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => (
                <TableRow key={s.id} className="hover:bg-muted/20">
                  <TableCell className="whitespace-nowrap text-sm text-foreground">{fmtDate(s.date)}</TableCell>
                  <TableCell>
                    <button
                      className="text-gold hover:underline text-sm font-medium whitespace-nowrap"
                      onClick={() => setSelectedSale(s)}
                    >
                      {s.name}
                    </button>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-foreground">{s.email}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${productColors[s.product] || ""}`}>
                      {s.product}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-foreground text-right">{fmt(s.total_sale)}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-foreground text-right">{fmt(s.collected)}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-foreground text-right">{fmt(s.remaining)}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-foreground">{s.payment_plan}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusColors[s.status] || ""}`}>
                      {s.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-steel text-sm py-8">
                    No sales found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
    </div>

      {selectedSale && (
        <ContactCardDialog
          open={!!selectedSale}
          onOpenChange={(open) => !open && setSelectedSale(null)}
          contactId={selectedSale.contact_id}
          contactName={selectedSale.name}
          email={selectedSale.email}
        />
      )}
    </div>
  );
}
