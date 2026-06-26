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
    day.voids = r.VOIDS ?? 0;
    day.wastage = r.WASTAGE ?? 0;
    day.shrinkage = r.SHRINKAGE ?? 0;
    byDate.set(date, day);
  }

  // Group sales lines by date — DE-DUPLICATING as we go. The Legacy API returns
  // every sales line exactly twice (same wholesale duplication seen in
  // /dailysummary); summing the raw lines would double turnover. We dedup on a
  // full line identity so only true exact-copy rows are dropped.
  const linesByDate = new Map<string, SalesLineRow[]>();
  const seenLine = new Set<string>();
  for (const l of lines) {
    const key = [
      l.DOCUMENTNR,
      l.ITEMINDEX,
      l.ITEMCODE,
      l.QTY,
      l.LINETOTAL,
      l.LINETAX,
      l.LINECOST,
      l.TRANSACTIONTIME,
      l.DEPARTMENTCODE,
    ].join("|");
    if (seenLine.has(key)) continue;
    seenLine.add(key);
    const date = isoDate(l.REPORTDATE);
    const arr = linesByDate.get(date) ?? [];
    arr.push(l);
    linesByDate.set(date, arr);
  }

  for (const [date, dayLines] of linesByDate) {
    const day = byDate.get(date) ?? blank(date);

    const docTotals = new Map<string, number>(); // DOCUMENTNR -> TRANSACTIONTOTAL
    let sumLineTotal = 0; // VAT-inclusive
    let sumLineTax = 0;
    // Breakdowns are accumulated EX-VAT (lineTotal - lineTax) so they sum to
    // the ex-VAT sales figure, consistent with every other number on the dash.
    const channel: Record<string, number> = {};
    const dept: Record<string, number> = {};

    for (const l of dayLines) {
      const lineTotal = l.LINETOTAL ?? 0;
      const lineTax = l.LINETAX ?? 0;
      const exVat = lineTotal - lineTax;
      sumLineTotal += lineTotal;
      sumLineTax += lineTax;

      if (l.DOCUMENTNR && !docTotals.has(l.DOCUMENTNR)) {
        docTotals.set(l.DOCUMENTNR, l.TRANSACTIONTOTAL ?? 0);
      }
      const mode = (l.TRANSMODE ?? "").trim() || "Unknown";
      channel[mode] = (channel[mode] ?? 0) + exVat;
      const dname = (l.DEPARTMENTNAME ?? "").trim() || "Unknown";
      dept[dname] = (dept[dname] ?? 0) + exVat;
    }

    const transactionCount = docTotals.size;
    const sumTransactionTotals = [...docTotals.values()].reduce((a, b) => a + b, 0);

    // §3.4 turnover correction (verified to reconcile exactly with the RM REST
    // "Turnover Excl" = TaxExcl − Nonturnover on Canal Walk):
    //   non_banking    = Σ(unique TRANSACTIONTOTAL per doc) − API TURNOVER
    //   turnover_excl  = Σ(LINETOTAL) − Σ(LINETAX) − non_banking
    //
    // When the daily summary didn't post (API TURNOVER = 0) but sales lines
    // exist, the non-banking term is meaningless (it would subtract the whole
    // day) — fall back to the plain ex-VAT line total, which equals the RM REST
    // "TaxExcl" basis.
    const exVatLineTotal = sumLineTotal - sumLineTax;
    const nonBanking = day.turnover > 0 ? sumTransactionTotals - day.turnover : 0;
    const turnoverExcl = exVatLineTotal - nonBanking;

    day.transactionCount = transactionCount;
    day.turnoverExcl = turnoverExcl;
    // Gross profit on the corrected (ex-VAT) turnover, per §3.4.
    day.grossProfit = turnoverExcl - day.costOfSales;
    // Average spend per transaction, EX-VAT.
    day.avgSpend = transactionCount > 0 ? turnoverExcl / transactionCount : 0;
    day.channelBreakdown = channel;
    day.departmentBreakdown = dept;
    byDate.set(date, day);
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
