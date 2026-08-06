import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Legend,
  LabelList,
  LabelProps,
  Tooltip,
  TooltipProps,
  XAxis,
  YAxis,
} from "recharts";
import { ChartConfig, ChartContainer, ChartLegendContent } from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface DailyRevenueRow {
  day: string;
  product_line: string;
  sales: number;
  cash_collected: number;
}

interface RevenueDay {
  day: string;
  label: string;
  sales: number;
  cash: number;
  outstanding: number;
  items: DailyRevenueRow[];
}

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactMoney = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const barMoney = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const chartConfig = {
  cash: {
    label: "Cash Collected",
    color: "hsl(var(--forest-light))",
  },
  outstanding: {
    label: "Sales Above Cash",
    color: "hsl(var(--gold-muted))",
  },
} satisfies ChartConfig;

/** `day` is already a Pacific calendar date -- parse as local, not UTC. */
function fmtDay(day: string) {
  const [, month, date] = day.split("-").map(Number);
  return `${month}/${date}`;
}

function getWeekStart(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  const localDate = new Date(year, month - 1, date);
  localDate.setDate(localDate.getDate() - localDate.getDay());
  return {
    key: `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, "0")}-${String(
      localDate.getDate(),
    ).padStart(2, "0")}`,
    label: `${localDate.getMonth() + 1}/${localDate.getDate()}`,
  };
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function getPacificToday() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return new Date(value("year"), value("month") - 1, value("day"));
}

