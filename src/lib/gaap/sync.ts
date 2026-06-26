import { sql } from "drizzle-orm";
import { db } from "@/db";
import { gaapDailyMetrics } from "@/db/schema";
import {
  fetchDailySummary,
  fetchSalesLines,
  type DailySummaryRow,
  type SalesLineRow,
} from "./legacy";

/** Legacy struggles with wide ranges; keep sales-line windows to 7 days. */
const CHUNK_DAYS = 7;

interface DayAgg {
  node: string;
  date: string;
  storeName: string | null;
  turnover: number;
  turnoverExcl: number;
  costOfSales: number;
  grossProfit: number;
  voids: number;
  wastage: number;
  shrinkage: number;
  transactionCount: number;
  avgSpend: number;
  channelBreakdown: Record<string, number>;
  departmentBreakdown: Record<string, number>;
}

export interface SyncResult {
  node: string;
  start: string;
  end: string;
  daysWritten: number;
  totalTurnoverExcl: number;
  totalTransactions: number;
  failedChunks: Array<{ start: string; end: string; error: string }>;
}

function isoDate(s: string): string {
  return s.slice(0, 10); // "2026-06-15T00:00:00" -> "2026-06-15"
}

function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function* chunks(start: string, end: string): Generator<[string, string]> {
  let cur = start;
  while (cur <= end) {
    let chunkEnd = addDays(cur, CHUNK_DAYS - 1);
    if (chunkEnd > end) chunkEnd = end;
    yield [cur, chunkEnd];
    cur = addDays(chunkEnd, 1);
  }
}

/**
 * Aggregate one chunk's raw rows into per-day metrics.
 *
 * Daily-summary rows can repeat per date (duplicate store-level totals, not
 * additive) — collapse last-write-wins. Sales lines give us transaction count,
 * the tax/non-banking correction, and the channel/department breakdowns.
 */
function aggregateChunk(
  node: string,
  summaries: DailySummaryRow[],
  lines: SalesLineRow[],
): Map<string, DayAgg> {
  const byDate = new Map<string, DayAgg>();

  const blank = (date: string): DayAgg => ({
    node,
    date,
    storeName: null,
    turnover: 0,
    turnoverExcl: 0,
    costOfSales: 0,
    grossProfit: 0,
    voids: 0,
    wastage: 0,
    shrinkage: 0,
    transactionCount: 0,
    avgSpend: 0,
    channelBreakdown: {},
    departmentBreakdown: {},
  });

  // Daily summary — last write wins per date.
  for (const r of summaries) {
    const date = isoDate(r.REPORTDATE);
    const day = byDate.get(date) ?? blank(date);
    day.storeName = (r.STORE ?? day.storeName ?? "")?.trim() || null;
    day.turnover = r.TURNOVER ?? 0;
    day.costOfSales = r.COSTOFSALES ?? 0;
    day.grossProfit = r.GROSSPROFIT ?? r.GP ?? 0;
    day.voids = r.VOIDS ?? 0;
    day.wastage = r.WASTAGE ?? 0;
    day.shrinkage = r.SHRINKAGE ?? 0;
    byDate.set(date, day);
  }

  // Group sales lines by date.
  const linesByDate = new Map<string, SalesLineRow[]>();
  for (const l of lines) {
    const date = isoDate(l.REPORTDATE);
    const arr = linesByDate.get(date) ?? [];
    arr.push(l);
    linesByDate.set(date, arr);
  }

  for (const [date, dayLines] of linesByDate) {
    const day = byDate.get(date) ?? blank(date);

    const docTotals = new Map<string, number>(); // DOCUMENTNR -> TRANSACTIONTOTAL
    let sumLineTotal = 0;
    let sumLineTax = 0;
    const channel: Record<string, number> = {};
    const dept: Record<string, number> = {};

    for (const l of dayLines) {
      const lineTotal = l.LINETOTAL ?? 0;
      sumLineTotal += lineTotal;
      sumLineTax += l.LINETAX ?? 0;

      if (l.DOCUMENTNR && !docTotals.has(l.DOCUMENTNR)) {
        docTotals.set(l.DOCUMENTNR, l.TRANSACTIONTOTAL ?? 0);
      }
      const mode = (l.TRANSMODE ?? "").trim() || "Unknown";
      channel[mode] = (channel[mode] ?? 0) + lineTotal;
      const dname = (l.DEPARTMENTNAME ?? "").trim() || "Unknown";
      dept[dname] = (dept[dname] ?? 0) + lineTotal;
    }

    const transactionCount = docTotals.size;
    const sumTransactionTotals = [...docTotals.values()].reduce((a, b) => a + b, 0);

    // §3.4 turnover correction: strip tips + non-banking, then remove tax.
    const nonBanking = sumTransactionTotals - day.turnover;
    const turnoverExcl = sumLineTotal - sumLineTax - nonBanking;

    day.transactionCount = transactionCount;
    day.turnoverExcl = turnoverExcl;
    day.avgSpend = transactionCount > 0 ? sumLineTotal / transactionCount : 0;
    day.channelBreakdown = channel;
    day.departmentBreakdown = dept;
    byDate.set(date, day);
  }

  // Days with a summary but no sales lines: fall back turnoverExcl -> turnover.
  for (const day of byDate.values()) {
    if (day.transactionCount === 0 && day.turnoverExcl === 0) {
      day.turnoverExcl = day.turnover;
    }
  }

  return byDate;
}

