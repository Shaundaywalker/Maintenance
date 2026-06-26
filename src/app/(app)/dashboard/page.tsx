import { requireUser } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMetrics, defaultWindow } from "@/lib/gaap/metrics";
import { fmtNum, fmtPct, fmtZAR, fmtZAR2 } from "@/lib/format";
import {
  AvgSpendTrendChart,
  ChannelLegend,
  ChannelPieChart,
  DepartmentBarChart,
  RevenueTrendChart,
} from "@/components/dashboard/charts";

export const dynamic = "force-dynamic";

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-muted-foreground text-sm">{label}</div>
        <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
          {value}
        </div>
        {sub ? <div className="text-muted-foreground mt-1 text-xs">{sub}</div> : null}
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  await requireUser();
  const { start, end } = defaultWindow();
  const m = await getMetrics(start, end);

  const hasData = m.totals.days > 0;
  const topDepartments = m.departments.slice(0, 8);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="border-brand inline-block border-b-2 pb-1 text-2xl font-semibold tracking-tight">
            {m.storeName} — Store Operations
          </h1>
          <p className="text-muted-foreground mt-2">
            Trailing 12 months · {start} → {end}
          </p>
        </div>
        {m.lastSyncedAt ? (
          <p className="text-muted-foreground text-xs">
            Last synced {m.lastSyncedAt.toLocaleString("en-ZA")}
          </p>
        ) : null}
      </div>

      {!hasData ? (
        <Card>
          <CardHeader>
            <CardTitle>No data yet</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Run <code className="bg-muted rounded px-1 py-0.5">npm run gaap:backfill</code>{" "}
            to load the last 12 months from GAAP, then refresh.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            <Stat label="Turnover (excl. VAT)" value={fmtZAR(m.totals.turnoverExcl)} />
            <Stat label="Average spend" value={fmtZAR2(m.totals.avgSpend)} sub="per transaction" />
            <Stat
              label="Gross profit"
              value={fmtZAR(m.totals.grossProfit)}
              sub={`${fmtPct(m.totals.gpPct)} margin`}
            />
            <Stat label="Transactions" value={fmtNum(m.totals.transactions)} />
            <Stat label="Voids" value={fmtZAR(m.totals.voids)} />
            <Stat label="Wastage" value={fmtZAR(Math.abs(m.totals.wastage))} />
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
        </>
      )}
    </div>
  );
}
