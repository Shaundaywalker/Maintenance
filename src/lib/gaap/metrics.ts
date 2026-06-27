import "server-only";
import { and, eq, gte, lte, asc, desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { gaapDailyMetrics, type GaapDailyMetrics } from "@/db/schema";
import { GAAP_STORE_NODE } from "./config";
import { BHO_STORES, BHO_START_DATE, MANAGERS, STORE_TYPES, storeByNode } from "./stores";

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
    wastage: number;
    stockVariance: number;
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
  wastage: number;
  stockVariance: number;
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

/**
 * The most recent date that has data — i.e. "yesterday" once the nightly sync
 * has run. Used as the default landing day so the dashboard never shows an empty
 * "today". Pass a node for a single store, omit for the whole estate.
 */
export async function latestDataDate(node?: string): Promise<string | null> {
  const nodes = node ? [node] : BHO_STORES.map((s) => s.node);
  const row = await db
    .select({ date: gaapDailyMetrics.date })
    .from(gaapDailyMetrics)
    .where(inArray(gaapDailyMetrics.node, nodes))
    .orderBy(desc(gaapDailyMetrics.date))
    .limit(1);
  return row[0]?.date ?? null;
}

/**
 * The single "yesterday" date used across EVERY screen (group, leaderboard and
 * per-store), so the same store reads the same number everywhere.
 *
 * = yesterday in SAST (the trading day just closed), unless the estate hasn't
 * synced that far yet, in which case it falls back to the latest day with data.
 * Partial "today" rows are ignored (we never anchor past yesterday).
 */
export async function anchorDay(): Promise<string> {
  const sast = new Date(Date.now() + 2 * 60 * 60 * 1000); // UTC+2
  sast.setUTCDate(sast.getUTCDate() - 1);
  const yesterday = sast.toISOString().slice(0, 10);
  const estateMax = await latestDataDate();
  if (!estateMax) return yesterday;
  return estateMax < yesterday ? estateMax : yesterday;
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
    { turnoverExcl: number; transactions: number; grossProfit: number; wastage: number; stockVariance: number }
  >();
  for (const r of rows) {
    const m = r.date.slice(0, 7); // YYYY-MM
    const cur =
      monthMap.get(m) ?? { turnoverExcl: 0, transactions: 0, grossProfit: 0, wastage: 0, stockVariance: 0 };
    cur.turnoverExcl += r.turnoverExcl;
    cur.transactions += r.transactionCount;
    cur.grossProfit += r.grossProfit;
    cur.wastage += r.wastage;
    cur.stockVariance += r.shrinkage;
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
      wastage: v.wastage,
      stockVariance: v.stockVariance,
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
      wastage: sum(rows, (r) => r.wastage),
      stockVariance: sum(rows, (r) => r.shrinkage),
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
  type: string;
  turnoverExcl: number;
  grossProfit: number;
  gpPct: number;
  transactions: number;
  avgSpend: number;
  hasData: boolean;
}

export interface GroupSummary {
  /** Manager name or store-type label. */
  label: string;
  turnoverExcl: number;
  transactions: number;
  avgSpend: number;
  gpPct: number;
  storeCount: number;
}

/** A single metric for one month with growth vs the prior month and prior year. */
export interface Growth {
  value: number;
  momPct: number | null; // vs previous month
  yoyPct: number | null; // vs same month last year
}

export interface GrowthMetric {
  revenue: Growth; // turnover excl. VAT
  invoices: Growth; // number of sales invoices
  spi: Growth; // Sales Per Invoice = revenue / invoices
}

export interface BhoGrowth {
  anchorMonth: string; // YYYY-MM — latest complete month
  prevMonth: string;
  yoyMonth: string;
  yoyAvailable: boolean;
  group: GrowthMetric;
  byType: Array<{ type: string; metric: GrowthMetric }>;
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
    wastage: number;
    stockVariance: number;
  };
  monthly: Array<{ month: string; turnoverExcl: number; avgSpend: number; transactions: number }>;
  managers: GroupSummary[];
  types: GroupSummary[];
  stores: StoreSummary[];
  growth: BhoGrowth;
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

function pctChange(cur: number, base: number | undefined): number | null {
  if (base === undefined || base === 0) return null;
  return ((cur - base) / base) * 100;
}

/**
 * Build month-on-month and year-on-year growth for revenue, invoices and SPI,
 * for the group as a whole and per store type. Anchored on the latest COMPLETE
 * calendar month so a partial current month doesn't distort the numbers.
 */
function computeGrowth(rows: GaapDailyMetrics[]): BhoGrowth {
  const typeByNode = new Map(BHO_STORES.map((s) => [s.node, s.format]));

  // bucket -> month -> {te, tx}
  const buckets = new Map<string, Map<string, { te: number; tx: number }>>();
  const add = (bucket: string, month: string, te: number, tx: number) => {
    const b = buckets.get(bucket) ?? new Map();
    const cur = b.get(month) ?? { te: 0, tx: 0 };
    cur.te += te;
    cur.tx += tx;
    b.set(month, cur);
    buckets.set(bucket, b);
  };
  const allMonths = new Set<string>();
  for (const r of rows) {
    const month = r.date.slice(0, 7);
    allMonths.add(month);
    add("__group__", month, r.turnoverExcl, r.transactionCount);
    add(typeByNode.get(r.node) ?? "?", month, r.turnoverExcl, r.transactionCount);
  }

  const nowMonth = new Date().toISOString().slice(0, 7);
  const sorted = [...allMonths].sort();
  const complete = sorted.filter((m) => m < nowMonth);
  const anchor = complete.length ? complete[complete.length - 1] : sorted[sorted.length - 1] ?? nowMonth;
  const prev = shiftMonth(anchor, -1);
  const yoy = shiftMonth(anchor, -12);

  const metricFor = (bucket: string): GrowthMetric => {
    const b = buckets.get(bucket) ?? new Map();
    const at = (m: string) => b.get(m);
    const spi = (m: string) => {
      const v = at(m);
      return v && v.tx > 0 ? v.te / v.tx : undefined;
    };
    const cur = at(anchor) ?? { te: 0, tx: 0 };
    const curSpi = cur.tx > 0 ? cur.te / cur.tx : 0;
    return {
      revenue: { value: cur.te, momPct: pctChange(cur.te, at(prev)?.te), yoyPct: pctChange(cur.te, at(yoy)?.te) },
      invoices: { value: cur.tx, momPct: pctChange(cur.tx, at(prev)?.tx), yoyPct: pctChange(cur.tx, at(yoy)?.tx) },
      spi: { value: curSpi, momPct: pctChange(curSpi, spi(prev)), yoyPct: pctChange(curSpi, spi(yoy)) },
    };
  };

  return {
    anchorMonth: anchor,
    prevMonth: prev,
    yoyMonth: yoy,
    yoyAvailable: allMonths.has(yoy),
    group: metricFor("__group__"),
    byType: STORE_TYPES.map((type) => ({ type, metric: metricFor(type) })),
  };
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
      type: cfg.format,
      turnoverExcl: te,
      grossProfit: gp,
      gpPct: te > 0 ? (gp / te) * 100 : 0,
      transactions: tx,
      avgSpend: tx > 0 ? te / tx : 0,
      hasData: !!ps,
    };
  }).sort((a, b) => b.turnoverExcl - a.turnoverExcl);

  const groupBy = (key: (s: StoreSummary) => string, labels: readonly string[]): GroupSummary[] =>
    labels.map((label) => {
      const ss = stores.filter((s) => key(s) === label);
      const te = sum(ss, (s) => s.turnoverExcl);
      const gp = sum(ss, (s) => s.grossProfit);
      const tx = sum(ss, (s) => s.transactions);
      return {
        label,
        turnoverExcl: te,
        transactions: tx,
        avgSpend: tx > 0 ? te / tx : 0,
        gpPct: te > 0 ? (gp / te) * 100 : 0,
        storeCount: ss.length,
      };
    });

  const managers = groupBy((s) => s.manager, MANAGERS);
  const types = groupBy((s) => s.type, STORE_TYPES);

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
      wastage: sum(rows, (r) => r.wastage),
      stockVariance: sum(rows, (r) => r.shrinkage),
    },
    monthly,
    managers,
    types,
    stores,
    growth: computeGrowth(rows),
  };
}

/** Store display name from config, falling back to the DB value. */
export function storeName(node: string, fallback?: string | null): string {
  return storeByNode(node)?.name ?? fallback ?? "Store";
}