async function upsertDays(days: DayAgg[]): Promise<void> {
  if (days.length === 0) return;
  const rows = days.map((d) => ({
    node: d.node,
    date: d.date,
    storeName: d.storeName,
    turnover: d.turnover,
    turnoverExcl: d.turnoverExcl,
    costOfSales: d.costOfSales,
    grossProfit: d.grossProfit,
    voids: d.voids,
    wastage: d.wastage,
    shrinkage: d.shrinkage,
    transactionCount: d.transactionCount,
    avgSpend: d.avgSpend,
    channelBreakdown: JSON.stringify(d.channelBreakdown),
    departmentBreakdown: JSON.stringify(d.departmentBreakdown),
    syncedAt: new Date(),
  }));

  await db
    .insert(gaapDailyMetrics)
    .values(rows)
    .onConflictDoUpdate({
      target: [gaapDailyMetrics.node, gaapDailyMetrics.date],
      set: {
        storeName: sql`excluded.store_name`,
        turnover: sql`excluded.turnover`,
        turnoverExcl: sql`excluded.turnover_excl`,
        costOfSales: sql`excluded.cost_of_sales`,
        grossProfit: sql`excluded.gross_profit`,
        voids: sql`excluded.voids`,
        wastage: sql`excluded.wastage`,
        shrinkage: sql`excluded.shrinkage`,
        transactionCount: sql`excluded.transaction_count`,
        avgSpend: sql`excluded.avg_spend`,
        channelBreakdown: sql`excluded.channel_breakdown`,
        departmentBreakdown: sql`excluded.department_breakdown`,
        syncedAt: sql`excluded.synced_at`,
      },
    });
}

/**
 * Sync a date range for one store node into `gaap_daily_metrics`.
 * Idempotent — re-running overwrites the same (node, date) rows.
 */
export async function syncRange(
  node: string,
  start: string,
  end: string,
  onProgress?: (msg: string) => void,
): Promise<SyncResult> {
  let daysWritten = 0;
  let totalTurnoverExcl = 0;
  let totalTransactions = 0;
  const failedChunks: SyncResult["failedChunks"] = [];

  for (const [cStart, cEnd] of chunks(start, end)) {
    try {
      const [summaries, lines] = await Promise.all([
        fetchDailySummary(node, cStart, cEnd),
        fetchSalesLines(node, cStart, cEnd),
      ]);

      const agg = aggregateChunk(node, summaries, lines);
      const days = [...agg.values()];
      await upsertDays(days);

      daysWritten += days.length;
      for (const d of days) {
        totalTurnoverExcl += d.turnoverExcl;
        totalTransactions += d.transactionCount;
      }
      onProgress?.(
        `${cStart}..${cEnd}: ${days.length} days, ${lines.length} lines, ${summaries.length} summary rows`,
      );
    } catch (err) {
      // One bad window must not abort the whole backfill — record and continue.
      // The sync is idempotent, so failed windows can be re-run later.
      const error = err instanceof Error ? err.message : String(err);
      failedChunks.push({ start: cStart, end: cEnd, error });
      onProgress?.(`${cStart}..${cEnd}: FAILED — ${error}`);
    }
  }

  return {
    node,
    start,
    end,
    daysWritten,
    totalTurnoverExcl,
    totalTransactions,
    failedChunks,
  };
}
