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
import { getMetrics, storeName } from "@/lib/gaap/metrics";
import { storeByNode } from "@/lib/gaap/stores";
import { fmtNum, fmtPct, fmtZAR, fmtZAR2 } from "@/lib/format";

export const dynamic = "force-dynamic";

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-muted-foreground truncate text-sm">{label}</div>
        <div className="mt-1 text-xl font-semibold tracking-tight tabular-nums whitespace-nowrap">
          {value}
        </div>
        {sub ? <div className="text-muted-foreground mt-1 truncate text-xs">{sub}</div> : null}
      </CardContent>
    </Card>
  );
}

/** "2026-06-15" -> "Mon 15" */
function dayLabel(d: string): string {
  const dt = new Date(d + "T00:00:00Z");
  return dt.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric" });
}

export default async function StoreMonthPage({
  params,
}: {
  params: Promise<{ node: string; month: string }>;
}) {
  await requireUser();
  const { node, month } = await params;
  const cfg = storeByNode(node);
  if (!cfg || !/^\d{4}-\d{2}$/.test(month)) notFound();

  const [y, mo] = month.split("-").map(Number);
  const start = `${month}-01`;
  // Day 0 of the next month = last day of this month.
  const end = new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10);
  const monthName = new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString("en-ZA", {
    month: "long",
    year: "numeric",
  });

  const m = await getMetrics(start, end, node);
  const name = storeName(node, m.storeName);
  const daysDesc = [...m.daily].reverse();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/dashboard/${node}`}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="h-4 w-4" /> {name}
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="border-brand inline-block border-b-2 pb-1 text-2xl font-semibold tracking-tight">
              {name} — {monthName}
            </h1>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="secondary">{cfg.manager}</Badge>
              <span className="text-muted-foreground text-sm">{cfg.format}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Month totals */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Turnover (excl. VAT)" value={fmtZAR(m.totals.turnoverExcl)} />
        <Stat label="SPI" value={fmtZAR2(m.totals.avgSpend)} sub="sales per invoice" />
        <Stat label="Gross profit" value={fmtZAR(m.totals.grossProfit)} sub={`${fmtPct(m.totals.gpPct)} margin`} />
        <Stat label="Invoices" value={fmtNum(m.totals.transactions)} />
        <Stat label="Wastage" value={fmtZAR(Math.abs(m.totals.wastage))} />
        <Stat label="Stock variance" value={fmtZAR(m.totals.stockVariance)} />
      </div>

      {/* Day by day */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Day by day — {monthName}</CardTitle>
        </CardHeader>
        <CardContent>
          {daysDesc.length === 0 ? (
            <p className="text-muted-foreground text-sm">No data for this month.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Day</TableHead>
                    <TableHead className="text-right">Turnover (excl)</TableHead>
                    <TableHead className="text-right">Invoices</TableHead>
                    <TableHead className="text-right">SPI</TableHead>
                    <TableHead className="text-right">Gross profit</TableHead>
                    <TableHead className="text-right">GP %</TableHead>
                    <TableHead className="text-right">Wastage</TableHead>
                    <TableHead className="text-right">Stock variance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {daysDesc.map((d) => (
                    <TableRow key={d.date}>
                      <TableCell className="font-medium whitespace-nowrap">{dayLabel(d.date)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtZAR(d.turnoverExcl)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtNum(d.transactionCount)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtZAR2(d.avgSpend)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtZAR(d.grossProfit)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtPct(d.gpPct)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtZAR(Math.abs(d.wastage))}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtZAR(d.stockVariance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
