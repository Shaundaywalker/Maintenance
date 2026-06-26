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
import { getMetrics, defaultWindow, storeName } from "@/lib/gaap/metrics";
import { storeByNode } from "@/lib/gaap/stores";
import { fmtMonth, fmtNum, fmtPct, fmtZAR, fmtZAR2 } from "@/lib/format";
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
}: {
  params: Promise<{ node: string }>;
}) {
  await requireUser();
  const { node } = await params;
  const cfg = storeByNode(node);
  if (!cfg) notFound();

  const { start, end } = defaultWindow();
  const m = await getMetrics(start, end, node);
  const name = storeName(node, m.storeName);
  const topDepartments = m.departments.slice(0, 8);
  // Most recent month first in the table.
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
            {start} → {end}
            {m.lastSyncedAt ? ` · synced ${m.lastSyncedAt.toLocaleDateString("en-ZA")}` : ""}
          </p>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <Stat label="Turnover (excl. VAT)" value={fmtZAR(m.totals.turnoverExcl)} />
        <Stat label="Average spend" value={fmtZAR2(m.totals.avgSpend)} sub="per transaction" />
        <Stat label="Gross profit" value={fmtZAR(m.totals.grossProfit)} sub={`${fmtPct(m.totals.gpPct)} margin`} />
        <Stat label="Transactions" value={fmtNum(m.totals.transactions)} />
        <Stat label="Wastage" value={fmtZAR(Math.abs(m.totals.wastage))} />
        <Stat label="Stock variance" value={fmtZAR(m.totals.stockVariance)} />
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

      {/* Month-by-month detail */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Month by month</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Turnover (excl)</TableHead>
                  <TableHead className="text-right">Transactions</TableHead>
                  <TableHead className="text-right">Avg spend</TableHead>
                  <TableHead className="text-right">Gross profit</TableHead>
                  <TableHead className="text-right">GP %</TableHead>
                  <TableHead className="text-right">Wastage</TableHead>
                  <TableHead className="text-right">Stock variance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthsDesc.map((mo) => (
                  <TableRow key={mo.month}>
                    <TableCell className="font-medium">{fmtMonth(mo.month)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtZAR(mo.turnoverExcl)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtNum(mo.transactions)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtZAR2(mo.avgSpend)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtZAR(mo.grossProfit)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtPct(mo.gpPct)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtZAR(Math.abs(mo.wastage))}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtZAR(mo.stockVariance)}</TableCell>
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
            <ChannelPieChart data={m.channels} />
            <ChannelLegend data={m.channels} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
