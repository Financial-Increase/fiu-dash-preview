import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
}

export default function StatCard({ label, value, icon: Icon, trend }: StatCardProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex items-start gap-3">
      <div className="w-10 h-10 rounded-lg bg-emerald/50 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-gold" />
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-steel font-semibold">{label}</p>
        <p className="text-2xl font-heading text-foreground mt-0.5">{value}</p>
        {trend && <p className="text-[10px] text-emerald mt-1">{trend}</p>}
      </div>
    </div>
  );
}
