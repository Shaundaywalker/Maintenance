/**
 * One-time (and re-runnable) backfill of GAAP store metrics into local SQLite.
 *
 *   npm run gaap:backfill            # last 12 months
 *   npm run gaap:backfill 2025-01-01 2025-12-31
 *
 * Idempotent: re-running overwrites the same (node, date) rows.
 */
import { syncRange } from "@/lib/gaap/sync";
import { GAAP_STORE_NODE, GAAP_STORE_NAME } from "@/lib/gaap/config";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function oneYearAgo(): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

const start = process.argv[2] ?? oneYearAgo();
const end = process.argv[3] ?? today();

console.log(
  `[gaap] backfill ${GAAP_STORE_NAME} (${GAAP_STORE_NODE})  ${start} -> ${end}`,
);

const result = await syncRange(GAAP_STORE_NODE, start, end, (msg) =>
  console.log("  " + msg),
);

// Retry any windows that fell over (transient Legacy network blips) once more.
if (result.failedChunks.length > 0) {
  console.log(`[gaap] retrying ${result.failedChunks.length} failed window(s)...`);
  for (const f of result.failedChunks) {
    const retry = await syncRange(GAAP_STORE_NODE, f.start, f.end, (msg) =>
      console.log("  " + msg),
    );
    result.daysWritten += retry.daysWritten;
    result.totalTurnoverExcl += retry.totalTurnoverExcl;
    result.totalTransactions += retry.totalTransactions;
    if (retry.failedChunks.length > 0) {
      console.warn(`  STILL FAILING ${f.start}..${f.end}: ${retry.failedChunks[0].error}`);
    }
  }
}

console.log(
  `[gaap] done: ${result.daysWritten} day-rows, ` +
    `turnover(excl) R${Math.round(result.totalTurnoverExcl).toLocaleString()}, ` +
    `${result.totalTransactions.toLocaleString()} transactions`,
);

process.exit(0);
