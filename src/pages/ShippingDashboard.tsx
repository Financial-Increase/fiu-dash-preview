import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
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
import { Checkbox } from "@/components/ui/checkbox";
import ContactCardDialog from "@/components/ContactCardDialog";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────
interface ShipmentRecord {
  id: string;
  contact_id: string;
  date_ordered: string;
  date_shipped: string | null;
  quantity: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  tracking_number: string;
  carrier: string;
  fulfillment_status: string;
  tracking_status: string;
  delivered: string;
  label_url: string | null;
}

type ColumnType = "text" | "select" | "boolean" | "date";

// ─── Column definitions ──────────────────────────────────────────────
const columns: { key: keyof ShipmentRecord; label: string; type?: ColumnType; options?: string[]; minWidth: number; editable?: boolean }[] = [
  { key: "date_ordered", label: "Date Ordered", type: "date", minWidth: 100, editable: false },
  { key: "date_shipped", label: "Date Shipped", type: "date", minWidth: 100, editable: true },
  { key: "quantity", label: "Quantity", minWidth: 70, editable: false },
  { key: "name", label: "Name", minWidth: 150, editable: false },
  { key: "address", label: "Address", minWidth: 200 },
  { key: "city", label: "City", minWidth: 120 },
  { key: "state", label: "State", minWidth: 70 },
  { key: "zip", label: "Zip", minWidth: 80 },
];

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

function formatToPacific(isoString: string): string {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString("en-US", {
      timeZone: "America/Los_Angeles",
      month: "2-digit",
      day: "2-digit",
      year: "2-digit",
    });
  } catch {
    return isoString;
  }
}

