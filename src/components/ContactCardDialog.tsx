import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { User, Mail, Phone, Pencil, Check, X, Tag, Receipt, Plus } from "lucide-react";
import ContactNotes from "./ContactNotes";

interface ContactCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contactName: string;
  email?: string;
  phone?: string;
}

const statusColors: Record<string, string> = {
  Active: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  Paid: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  Enrolled: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  Bundled: "bg-gold/20 text-gold border-gold/30",
  Late: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  Failed: "bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30",
  Paused: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  Canceled: "bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30",
  Expired: "bg-steel/20 text-steel border-steel/30",
  Yes: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  No: "bg-muted text-muted-foreground border-border",
};

const productBadgeColors: Record<string, string> = {
  Book: "bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 border-cyan-500/30",
  Workshop: "bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30",
  Live: "bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-500/30",
  Velocity: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  Summit: "bg-pink-500/20 text-pink-700 dark:text-pink-400 border-pink-500/30",
};

function formatDate(d: string | null) {
  if (!d) return "—";
  try {
    const [y, m, day] = d.split("-");
    return `${m}/${day}/${y.slice(2)}`;
  } catch {
    return d;
  }
}

function FieldRow({ label, value, type = "text" }: { label: string; value: any; type?: "text" | "badge" | "currency" | "boolean" | "date" }) {
  const display = (() => {
    if (value === null || value === undefined || value === "") return "—";
    if (type === "badge") return (
      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusColors[String(value)] || "bg-muted text-muted-foreground"}`}>
        {String(value)}
      </Badge>
    );
    if (type === "currency") return <span className="font-mono text-gold">${Number(value).toLocaleString()}</span>;
    if (type === "boolean") return (
      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${value ? statusColors.Yes : statusColors.No}`}>
        {value ? "Yes" : "No"}
      </Badge>
    );
    if (type === "date") return formatDate(String(value));
    return String(value);
  })();

  return (
    <div>
      <span className="text-[10px] uppercase tracking-wider text-steel font-semibold">{label}</span>
      <div className="mt-0.5 text-sm text-foreground">{display}</div>
    </div>
  );
}

interface EditFieldProps {
  label: string;
  value: any;
  type?: "text" | "badge" | "currency" | "boolean" | "date";
  editing: boolean;
  onChange?: (val: any) => void;
  options?: string[];
}

function EditableFieldRow({ label, value, type = "text", editing, onChange, options }: EditFieldProps) {
  if (!editing) return <FieldRow label={label} value={value} type={type} />;

  return (
    <div>
      <span className="text-[10px] uppercase tracking-wider text-steel font-semibold">{label}</span>
      <div className="mt-0.5">
        {type === "boolean" ? (
          <Checkbox
            checked={!!value}
            onCheckedChange={(checked) => onChange?.(!!checked)}
            className="mt-1"
          />
        ) : type === "badge" && options ? (
          <Select value={String(value || "")} onValueChange={(v) => onChange?.(v)}>
            <SelectTrigger className="h-7 text-xs bg-muted border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : type === "currency" ? (
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-steel">$</span>
            <Input
              type="text"
              value={value != null && value !== "" ? Number(value).toLocaleString() : ""}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9.]/g, "");
                onChange?.(raw === "" ? 0 : Number(raw));
              }}
              className="h-7 text-xs bg-muted border-border text-foreground pl-5"
            />
          </div>
        ) : type === "date" ? (
          <Input
            type="date"
            value={value || ""}
            onChange={(e) => onChange?.(e.target.value || null)}
            className="h-7 text-xs bg-muted border-border text-foreground"
          />
        ) : (
          <Input
            value={value ?? ""}
            onChange={(e) => onChange?.(e.target.value)}
            className="h-7 text-xs bg-muted border-border text-foreground"
          />
        )}
      </div>
    </div>
  );
}

const sourceLabels = ["Source 1", "Source 2", "Source 3", "Source 4", "Source 5"] as const;
const sourceKeys = ["source_1", "source_2", "source_3", "source_4", "source_5"] as const;

