import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  Plus,
  Check,
  ChevronsUpDown,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";
import ContactCardDialog from "@/components/ContactCardDialog";
import EditableCell from "@/components/EditableCell";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────
type OfferType = "main" | "bump" | "upsell" | "downsell" | "manual" | "unknown";

// Shape as PostgREST returns it: numerics arrive as strings.
interface RawLineItem {
  id: string;
  line_index: number;
  title: string;
  product_id: string | null;
  quantity: number;
  unit_price: number | string;
  line_price: number | string;
  product_type: string | null;
  trial_period: number | null;
  offer_type: string | null;
  funnel_page_url: string | null;
  category: string | null;
}

interface LineItem {
  id: string;
  line_index: number;
  title: string;
  product_id: string | null;
  quantity: number;
  unit_price: number;
  line_price: number;
  product_type: string | null;
  trial_period: number | null;
  offer_type: OfferType;
  funnel_page_url: string | null;
  category: string | null;
}

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
  processor: string;
  status: string;
  lineItems: LineItem[];
}

interface SavedView {
  id: string;
  name: string;
  categoryFilters?: string[];
  // Kept for views saved before multi-select category filters were added.
  categoryFilter?: string;
  offerTypeFilters?: OfferType[];
  processorFilters?: string[];
  dateFrom?: string;
  dateTo?: string;
  search: string;
}

interface ContactOption {
  id: string;
  name: string;
  email: string;
  phone: string;
}

interface ManualTransactionForm {
  contactId: string;
  date: string;
  description: string;
  category: string;
  amount: string;
  processor: string;
  status: string;
}

// ─── Constants ───────────────────────────────────────────────────────
const categories = ["All", "Hardcover Book", "Digital Book", "Course", "Live", "Velocity", "Summit"];
const offerTypeFilterOptions: { value: OfferType; label: string }[] = [
  { value: "manual", label: "Manual" },
  { value: "main", label: "Main" },
  { value: "bump", label: "Bump" },
  { value: "upsell", label: "Upsell" },
  { value: "downsell", label: "Downsell" },
];
const processorFilterOptions = ["NMI", "Stripe", "Venmo", "Zelle", "Cash"];

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
  Velocity: "bg-orange/20 text-orange border-orange/30",
  Summit: "bg-pink-500/20 text-pink-700 dark:text-pink-400 border-pink-500/30",
  Course: "bg-cobalt/15 text-cobalt border-cobalt/40",
};

// How the product was sold. Derived in Postgres from GHL's
// product_submission_type + funnel sub-source; see derive_offer_type().
const offerTypeLabels: Record<OfferType, string> = {
  main: "Main",
  bump: "Bump",
  upsell: "Upsell",
  downsell: "Downsell",
  manual: "Manual",
  unknown: "—",
};

const offerTypeColors: Record<OfferType, string> = {
  main: "bg-slate-600 text-white border-slate-600",
  bump: "bg-amber-600 text-white border-amber-600",
  upsell: "bg-green-600 text-white border-green-600",
  downsell: "bg-rose-400 text-white border-rose-400",
  manual: "bg-cobalt text-white border-cobalt",
  unknown: "bg-zinc-600 text-white border-zinc-600",
};

const statusColors: Record<string, string> = {
  Paid: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
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

const createEmptyManualTransaction = (): ManualTransactionForm => ({
  contactId: "",
  date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  description: "",
  category: "",
  amount: "",
  processor: "NMI",
  status: "Paid",
});

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
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "category", label: "Product" },
  { key: "productCategory", label: "Category" },
  { key: "offerType", label: "Type" },
  { key: "amount", label: "Amount" },
  { key: "processor", label: "Processor" },
  { key: "status", label: "Status" },
] as const;

type ColumnKey = typeof allColumns[number]["key"];
const allColumnKeys = allColumns.map((c) => c.key);

