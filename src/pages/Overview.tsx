import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import StatCard from "@/components/StatCard";
import FunnelStatsCard, { FunnelStats } from "@/components/FunnelStatsCard";
import DailyRevenueTable, { DailyRevenueRow } from "@/components/DailyRevenueTable";
import { BookOpen, Rocket, CreditCard, Users, UserCheck, Crown, CalendarDays } from "lucide-react";

/** The $67/mo LIVE membership. Its display name has drifted across GHL
 *  ("Financial Increase University LIVE", "Financial Increase LIVE",
 *  "Purchased FIU LIVE (Active)"), so product_id is the only stable key --
 *  same reasoning as product_categories, where this id is category 'Live'. */
const LIVE_MEMBERSHIP_PRODUCT_ID = "695828e778a7ba627d5115f3";

/** Someone on the $7 trial still has the membership, so they count as a member. */
const MEMBER_SUB_STATUSES = ["active", "trialing"];

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/** `head: true` asks PostgREST for the count header only -- no rows come back. */
async function countRows(
  build: PromiseLike<{ count: number | null; error: { message: string } | null }>,
) {
  const { count, error } = await build;
  if (error) throw error;
  return count ?? 0;
}

const weekAgo = () => new Date(Date.now() - 7 * 86_400_000).toISOString();
const today = () => new Date().toISOString().slice(0, 10);

/** Trends read as deltas, so hide them at zero rather than showing "+0". */
const thisWeek = (n: number) => (n > 0 ? `+${n} this week` : undefined);

export default function Overview() {
  const { data: funnels = [], isLoading } = useQuery({
    queryKey: ["funnel-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funnel_stats")
        .select("*")
        .order("total_revenue", { ascending: false });
      if (error) throw error;
      // PostgREST returns numerics as strings.
      return (data ?? []).map((r) => ({
        ...r,
        main_revenue: Number(r.main_revenue),
        bump_revenue: Number(r.bump_revenue),
        upsell_revenue: Number(r.upsell_revenue),
        downsell_revenue: Number(r.downsell_revenue),
        total_revenue: Number(r.total_revenue),
        bump_attach_pct: r.bump_attach_pct == null ? null : Number(r.bump_attach_pct),
        upsell_take_pct: r.upsell_take_pct == null ? null : Number(r.upsell_take_pct),
        downsell_take_pct: r.downsell_take_pct == null ? null : Number(r.downsell_take_pct),
      })) as FunnelStats[];
    },
  });

  const { data: daily = [] } = useQuery({
    queryKey: ["daily-product-revenue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_product_revenue")
        .select("*")
        .order("day", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        day: r.day,
        product_line: r.product_line,
        sales: Number(r.sales),
        cash_collected: Number(r.cash_collected),
      })) as DailyRevenueRow[];
    },
  });

  const { data: stats = [] } = useQuery({
    queryKey: ["overview-stats"],
    queryFn: async () => {
      const since = weekAgo();
      const dueBy = today();

      const [
        bookOrders,
        bookOrdersWeek,
        velocityLeads,
        velocityLeadsWeek,
        velocityMembers,
        workshops,
        workshopsWeek,
        summit,
        summitAttended,
        liveMembers,
        liveTrials,
        dueInstallments,
        lateSubs,
      ] = await Promise.all([
        countRows(supabase.from("book_orders").select("*", { count: "exact", head: true })),
        countRows(
          supabase
            .from("book_orders")
            .select("*", { count: "exact", head: true })
            .gte("date_ordered", since),
        ),
        countRows(supabase.from("velocity_sales").select("*", { count: "exact", head: true })),
        countRows(
          supabase
            .from("velocity_sales")
            .select("*", { count: "exact", head: true })
            .gte("created_at", since),
        ),
        countRows(
          supabase
            .from("velocity_members")
            .select("*", { count: "exact", head: true })
            .eq("velocity_status", "Active"),
        ),
        countRows(
          supabase.from("workshop_registrations").select("*", { count: "exact", head: true }),
        ),
        countRows(
          supabase
            .from("workshop_registrations")
            .select("*", { count: "exact", head: true })
            .gte("date_registered", since),
        ),
        countRows(supabase.from("summit_registrations").select("*", { count: "exact", head: true })),
        countRows(
          supabase
            .from("summit_registrations")
            .select("*", { count: "exact", head: true })
            .eq("attended", true),
        ),
        countRows(
          supabase
            .from("highlevel_subscriptions")
            .select("*", { count: "exact", head: true })
            .eq("recurring_product_id", LIVE_MEMBERSHIP_PRODUCT_ID)
            .in("status", MEMBER_SUB_STATUSES),
        ),
        countRows(
          supabase
            .from("highlevel_subscriptions")
            .select("*", { count: "exact", head: true })
            .eq("recurring_product_id", LIVE_MEMBERSHIP_PRODUCT_ID)
            .eq("status", "trialing"),
        ),
        // Velocity installments that have come due and are still unpaid.
        supabase
          .from("velocity_installments")
          .select("amount")
          .neq("status", "Paid")
          .lte("due_date", dueBy),
        // A subscription stays flagged is_late until someone resolves it.
        supabase.from("highlevel_subscriptions").select("amount").eq("is_late", true),
      ]);

      if (dueInstallments.error) throw dueInstallments.error;
      if (lateSubs.error) throw lateSubs.error;

      const owed = [
        ...(dueInstallments.data ?? []),
        ...(lateSubs.data ?? []),
      ];
      const outstanding = owed.reduce((sum, r) => sum + Number(r.amount ?? 0), 0);

      return [
        {
          label: "Book Shipments",
          value: bookOrders,
          icon: BookOpen,
          trend: thisWeek(bookOrdersWeek),
        },
        {
          label: "Velocity Leads",
          value: velocityLeads,
          icon: Rocket,
          trend: thisWeek(velocityLeadsWeek),
        },
        {
          label: "Payments Due",
          value: owed.length,
          icon: CreditCard,
          trend: outstanding > 0 ? `${money.format(outstanding)} outstanding` : undefined,
        },
        {
          label: "Workshop Registrants",
          value: workshops,
          icon: CalendarDays,
          trend: thisWeek(workshopsWeek),
        },
        { label: "Velocity Members", value: velocityMembers, icon: UserCheck },
        {
          label: "FIU Members",
          value: liveMembers,
          icon: Users,
          trend: liveTrials > 0 ? `${liveTrials} on trial` : undefined,
        },
        {
          label: "Summit Registrants",
          value: summit,
          icon: Crown,
          trend: summitAttended > 0 ? `${summitAttended} attended` : undefined,
        },
      ];
    },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-2xl tracking-wide text-gold">Dashboard Overview</h1>
        <p className="text-xs text-steel mt-1">Financial Increase University — All Systems</p>
      </div>

      <DailyRevenueTable rows={daily} />

      {isLoading && <p className="text-xs text-steel mb-8">Loading funnel stats…</p>}
      {funnels.map((f) => (
        <FunnelStatsCard key={f.funnel_name} s={f} />
      ))}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>
    </div>
  );
}