export default function ContactCardDialog({
  open,
  onOpenChange,
  contactId,
  contactName,
  email,
  phone,
}: ContactCardDialogProps) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(contactName);
  const [editEmail, setEditEmail] = useState(email ?? "");
  const [editPhone, setEditPhone] = useState(phone ?? "");
  const [editSources, setEditSources] = useState<string[]>(["", "", "", "", ""]);

  // Product edit states
  const [editWorkshop, setEditWorkshop] = useState<any[]>([]);
  const [editLive, setEditLive] = useState<any[]>([]);
  const [editVelocityMembers, setEditVelocityMembers] = useState<any[]>([]);
  const [editVelocitySales, setEditVelocitySales] = useState<any[]>([]);
  const [editSummit, setEditSummit] = useState<any[]>([]);
  const [editBookOrders, setEditBookOrders] = useState<any[]>([]);

  // Fetch contact record for sources
  const { data: contactRecord } = useQuery({
    queryKey: ["contact-record", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("id", contactId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  useEffect(() => {
    setEditName(contactName);
    setEditEmail(email ?? "");
    setEditPhone(phone ?? "");
    setEditing(false);
  }, [contactId, contactName, email, phone]);

  useEffect(() => {
    if (contactRecord) {
      setEditSources([
        contactRecord.source_1 ?? "",
        contactRecord.source_2 ?? "",
        contactRecord.source_3 ?? "",
        contactRecord.source_4 ?? "",
        contactRecord.source_5 ?? "",
      ]);
    }
  }, [contactRecord]);

  // Fetch product data
  const { data: workshopData } = useQuery({
    queryKey: ["contact-workshop", contactId],
    queryFn: async () => {
      const { data } = await supabase.from("workshop_registrations").select("*").eq("contact_id", contactId);
      return data ?? [];
    },
    enabled: open,
  });

  const { data: velocityMemberData } = useQuery({
    queryKey: ["contact-velocity-member", contactId],
    queryFn: async () => {
      const { data } = await supabase.from("velocity_members").select("*, velocity_installments(*)").eq("contact_id", contactId);
      return data ?? [];
    },
    enabled: open,
  });

  const { data: velocitySalesData } = useQuery({
    queryKey: ["contact-velocity-sales", contactId],
    queryFn: async () => {
      const { data } = await supabase.from("velocity_sales").select("*").eq("contact_id", contactId);
      return data ?? [];
    },
    enabled: open,
  });

  const { data: liveData } = useQuery({
    queryKey: ["contact-live", contactId],
    queryFn: async () => {
      const { data } = await supabase.from("membership_records").select("*").eq("contact_id", contactId);
      return data ?? [];
    },
    enabled: open,
  });

  const { data: summitData } = useQuery({
    queryKey: ["contact-summit", contactId],
    queryFn: async () => {
      const { data } = await supabase.from("summit_registrations").select("*").eq("contact_id", contactId);
      return data ?? [];
    },
    enabled: open,
  });

  const { data: transactionsData } = useQuery({
    queryKey: ["contact-transactions", contactId],
    queryFn: async () => {
      const { data } = await supabase.from("transactions").select("*").eq("contact_id", contactId).order("date", { ascending: false });
      return data ?? [];
    },
    enabled: open,
  });

  const { data: bookOrdersData } = useQuery({
    queryKey: ["contact-book-orders", contactId],
    queryFn: async () => {
      const { data } = await supabase.from("book_orders").select("*").eq("contact_id", contactId).order("date_ordered", { ascending: false });
      return data ?? [];
    },
    enabled: open,
  });

  // Sync product data to edit state when data loads or editing starts
  useEffect(() => {
    if (workshopData) setEditWorkshop(workshopData.map((r) => ({ ...r })));
  }, [workshopData]);
  useEffect(() => {
    if (liveData) setEditLive(liveData.map((r) => ({ ...r })));
  }, [liveData]);
  useEffect(() => {
    if (velocityMemberData) setEditVelocityMembers(velocityMemberData.map((r) => ({ ...r })));
  }, [velocityMemberData]);
  useEffect(() => {
    if (velocitySalesData) setEditVelocitySales(velocitySalesData.map((r) => ({ ...r })));
  }, [velocitySalesData]);
  useEffect(() => {
    if (summitData) setEditSummit(summitData.map((r) => ({ ...r })));
  }, [summitData]);
  useEffect(() => {
    if (bookOrdersData) setEditBookOrders(bookOrdersData.map((r) => ({ ...r })));
  }, [bookOrdersData]);

  // Derive products
  const products: string[] = [];
  if ((bookOrdersData?.length ?? 0) > 0) products.push("Book");
  if ((workshopData?.length ?? 0) > 0) products.push("Workshop");
  if ((liveData?.length ?? 0) > 0) products.push("Live");
  if ((velocityMemberData?.length ?? 0) > 0 || (velocitySalesData?.length ?? 0) > 0) products.push("Velocity");
  if ((summitData?.length ?? 0) > 0) products.push("Summit");

  const isNewRecord = (r: any) => r._isNew === true;

  const addBlankWorkshop = () => {
    setEditWorkshop((prev) => [...prev, { _isNew: true, contact_id: contactId, date_registered: new Date().toISOString(), workshop_date: null, attended: false, membership_status: "—" }]);
  };
  const addBlankLive = () => {
    setEditLive((prev) => [...prev, { _isNew: true, contact_id: contactId, membership_status: "Active", utm_source: "", member_since: null, cancellation_date: null, months_active: 0 }]);
  };
  const addBlankVelocityMember = () => {
    setEditVelocityMembers((prev) => [...prev, { _isNew: true, contact_id: contactId, velocity_status: "Active", cohort: "", start_date: "", end_date: "", total_sale: 0, deposit: 0, deposit_status: "Paid", deposit_date: null }]);
  };
  const addBlankVelocitySale = () => {
    setEditVelocitySales((prev) => [...prev, { _isNew: true, contact_id: contactId, lead_source: "", call_date: null, attended: false, enrolled: false, sale_amount: 0, cohort: "—" }]);
  };
  const addBlankSummit = () => {
    setEditSummit((prev) => [...prev, { _isNew: true, contact_id: contactId, summit: "", ticket_type: "Bundled", utm_source: "", attended: false }]);
  };
  const addBlankBookOrder = () => {
    setEditBookOrders((prev) => [...prev, { _isNew: true, contact_id: contactId, date_ordered: new Date().toISOString(), tracking_status: "PRE_TRANSIT", carrier: "—", tracking_number: "—", delivered: false, address: "", city: "", state: "", zip: "" }]);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const trimmedName = editName.trim();
      const trimmedEmail = editEmail.trim();
      if (!trimmedName || !trimmedEmail) return;

      // Save contact
      const { error } = await supabase
        .from("contacts")
        .update({
          name: trimmedName,
          email: trimmedEmail,
          phone: editPhone.trim(),
          source_1: editSources[0].trim(),
          source_2: editSources[1].trim(),
          source_3: editSources[2].trim(),
          source_4: editSources[3].trim(),
          source_5: editSources[4].trim(),
        })
        .eq("id", contactId);
      if (error) throw error;

      // Save workshop records
      for (const wr of editWorkshop) {
        if (isNewRecord(wr)) {
          const { _isNew, id, ...rest } = wr;
          const { error: wErr } = await supabase.from("workshop_registrations").insert(rest);
          if (wErr) throw wErr;
        } else {
          const { error: wErr } = await supabase.from("workshop_registrations").update({
            workshop_date: wr.workshop_date, attended: wr.attended, membership_status: wr.membership_status,
          }).eq("id", wr.id);
          if (wErr) throw wErr;
        }
      }

      // Save live/membership records
      for (const mr of editLive) {
        if (isNewRecord(mr)) {
          const { _isNew, id, ...rest } = mr;
          const { error: mErr } = await supabase.from("membership_records").insert(rest);
          if (mErr) throw mErr;
        } else {
          const { error: mErr } = await supabase.from("membership_records").update({
            membership_status: mr.membership_status, utm_source: mr.utm_source, member_since: mr.member_since,
            cancellation_date: mr.cancellation_date, months_active: mr.months_active,
          }).eq("id", mr.id);
          if (mErr) throw mErr;
        }
      }

      // Save velocity member records
      for (const vm of editVelocityMembers) {
        if (isNewRecord(vm)) {
          const { _isNew, id, velocity_installments, ...rest } = vm;
          const { error: vErr } = await supabase.from("velocity_members").insert(rest);
          if (vErr) throw vErr;
        } else {
          const { error: vErr } = await supabase.from("velocity_members").update({
            velocity_status: vm.velocity_status, cohort: vm.cohort, start_date: vm.start_date,
            end_date: vm.end_date, total_sale: vm.total_sale, deposit: vm.deposit,
            deposit_status: vm.deposit_status, deposit_date: vm.deposit_date,
          }).eq("id", vm.id);
          if (vErr) throw vErr;
        }
      }

      // Save velocity sales records
      for (const vs of editVelocitySales) {
        if (isNewRecord(vs)) {
          const { _isNew, id, ...rest } = vs;
          const { error: sErr } = await supabase.from("velocity_sales").insert(rest);
          if (sErr) throw sErr;
        } else {
          const { error: sErr } = await supabase.from("velocity_sales").update({
            lead_source: vs.lead_source, call_date: vs.call_date, attended: vs.attended,
            enrolled: vs.enrolled, sale_amount: vs.sale_amount, cohort: vs.cohort,
          }).eq("id", vs.id);
          if (sErr) throw sErr;
        }
      }

      // Save summit records
      for (const sr of editSummit) {
        if (isNewRecord(sr)) {
          const { _isNew, id, ...rest } = sr;
          const { error: srErr } = await supabase.from("summit_registrations").insert(rest);
          if (srErr) throw srErr;
        } else {
          const { error: srErr } = await supabase.from("summit_registrations").update({
            summit: sr.summit, ticket_type: sr.ticket_type, utm_source: sr.utm_source, attended: sr.attended,
          }).eq("id", sr.id);
          if (srErr) throw srErr;
        }
      }

      // Save book order records
      for (const bo of editBookOrders) {
        if (isNewRecord(bo)) {
          const { _isNew, id, ...rest } = bo;
          const { error: bErr } = await supabase.from("book_orders").insert(rest);
          if (bErr) throw bErr;
        }
      }
    },
    onSuccess: () => {
      setEditing(false);
      queryClient.invalidateQueries();
    },
  });

  const cancelEdit = () => {
    setEditName(contactName);
    setEditEmail(email ?? "");
    setEditPhone(phone ?? "");
    if (contactRecord) {
      setEditSources([
        contactRecord.source_1 ?? "",
        contactRecord.source_2 ?? "",
        contactRecord.source_3 ?? "",
        contactRecord.source_4 ?? "",
        contactRecord.source_5 ?? "",
      ]);
    }
    if (workshopData) setEditWorkshop(workshopData.map((r) => ({ ...r })));
    if (liveData) setEditLive(liveData.map((r) => ({ ...r })));
    if (velocityMemberData) setEditVelocityMembers(velocityMemberData.map((r) => ({ ...r })));
    if (velocitySalesData) setEditVelocitySales(velocitySalesData.map((r) => ({ ...r })));
    if (summitData) setEditSummit(summitData.map((r) => ({ ...r })));
    if (bookOrdersData) setEditBookOrders(bookOrdersData.map((r) => ({ ...r })));
    setEditing(false);
  };

  const updateSource = (index: number, value: string) => {
    setEditSources((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const updateRecord = (setter: React.Dispatch<React.SetStateAction<any[]>>, index: number, field: string, value: any) => {
    setter((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const allTabs = [
    { key: "book", label: "Book" },
    { key: "workshop", label: "Workshop" },
    { key: "live", label: "Live" },
    { key: "velocity", label: "Velocity" },
    { key: "summit", label: "Summit" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-gold font-body text-lg font-semibold tracking-wide">
              <User className="w-5 h-5" />
              {editing ? (
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-7 text-base font-semibold text-gold bg-muted border-border w-52"
                  maxLength={100}
                />
              ) : (
                contactName
              )}
            </DialogTitle>
            {!editing ? (
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-steel hover:text-foreground" onClick={() => setEditing(true)}>
                <Pencil className="w-3 h-3" /> Edit
              </Button>
            ) : (
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="h-7 px-2 text-emerald-700 dark:text-emerald-400 hover:text-emerald-700 dark:text-emerald-400"
                  onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !editName.trim() || !editEmail.trim()}>
                  <Check className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-steel hover:text-destructive" onClick={cancelEdit}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Core contact info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-3.5 h-3.5 text-steel shrink-0" />
              {editing ? (
                <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)}
                  className="h-7 text-sm bg-muted border-border text-foreground flex-1" type="email" maxLength={255} />
              ) : (
                <a href={`mailto:${email}`} className="text-primary hover:underline">{email || "—"}</a>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-3.5 h-3.5 text-steel shrink-0" />
              {editing ? (
                <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)}
                  className="h-7 text-sm bg-muted border-border text-foreground flex-1" maxLength={30} />
              ) : (
                <span className="text-foreground">{phone || "—"}</span>
              )}
            </div>
          </div>

          {/* Source attribution */}
          <div className="pt-2 border-t border-border/50">
            <span className="text-[10px] uppercase tracking-wider text-steel font-semibold">Source</span>
            {editing ? (
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-1.5">
                {sourceLabels.map((label, i) => (
                  <div key={label}>
                    <span className="text-[9px] uppercase tracking-wider text-steel">{label}</span>
                    <Input
                      value={editSources[i]}
                      onChange={(e) => updateSource(i, e.target.value)}
                      className="h-6 text-xs bg-muted border-border text-foreground mt-0.5"
                      maxLength={100}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1.5">
                {sourceKeys.map((key, i) => {
                  const val = contactRecord?.[key];
                  if (!val) return null;
                  return (
                    <div key={key}>
                      <span className="text-[9px] uppercase tracking-wider text-steel">{sourceLabels[i]}</span>
                      <p className="text-sm text-foreground">{val}</p>
                    </div>
                  );
                })}
                {sourceKeys.every((k) => !contactRecord?.[k]) && (
                  <p className="text-xs text-steel col-span-2">No source data</p>
                )}
              </div>
            )}
          </div>

          {/* Products */}
          <div className="pt-2 border-t border-border/50">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Tag className="w-3 h-3 text-steel" />
              <span className="text-[10px] uppercase tracking-wider text-steel font-semibold">Products</span>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {products.length > 0 ? products.map((p) => (
                <Badge key={p} variant="outline" className={`text-[10px] px-2 py-0.5 ${productBadgeColors[p] || ""}`}>
                  {p}
                </Badge>
              )) : (
                <span className="text-xs text-steel">No products</span>
              )}
            </div>
          </div>

          {/* Product tabs */}
          <Tabs defaultValue="book" className="pt-2 border-t border-border/50">
            <TabsList className="bg-muted/50 h-8">
              {allTabs.map((t) => {
                const hasData = products.includes(t.label);
                return (
                  <TabsTrigger
                    key={t.key}
                    value={t.key}
                    className={`text-xs h-6 px-3 data-[state=active]:bg-card data-[state=active]:text-gold ${!hasData ? "opacity-50" : ""}`}
                  >
                    {t.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {/* Book Tab */}
            <TabsContent value="book" className="mt-3 space-y-3">
              {editBookOrders.map((bo: any, i: number) => (
                <div key={bo.id ?? `new-book-${i}`} className="space-y-2">
                  {editBookOrders.length > 1 && <p className="text-[10px] text-steel uppercase tracking-wider">Order {i + 1}</p>}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <EditableFieldRow label="Date Ordered" value={bo.date_ordered?.split("T")[0]} type="date" editing={editing}
                      onChange={(v) => updateRecord(setEditBookOrders, i, "date_ordered", v)} />
                    <EditableFieldRow label="Status" value={bo.tracking_status} type="badge" editing={editing}
                      options={["PRE_TRANSIT", "IN_TRANSIT", "DELIVERED", "RETURNED", "FAILURE"]}
                      onChange={(v) => updateRecord(setEditBookOrders, i, "tracking_status", v)} />
                    <EditableFieldRow label="Carrier" value={bo.carrier} type="text" editing={editing}
                      onChange={(v) => updateRecord(setEditBookOrders, i, "carrier", v)} />
                    <EditableFieldRow label="Tracking #" value={bo.tracking_number} type="text" editing={editing}
                      onChange={(v) => updateRecord(setEditBookOrders, i, "tracking_number", v)} />
                    <EditableFieldRow label="Delivered" value={bo.delivered} type="boolean" editing={editing}
                      onChange={(v) => updateRecord(setEditBookOrders, i, "delivered", v)} />
                    {editing ? (
                      <>
                        <EditableFieldRow label="Address" value={bo.address} type="text" editing={editing}
                          onChange={(v) => updateRecord(setEditBookOrders, i, "address", v)} />
                        <EditableFieldRow label="City" value={bo.city} type="text" editing={editing}
                          onChange={(v) => updateRecord(setEditBookOrders, i, "city", v)} />
                        <EditableFieldRow label="State" value={bo.state} type="text" editing={editing}
                          onChange={(v) => updateRecord(setEditBookOrders, i, "state", v)} />
                        <EditableFieldRow label="Zip" value={bo.zip} type="text" editing={editing}
                          onChange={(v) => updateRecord(setEditBookOrders, i, "zip", v)} />
                      </>
                    ) : (
                      <FieldRow label="Address" value={`${bo.address}, ${bo.city}, ${bo.state} ${bo.zip}`} />
                    )}
                  </div>
                </div>
              ))}
              {editBookOrders.length === 0 && !editing && (
                <p className="text-xs text-steel py-2">No book orders</p>
              )}
              {editing && (
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-gold hover:text-gold/80" onClick={addBlankBookOrder}>
                  <Plus className="w-3 h-3" /> Add Book Order
                </Button>
              )}
            </TabsContent>

            {/* Workshop Tab */}
            <TabsContent value="workshop" className="mt-3 space-y-3">
              {editWorkshop.map((wr, i) => (
                <div key={wr.id ?? `new-ws-${i}`} className="space-y-2">
                  {editWorkshop.length > 1 && <p className="text-[10px] text-steel uppercase tracking-wider">Registration {i + 1}</p>}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <FieldRow label="Registered" value={wr.date_registered} type="date" />
                    <EditableFieldRow label="Workshop Date" value={wr.workshop_date} type="date" editing={editing}
                      onChange={(v) => updateRecord(setEditWorkshop, i, "workshop_date", v)} />
                    <EditableFieldRow label="Attended" value={wr.attended} type="boolean" editing={editing}
                      onChange={(v) => updateRecord(setEditWorkshop, i, "attended", v)} />
                    <EditableFieldRow label="Membership" value={wr.membership_status} type="badge" editing={editing}
                      options={["—", "Active", "Canceled", "Paused", "Expired"]}
                      onChange={(v) => updateRecord(setEditWorkshop, i, "membership_status", v)} />
                  </div>
                </div>
              ))}
              {editWorkshop.length === 0 && !editing && (
                <p className="text-xs text-steel py-2">No workshop registrations</p>
              )}
              {editing && (
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-gold hover:text-gold/80" onClick={addBlankWorkshop}>
                  <Plus className="w-3 h-3" /> Add Workshop Registration
                </Button>
              )}
            </TabsContent>

            {/* Live Tab */}
            <TabsContent value="live" className="mt-3 space-y-3">
              {editLive.map((mr, i) => (
                <div key={mr.id ?? `new-live-${i}`} className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <EditableFieldRow label="Status" value={mr.membership_status} type="badge" editing={editing}
                    options={["Active", "Canceled", "Paused", "Expired"]}
                    onChange={(v) => updateRecord(setEditLive, i, "membership_status", v)} />
                  <EditableFieldRow label="Source" value={mr.utm_source} type="text" editing={editing}
                    onChange={(v) => updateRecord(setEditLive, i, "utm_source", v)} />
                  <EditableFieldRow label="Member Since" value={mr.member_since} type="date" editing={editing}
                    onChange={(v) => updateRecord(setEditLive, i, "member_since", v)} />
                  <EditableFieldRow label="Cancellation Date" value={mr.cancellation_date} type="date" editing={editing}
                    onChange={(v) => updateRecord(setEditLive, i, "cancellation_date", v)} />
                  <EditableFieldRow label="Months Active" value={mr.months_active} type="text" editing={editing}
                    onChange={(v) => updateRecord(setEditLive, i, "months_active", Number(v) || 0)} />
                </div>
              ))}
              {editLive.length === 0 && !editing && (
                <p className="text-xs text-steel py-2">No Live membership record</p>
              )}
              {editing && (
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-gold hover:text-gold/80" onClick={addBlankLive}>
                  <Plus className="w-3 h-3" /> Add Live Membership
                </Button>
              )}
            </TabsContent>

            {/* Velocity Tab */}
            <TabsContent value="velocity" className="mt-3 space-y-3">
              {editVelocityMembers.map((vm, i) => (
                <div key={vm.id ?? `new-vm-${i}`} className="space-y-2">
                  <p className="text-[10px] text-steel uppercase tracking-wider font-semibold">Membership</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <EditableFieldRow label="Status" value={vm.velocity_status} type="badge" editing={editing}
                      options={["Active", "Canceled", "Paused", "Completed"]}
                      onChange={(v) => updateRecord(setEditVelocityMembers, i, "velocity_status", v)} />
                    <EditableFieldRow label="Cohort" value={vm.cohort} type="text" editing={editing}
                      onChange={(v) => updateRecord(setEditVelocityMembers, i, "cohort", v)} />
                    <EditableFieldRow label="Start" value={vm.start_date} type="date" editing={editing}
                      onChange={(v) => updateRecord(setEditVelocityMembers, i, "start_date", v)} />
                    <EditableFieldRow label="End" value={vm.end_date} type="date" editing={editing}
                      onChange={(v) => updateRecord(setEditVelocityMembers, i, "end_date", v)} />
                    <div className="col-span-2 grid grid-cols-2 gap-x-4 items-end">
                      <EditableFieldRow label="Total Sale" value={vm.total_sale} type="currency" editing={editing}
                        onChange={(v) => updateRecord(setEditVelocityMembers, i, "total_sale", v)} />
                      <div>
                        <a
                          href="https://collectcheckout.com/r/kumbzcroq5g3wzu3vdkx2scrkdncli"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-xs font-medium bg-gold/20 text-gold border border-gold/30 hover:bg-gold/30 transition-colors"
                        >
                          Make Velocity Payment
                        </a>
                      </div>
                    </div>
                  </div>
                  {vm.velocity_installments?.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[10px] text-steel uppercase tracking-wider font-semibold mb-1">
                        Installments ({vm.velocity_installments.filter((inst: any) => inst.status === "Paid").length}/{vm.velocity_installments.length} paid)
                      </p>
                      <div className="grid gap-1">
                        {vm.velocity_installments
                          .sort((a: any, b: any) => a.installment_number - b.installment_number)
                          .map((inst: any) => (
                            <div key={inst.id} className="flex items-center gap-3 text-xs py-1 px-2 rounded bg-muted/30">
                              <span className="text-steel w-4">#{inst.installment_number}</span>
                              <span className="text-foreground w-16">${Number(inst.amount).toLocaleString()}</span>
                              <span className="text-steel w-20">Due {formatDate(inst.due_date)}</span>
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusColors[inst.status] || ""}`}>
                                {inst.status}
                              </Badge>
                              {inst.paid_date && <span className="text-[10px] text-steel">Paid {formatDate(inst.paid_date)}</span>}
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {editVelocitySales.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] text-steel uppercase tracking-wider font-semibold">Sales Pipeline</p>
                  {editVelocitySales.map((vs, i) => (
                    <div key={vs.id ?? `new-vs-${i}`} className="grid grid-cols-2 gap-x-4 gap-y-2">
                      <EditableFieldRow label="Enrollment Call Date" value={vs.call_date} type="date" editing={editing}
                        onChange={(v) => updateRecord(setEditVelocitySales, i, "call_date", v)} />
                      <EditableFieldRow label="Cohort" value={vs.cohort ? String(vs.cohort).replace(/\D/g, '') || vs.cohort : "—"} type="text" editing={editing}
                        onChange={(v) => updateRecord(setEditVelocitySales, i, "cohort", v)} />
                      <EditableFieldRow label="Attended" value={vs.attended} type="boolean" editing={editing}
                        onChange={(v) => updateRecord(setEditVelocitySales, i, "attended", v)} />
                      <EditableFieldRow label="Enrolled" value={vs.enrolled} type="boolean" editing={editing}
                        onChange={(v) => updateRecord(setEditVelocitySales, i, "enrolled", v)} />
                    </div>
                  ))}
                </div>
              )}
              {editVelocityMembers.length === 0 && editVelocitySales.length === 0 && !editing && (
                <p className="text-xs text-steel py-2">No Velocity records</p>
              )}
              {editing && (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-gold hover:text-gold/80" onClick={addBlankVelocityMember}>
                    <Plus className="w-3 h-3" /> Add Membership
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-gold hover:text-gold/80" onClick={addBlankVelocitySale}>
                    <Plus className="w-3 h-3" /> Add Sales Lead
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* Summit Tab */}
            <TabsContent value="summit" className="mt-3 space-y-3">
              {editSummit.map((sr, i) => (
                <div key={sr.id ?? `new-sum-${i}`} className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <EditableFieldRow label="Summit" value={sr.summit} type="text" editing={editing}
                    onChange={(v) => updateRecord(setEditSummit, i, "summit", v)} />
                  <EditableFieldRow label="Ticket Type" value={sr.ticket_type} type="badge" editing={editing}
                    options={["Bundled", "Paid", "Free", "VIP"]}
                    onChange={(v) => updateRecord(setEditSummit, i, "ticket_type", v)} />
                  <EditableFieldRow label="Source" value={sr.utm_source} type="text" editing={editing}
                    onChange={(v) => updateRecord(setEditSummit, i, "utm_source", v)} />
                  <EditableFieldRow label="Attended" value={sr.attended} type="boolean" editing={editing}
                    onChange={(v) => updateRecord(setEditSummit, i, "attended", v)} />
                </div>
              ))}
              {editSummit.length === 0 && !editing && (
                <p className="text-xs text-steel py-2">No summit registrations</p>
              )}
              {editing && (
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-gold hover:text-gold/80" onClick={addBlankSummit}>
                  <Plus className="w-3 h-3" /> Add Summit Registration
                </Button>
              )}
            </TabsContent>
          </Tabs>

          {/* Transactions */}
          <div className="pt-2 border-t border-border/50">
            <div className="flex items-center gap-1.5 mb-2">
              <Receipt className="w-3 h-3 text-steel" />
              <span className="text-[10px] uppercase tracking-wider text-steel font-semibold">Transactions</span>
              {transactionsData && transactionsData.length > 0 && (
                <span className="text-[10px] text-steel">({transactionsData.length})</span>
              )}
            </div>
            {transactionsData && transactionsData.length > 0 ? (
              <div className="grid gap-1">
                {transactionsData.map((tx: any) => (
                  <div key={tx.id} className="flex items-center gap-2 text-xs py-1.5 px-2 rounded bg-muted/30 flex-wrap">
                    <span className="text-steel shrink-0">{formatDate(tx.date?.split("T")[0])}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">{tx.category}</Badge>
                    <span className="text-foreground flex-1 min-w-0 truncate">{tx.description}</span>
                    {tx.amount > 0 && <span className="font-mono text-gold shrink-0">${Number(tx.amount).toLocaleString()}</span>}
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${statusColors[tx.status] || ""}`}>
                      {tx.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-steel py-1">No transactions</p>
            )}
          </div>

          {/* Notes */}
          <ContactNotes contactId={contactId} contactName={contactName} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
