import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import ContactCardDialog from "./ContactCardDialog";

interface Column {
  key: string;
  label: string;
  type?: "text" | "date" | "badge" | "currency" | "boolean";
}

interface DashboardTableProps {
  title: string;
  subtitle?: string;
  columns: Column[];
  data: Record<string, any>[];
  count?: number;
}

const statusColors: Record<string, string> = {
  Active: "bg-emerald text-foreground",
  Paid: "bg-emerald text-foreground",
  Delivered: "bg-emerald text-foreground",
  DELIVERED: "bg-emerald text-foreground",
  TRANSIT: "bg-primary/20 text-primary",
  "PRE_TRANSIT": "bg-gold/20 text-gold",
  Enrolled: "bg-emerald text-foreground",
  Yes: "bg-emerald text-foreground",
  Bundled: "bg-gold/20 text-gold",
  Late: "bg-destructive/20 text-destructive",
  Failed: "bg-destructive/20 text-destructive",
  Paused: "bg-gold/20 text-gold",
  Canceled: "bg-destructive/20 text-destructive",
  Expired: "bg-steel/20 text-steel",
  No: "bg-muted text-muted-foreground",
};

export default function DashboardTable({ title, subtitle, columns, data, count }: DashboardTableProps) {
  const [selectedContact, setSelectedContact] = useState<Record<string, any> | null>(null);

  return (
    <div>
      <div className="mb-4">
        <div className="flex items-baseline gap-3">
          <h2 className="font-heading text-xl tracking-wide text-gold">{title}</h2>
          {count !== undefined && (
            <span className="text-xs text-steel font-body">({count} records)</span>
          )}
        </div>
        {subtitle && <p className="text-xs text-steel mt-1">{subtitle}</p>}
      </div>

      <div className="rounded-lg border border-border overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                {columns.map((col) => (
                  <TableHead key={col.key} className="text-steel text-[10px] uppercase tracking-wider font-semibold">
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, i) => (
                <TableRow key={i} className="border-border hover:bg-muted/30 transition-colors">
                  {columns.map((col) => (
                    <TableCell key={col.key} className="text-sm">
                      {col.type === "badge" ? (
                        <Badge variant="secondary" className={`text-[10px] font-semibold ${statusColors[row[col.key]] || "bg-muted text-muted-foreground"}`}>
                          {row[col.key]}
                        </Badge>
                      ) : col.type === "currency" ? (
                        <span className="font-mono text-gold">${Number(row[col.key]).toLocaleString()}</span>
                      ) : col.type === "boolean" ? (
                        <Badge variant="secondary" className={`text-[10px] font-semibold ${row[col.key] ? statusColors.Yes : statusColors.No}`}>
                          {row[col.key] ? "Yes" : "No"}
                        </Badge>
                      ) : col.key === "name" ? (
                        <button
                          onClick={() => setSelectedContact(row)}
                          className="font-medium text-foreground hover:text-gold transition-colors text-left"
                        >
                          {row[col.key] ?? "—"}
                        </button>
                      ) : (
                        <span className="text-muted-foreground">
                          {row[col.key] ?? "—"}
                        </span>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {selectedContact && (
        <ContactCardDialog
          open={!!selectedContact}
          onOpenChange={(open) => !open && setSelectedContact(null)}
          contactId={selectedContact.id || selectedContact.name}
          contactName={selectedContact.name}
          email={selectedContact.email}
          phone={selectedContact.phone}
        />
      )}
    </div>
  );
}