export default function TransactionsDashboard() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  const [offerTypeFilters, setOfferTypeFilters] = useState<OfferType[]>([]);
  const [processorFilters, setProcessorFilters] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [activeDateFrom, setActiveDateFrom] = useState<string | undefined>();
  const [activeDateTo, setActiveDateTo] = useState<string | undefined>();
  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  const [columnFilterOpen, setColumnFilterOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(new Set(allColumnKeys));
  const [selectedContact, setSelectedContact] = useState<{ contact_id: string; name: string; email: string; phone: string } | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const [manualTransaction, setManualTransaction] = useState<ManualTransactionForm>(createEmptyManualTransaction);

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

  const hasFilters =
    categoryFilters.length > 0 ||
    offerTypeFilters.length > 0 ||
    processorFilters.length > 0 ||
    !!activeDateFrom;

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

  const toggleCategory = (category: string) => {
    setCategoryFilters((current) => {
      if (category === "All") return [];
      return current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category];
    });
    setActiveViewId(null);
  };

  const toggleOfferType = (offerType: OfferType) => {
    setOfferTypeFilters((current) =>
      current.includes(offerType)
        ? current.filter((item) => item !== offerType)
        : [...current, offerType]
    );
    setActiveViewId(null);
  };

  const toggleProcessor = (processor: string) => {
    setProcessorFilters((current) =>
      current.includes(processor)
        ? current.filter((item) => item !== processor)
        : [...current, processor]
    );
    setActiveViewId(null);
  };

  // ── Fetch from DB ──────────────────────────────────────────────────
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["transactions-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select(
          "*, contacts(id, name, email, phone), transaction_line_items(id, line_index, title, product_id, quantity, unit_price, line_price, product_type, trial_period, offer_type, funnel_page_url, category)"
        )
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        contact_id: r.contacts?.id ?? r.contact_id,
        date: r.date,
        name: r.contacts?.name ?? "Unknown",
        phone: r.contacts?.phone ?? "",
        email: r.contacts?.email ?? "",
        category: r.category,
        description: r.description,
        amount: Number(r.amount),
        processor: r.processor,
        status: r.status,
        lineItems: ((r.transaction_line_items ?? []) as RawLineItem[])
          .map((li) => ({
            id: li.id,
            line_index: li.line_index,
            title: li.title,
            product_id: li.product_id,
            quantity: li.quantity,
            unit_price: Number(li.unit_price),
            line_price: Number(li.line_price),
            product_type: li.product_type,
            trial_period: li.trial_period,
            offer_type: (li.offer_type ?? "unknown") as OfferType,
            funnel_page_url: li.funnel_page_url,
            category: li.category,
          }))
          .sort((a, b) => a.line_index - b.line_index),
      })) as Transaction[];
    },
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["transaction-contact-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, name, email, phone")
        .order("name");
      if (error) throw error;
      return (data ?? []) as ContactOption[];
    },
  });

  const selectedManualContact = contacts.find((contact) => contact.id === manualTransaction.contactId);

  const addTransaction = useMutation({
    mutationFn: async (form: ManualTransactionForm) => {
      const amount = Number(form.amount);
      if (!form.contactId) throw new Error("Select a contact");
      if (!form.date) throw new Error("Enter a transaction date");
      if (!form.description.trim()) throw new Error("Enter a product or description");
      if (!form.category) throw new Error("Select a category");
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter an amount greater than $0");

      const { error } = await supabase.from("transactions").insert({
        contact_id: form.contactId,
        date: new Date(form.date).toISOString(),
        description: form.description.trim(),
        category: form.category,
        amount,
        processor: form.processor,
        status: form.status.trim() || "Paid",
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["transactions-all"] });
      setAddDialogOpen(false);
      setManualTransaction(createEmptyManualTransaction());
      toast.success("Transaction added");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Could not add transaction");
    },
  });

  const handleAddDialogChange = (open: boolean) => {
    setAddDialogOpen(open);
    setContactPickerOpen(false);
    if (!open && !addTransaction.isPending) {
      setManualTransaction(createEmptyManualTransaction());
    }
  };

  const updateStatus = useMutation({
    mutationFn: async ({ transactionId, status }: { transactionId: string; status: string }) => {
      const { error } = await supabase
        .from("transactions")
        .update({ status })
        .eq("id", transactionId);
      if (error) throw error;
    },
    onMutate: async ({ transactionId, status }) => {
      await queryClient.cancelQueries({ queryKey: ["transactions-all"] });
      const previous = queryClient.getQueryData<Transaction[]>(["transactions-all"]);
      queryClient.setQueryData<Transaction[]>(["transactions-all"], (current = []) =>
        current.map((transaction) =>
          transaction.id === transactionId ? { ...transaction, status } : transaction
        )
      );
      return { previous };
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["transactions-all"], context.previous);
      }
      toast.error(error.message || "Could not update transaction status");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions-all"] });
      toast.success("Transaction status updated");
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

    // The category filter is applied per product when the rows are built, not
    // here -- filtering whole transactions would drag in sibling products that
    // don't match the chip.

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
  }, [transactions, search, activeDateFrom, activeDateTo]);

  // ── Flatten to one row per product ─────────────────────────────────────
  // A purchase with an order bump becomes two adjacent rows sharing the same
  // timestamp and name. Transactions with no line items (manual charges) still
  // get a single row so nothing disappears from the ledger.
  const rows = useMemo(() => {
    const out: {
      key: string;
      tx: Transaction;
      li: LineItem | null;
      firstOfGroup: boolean;
      groupSize: number;
      charged: number;
      unreconciled: boolean;
    }[] = [];

    for (const t of filtered) {
      if (processorFilters.length > 0 && !processorFilters.includes(t.processor)) {
        continue;
      }

      const transactionCategories = new Set(
        t.lineItems.length > 0
          ? t.lineItems.map((li) => li.category).filter((category): category is string => !!category)
          : [t.category]
      );
      if (
        categoryFilters.length > 0 &&
        !categoryFilters.some((category) => transactionCategories.has(category))
      ) {
        continue;
      }

      if (t.lineItems.length === 0) {
        if (offerTypeFilters.length > 0 && !offerTypeFilters.includes("manual")) continue;
        out.push({ key: t.id, tx: t, li: null, firstOfGroup: true, groupSize: 1, charged: t.amount, unreconciled: false });
        continue;
      }

      // Once a purchase satisfies any selected category, show its matching
      // product rows together. With no category selection, show the full order.
      const items = t.lineItems.filter(
        (li) =>
          (categoryFilters.length === 0 || (!!li.category && categoryFilters.includes(li.category))) &&
          (offerTypeFilters.length === 0 || offerTypeFilters.includes(li.offer_type))
      );
      if (items.length === 0) continue;

      // Reconciliation is judged against the WHOLE purchase even when the view
      // is filtered, otherwise hiding a sibling product would look like a
      // shortfall that isn't there.
      const sum = t.lineItems.reduce((s, li) => s + li.line_price, 0);
      const reconciles = Math.abs(sum - t.amount) < 0.01;

      items.forEach((li, i) => {
        // On a downsell the line carries the $67 list price but only the $7
        // trial was captured. With a single line the transaction amount is the
        // truth; a multi-line mismatch keeps line_price and is flagged instead
        // of being silently reallocated.
        const charged = reconciles || t.lineItems.length > 1 ? li.line_price : t.amount;
        out.push({
          key: li.id,
          tx: t,
          li,
          firstOfGroup: i === 0,
          groupSize: items.length,
          charged,
          unreconciled: !reconciles && t.lineItems.length > 1,
        });
      });
    }
    return out;
  }, [filtered, categoryFilters, offerTypeFilters, processorFilters]);

  // Sum what is actually on screen. Unfiltered this equals the sum of
  // transaction totals; filtered it reflects just the matching products,
  // so the figure never contradicts the rows beneath it.
  const totalRevenue = useMemo(() => rows.reduce((s, r) => s + r.charged, 0), [rows]);
  const purchaseCount = useMemo(() => new Set(rows.map((r) => r.tx.id)).size, [rows]);

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
      categoryFilters,
      offerTypeFilters,
      processorFilters,
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
    setCategoryFilters(
      view.categoryFilters ??
        (view.categoryFilter && view.categoryFilter !== "All" ? [view.categoryFilter] : [])
    );
    setOfferTypeFilters(view.offerTypeFilters ?? []);
    setProcessorFilters(view.processorFilters ?? []);
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
    setCategoryFilters([]);
    setOfferTypeFilters([]);
    setProcessorFilters([]);
    clearDateRange();
    setSearch("");
    setActiveViewId(null);
  };

  if (isLoading) return <div className="text-steel text-sm p-4">Loading…</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl text-gold tracking-wide">Transactions</h2>
          <p className="text-xs text-steel mt-1">
            Payment transactions received — {rows.length} products across {purchaseCount}{hasFilters ? ` of ${transactions.length}` : ""} purchases · {currencyFormatter.format(totalRevenue)} collected
          </p>
        </div>
        <Button size="sm" className="h-8 shrink-0 gap-1.5 text-xs" onClick={() => setAddDialogOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Add Transaction
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 overflow-x-auto">
        <div className="relative shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-steel" />
          <Input
            placeholder="Search…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setActiveViewId(null); }}
            className="pl-8 w-48 bg-card border-border text-foreground text-xs h-8"
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-8 shrink-0 gap-1.5 text-xs border-border hover:bg-muted",
                categoryFilters.length > 0 ? "text-primary border-primary/30" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Category{categoryFilters.length > 0 ? ` (${categoryFilters.length})` : ""}
              <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-2 bg-card border-border" align="start">
            <label className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-muted">
              <Checkbox checked={categoryFilters.length === 0} onCheckedChange={() => toggleCategory("All")} />
              <span className="text-xs text-foreground">All categories</span>
            </label>
            {categories.slice(1).map((category) => (
              <label key={category} className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-muted">
                <Checkbox checked={categoryFilters.includes(category)} onCheckedChange={() => toggleCategory(category)} />
                <span className="text-xs text-foreground">{category}</span>
              </label>
            ))}
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-8 shrink-0 gap-1.5 text-xs border-border hover:bg-muted",
                offerTypeFilters.length > 0 ? "text-primary border-primary/30" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Type{offerTypeFilters.length > 0 ? ` (${offerTypeFilters.length})` : ""}
              <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-44 p-2 bg-card border-border" align="start">
            <label className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-muted">
              <Checkbox checked={offerTypeFilters.length === 0} onCheckedChange={() => { setOfferTypeFilters([]); setActiveViewId(null); }} />
              <span className="text-xs text-foreground">All types</span>
            </label>
            {offerTypeFilterOptions.map(({ value, label }) => (
              <label key={value} className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-muted">
                <Checkbox checked={offerTypeFilters.includes(value)} onCheckedChange={() => toggleOfferType(value)} />
                <span className="text-xs text-foreground">{label}</span>
              </label>
            ))}
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-8 shrink-0 gap-1.5 text-xs border-border hover:bg-muted",
                processorFilters.length > 0 ? "text-primary border-primary/30" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Processor{processorFilters.length > 0 ? ` (${processorFilters.length})` : ""}
              <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-44 p-2 bg-card border-border" align="start">
            <label className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-muted">
              <Checkbox checked={processorFilters.length === 0} onCheckedChange={() => { setProcessorFilters([]); setActiveViewId(null); }} />
              <span className="text-xs text-foreground">All processors</span>
            </label>
            {processorFilterOptions.map((processor) => (
              <label key={processor} className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-muted">
                <Checkbox checked={processorFilters.includes(processor)} onCheckedChange={() => toggleProcessor(processor)} />
                <span className="text-xs text-foreground">{processor}</span>
              </label>
            ))}
          </PopoverContent>
        </Popover>

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
                {isCol("email") && <TableHead className="w-[150px] max-w-[150px] whitespace-nowrap text-xs font-semibold text-steel">Email</TableHead>}
                {isCol("phone") && <TableHead className="whitespace-nowrap text-xs font-semibold text-steel min-w-[120px]">Phone</TableHead>}
                {isCol("category") && <TableHead className="whitespace-nowrap text-xs font-semibold text-steel min-w-[180px]">Product</TableHead>}
                {isCol("productCategory") && <TableHead className="whitespace-nowrap text-xs font-semibold text-steel min-w-[110px]">Category</TableHead>}
                {isCol("offerType") && <TableHead className="w-px whitespace-nowrap text-xs font-semibold text-steel">Type</TableHead>}
                {isCol("amount") && <TableHead className="whitespace-nowrap text-xs font-semibold text-steel min-w-[100px] text-right">Amount</TableHead>}
                {isCol("processor") && <TableHead className="whitespace-nowrap text-xs font-semibold text-steel min-w-[90px]">Processor</TableHead>}
                {isCol("status") && <TableHead className="whitespace-nowrap text-xs font-semibold text-steel min-w-[110px]">Status</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const { tx: t, li } = row;
                // Continuation rows of the same purchase repeat neither the
                // timestamp nor the name -- the blank cells plus the left rule
                // are what visually bind the group together.
                const cont = !row.firstOfGroup;
                const grouped = row.groupSize > 1;
                return (
                  <TableRow
                    key={row.key}
                    className={cn("hover:bg-muted/20", cont && "border-t-0")}
                  >
                    {isCol("date") && (
                      <TableCell
                        className={cn(
                          "whitespace-nowrap text-sm text-foreground",
                          grouped && "border-l-2 border-gold/40"
                        )}
                      >
                        {cont ? "" : fmtDate(t.date)}
                      </TableCell>
                    )}
                    {isCol("name") && (
                      <TableCell className="whitespace-nowrap text-sm font-medium">
                        {cont ? (
                          ""
                        ) : (
                          <button
                            onClick={() => setSelectedContact({ contact_id: t.contact_id, name: t.name, email: t.email, phone: t.phone })}
                            className="text-foreground hover:text-gold transition-colors text-left"
                          >
                            {t.name}
                          </button>
                        )}
                      </TableCell>
                    )}
                    {isCol("email") && (
                      <TableCell className="w-[150px] max-w-[150px] text-sm text-foreground">
                        <span className="block truncate" title={cont ? undefined : t.email}>
                          {cont ? "" : t.email}
                        </span>
                      </TableCell>
                    )}
                    {isCol("phone") && (
                      <TableCell className="whitespace-nowrap text-sm text-foreground">
                        {cont ? "" : t.phone || "\u2014"}
                      </TableCell>
                    )}
                    {isCol("category") && (
                      <TableCell className="text-sm text-foreground">
                        {li ? (
                          <div className="flex items-center gap-1.5">
                            <span>{li.title}</span>
                            {li.quantity > 1 && (
                              <span className="text-steel text-xs">\u00d7{li.quantity}</span>
                            )}
                          </div>
                        ) : t.description ? (
                          <span>{t.description}</span>
                        ) : (
                          <span className="text-steel">\u2014</span>
                        )}
                      </TableCell>
                    )}
                    {isCol("productCategory") && (
                      <TableCell className="whitespace-nowrap">
                        {/* Short label mapped per product_id -- see product_categories.
                            Manual charges have no line item, so fall back to the
                            transaction's own category. */}
                        {(() => {
                          const cat = li ? li.category : t.category;
                          return cat ? (
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 ${categoryColors[cat] || ""}`}
                            >
                              {cat}
                            </Badge>
                          ) : null;
                        })()}
                      </TableCell>
                    )}
                    {isCol("offerType") && (
                      <TableCell className="whitespace-nowrap">
                        {li ? (
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${offerTypeColors[li.offer_type]}`}
                            title={li.funnel_page_url ? `Sold on ${li.funnel_page_url}` : undefined}
                          >
                            {offerTypeLabels[li.offer_type]}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${offerTypeColors.manual}`}
                          >
                            Manual
                          </Badge>
                        )}
                      </TableCell>
                    )}
                    {isCol("amount") && (
                      <TableCell className="whitespace-nowrap text-sm text-foreground text-right tabular-nums">
                        {currencyFormatter.format(row.charged)}
                        {row.unreconciled && (
                          <div className="text-[10px] text-amber-600 dark:text-amber-500">
                            charged {currencyFormatter.format(t.amount)} total
                          </div>
                        )}
                      </TableCell>
                    )}
                    {isCol("processor") && (
                      <TableCell className="whitespace-nowrap text-sm text-foreground">
                        {cont ? "" : t.processor}
                      </TableCell>
                    )}
                    {isCol("status") && (
                      <TableCell className="whitespace-nowrap">
                        {cont ? "" : (
                          <div className={cn(
                            "rounded-sm border px-1.5 py-0.5",
                            statusColors[t.status] || "border-border"
                          )}>
                            <EditableCell
                              value={t.status}
                              onChange={(status) =>
                                updateStatus.mutate({ transactionId: t.id, status })
                              }
                            />
                          </div>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
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

      <Dialog open={addDialogOpen} onOpenChange={handleAddDialogChange}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-gold tracking-wide">Add Transaction</DialogTitle>
            <DialogDescription>
              Record a payment that was received outside the automatic payment sync.
            </DialogDescription>
          </DialogHeader>

          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              addTransaction.mutate(manualTransaction);
            }}
          >
            <div className="grid gap-1.5">
              <Label>Contact</Label>
              <Popover open={contactPickerOpen} onOpenChange={setContactPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={contactPickerOpen}
                    className="h-9 w-full justify-between bg-muted font-normal"
                  >
                    {selectedManualContact ? (
                      <span className="truncate">
                        {selectedManualContact.name} · {selectedManualContact.email}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Search contacts…</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search by name or email…" />
                    <CommandList>
                      <CommandEmpty>No contact found.</CommandEmpty>
                      <CommandGroup>
                        {contacts.map((contact) => (
                          <CommandItem
                            key={contact.id}
                            value={`${contact.name} ${contact.email}`}
                            onSelect={() => {
                              setManualTransaction((current) => ({ ...current, contactId: contact.id }));
                              setContactPickerOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", manualTransaction.contactId === contact.id ? "opacity-100" : "opacity-0")} />
                            <span className="min-w-0">
                              <span className="block truncate text-sm">{contact.name}</span>
                              <span className="block truncate text-xs text-muted-foreground">{contact.email}</span>
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <div className="grid min-w-0 gap-1.5">
                <Label htmlFor="manual-transaction-date">Date</Label>
                <Input
                  id="manual-transaction-date"
                  type="datetime-local"
                  value={manualTransaction.date}
                  onChange={(event) => setManualTransaction((current) => ({ ...current, date: event.target.value }))}
                  className="h-9 min-w-0 w-full bg-muted"
                  required
                />
              </div>
              <div className="grid min-w-0 gap-1.5">
                <Label htmlFor="manual-transaction-amount">Amount</Label>
                <div className="relative min-w-0">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input
                    id="manual-transaction-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={manualTransaction.amount}
                    onChange={(event) => setManualTransaction((current) => ({ ...current, amount: event.target.value }))}
                    className="h-9 min-w-0 w-full bg-muted pl-7"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="manual-transaction-description">Product or description</Label>
              <Input
                id="manual-transaction-description"
                placeholder="e.g. FIU Live ticket"
                value={manualTransaction.description}
                onChange={(event) => setManualTransaction((current) => ({ ...current, description: event.target.value }))}
                className="h-9 bg-muted"
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Category</Label>
                <Select
                  value={manualTransaction.category}
                  onValueChange={(category) => setManualTransaction((current) => ({ ...current, category }))}
                >
                  <SelectTrigger className="h-9 bg-muted">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.slice(1).map((category) => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Processor</Label>
                <Select
                  value={manualTransaction.processor}
                  onValueChange={(processor) => setManualTransaction((current) => ({ ...current, processor }))}
                >
                  <SelectTrigger className="h-9 bg-muted">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["NMI", "Stripe", "Venmo", "Cash", "Zelle"].map((processor) => (
                      <SelectItem key={processor} value={processor}>{processor}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="manual-transaction-status">Status</Label>
                <Input
                  id="manual-transaction-status"
                  value={manualTransaction.status}
                  onChange={(event) => setManualTransaction((current) => ({ ...current, status: event.target.value }))}
                  className="h-9 bg-muted"
                />
              </div>
            </div>

            <DialogFooter className="mt-2 gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => handleAddDialogChange(false)} disabled={addTransaction.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={addTransaction.isPending}>
                {addTransaction.isPending ? "Adding…" : "Add Transaction"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
