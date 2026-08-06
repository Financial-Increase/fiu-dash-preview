import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardTable from "@/components/DashboardTable";

const columns = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "utm_source", label: "Source" },
  { key: "ticket_type", label: "Ticket Type", type: "badge" as const },
  { key: "summit", label: "Summit" },
  { key: "attended", label: "Attended", type: "boolean" as const },
];

export default function SummitDashboard() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["summit-registrations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("summit_registrations")
        .select("id, utm_source, ticket_type, summit, attended, contacts(id, name, email, phone)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.contacts.id,
        name: r.contacts.name,
        email: r.contacts.email,
        phone: r.contacts.phone,
        utm_source: r.utm_source,
        ticket_type: r.ticket_type,
        summit: r.summit,
        attended: r.attended,
      }));
    },
  });

  if (isLoading) return <div className="text-steel text-sm p-4">Loading…</div>;

  return (
    <DashboardTable
      title="FIU Summit"
      subtitle="Summit registrants — bundled tickets and future paid tickets"
      columns={columns}
      data={data}
      count={data.length}
    />
  );
}