function RevenueTooltip({ active, payload }: TooltipProps<number, string>) {
  const data = payload?.[0]?.payload as RevenueDay | undefined;
  if (!active || !data) return null;

  return (
    <div className="min-w-56 border border-border bg-popover p-3 text-popover-foreground shadow-xl">
      <p className="mb-2 text-xs font-semibold text-foreground">{data.label}</p>
      <div className="mb-2 grid gap-1 text-xs">
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2.5 w-2.5 bg-[hsl(var(--gold-muted))]" />
            Sales
          </span>
          <span className="font-medium tabular-nums">{money.format(data.sales)}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2.5 w-2.5 bg-[hsl(var(--forest-light))]" />
            Cash Collected
          </span>
          <span className="font-medium tabular-nums">{money.format(data.cash)}</span>
        </div>
      </div>
      <div className="border-t border-border pt-2">
        {data.items.map((item) => (
          <div key={item.product_line} className="flex items-center justify-between gap-6 py-0.5 text-[11px]">
            <span className="text-muted-foreground">{item.product_line}</span>
            <span className="tabular-nums text-foreground">{money.format(item.cash_collected)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RevenueBarLabel({ viewBox, index, days }: LabelProps & { days: RevenueDay[] }) {
  const box = viewBox as { x?: number; y?: number; width?: number } | undefined;
  const day = typeof index === "number" ? days[index] : undefined;
  if (!day || typeof box?.x !== "number" || typeof box.y !== "number" || typeof box.width !== "number") {
    return null;
  }

  const x = box.x + box.width / 2;
  const y = box.y - 46;

  return (
    <text x={x} y={y} textAnchor="middle" fontSize={10}>
      <tspan x={x} dy={0} fill="hsl(var(--gold-deep))" fontWeight={700}>Sales:</tspan>
      <tspan x={x} dy={12} fill="hsl(var(--gold-deep))" fontWeight={600}>{barMoney.format(day.sales)}</tspan>
      <tspan x={x} dy={13} fill="hsl(var(--forest-light))" fontWeight={700}>Cash:</tspan>
      <tspan x={x} dy={12} fill="hsl(var(--forest-light))" fontWeight={600}>{barMoney.format(day.cash)}</tspan>
    </text>
  );
}

export default function DailyRevenueTable({ rows }: { rows: DailyRevenueRow[] }) {
  const days: RevenueDay[] = Array.from(new Set(rows.map((row) => row.day)))
    .sort((a, b) => b.localeCompare(a))
    .map((day) => {
      const items = rows
        .filter((row) => row.day === day)
        .sort((a, b) => b.sales - a.sales || a.product_line.localeCompare(b.product_line));
      const sales = items.reduce((sum, row) => sum + row.sales, 0);
      const cash = items.reduce((sum, row) => sum + row.cash_collected, 0);
      return {
        day,
        label: fmtDay(day),
        items,
        sales,
        cash,
        outstanding: Math.max(0, sales - cash),
      };
    });

  const weekly = Array.from(
    rows.reduce((weeks, row) => {
      const week = getWeekStart(row.day);
      const current = weeks.get(week.key) ?? { week: week.key, label: week.label, sales: 0, cash: 0 };
      current.sales += row.sales;
      current.cash += row.cash_collected;
      weeks.set(week.key, current);
      return weeks;
    }, new Map<string, { week: string; label: string; sales: number; cash: number }>()).values(),
  ).sort((a, b) => b.week.localeCompare(a.week));

  const pacificToday = getPacificToday();
  const sevenDaysAgo = new Date(pacificToday);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const todayKey = toDateKey(pacificToday);
  const sevenDaysAgoKey = toDateKey(sevenDaysAgo);
  const lastSevenDays = rows
    .filter((row) => row.day >= sevenDaysAgoKey && row.day <= todayKey)
    .reduce(
      (total, row) => ({
        sales: total.sales + row.sales,
        cash: total.cash + row.cash_collected,
      }),
      { sales: 0, cash: 0 },
    );

  return (
    <div className="mb-8">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading text-lg tracking-wide text-gold">Daily Sales &amp; Cash Collected</h2>
        <p className="text-xs text-steel">Daily totals · Pacific time</p>
      </div>

      {days.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card px-2 pb-2 pt-4">
          <div style={{ width: Math.max(560, days.length * 57 + 80) }}>
            <ChartContainer config={chartConfig} className="h-[340px] w-full aspect-auto">
              <BarChart data={days} accessibilityLayer margin={{ top: 64, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  minTickGap={12}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  width={72}
                  tickFormatter={(value: number) => compactMoney.format(value)}
                />
                <Tooltip content={<RevenueTooltip />} cursor={{ fill: "hsl(var(--muted) / 0.45)" }} />
                <Legend content={<ChartLegendContent />} />
                <Bar dataKey="cash" stackId="revenue" fill="var(--color-cash)" maxBarSize={42}>
                  {days.map((day) => (
                    <Cell
                      key={day.day}
                      radius={day.outstanding > 0 ? [0, 0, 3, 3] : [3, 3, 3, 3]}
                    />
                  ))}
                </Bar>
                <Bar
                  dataKey="outstanding"
                  stackId="revenue"
                  fill="var(--color-outstanding)"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={42}
                >
                  <LabelList
                    dataKey="day"
                    content={(props) => <RevenueBarLabel {...props} days={days} />}
                  />
                </Bar>
              </BarChart>
            </ChartContainer>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border py-12 text-center text-sm text-steel">
          No sales recorded
        </div>
      )}

      <p className="mt-2 text-[10px] text-steel/70">
        Sales and Cash Collected match for pay-in-full products. Velocity sales are booked at
        enrollment while installment cash appears on the day it is collected.
      </p>

      <div className="mt-6 w-full max-w-3xl">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h3 className="font-heading text-base tracking-wide text-gold">Weekly Summary</h3>
          <p className="text-xs text-steel">Sunday–Saturday · Pacific time</p>
        </div>
        <div className="overflow-hidden rounded-lg border border-border">
          <Table className="[&_th]:h-9 [&_th]:px-3 [&_td]:px-3 [&_td]:py-2">
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs font-semibold text-steel">Week</TableHead>
                <TableHead className="text-right text-xs font-semibold text-gold-deep">Sales</TableHead>
                <TableHead className="text-right text-xs font-semibold text-forest-light">Cash Collected</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="bg-muted/20 hover:bg-muted/30">
                <TableCell className="text-sm font-semibold text-foreground">Last 7 days</TableCell>
                <TableCell className="text-right text-sm font-bold tabular-nums text-gold-deep">
                  {money.format(lastSevenDays.sales)}
                </TableCell>
                <TableCell className="text-right text-sm font-bold tabular-nums text-forest-light">
                  {money.format(lastSevenDays.cash)}
                </TableCell>
              </TableRow>
              {weekly.map((week) => (
                <TableRow key={week.week} className="hover:bg-muted/20">
                  <TableCell className="text-sm font-medium text-foreground">Week of {week.label}</TableCell>
                  <TableCell className="text-right text-sm font-semibold tabular-nums text-gold-deep">
                    {money.format(week.sales)}
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold tabular-nums text-forest-light">
                    {money.format(week.cash)}
                  </TableCell>
                </TableRow>
              ))}
              {weekly.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-sm text-steel">
                    No weekly activity
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
