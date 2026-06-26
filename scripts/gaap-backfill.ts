/**
 * Backfill GAAP store metrics into local SQLite for ALL BHO stores
 * (or a single node).
 *
 *   npm run gaap:backfill                         # all stores, last 12 months
 *   npm run gaap:backfill -- 2025-01-01 2025-12-31 # all stores, explicit range
 *   npm run gaap:backfill -- C0399R0001B0043       # one node, last 12 months
 *
 * Idempotent: re-running overwrites the same (node, date) rows.
 */
import { syncRange } from "@/lib/gaap/sync";
import { BHO_STORES, BHO_START_DATE, storeByNode } from "@/lib/gaap/stores";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const args = process.argv.slice(2);
const nodeArg = args.find((a) => /^C\d/.test(a));
const dates = args.filter((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
const start = dates[0] ?? BHO_START_DATE;
const end = dates[1] ?? today();

const targets = nodeArg
  ? BHO_STORES.filter((s) => s.node === nodeArg)
  : BHO_STORES;

if (targets.length === 0) {
  console.error(`No store matches node ${nodeArg}`);
  process.exit(1);
}

console.log(`[gaap] backfill ${targets.length} store(s)  ${start} -> ${end}`);

let grandTurnover = 0;
let grandTx = 0;
const failures: string[] = [];

for (const store of targets) {
  process.stdout.write(`  ${store.name.padEnd(20)} `);
  try {
    let res = await syncRange(store.node, start, end);
    // one retry pass for transient blips
    for (const f of res.failedChunks) {
      const r = await syncRange(store.node, f.start, f.end);
      res = {
        ...res,
        totalTurnoverExcl: res.totalTurnoverExcl + r.totalTurnoverExcl,
        totalTransactions: res.totalTransactions + r.totalTransactions,
        failedChunks: r.failedChunks,
      };
    }
    grandTurnover += res.totalTurnoverExcl;
    grandTx += res.totalTransactions;
    const flag = res.failedChunks.length ? ` ⚠ ${res.failedChunks.length} failed` : "";
    console.log(
      `R${Math.round(res.totalTurnoverExcl).toLocaleString()} excl · ${res.totalTransactions.toLocaleString()} tx${flag}`,
    );
    if (res.failedChunks.length) failures.push(store.name);
  } catch (err) {
    console.log(`ERROR — ${err instanceof Error ? err.message : String(err)}`);
    failures.push(store.name);
  }
}

console.log(
  `\n[gaap] done: ${targets.length} stores · R${Math.round(grandTurnover).toLocaleString()} excl · ${grandTx.toLocaleString()} transactions`,
);
if (failures.length) console.log(`[gaap] stores with failures: ${failures.join(", ")}`);
void storeByNode;
process.exit(0);
