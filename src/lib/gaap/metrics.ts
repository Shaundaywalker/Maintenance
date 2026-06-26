import "server-only";
import { and, eq, gte, lte, asc } from "drizzle-orm";
import { db } from "@/db";
import { gaapDailyMetrics, type GaapDailyMetrics } from "@/db/schema";
import { GAAP_STORE_NODE } from "./config";

export interface DailyPoint {
  date: string;
  turnover: number;
  turnoverExcl: number;
  grossProfit: number;
  costOfSales: number;
  voids: number;
  wastage: number;
  transactionCount: number;
  avgSpend: number;
}

export interface MetricsBundle {
  storeName: string;
  start: string;
  end: string;
  lastSyncedAt: Date | null;
  totals: {
    turnoverExcl: number;
    grossProfit: number;
    gpPct: number;
    transactions: number;
    avgSpend: number;
    voids: number;
    wastage: number;
    days: number;
  };
  daily: DailyPoint[];
  monthly: Array<{ month: string; turnoverExcl: number; avgSpend: number; transactions: number }>;
  departments: Array<{ name: string; value: number }>;
  channels: Array<{ name: string; value: number }>;
}

function parseMap(json: string | null): Record<string, number> {
  if (!json) return {};
  try {
    return JSON.parse(json) as Record<string, number>;
  } catch {
    return {};
  }
}

/** Default window: last 12 months up to today. */
export function defaultWindow(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setUTCFullYear(start.getUTCFullYear() - 1);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export async function getMetrics(
  start: string,
  end: string,
  node = GAAP_STORE_NODE,
): Promise<MetricsBundle> {
  const rows: GaapDailyMetrics[] = await db
    .select()
    .from(gaapDailyMetrics)
    .where(
      and(
        eq(gaapDailyMetrics.node, node),
        gte(gaapDailyMetrics.date, start),
        lte(gaapDailyMetrics.date, end),
      ),
    )
    .orderBy(asc(gaapDailyMetrics.date));

  const daily: DailyPoint[] = rows.map((r) => ({
    date: r.date,
    turnover: r.turnover,
    turnoverExcl: r.turnoverExcl,
    grossProfit: r.grossProfit,
    costOfSales: r.costOfSales,
    voids: r.voids,
    wastage: r.wastage,
    transactionCount: r.transactionCount,
    avgSpend: r.avgSpend,
  }));

  // Totals
  const turnoverExcl = sum(rows, (r) => r.turnoverExcl);
  const grossProfit = sum(rows, (r) => r.grossProfit);
  const transactions = sum(rows, (r) => r.transactionCount);
  const lineTotalForAvg = sum(rows, (r) => r.avgSpend * r.transactionCount);

  // Monthly rollup
  const monthMap = new Map<string, { turnoverExcl: number; transactions: number }>();
  for (const r of rows) {
    const m = r.date.slice(0, 7); // YYYY-MM
    const cur = monthMap.get(m) ?? { turnoverExcl: 0, transactions: 0 };
    cur.turnoverExcl += r.turnoverExcl;
    cur.transactions += r.transactionCount;
    monthMap.set(m, cur);
  }
  const monthly = [...monthMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, v]) => ({
      month,
      turnoverExcl: v.turnoverExcl,
      transactions: v.transactions,
      avgSpend: v.transactions > 0 ? v.turnoverExcl / v.transactions : 0,
    }));

  // Department + channel rollups across the window
  const deptMap = new Map<string, number>();
  const chanMap = new Map<string, number>();
  for (const r of rows) {
    for (const [k, v] of Object.entries(parseMap(r.departmentBreakdown)))
      deptMap.set(k, (deptMap.get(k) ?? 0) + v);
    for (const [k, v] of Object.entries(parseMap(r.channelBreakdown)))
      chanMap.set(k, (chanMap.get(k) ?? 0) + v);
  }
  const departments = [...deptMap.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const channels = [...chanMap.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const lastSyncedAt = rows.reduce<Date | null>((acc, r) => {
    return !acc || r.syncedAt > acc ? r.syncedAt : acc;
  }, null);

  return {
    storeName: rows[0]?.storeName ?? "Store",
    start,
    end,
    lastSyncedAt,
    totals: {
      turnoverExcl,
      grossProfit,
      gpPct: turnoverExcl > 0 ? (grossProfit / turnoverExcl) * 100 : 0,
      transactions,
      avgSpend: transactions > 0 ? lineTotalForAvg / transactions : 0,
      voids: sum(rows, (r) => r.voids),
      wastage: sum(rows, (r) => r.wastage),
      days: rows.length,
    },
    daily,
    monthly,
    departments,
    channels,
  };
}

function sum<T>(arr: T[], pick: (t: T) => number): number {
  return arr.reduce((acc, t) => acc + pick(t), 0);
}
