import Link from "next/link";
import { ChevronRight } from "lucide-react";
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
import { getBhoOverview, defaultWindow, type GroupSummary } from "@/lib/gaap/metrics";
import { BHO_STORES_NO_DATA, MANAGERS } from "@/lib/gaap/stores";
import { fmtNum, fmtPct, fmtZAR, fmtZAR2 } from "@/lib/format";
import {
  AvgSpendTrendChart,
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

/** A "turnover by X" bar chart + summary list, used for both managers and types. */
function GroupBreakdown({ title, groups }: { title: string; groups: GroupSummary[] }) {
  const chart = groups.map((g) => ({ name: g.label, value: g.turnoverExcl }));
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <DepartmentBarChart data={chart} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {groups.map((g) => (
            <div key={g.label} className="flex items-center justify-between">
              <div>
                <div className="font-medium">{g.label}</div>
                <div className="text-muted-foreground text-xs">
                  {g.storeCount} stores · {fmtPct(g.gpPct)} GP
                </div>
              </div>
              <div className="text-right tabular-nums">
                <div>{fmtZAR(g.turnoverExcl)}</div>
                <div className="text-muted-foreground text-xs">{fmtZAR2(g.avgSpend)} avg</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default async function DashboardPage() {
  await requireUser();
  const { start, end } = defaultWindow();
  const bho = await getBhoOverview(start, end);

  const hasData = bho.totals.transactions > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="border-brand inline-block border-b-2 pb-1 text-2xl font-semibold tracking-tight">
            BHO — Bootlegger Head Office
          </h1>
          <p className="text-muted-foreground mt-2">
            Group consolidated · {bho.storeCount} stores · {start} → {end}
          </p>
        </div>
        {bho.lastSyncedAt ? (
          <p className="text-muted-foreground text-xs">
            Last synced {bho.lastSyncedAt.toLocaleString("en-ZA")}
          </p>
        ) : null}
      </div>

      {!hasData ? (
        <Card>
          <CardHeader>
            <CardTitle>No data yet</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Run <code className="bg-muted rounded px-1 py-0.5">npm run gaap:backfill</code> to load
            history from GAAP, then refresh.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Group KPI row */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-7">
            <Stat label="Group turnover (excl. VAT)" value={fmtZAR(bho.totals.turnoverExcl)} />
            <Stat label="Average spend" value={fmtZAR2(bho.totals.avgSpend)} sub="per transaction" />
            <Stat
              label="Gross profit"
              value={fmtZAR(bho.totals.grossProfit)}
              sub={`${fmtPct(bho.totals.gpPct)} margin`}
            />
            <Stat label="Transactions" value={fmtNum(bho.totals.transactions)} />
            <Stat label="Stores" value={fmtNum(bho.storeCount)} />
            <Stat label="Wastage" value={fmtZAR(Math.abs(bho.totals.wastage))} />
            <Stat label="Stock variance" value={fmtZAR(bho.totals.stockVariance)} />
          </div>

          {/* Store-type split (All Day Café vs XS) */}
          <GroupBreakdown title="Turnover by store type" groups={bho.types} />

          {/* Group trends */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Group monthly turnover (excl. VAT)</CardTitle>
              </CardHeader>
              <CardContent>
                <RevenueTrendChart data={bho.monthly} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Group average spend per transaction</CardTitle>
              </CardHeader>
              <CardContent>
                <AvgSpendTrendChart data={bho.monthly} />
              </CardContent>
            </Card>
          </div>

          {/* By operations manager */}
          <GroupBreakdown title="Turnover by operations manager" groups={bho.managers} />

          {/* Store leaderboard, grouped by manager — click to drill into a store */}
          {MANAGERS.map((mgr) => {
            const stores = bho.stores.filter((s) => s.manager === mgr);
            return (
              <Card key={mgr}>
                <CardHeader>
                  <CardTitle className="text-base">{mgr}&rsquo;s stores</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Store</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Turnover (excl)</TableHead>
                          <TableHead className="text-right">Transactions</TableHead>
                          <TableHead className="text-right">Avg spend</TableHead>
                          <TableHead className="text-right">GP %</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stores.map((s) => (
                          <TableRow key={s.node} className="group">
                            <TableCell className="font-medium">
                              <Link
                                href={`/dashboard/${s.node}`}
                                className="hover:text-brand inline-flex items-center gap-2"
                              >
                                {s.name}
                                {!s.hasData ? (
                                  <Badge variant="outline" className="text-xs">
                                    no data
                                  </Badge>
                                ) : null}
                              </Link>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs font-normal">
                                {s.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {fmtZAR(s.turnoverExcl)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {fmtNum(s.transactions)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {fmtZAR2(s.avgSpend)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {fmtPct(s.gpPct)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Link
                                href={`/dashboard/${s.node}`}
                                className="text-muted-foreground hover:text-foreground inline-flex"
                                aria-label={`Open ${s.name}`}
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
            );
          })}

          {BHO_STORES_NO_DATA.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Awaiting data source</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground space-y-1 text-sm">
                {BHO_STORES_NO_DATA.map((s) => (
                  <div key={s.name}>
                    <span className="text-foreground font-medium">{s.name}</span> ({s.manager}) —{" "}
                    {s.reason}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
