import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getMetrics, defaultWindow, anchorDay, storeName } from "@/lib/gaap/metrics";
import { storeByNode, BHO_START_DATE } from "@/lib/gaap/stores";
import { fmtMonth, fmtNum, fmtPct, fmtPeriod, fmtZAR, fmtZAR2 } from "@/lib/format";
import { DateRangePicker } from "@/components/dashboard/date-range";
import { ChevronRight } from "lucide-react";

const isDate = (s?: string): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
import {
  AvgSpendTrendChart,
  ChannelLegend,
  ChannelPieChart,
  DepartmentBarChart,
  RevenueTrendChart,
} from "@/components/dashboard/charts";

export const dynamic = "force-dynamic";

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-muted-foreground text-sm">{label}</div>
        <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
        {sub ? <div className="text-muted-foreground mt-1 text-xs">{sub}</div> : null}
      </CardContent>
    </Card>
  );
}

export default async function StorePage({
  params,
  searchParams,
}: {
  params: Promise<{ node: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireUser();
  const { node } = await params;
  const cfg = storeByNode(node);
  if (!cfg) notFound();

  const { start, end } = defaultWindow();
  const m = await getMetrics(start, end, node); // full history → trends + month-by-month list

  // Period summary (headline + mix) defaults to yesterday, follows the picker.
  const yesterday = await anchorDay();
  const sp = await searchParams;
  let from = isDate(sp.from) ? sp.from : yesterday;
  let to = isDate(sp.to) ? sp.to : yesterday;
  if (from > to) [from, to] = [to, from];
  const isYesterday = from === yesterday && to === yesterday;
  const period = await getMetrics(from, to, node);

  const name = storeName(node, m.storeName);
  const topDepartments = period.departments.slice(0, 8);
  // Most recent month first; each row drills into day-by-day for that month.
  const monthsDesc = [...m.monthly].reverse();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/dashboard"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="h-4 w-4" /> BHO overview
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="border-brand inline-block border-b-2 pb-1 text-2xl font-semibold tracking-tight">
              {name}
            </h1>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="secondary">{cfg.manager}</Badge>
              <span className="text-muted-foreground text-sm">{cfg.format}</span>
            </div>
          </div>
          <p className="text-muted-foreground text-xs">
            {m.lastSyncedAt ? `Synced ${m.lastSyncedAt.toLocaleDateString("en-ZA")}` : ""}
          </p>
        </div>
      </div>

      {/* Period summary — defaults to yesterday, driven by the from–to picker */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-lg font-semibold tracking-tight">
            {isYesterday ? "Yesterday" : "Selected period"}
          </h2>
          <span className="text-muted-foreground text-sm">{fmtPeriod(from, to)}</span>
        </div>
        <DateRangePicker from={from} to={to} min={BHO_START_DATE} max={end} />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <Stat label="Turnover (excl. VAT)" value={fmtZAR(period.totals.turnoverExcl)} />
        <Stat label="SPI" value={fmtZAR2(period.totals.avgSpend)} sub="sales per invoice" />
        <Stat label="Gross profit" value={fmtZAR(period.totals.grossProfit)} sub={`${fmtPct(period.totals.gpPct)} margin`} />
        <Stat label="Invoices" value={fmtNum(period.totals.transactions)} />
        <Stat label="Wastage" value={fmtZAR(Math.abs(period.totals.wastage))} />
        <Stat label="Stock variance" value={fmtZAR(period.totals.stockVariance)} />
      </div>

      {/* Historical context */}
      <div className="mt-2 flex items-baseline gap-2 border-t pt-4">
        <h2 className="text-lg font-semibold tracking-tight">Trends &amp; month-by-month</h2>
        <span className="text-muted-foreground text-sm">since {start}</span>
      </div>

      {/* Trends */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly turnover (excl. VAT)</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueTrendChart data={m.monthly} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Average spend per transaction</CardTitle>
          </CardHeader>
          <CardContent>
            <AvgSpendTrendChart data={m.monthly} />
          </CardContent>
        </Card>
      </div>

      {/* Month-by-month detail — click a month to drill into day-by-day */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Month by month</CardTitle>
          <p className="text-muted-foreground text-xs">Click a month to see day-by-day.</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Turnover (excl)</TableHead>
                  <TableHead className="text-right">Invoices</TableHead>
                  <TableHead className="text-right">SPI</TableHead>
                  <TableHead className="text-right">Gross profit</TableHead>
                  <TableHead className="text-right">GP %</TableHead>
                  <TableHead className="text-right">Wastage</TableHead>
                  <TableHead className="text-right">Stock variance</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthsDesc.map((mo) => (
                  <TableRow key={mo.month} className="group">
                    <TableCell className="font-medium">
                      <Link
                        href={`/dashboard/${node}/${mo.month}`}
                        className="hover:text-brand inline-flex items-center gap-1"
                      >
                        {fmtMonth(mo.month)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmtZAR(mo.turnoverExcl)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtNum(mo.transactions)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtZAR2(mo.avgSpend)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtZAR(mo.grossProfit)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtPct(mo.gpPct)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtZAR(Math.abs(mo.wastage))}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtZAR(mo.stockVariance)}</TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/dashboard/${node}/${mo.month}`}
                        className="text-muted-foreground hover:text-foreground inline-flex"
                        aria-label={`Day-by-day for ${fmtMonth(mo.month)}`}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Mix */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Sales by department</CardTitle>
          </CardHeader>
          <CardContent>
            <DepartmentBarChart data={topDepartments} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sales by channel</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ChannelPieChart data={period.channels} />
            <ChannelLegend data={period.channels} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
