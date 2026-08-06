import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";

function fmt(n: number) {
  return `$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function CompensationLedger() {
  const { memberId } = useParams<{ memberId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const now = new Date();
  const [selectedPeriod, setSelectedPeriod] = useState(format(now, "yyyy-MM"));
  const [addOpen, setAddOpen] = useState(false);
  const [entryType, setEntryType] = useState<string>("credit");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [entryDate, setEntryDate] = useState(format(now, "yyyy-MM-dd"));

  // Fetch team member
  const { data: member } = useQuery({
    queryKey: ["team-member", memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("id, name, email, role")
        .eq("id", memberId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!memberId,
  });

  // Fetch ledger entries
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["compensation-ledger", memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compensation_ledger")
        .select("*")
        .eq("team_member_id", memberId!)
        .order("entry_date", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!memberId,
  });

  // Add entry mutation
  const addEntry = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("compensation_ledger").insert({
        team_member_id: memberId!,
        entry_type: entryType,
        amount: parseFloat(amount),
        description,
        entry_date: entryDate,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compensation-ledger", memberId] });
      toast.success("Entry added");
      setAmount("");
      setDescription("");
      setEntryDate(format(new Date(), "yyyy-MM-dd"));
      setAddOpen(false);
    },
    onError: () => toast.error("Failed to add entry"),
  });

  // Delete entry mutation
  const deleteEntry = useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase.from("compensation_ledger").delete().eq("id", entryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compensation-ledger", memberId] });
      toast.success("Entry deleted");
    },
    onError: () => toast.error("Failed to delete entry"),
  });

  // Generate period options from entries
  const periodOptions = useMemo(() => {
    const periods = new Set<string>();
    // Always include current month and surrounding months
    for (let i = -6; i <= 6; i++) {
      periods.add(format(addMonths(now, i), "yyyy-MM"));
    }
    // Include months from actual entries
    for (const e of entries) {
      periods.add(e.entry_date.substring(0, 7));
    }
    return Array.from(periods).sort().reverse();
  }, [entries]);

  const periodLabel = (key: string) => {
    const [y, m] = key.split("-");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[parseInt(m, 10) - 1]} ${y}`;
  };

  // Filter entries by selected period
  const filteredEntries = useMemo(() => {
    if (selectedPeriod === "all") return entries;
    return entries.filter((e) => e.entry_date.startsWith(selectedPeriod));
  }, [entries, selectedPeriod]);

  // Running balance for filtered view (carry forward from prior entries)
  const entriesWithBalance = useMemo(() => {
    let bal = 0;
    // Calculate balance from all entries up to the start of selected period
    if (selectedPeriod !== "all") {
      for (const e of entries) {
        if (e.entry_date.substring(0, 7) >= selectedPeriod) break;
        bal += e.entry_type === "credit" ? Number(e.amount) : -Number(e.amount);
      }
    }
    return filteredEntries.map((e) => {
      const amt = Number(e.amount);
      bal += e.entry_type === "credit" ? amt : -amt;
      return { ...e, balance: bal };
    });
  }, [entries, filteredEntries, selectedPeriod]);

  const totalCredits = filteredEntries.filter((e) => e.entry_type === "credit").reduce((s, e) => s + Number(e.amount), 0);
  const totalDebits = filteredEntries.filter((e) => e.entry_type === "debit").reduce((s, e) => s + Number(e.amount), 0);
  const balance = totalCredits - totalDebits;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/accounting/compensation")}
          className="text-steel hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-heading text-gold tracking-wide">
          {member?.name ?? "Loading…"}
        </h1>
        <p className="text-steel text-sm mt-1">
          {member?.role} · {member?.email}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-[10px] uppercase tracking-wider text-steel font-semibold">Total Owed (Credits)</p>
          <p className="text-xl font-heading text-gold mt-1">{fmt(totalCredits)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-[10px] uppercase tracking-wider text-steel font-semibold">Total Paid (Debits)</p>
          <p className="text-xl font-heading text-emerald mt-1">{fmt(totalDebits)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-[10px] uppercase tracking-wider text-steel font-semibold">Balance Due</p>
          <p className={`text-xl font-heading mt-1 ${balance > 0 ? "text-gold" : balance < 0 ? "text-emerald" : "text-foreground"}`}>
            {balance >= 0 ? fmt(balance) : `-${fmt(balance)}`}
          </p>
        </div>
      </div>

      {/* Period selector + Add entry */}
      <div className="flex items-center gap-3">
        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-44 h-8 text-xs bg-card border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            {periodOptions.map((p) => (
              <SelectItem key={p} value={p}>
                {periodLabel(p)}
                {p === format(now, "yyyy-MM") ? " (Current)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Popover open={addOpen} onOpenChange={setAddOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" className="gap-1.5 text-xs">
              <Plus className="w-3.5 h-3.5" />
              Add Entry
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4 bg-card border-border space-y-3" align="start">
            <p className="text-[10px] uppercase tracking-wider text-steel font-semibold">New Ledger Entry</p>

            <Select value={entryType} onValueChange={setEntryType}>
              <SelectTrigger className="h-8 text-xs bg-muted border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="credit">Credit (Owed to them)</SelectItem>
                <SelectItem value="debit">Debit (Payment made)</SelectItem>
              </SelectContent>
            </Select>

            <Input
              type="number"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-8 text-xs bg-muted border-border text-foreground"
            />

            <Input
              placeholder="Description (e.g. Commission for March)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-8 text-xs bg-muted border-border text-foreground"
            />

            <Input
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="h-8 text-xs bg-muted border-border text-foreground"
            />

            <Button
              size="sm"
              className="h-7 text-xs w-full"
              onClick={() => addEntry.mutate()}
              disabled={!amount || parseFloat(amount) <= 0 || addEntry.isPending}
            >
              {addEntry.isPending ? "Adding…" : "Add Entry"}
            </Button>
          </PopoverContent>
        </Popover>
      </div>

      {/* Ledger table */}
      <div className="rounded-md border border-border/40 bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/40">
              <TableHead className="text-steel text-[10px] uppercase tracking-wider font-semibold">Date</TableHead>
              <TableHead className="text-steel text-[10px] uppercase tracking-wider font-semibold">Type</TableHead>
              <TableHead className="text-steel text-[10px] uppercase tracking-wider font-semibold">Description</TableHead>
              <TableHead className="text-steel text-[10px] uppercase tracking-wider font-semibold text-right">Amount</TableHead>
              <TableHead className="text-steel text-[10px] uppercase tracking-wider font-semibold text-right">Balance</TableHead>
              <TableHead className="text-steel text-[10px] uppercase tracking-wider font-semibold w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-steel py-8">Loading…</TableCell>
              </TableRow>
            ) : entriesWithBalance.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-steel py-8">
                  No ledger entries yet. Add a credit or debit to get started.
                </TableCell>
              </TableRow>
            ) : (
              entriesWithBalance.map((e) => (
                <TableRow key={e.id} className="border-border/40 hover:bg-muted/20">
                  <TableCell className="text-sm text-foreground whitespace-nowrap">
                    {format(new Date(e.entry_date + "T00:00:00"), "MM/dd/yy")}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        e.entry_type === "credit"
                          ? "bg-gold/20 text-gold border-gold/30 text-[10px]"
                          : "bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px]"
                      }
                    >
                      {e.entry_type === "credit" ? "Credit" : "Debit"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-foreground">{e.description || "—"}</TableCell>
                  <TableCell className={`text-sm text-right font-mono ${e.entry_type === "credit" ? "text-gold" : "text-emerald"}`}>
                    {e.entry_type === "credit" ? "+" : "−"}{fmt(Number(e.amount))}
                  </TableCell>
                  <TableCell className={`text-sm text-right font-mono ${e.balance > 0 ? "text-gold" : e.balance < 0 ? "text-emerald" : "text-foreground"}`}>
                    {e.balance >= 0 ? fmt(e.balance) : `-${fmt(e.balance)}`}
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => deleteEntry.mutate(e.id)}
                      className="text-steel hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