// ─── Component ───────────────────────────────────────────────────────
export default function ShippingDashboard() {
  const queryClient = useQueryClient();
  const [selectedContact, setSelectedContact] = useState<{ contact_id: string; name: string; email: string; phone: string } | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [bulkShipDate, setBulkShipDate] = useState(() => format(new Date(), "yyyy-MM-dd"));

  // ── Fetch from DB ──────────────────────────────────────────────────
  const { data: dbData = [], isLoading } = useQuery({
    queryKey: ["book-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("book_orders")
        .select("*, contacts(id, name, email, phone)")
        .order("date_ordered", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id,
        contact_id: r.contacts?.id ?? r.contact_id,
        date_ordered: r.date_ordered ?? "",
        date_shipped: r.date_shipped ?? null,
        quantity: r.quantity ?? 1,
        name: r.contacts?.name ?? "Unknown",
        email: r.contacts?.email ?? "",
        phone: r.contacts?.phone ?? "",
        address: r.address,
        city: r.city,
        state: r.state,
        zip: r.zip,
        tracking_number: r.tracking_number,
        carrier: r.carrier,
        fulfillment_status: r.fulfillment_status,
        tracking_status: r.tracking_status,
        delivered: r.delivered ? "Yes" : "No",
        label_url: r.label_url ?? null,
      })) as ShipmentRecord[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: string }) => {
      let updatePayload: any;
      if (field === "delivered") {
        updatePayload = { delivered: value === "Yes" };
      } else if (field === "date_shipped") {
        // Clearing the cell sends "" — store NULL so the row goes back
        // into the To Be Shipped section.
        updatePayload = { date_shipped: value ? value : null };
      } else {
        updatePayload = { [field]: value };
      }
      const { error } = await supabase.from("book_orders").update(updatePayload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["book-orders"] });
    },
  });

  const updateField = (id: string, field: keyof ShipmentRecord, value: string) => {
    if (field === "name" || field === "email" || field === "phone" || field === "contact_id") return;
    updateMutation.mutate({ id, field, value });
  };

  const bulkShipMutation = useMutation({
    mutationFn: async ({ ids, date }: { ids: string[]; date: string }) => {
      const { error } = await supabase
        .from("book_orders")
        .update({ date_shipped: date })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["book-orders"] });
      setSelectedOrderIds(new Set());
      toast.success(`${variables.ids.length} ${variables.ids.length === 1 ? "order" : "orders"} marked shipped`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const filteredData = dbData;

  if (isLoading) return <div className="text-steel text-sm p-4">Loading…</div>;

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <h2 className="font-heading text-xl tracking-wide text-gold">Hardcover Book Shipping</h2>
        <p className="text-xs text-steel mt-1">
          Click any field to edit · Process shipments and update tracking info
        </p>
      </div>

      {/* Two separate boxes — To Be Shipped on top, Shipped on bottom.
          Filling in a Date Shipped on a To Be Shipped row drops it into
          the Shipped box automatically. */}
      {(() => {
        const toBeShipped = filteredData
          .filter((r) => !r.date_shipped)
          .sort((a, b) => {
            const aTime = extractDate(a.date_ordered)?.getTime() ?? Number.MAX_SAFE_INTEGER;
            const bTime = extractDate(b.date_ordered)?.getTime() ?? Number.MAX_SAFE_INTEGER;
            return aTime - bTime;
          });
        const shipped = filteredData
          .filter((r) => r.date_shipped)
          .sort((a, b) => {
            const aTime = extractDate(a.date_shipped ?? "")?.getTime() ?? 0;
            const bTime = extractDate(b.date_shipped ?? "")?.getTime() ?? 0;
            return bTime - aTime;
          });

        const renderCell = (row: ShipmentRecord, col: typeof columns[number]) => {
          const raw = row[col.key];
          if (col.key === "name") {
            return (
              <button
                onClick={() => setSelectedContact({ contact_id: row.contact_id, name: row.name, email: row.email, phone: row.phone })}
                className="text-foreground hover:text-gold transition-colors text-left font-medium"
              >
                {row.name}
              </button>
            );
          }
          if (col.editable === false) {
            return (
              <span className="text-foreground">
                {col.key === "date_ordered" ? formatToPacific(row.date_ordered) : (raw ?? "—")}
              </span>
            );
          }
          return (
            <EditableCell
              value={(raw ?? "") as string}
              onChange={(v) => updateField(row.id, col.key, v)}
              type={col.type ?? "text"}
              options={col.options}
            />
          );
        };

        const renderBox = (
          title: string,
          rows: ShipmentRecord[],
          emptyMsg: string,
          accent: "amber" | "emerald",
          selectable = false,
        ) => {
          const accentClasses = accent === "amber"
            ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
            : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
          const visibleSelectedIds = rows.filter((row) => selectedOrderIds.has(row.id)).map((row) => row.id);
          const allVisibleSelected = rows.length > 0 && visibleSelectedIds.length === rows.length;
          const someVisibleSelected = visibleSelectedIds.length > 0 && !allVisibleSelected;

          const toggleAllVisible = (checked: boolean) => {
            setSelectedOrderIds((previous) => {
              const next = new Set(previous);
              for (const row of rows) {
                if (checked) next.add(row.id);
                else next.delete(row.id);
              }
              return next;
            });
          };

          const markSelectedShipped = () => {
            if (!bulkShipDate || visibleSelectedIds.length === 0) return;
            bulkShipMutation.mutate({ ids: visibleSelectedIds, date: bulkShipDate });
          };

          return (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className={`px-4 py-2.5 border-b border-border flex items-center justify-between gap-3 ${accentClasses}`}>
                <p className="text-xs uppercase tracking-wider font-semibold">
                  {title} <span className="text-steel font-normal ml-1">({rows.length})</span>
                </p>
                {selectable && visibleSelectedIds.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs normal-case text-foreground">
                      {visibleSelectedIds.length} selected
                    </span>
                    <input
                      type="date"
                      value={bulkShipDate}
                      onChange={(event) => setBulkShipDate(event.target.value)}
                      aria-label="Shipped date"
                      className="h-7 rounded-sm border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-gold"
                    />
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      onClick={markSelectedShipped}
                      disabled={!bulkShipDate || bulkShipMutation.isPending}
                    >
                      {bulkShipMutation.isPending ? "Updating…" : "Mark Shipped"}
                    </Button>
                  </div>
                )}
              </div>
              <div className="overflow-x-auto scrollbar-thin">
                <Table className="min-w-[1050px] [&_th]:h-8 [&_th]:px-3 [&_td]:px-3 [&_td]:py-1">
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      {selectable && (
                        <TableHead className="w-10 min-w-10">
                          <Checkbox
                            checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                            onCheckedChange={(checked) => toggleAllVisible(checked === true)}
                            aria-label="Select all orders waiting to ship"
                          />
                        </TableHead>
                      )}
                      {columns.map((col) => (
                        <TableHead
                          key={col.key}
                          className="text-steel text-[10px] uppercase tracking-wider font-semibold"
                          style={{ minWidth: col.minWidth, width: col.minWidth }}
                        >
                          {col.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={columns.length + (selectable ? 1 : 0)} className="text-center py-8 text-steel text-sm">
                          {emptyMsg}
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((row) => (
                        <TableRow key={row.id} className="border-border hover:bg-muted/30 transition-colors">
                          {selectable && (
                            <TableCell className="w-10 min-w-10">
                              <Checkbox
                                checked={selectedOrderIds.has(row.id)}
                                onCheckedChange={(checked) => {
                                  setSelectedOrderIds((previous) => {
                                    const next = new Set(previous);
                                    if (checked === true) next.add(row.id);
                                    else next.delete(row.id);
                                    return next;
                                  });
                                }}
                                aria-label={`Select order for ${row.name}`}
                              />
                            </TableCell>
                          )}
                          {columns.map((col) => (
                            <TableCell
                              key={col.key}
                              className="text-sm whitespace-nowrap"
                              style={{ minWidth: col.minWidth, width: col.minWidth }}
                            >
                              {renderCell(row, col)}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          );
        };

        return (
          <div className="space-y-6">
            {renderBox("To Be Shipped", toBeShipped, "Nothing waiting to ship.", "amber", true)}
            {renderBox("Shipped", shipped, "No shipped orders yet.", "emerald")}
          </div>
        );
      })()}

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
