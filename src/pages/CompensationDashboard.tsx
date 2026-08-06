import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function fmt(n: number) {
  return `$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function CompensationDashboard() {
  const navigate = useNavigate();

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["team-members-compensation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("id, name, email, role")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch all ledger entries to compute totals per member
  const { data: ledgerEntries = [] } = useQuery({
    queryKey: ["compensation-ledger-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compensation_ledger")
        .select("team_member_id, entry_type, amount");
      if (error) throw error;
      return data ?? [];
    },
  });

  const memberTotals = members.map((m) => {
    const entries = ledgerEntries.filter((e) => e.team_member_id === m.id);
    const credits = entries.filter((e) => e.entry_type === "credit").reduce((s, e) => s + Number(e.amount), 0);
    const debits = entries.filter((e) => e.entry_type === "debit").reduce((s, e) => s + Number(e.amount), 0);
    return { ...m, totalPaid: debits, balance: credits - debits };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading text-gold tracking-wide">Compensation</h1>
        <p className="text-steel text-sm mt-1">
          Team payout ledgers. Click a team member to view their compensation history.
        </p>
      </div>

      <div className="rounded-md border border-border/40 bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/40">
              <TableHead className="text-steel">Name</TableHead>
              <TableHead className="text-steel">Email</TableHead>
              <TableHead className="text-steel">Role</TableHead>
              <TableHead className="text-steel text-right">Total Paid</TableHead>
              <TableHead className="text-steel text-right">Balance Due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-steel py-8">Loading…</TableCell>
              </TableRow>
            ) : memberTotals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-steel py-8">No team members</TableCell>
              </TableRow>
            ) : (
              memberTotals.map((m) => (
                <TableRow key={m.id} className="border-border/40 hover:bg-muted/20">
                  <TableCell>
                    <button
                      className="text-gold hover:underline text-sm font-medium"
                      onClick={() => navigate(`/accounting/compensation/${m.id}`)}
                    >
                      {m.name}
                    </button>
                  </TableCell>
                  <TableCell className="text-foreground text-sm">{m.email}</TableCell>
                  <TableCell className="text-steel text-sm">{m.role}</TableCell>
                  <TableCell className="text-emerald text-sm text-right font-mono">
                    {m.totalPaid > 0 ? fmt(m.totalPaid) : "—"}
                  </TableCell>
                  <TableCell className={`text-sm text-right font-mono ${m.balance > 0 ? "text-gold" : "text-foreground"}`}>
                    {m.balance > 0 ? fmt(m.balance) : m.balance < 0 ? `-${fmt(m.balance)}` : "—"}
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
