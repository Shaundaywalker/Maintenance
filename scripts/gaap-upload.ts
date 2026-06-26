/**
 * Push locally-computed GAAP daily metrics to the deployed app's volume DB,
 * via the secret-guarded import endpoint. Run after `npm run gaap:backfill`.
 *
 *   npm run gaap:upload -- https://shaun-production.up.railway.app
 *
 * The target URL and GAAP_SYNC_SECRET (from .env) must match the deployment.
 */
import { db } from "@/db";
import { gaapDailyMetrics } from "@/db/schema";

const target = process.argv[2];
if (!target) {
  console.error("Usage: npm run gaap:upload -- <https://app-url>");
  process.exit(1);
}
const secret = process.env.GAAP_SYNC_SECRET;
if (!secret) {
  console.error("GAAP_SYNC_SECRET not set in environment (.env)");
  process.exit(1);
}

const rows = await db.select().from(gaapDailyMetrics);
console.log(`[upload] ${rows.length} rows -> ${target}`);

const CHUNK = 1000;
let sent = 0;
for (let i = 0; i < rows.length; i += CHUNK) {
  const batch = rows.slice(i, i + CHUNK);
  const res = await fetch(`${target.replace(/\/$/, "")}/api/sync/gaap/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-sync-secret": secret },
    body: JSON.stringify({ rows: batch }),
  });
  if (!res.ok) {
    console.error(`  batch ${i}-${i + batch.length} FAILED: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    process.exit(1);
  }
  const j = (await res.json()) as { imported?: number };
  sent += j.imported ?? batch.length;
  console.log(`  ${sent}/${rows.length}`);
}

console.log(`[upload] done: ${sent} rows imported`);
process.exit(0);
