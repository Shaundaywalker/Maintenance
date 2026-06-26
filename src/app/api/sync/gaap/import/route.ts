import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { gaapDailyMetrics } from "@/db/schema";
import { getSyncSecret } from "@/lib/gaap/config";

/**
 * Bulk-import pre-computed daily metrics into the volume DB.
 *
 *   POST /api/sync/gaap/import
 *   Header: X-Sync-Secret: <GAAP_SYNC_SECRET>
 *   Body: { rows: GaapDailyMetricsRow[] }
 *
 * Lets the (fast, local) backfill push its results straight to production
 * instead of re-fetching the whole estate from GAAP on Railway. Idempotent —
 * upserts on (node, date). The payload is plain operational numbers, no secrets.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface Row {
  node: string;
  date: string;
  storeName?: string | null;
  turnover: number;
  turnoverExcl: number;
  costOfSales: number;
  grossProfit: number;
  voids: number;
  wastage: number;
  shrinkage: number;
  transactionCount: number;
  avgSpend: number;
  channelBreakdown?: string | null;
  departmentBreakdown?: string | null;
}

export async function POST(req: Request) {
  const secret = getSyncSecret();
  if (!secret || req.headers.get("x-sync-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { rows?: Row[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const rows = body.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ ok: false, error: "no rows" }, { status: 400 });
  }

  const values = rows.map((r) => ({
    node: r.node,
    date: r.date,
    storeName: r.storeName ?? null,
    turnover: r.turnover ?? 0,
    turnoverExcl: r.turnoverExcl ?? 0,
    costOfSales: r.costOfSales ?? 0,
    grossProfit: r.grossProfit ?? 0,
    voids: r.voids ?? 0,
    wastage: r.wastage ?? 0,
    shrinkage: r.shrinkage ?? 0,
    transactionCount: r.transactionCount ?? 0,
    avgSpend: r.avgSpend ?? 0,
    channelBreakdown: r.channelBreakdown ?? null,
    departmentBreakdown: r.departmentBreakdown ?? null,
    syncedAt: new Date(),
  }));

  // Chunk inserts to stay well under SQLite's variable limit.
  const CHUNK = 200;
  for (let i = 0; i < values.length; i += CHUNK) {
    await db
      .insert(gaapDailyMetrics)
      .values(values.slice(i, i + CHUNK))
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

  return NextResponse.json({ ok: true, imported: values.length });
}
