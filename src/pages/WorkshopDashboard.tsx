import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import EditableCell from "@/components/EditableCell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Save,
  Trash2,
  X,
  BookmarkCheck,
  CalendarIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

// ─── Types ───────────────────────────────────────────────────────────
interface WorkshopContact {
  id: string;
  registration_id: string;
  date_registered: string;
  name: string;
  email: string;
  phone: string;
  source_1: string;
  source_2: string;
  source_3: string;
  source_4: string;
  source_5: string;
  workshop_date: string;
  attended: string;
  membership_status: string;
}

interface ColumnFilter {
  column: keyof WorkshopContact;
  value: string;
  dateFrom?: string;
  dateTo?: string;
  isDate?: boolean;
}

interface SavedView {
  id: string;
  name: string;
  filters: ColumnFilter[];
}

type ColumnType = "text" | "select" | "boolean" | "date";

// ─── Column definitions ──────────────────────────────────────────────
const columns: { key: keyof WorkshopContact; label: string; type?: ColumnType; options?: string[]; minWidth: number }[] = [
  { key: "date_registered", label: "Registered", type: "date", minWidth: 180 },
  { key: "name", label: "Name", minWidth: 150 },
  { key: "email", label: "Email", minWidth: 180 },
  { key: "phone", label: "Phone", minWidth: 140 },
  { key: "source_1", label: "Source 1", minWidth: 120 },
  { key: "source_2", label: "Source 2", minWidth: 110 },
  { key: "source_3", label: "Source 3", minWidth: 130 },
  { key: "source_4", label: "Source 4", minWidth: 120 },
  { key: "source_5", label: "Source 5", minWidth: 120 },
  { key: "workshop_date", label: "Workshop Date", type: "date", minWidth: 130 },
  { key: "attended", label: "Attended", type: "boolean", minWidth: 100 },
  { key: "membership_status", label: "Membership", type: "select", options: ["Active", "Paused", "Canceled", "Expired", "—"], minWidth: 120 },
];

const isDateColumn = (key: keyof WorkshopContact) => columns.find((c) => c.key === key)?.type === "date";

