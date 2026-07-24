import StatCard from "@/components/StatCard";
import { BookOpen, Rocket, CreditCard, Users, UserCheck, Crown, CalendarDays } from "lucide-react";

const stats = [
  { label: "Book Shipments", value: 142, icon: BookOpen, trend: "+12 this week" },
  { label: "Velocity Leads", value: 38, icon: Rocket, trend: "+5 this week" },
  { label: "Payments Due", value: 7, icon: CreditCard },
  { label: "Workshop Registrants", value: 256, icon: CalendarDays, trend: "+34 this week" },
  { label: "Velocity Members", value: 24, icon: UserCheck },
  { label: "FIU Members", value: 189, icon: Users, trend: "+8 this month" },
  { label: "Summit Registrants", value: 312, icon: Crown },
];

export default function Overview() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-2xl tracking-wide text-gold">Dashboard Overview</h1>
        <p className="text-xs text-steel mt-1">Financial Increase University — All Systems</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>
    </div>
  );
}
