import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Clock, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import StatCard from "@/components/StatCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ContactCardDialog from "@/components/ContactCardDialog";

interface CallWithContact {
  id: string;
  call_date: string;
  scheduled_for: string | null;
  created_at: string;
  call_type: string;
  status: string;
  notes: string;
  duration_minutes: number | null;
  source: string;
  host_team_member_id: string;
  contact_id: string;
  contacts: { name: string; email?: string; phone?: string } | null;
  team_members: { name: string } | null;
}

const callTimeIso = (call: { scheduled_for: string | null; call_date: string }): string =>
  call.scheduled_for ?? call.call_date;

const callTime = (call: { scheduled_for: string | null; call_date: string }): number =>
  Date.parse(callTimeIso(call));

const statusColor: Record<string, string> = {
  Scheduled: "bg-blue-600/20 text-blue-700 dark:text-blue-400 border-blue-500/30",
  Completed: "bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  "No-Show": "bg-red-600/20 text-red-700 dark:text-red-400 border-red-500/30",
  Cancelled: "bg-steel/20 text-steel border-steel/30",
};

export default function CallsDashboard() {
  const [selectedContact, setSelectedContact] = useState<CallWithContact | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const { data: calls = [], isLoading } = useQuery({
    queryKey: ["calls"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calls")
        .select("id, call_date, scheduled_for, created_at, call_type, status, notes, duration_minutes, source, contact_id, host_team_member_id, contacts(name, email, phone), team_members(name)")
        .order("scheduled_for", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as CallWithContact[];
    },
  });

  const tz = "America/Los_Angeles";
  const upcoming = calls
    .filter((call) => callTime(call) >= now)
    .sort((a, b) => callTime(a) - callTime(b));
  const past = calls
    .filter((call) => callTime(call) < now)
    .sort((a, b) => callTime(b) - callTime(a));

  const scheduled = upcoming.filter((call) => call.status === "Scheduled").length;
  const completed = calls.filter((c) => c.status === "Completed").length;
  const noShows = calls.filter((c) => c.status === "No-Show").length;
  const total = completed + noShows;
  const showRate = total > 0 ? `${Math.round((completed / total) * 100)}%` : "—";

  const renderTable = (rows: CallWithContact[]) => (
    <div className="rounded-md border border-border/40 bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-border/40">
            <TableHead className="text-steel">Scheduled At</TableHead>
            <TableHead className="text-steel">Scheduled For</TableHead>
            <TableHead className="text-steel">Contact</TableHead>
            <TableHead className="text-steel">Host</TableHead>
            <TableHead className="text-steel">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-steel py-8">Loading…</TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-steel py-8">No calls</TableCell>
            </TableRow>
          ) : (
            rows.map((call) => (
              <TableRow key={call.id} className="border-border/40">
                <TableCell className="text-steel text-xs whitespace-nowrap">
                  {format(toZonedTime(new Date(call.created_at), tz), "MM/dd/yy h:mm a")}
                </TableCell>
                <TableCell className="text-foreground text-sm whitespace-nowrap">
                  {format(toZonedTime(new Date(callTimeIso(call)), tz), "EEEE, MM/dd/yy '@' h:mm a")}
                </TableCell>
                <TableCell>
                  <button
                    className="text-gold hover:underline text-sm font-medium"
                    onClick={() => setSelectedContact(call)}
                  >
                    {call.contacts?.name ?? "—"}
                  </button>
                </TableCell>
                <TableCell className="text-foreground text-sm">
                  {call.team_members?.name ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusColor[call.status] ?? "text-steel"}>
                    {call.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading text-gold tracking-wide">Calls</h1>
        <p className="text-steel text-sm mt-1">
          Scheduled sales calls.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Scheduled" value={scheduled} icon={Calendar} />
        <StatCard label="Completed" value={completed} icon={CheckCircle} />
        <StatCard label="No-Shows" value={noShows} icon={XCircle} />
        <StatCard label="Show Rate" value={showRate} icon={Clock} />
      </div>

      <Tabs defaultValue="upcoming" className="w-full">
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming">{renderTable(upcoming)}</TabsContent>
        <TabsContent value="past">{renderTable(past)}</TabsContent>
      </Tabs>

      {selectedContact && (
        <ContactCardDialog
          open={!!selectedContact}
          onOpenChange={(open) => !open && setSelectedContact(null)}
          contactId={selectedContact.contact_id}
          contactName={selectedContact.contacts?.name ?? ""}
          email={selectedContact.contacts?.email}
          phone={selectedContact.contacts?.phone}
        />
      )}
    </div>
  );
}
