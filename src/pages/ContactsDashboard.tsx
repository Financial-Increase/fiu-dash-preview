import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { Search } from "lucide-react";
import ContactCardDialog from "@/components/ContactCardDialog";

interface ContactWithSources {
  id: string;
  name: string;
  email: string;
  phone: string;
  sources: string[];
}

const sourceBadgeColors: Record<string, string> = {
  Workshop: "bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30",
  Velocity: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  Live: "bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-500/30",
  Summit: "bg-pink-500/20 text-pink-700 dark:text-pink-400 border-pink-500/30",
};

export default function ContactsDashboard() {
  const [search, setSearch] = useState("");
  const [selectedContact, setSelectedContact] = useState<ContactWithSources | null>(null);
  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["contacts-with-sources"],
    queryFn: async () => {
      // Fetch contacts and all product tables in parallel
      const [contactsRes, workshopRes, velocityMembersRes, velocitySalesRes, membershipRes, summitRes] = await Promise.all([
        supabase.from("contacts").select("*").order("name"),
        supabase.from("workshop_registrations").select("contact_id"),
        supabase.from("velocity_members").select("contact_id"),
        supabase.from("velocity_sales").select("contact_id"),
        supabase.from("membership_records").select("contact_id"),
        supabase.from("summit_registrations").select("contact_id"),
      ]);

      if (contactsRes.error) throw contactsRes.error;

      // Combine velocity_members and velocity_sales into single "Velocity" tag
      const workshopIds = new Set((workshopRes.data ?? []).map((r) => r.contact_id));
      const velocityIds = new Set([
        ...(velocityMembersRes.data ?? []).map((r) => r.contact_id),
        ...(velocitySalesRes.data ?? []).map((r) => r.contact_id),
      ]);
      const liveIds = new Set((membershipRes.data ?? []).map((r) => r.contact_id));
      const sumIds = new Set((summitRes.data ?? []).map((r) => r.contact_id));

      return (contactsRes.data ?? []).map((c) => {
        const sources: string[] = [];
        if (workshopIds.has(c.id)) sources.push("Workshop");
        if (liveIds.has(c.id)) sources.push("Live");
        if (velocityIds.has(c.id)) sources.push("Velocity");
        if (sumIds.has(c.id)) sources.push("Summit");
        return { id: c.id, name: c.name, email: c.email, phone: c.phone, sources } as ContactWithSources;
      });
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.toLowerCase();
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.sources.some((s) => s.toLowerCase().includes(q))
    );
  }, [contacts, search]);

  if (isLoading) return <div className="text-steel text-sm p-4">Loading…</div>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading text-xl text-gold tracking-wide">Contacts</h2>
        <p className="text-xs text-steel mt-1">
          Unified CRM — {contacts.length} contacts aggregated from all dashboards
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-steel" />
        <Input
          placeholder="Search name, email, phone, or source…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-card border-border text-foreground text-sm h-9"
        />
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="whitespace-nowrap text-xs font-semibold text-steel min-w-[150px]">Name</TableHead>
                <TableHead className="whitespace-nowrap text-xs font-semibold text-steel min-w-[180px]">Email</TableHead>
                <TableHead className="whitespace-nowrap text-xs font-semibold text-steel min-w-[140px]">Phone</TableHead>
                <TableHead className="whitespace-nowrap text-xs font-semibold text-steel min-w-[280px]">Appears In</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((contact) => (
                <TableRow key={contact.id} className="hover:bg-muted/20 cursor-pointer" onClick={() => setSelectedContact(contact)}>
                  <TableCell className="whitespace-nowrap text-sm font-medium">
                    <button className="text-foreground hover:text-gold transition-colors text-left">
                      {contact.name}
                    </button>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-foreground">{contact.email}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-foreground">{contact.phone || "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex gap-1.5 flex-wrap">
                      {contact.sources.map((s) => (
                        <Badge key={s} variant="outline" className={`text-[10px] px-1.5 py-0 ${sourceBadgeColors[s] || ""}`}>
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-steel text-sm py-8">
                    No contacts found
                  </TableCell>
                </TableRow>
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
