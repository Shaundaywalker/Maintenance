import "server-only";
import { and, eq, gte, lte, asc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { gaapDailyMetrics, type GaapDailyMetrics } from "@/db/schema";
import { GAAP_STORE_NODE } from "./config";
import { BHO_STORES, BHO_START_DATE, MANAGERS, storeByNode } from "./stores";

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
  monthly: MonthlyPoint[];
  departments: Array<{ name: string; value: number }>;
  channels: Array<{ name: string; value: number }>;
}

export interface MonthlyPoint {
  month: string;
  turnoverExcl: number;
  avgSpend: number;
  transactions: number;
  grossProfit: number;
  gpPct: number;
  voids: number;
  wastage: number;
}

function parseMap(json: string | null): Record<string, number> {
  if (!json) return {};
  try {
    return JSON.parse(json) as Record<string, number>;
  } catch {
    return {};
  }
}

/** Default window: from the fixed BHO history start up to today. */
export function defaultWindow(): { start: string; end: string } {
  return { start: BHO_START_DATE, end: new Date().toISOString().slice(0, 10) };
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
  const monthMap = new Map<
    string,
    { turnoverExcl: number; transactions: number; grossProfit: number; voids: number; wastage: number }
  >();
  for (const r of rows) {
    const m = r.date.slice(0, 7); // YYYY-MM
    const cur =
      monthMap.get(m) ?? { turnoverExcl: 0, transactions: 0, grossProfit: 0, voids: 0, wastage: 0 };
    cur.turnoverExcl += r.turnoverExcl;
    cur.transactions += r.transactionCount;
    cur.grossProfit += r.grossProfit;
    cur.voids += r.voids;
    cur.wastage += r.wastage;
    monthMap.set(m, cur);
  }
  const monthly: MonthlyPoint[] = [...monthMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, v]) => ({
      month,
      turnoverExcl: v.turnoverExcl,
      transactions: v.transactions,
      avgSpend: v.transactions > 0 ? v.turnoverExcl / v.transactions : 0,
      grossProfit: v.grossProfit,
      gpPct: v.turnoverExcl > 0 ? (v.grossProfit / v.turnoverExcl) * 100 : 0,
      voids: v.voids,
      wastage: v.wastage,
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

// ── Consolidated BHO overview (all stores) ───────────────────────────────────

export interface StoreSummary {
  node: string;
  name: string;
  manager: string;
  format: string;
  turnoverExcl: number;
  grossProfit: number;
  gpPct: number;
  transactions: number;
  avgSpend: number;
  hasData: boolean;
}

export interface ManagerSummary {
  manager: string;
  turnoverExcl: number;
  transactions: number;
  avgSpend: number;
  gpPct: number;
  storeCount: number;
}

export interface BhoOverview {
  start: string;
  end: string;
  storeCount: number;
  lastSyncedAt: Date | null;
  totals: {
    turnoverExcl: number;
    grossProfit: number;
    gpPct: number;
    transactions: number;
    avgSpend: number;
    voids: number;
    wastage: number;
  };
  monthly: Array<{ month: string; turnoverExcl: number; avgSpend: number; transactions: number }>;
  managers: ManagerSummary[];
  stores: StoreSummary[];
}

export async function getBhoOverview(start: string, end: string): Promise<BhoOverview> {
  const nodes = BHO_STORES.map((s) => s.node);
  const rows: GaapDailyMetrics[] = await db
    .select()
    .from(gaapDailyMetrics)
    .where(
      and(
        inArray(gaapDailyMetrics.node, nodes),
        gte(gaapDailyMetrics.date, start),
        lte(gaapDailyMetrics.date, end),
      ),
    );

  // Per-store accumulation
  const perStore = new Map<string, { te: number; gp: number; cos: number; tx: number }>();
  const monthMap = new Map<string, { te: number; tx: number }>();
  let lastSyncedAt: Date | null = null;

  for (const r of rows) {
    const ps = perStore.get(r.node) ?? { te: 0, gp: 0, cos: 0, tx: 0 };
    ps.te += r.turnoverExcl;
    ps.gp += r.grossProfit;
    ps.cos += r.costOfSales;
    ps.tx += r.transactionCount;
    perStore.set(r.node, ps);

    const m = r.date.slice(0, 7);
    const mm = monthMap.get(m) ?? { te: 0, tx: 0 };
    mm.te += r.turnoverExcl;
    mm.tx += r.transactionCount;
    monthMap.set(m, mm);

    if (!lastSyncedAt || r.syncedAt > lastSyncedAt) lastSyncedAt = r.syncedAt;
  }

  const stores: StoreSummary[] = BHO_STORES.map((cfg) => {
    const ps = perStore.get(cfg.node);
    const te = ps?.te ?? 0;
    const tx = ps?.tx ?? 0;
    const gp = ps?.gp ?? 0;
    return {
      node: cfg.node,
      name: cfg.name,
      manager: cfg.manager,
      format: cfg.format,
      turnoverExcl: te,
      grossProfit: gp,
      gpPct: te > 0 ? (gp / te) * 100 : 0,
      transactions: tx,
      avgSpend: tx > 0 ? te / tx : 0,
      hasData: !!ps,
    };
  }).sort((a, b) => b.turnoverExcl - a.turnoverExcl);

  const managers: ManagerSummary[] = MANAGERS.map((mgr) => {
    const ss = stores.filter((s) => s.manager === mgr);
    const te = sum(ss, (s) => s.turnoverExcl);
    const gp = sum(ss, (s) => s.grossProfit);
    const tx = sum(ss, (s) => s.transactions);
    return {
      manager: mgr,
      turnoverExcl: te,
      transactions: tx,
      avgSpend: tx > 0 ? te / tx : 0,
      gpPct: te > 0 ? (gp / te) * 100 : 0,
      storeCount: ss.length,
    };
  });

  const totalTE = sum(rows, (r) => r.turnoverExcl);
  const totalGP = sum(rows, (r) => r.grossProfit);
  const totalTx = sum(rows, (r) => r.transactionCount);

  const monthly = [...monthMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, v]) => ({
      month,
      turnoverExcl: v.te,
      transactions: v.tx,
      avgSpend: v.tx > 0 ? v.te / v.tx : 0,
    }));

  return {
    start,
    end,
    storeCount: BHO_STORES.length,
    lastSyncedAt,
    totals: {
      turnoverExcl: totalTE,
      grossProfit: totalGP,
      gpPct: totalTE > 0 ? (totalGP / totalTE) * 100 : 0,
      transactions: totalTx,
      avgSpend: totalTx > 0 ? totalTE / totalTx : 0,
      voids: sum(rows, (r) => r.voids),
      wastage: sum(rows, (r) => r.wastage),
    },
    monthly,
    managers,
    stores,
  };
}

/** Store display name from config, falling back to the DB value. */
export function storeName(node: string, fallback?: string | null): string {
  return storeByNode(node)?.name ?? fallback ?? "Store";
}
