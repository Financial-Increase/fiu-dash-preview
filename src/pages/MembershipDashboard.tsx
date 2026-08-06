import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardTable from "@/components/DashboardTable";
import { Button } from "@/components/ui/button";
import { Filter, X } from "lucide-react";

const columns = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "utm_source", label: "Source" },
  { key: "membership_status", label: "Status", type: "badge" as const },
  { key: "member_since", label: "Member Since" },
  { key: "cancellation_date", label: "Canceled" },
  { key: "months_active", label: "Months Active" },
];

const STATUS_OPTIONS = ["Active", "Canceled", "Paused"];

export default function MembershipDashboard() {
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["membership-records"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("membership_records")
        .select("*, contacts(id, name, email, phone)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.contacts.id,
        name: r.contacts.name,
        email: r.contacts.email,
        phone: r.contacts.phone,
        utm_source: r.utm_source,
        membership_status: r.membership_status,
        member_since: r.member_since ?? "—",
        cancellation_date: r.cancellation_date ?? "—",
        months_active: r.months_active,
      }));
    },
  });

  const filtered = statusFilter
    ? data.filter((r) => r.membership_status === statusFilter)
    : data;

  if (isLoading) return <div className="text-steel text-sm p-4">Loading…</div>;

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-[10px] uppercase tracking-wider text-steel font-semibold flex items-center gap-1">
          <Filter className="w-3.5 h-3.5" /> Status:
        </span>
        {STATUS_OPTIONS.map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? "default" : "outline"}
            size="sm"
            className={`h-7 text-xs ${
              statusFilter === s
                ? ""
                : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
            onClick={() => setStatusFilter(statusFilter === s ? null : s)}
          >
            {s}
          </Button>
        ))}
        {statusFilter && (
          <button
            onClick={() => setStatusFilter(null)}
            className="text-[10px] text-steel hover:text-destructive transition-colors underline flex items-center gap-0.5"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
        <span className="ml-auto text-xs text-steel">
          {filtered.length}{statusFilter ? ` of ${data.length}` : ""} records
        </span>
      </div>

      <DashboardTable
        title="FIU Membership"
        subtitle="Active membership roster with retention tracking"
        columns={columns}
        data={filtered}
        count={filtered.length}
      />
    </div>
  );
}
