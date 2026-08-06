import { Badge } from "@/components/ui/badge";

export interface FunnelStats {
  funnel_name: string;
  main_units: number;
  main_revenue: number;
  main_orders: number;
  bump_units: number;
  bump_revenue: number;
  bump_orders: number;
  upsell_units: number;
  upsell_revenue: number;
  downsell_units: number;
  downsell_revenue: number;
  total_revenue: number;
  main_buyers: number;
  upsell_buyers: number;
  declined_upsell: number;
  downsell_buyers: number;
  bump_attach_pct: number | null;
  upsell_take_pct: number | null;
  downsell_take_pct: number | null;
}

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const pct = (v: number | null) => (v == null ? "—" : `${v}%`);

/** One step of the funnel. `rate` is the conversion into this step. */
function Step({
  label,
  product,
  tone,
  units,
  revenue,
  rate,
  rateLabel,
}: {
  label: string;
  product: string;
  tone: string;
  units: number;
  revenue: number;
  rate?: string;
  rateLabel?: string;
}) {
  return (
    <div className="flex-1 min-w-[180px] bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${tone}`}>
          {label}
        </Badge>
      </div>
      <p className="text-xs text-steel truncate" title={product}>
        {product}
      </p>
      <p className="text-2xl font-heading text-foreground mt-1 tabular-nums">
        {units}
        <span className="text-xs text-steel font-sans ml-1.5">
          {units === 1 ? "unit" : "units"}
        </span>
      </p>
      <p className="text-sm text-foreground tabular-nums mt-0.5">{money.format(revenue)}</p>
      {rate !== undefined && (
        <p className="text-xs text-steel mt-2 border-t border-border pt-2">
          <span className="text-emerald font-semibold text-base tabular-nums">{rate}</span>{" "}
          {rateLabel}
        </p>
      )}
    </div>
  );
}

export default function FunnelStatsCard({ s }: { s: FunnelStats }) {
  return (
    <div className="mb-8">
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <h2 className="font-heading text-lg tracking-wide text-gold">
          {s.funnel_name} Funnel
        </h2>
        <p className="text-xs text-steel">
          {s.main_buyers} buyers · {money.format(s.total_revenue)} collected
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Step
          label="Main"
          product="Hardcover Book"
          tone="bg-slate-600 text-white border-slate-600"
          units={s.main_units}
          revenue={s.main_revenue}
        />
        <Step
          label="Bump"
          product="FIU Course"
          tone="bg-amber-600 text-white border-amber-600"
          units={s.bump_units}
          revenue={s.bump_revenue}
          rate={pct(s.bump_attach_pct)}
          rateLabel={`attached (${s.bump_orders} of ${s.main_orders} orders)`}
        />
        <Step
          label="Upsell"
          product="Live Membership $67/mo"
          tone="bg-green-600 text-white border-green-600"
          units={s.upsell_units}
          revenue={s.upsell_revenue}
          rate={pct(s.upsell_take_pct)}
          rateLabel={`took it (${s.upsell_buyers} of ${s.main_buyers} buyers)`}
        />
        <Step
          label="Downsell"
          product="Live $7 Trial"
          tone="bg-rose-400 text-white border-rose-400"
          units={s.downsell_units}
          revenue={s.downsell_revenue}
          rate={pct(s.downsell_take_pct)}
          rateLabel={`of the ${s.declined_upsell} who passed on the upsell`}
        />
      </div>

      {/* "Declined" is inferred from purchases -- there is no pageview data, so
          a buyer who never reached the upsell page counts as having declined. */}
      <p className="text-[10px] text-steel/70 mt-2">
        Rates are purchase-based: anyone who bought the book but not the upsell counts as declining it.
      </p>
    </div>
  );
}
