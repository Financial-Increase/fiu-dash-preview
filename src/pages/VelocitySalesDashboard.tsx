import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardTable from "@/components/DashboardTable";

const columns = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "lead_source", label: "Lead Source" },
  { key: "call_date", label: "Call Date" },
  { key: "attended", label: "Attended", type: "boolean" as const },
  { key: "enrolled", label: "Enrolled", type: "boolean" as const },
  { key: "sale_amount", label: "Sale Amount", type: "currency" as const },
  { key: "cohort", label: "Cohort", type: "badge" as const },
];

export default function VelocitySalesDashboard() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["velocity-sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("velocity_sales")
        .select("*, contacts(id, name, email, phone)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.contacts.id,
        name: r.contacts.name,
        email: r.contacts.email,
        phone: r.contacts.phone,
        lead_source: r.lead_source,
        call_date: r.call_date ?? "—",
        attended: r.attended,
        enrolled: r.enrolled,
        sale_amount: r.sale_amount,
        cohort: r.cohort,
      }));
    },
  });

  if (isLoading) return <div className="text-steel text-sm p-4">Loading…</div>;

  return (
    <DashboardTable
      title="Financial Velocity Sales"
      subtitle="Track prospects through the Velocity enrollment pipeline"
      columns={columns}
      data={data}
      count={data.length}
    />
  );
}