// ─── Helpers ─────────────────────────────────────────────────────────
function extractDate(val: string): Date | null {
  if (!val) return null;
  try {
    const d = parseISO(val);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
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
export default function WorkshopDashboard() {
  const queryClient = useQueryClient();

  const { data: dbData = [], isLoading } = useQuery({
    queryKey: ["workshop-registrations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workshop_registrations")
        .select("*, contacts(id, name, email, phone, source_1, source_2, source_3, source_4, source_5)")
        .order("date_registered", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.contacts.id,
        registration_id: r.id,
        date_registered: r.date_registered,
        name: r.contacts.name,
        email: r.contacts.email,
        phone: r.contacts.phone,
        source_1: r.contacts.source_1,
        source_2: r.contacts.source_2,
        source_3: r.contacts.source_3,
        source_4: r.contacts.source_4,
        source_5: r.contacts.source_5,
        workshop_date: r.workshop_date ?? "",
        attended: r.attended ? "Yes" : "No",
        membership_status: r.membership_status,
      })) as WorkshopContact[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ registrationId, field, value }: { registrationId: string; field: string; value: string }) => {
      if (["name", "email", "phone", "source_1", "source_2", "source_3", "source_4", "source_5"].includes(field)) {
        const row = dbData.find((r) => r.registration_id === registrationId);
        if (!row) return;
        const updateObj: Record<string, string> = {};
        updateObj[field] = value;
        const { error } = await supabase.from("contacts").update(updateObj as any).eq("id", row.id);
        if (error) throw error;
      } else {
        let dbValue: any = value;
        if (field === "attended") dbValue = value === "Yes";
        const updateObj: Record<string, any> = {};
        updateObj[field] = dbValue;
        const { error } = await supabase.from("workshop_registrations").update(updateObj as any).eq("id", registrationId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workshop-registrations"] });
    },
  });

  const [filters, setFilters] = useState<ColumnFilter[]>([]);
  const [selectedContact, setSelectedContact] = useState<WorkshopContact | null>(null);
  const [savedViews, setSavedViews] = useState<SavedView[]>(() => {
    try {
      const stored = localStorage.getItem("fiu-workshop-views");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [saveViewName, setSaveViewName] = useState("");
  const [saveOpen, setSaveOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [newFilterCol, setNewFilterCol] = useState<keyof WorkshopContact>("source_1");
  const [newFilterVal, setNewFilterVal] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const selectedColIsDate = isDateColumn(newFilterCol);

  useEffect(() => {
    setNewFilterVal("");
    setDateRange(undefined);
  }, [newFilterCol]);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      ro.disconnect();
    };
  }, [checkScroll]);

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "right" ? 300 : -300, behavior: "smooth" });
  };

  const updateField = (registrationId: string, field: keyof WorkshopContact, value: string) => {
    updateMutation.mutate({ registrationId, field, value });
  };

  // ── Filter ops ──────────────────────────────────────────────────────
  const addFilter = () => {
    if (selectedColIsDate) {
      if (!dateRange?.from) return;
      const f: ColumnFilter = {
        column: newFilterCol,
        value: "",
        dateFrom: dateRange.from.toISOString(),
        dateTo: (dateRange.to ?? dateRange.from).toISOString(),
        isDate: true,
      };
      setFilters((prev) => [...prev, f]);
      setDateRange(undefined);
    } else {
      if (!newFilterVal.trim()) return;
      setFilters((prev) => [...prev, { column: newFilterCol, value: newFilterVal.trim() }]);
      setNewFilterVal("");
    }
    setFilterOpen(false);
    setActiveViewId(null);
  };

  const removeFilter = (index: number) => {
    setFilters((prev) => prev.filter((_, i) => i !== index));
    setActiveViewId(null);
  };

  const clearFilters = () => {
    setFilters([]);
    setActiveViewId(null);
  };

  const filteredData = dbData.filter((row) =>
    filters.every((f) => {
      if (f.isDate && f.dateFrom) {
        const rowDate = extractDate(row[f.column]);
        if (!rowDate) return false;
        const from = startOfDay(parseISO(f.dateFrom));
        const to = endOfDay(parseISO(f.dateTo ?? f.dateFrom));
        return isWithinInterval(rowDate, { start: from, end: to });
      }
      return row[f.column]?.toLowerCase().includes(f.value.toLowerCase());
    })
  );

  // ── Saved views ─────────────────────────────────────────────────────
  const persistViews = (views: SavedView[]) => {
    setSavedViews(views);
    localStorage.setItem("fiu-workshop-views", JSON.stringify(views));
  };

  const saveCurrentView = () => {
    if (!saveViewName.trim() || filters.length === 0) return;
    const view: SavedView = {
      id: crypto.randomUUID(),
      name: saveViewName.trim(),
      filters: [...filters],
    };
    persistViews([...savedViews, view]);
    setActiveViewId(view.id);
    setSaveViewName("");
    setSaveOpen(false);
  };

  const loadView = (view: SavedView) => {
    setFilters([...view.filters]);
    setActiveViewId(view.id);
  };

  const deleteView = (id: string) => {
    persistViews(savedViews.filter((v) => v.id !== id));
    if (activeViewId === id) setActiveViewId(null);
  };

  const colLabel = (key: string) => columns.find((c) => c.key === key)?.label ?? key;

  const filterChipLabel = (f: ColumnFilter) => {
    if (f.isDate && f.dateFrom) {
      const from = formatDateLabel(f.dateFrom);
      const to = f.dateTo ? formatDateLabel(f.dateTo) : from;
      return from === to ? `${colLabel(f.column)}: ${from}` : `${colLabel(f.column)}: ${from} → ${to}`;
    }
    return `${colLabel(f.column)}: ${f.value}`;
  };

  if (isLoading) return <div className="text-steel text-sm p-4">Loading…</div>;

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-baseline gap-3">
          <h2 className="font-heading text-xl tracking-wide text-gold">FIU Workshop</h2>
          <span className="text-xs text-steel font-body">
            ({filteredData.length}{filters.length > 0 ? ` of ${dbData.length}` : ""} registrants)
          </span>
        </div>
        <p className="text-xs text-steel mt-1">
          Click any field to edit · Scroll sideways for all columns · Filter &amp; save views
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Popover open={filterOpen} onOpenChange={setFilterOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs border-border text-muted-foreground hover:text-foreground hover:bg-muted">
              <Filter className="w-3.5 h-3.5" />
              Add Filter
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto min-w-[280px] p-3 bg-card border-border space-y-2" align="start">
            <p className="text-[10px] uppercase tracking-wider text-steel font-semibold">Filter by column</p>
            <Select value={newFilterCol} onValueChange={(v) => setNewFilterCol(v as keyof WorkshopContact)}>
              <SelectTrigger className="h-8 text-xs bg-muted border-border text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {columns.map((c) => (
                  <SelectItem key={c.key} value={c.key} className="text-xs">{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedColIsDate ? (
              <div className="space-y-2">
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
              </div>
            ) : (
              <Input
                placeholder="Contains…"
                className="h-8 text-xs bg-muted border-border text-foreground"
                value={newFilterVal}
                onChange={(e) => setNewFilterVal(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addFilter()}
              />
            )}

            <Button
              size="sm"
              className="h-7 text-xs w-full"
              onClick={addFilter}
              disabled={selectedColIsDate ? !dateRange?.from : !newFilterVal.trim()}
            >
              Apply Filter
            </Button>
          </PopoverContent>
        </Popover>

        {filters.length > 0 && (
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
                placeholder="e.g. Instagram Paid"
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

        {filters.map((f, i) => (
          <span key={i} className="inline-flex items-center gap-1 bg-emerald/30 text-gold text-[11px] font-medium px-2.5 py-1 rounded-sm whitespace-nowrap">
            {f.isDate && <CalendarIcon className="w-3 h-3" />}
            {filterChipLabel(f)}
            <button onClick={() => removeFilter(i)} className="hover:text-destructive transition-colors">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}

        {filters.length > 1 && (
          <button onClick={clearFilters} className="text-[10px] text-steel hover:text-destructive transition-colors underline">
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

      {/* Table with scroll */}
      <div className="relative rounded-lg border border-border overflow-hidden bg-card">
        {canScrollLeft && (
          <button
            onClick={() => scroll("left")}
            className="absolute left-0 top-0 bottom-0 z-10 w-8 bg-gradient-to-r from-card to-transparent flex items-center justify-center hover:from-card/90 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gold" />
          </button>
        )}
        {canScrollRight && (
          <button
            onClick={() => scroll("right")}
            className="absolute right-0 top-0 bottom-0 z-10 w-8 bg-gradient-to-l from-card to-transparent flex items-center justify-center hover:from-card/90 transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gold" />
          </button>
        )}

        <div ref={scrollRef} className="overflow-x-auto scrollbar-thin">
          <Table className="min-w-[1500px]">
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                {columns.map((col) => (
                  <TableHead
                    key={col.key}
                    className="text-steel text-[10px] uppercase tracking-wider font-semibold"
                    style={{ minWidth: col.minWidth }}
                  >
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-12 text-steel text-sm">
                    No registrants match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((row) => (
                  <TableRow key={row.registration_id} className="border-border hover:bg-muted/30 transition-colors">
                    {columns.map((col) => (
                      <TableCell key={col.key} className="text-sm whitespace-nowrap" style={{ minWidth: col.minWidth }}>
                        {col.key === "name" ? (
                          <button
                            onClick={() => setSelectedContact(row)}
                            className="font-medium text-foreground hover:text-gold transition-colors text-left"
                          >
                            {row[col.key]}
                          </button>
                        ) : (
                          <EditableCell
                            value={row[col.key]}
                            onChange={(v) => updateField(row.registration_id, col.key, v)}
                            type={col.type === "date" ? "text" : col.type ?? "text"}
                            options={col.options}
                          />
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {selectedContact && (
        <ContactCardDialog
          open={!!selectedContact}
          onOpenChange={(open) => !open && setSelectedContact(null)}
          contactId={selectedContact.id}
          contactName={selectedContact.name}
          email={selectedContact.email}
          phone={selectedContact.phone}
        />
      )}
    </div>
  );
}
