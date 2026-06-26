import { NextResponse } from "next/server";
import { syncRange } from "@/lib/gaap/sync";
import { getSyncSecret } from "@/lib/gaap/config";
import { BHO_STORES } from "@/lib/gaap/stores";

/**
 * Nightly / on-demand refresh endpoint.
 *
 *   POST /api/sync/gaap
 *   Header: X-Sync-Secret: <GAAP_SYNC_SECRET>
 *   Body (optional): { "node": "C0399...", "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" }
 *
 * - No `node`  → syncs every BHO store for the range.
 * - No dates   → last 3 days (small overlap heals gaps).
 *
 * For a 12-month backfill, call once per (node, month) so each request stays
 * inside the gateway timeout.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  const secret = getSyncSecret();
  if (!secret || req.headers.get("x-sync-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { node?: string; start?: string; end?: string } = {};
  try {
    body = await req.json();
  } catch {
    // empty body — use defaults
  }

  const start = body.start ?? daysAgo(3);
  const end = body.end ?? daysAgo(0);
  const targets = body.node
    ? BHO_STORES.filter((s) => s.node === body.node)
    : BHO_STORES;

  if (targets.length === 0) {
    return NextResponse.json({ ok: false, error: `unknown node ${body.node}` }, { status: 400 });
  }

  try {
    let turnoverExcl = 0;
    let transactions = 0;
    let daysWritten = 0;
    const failed: Array<{ node: string; start: string; end: string }> = [];

    for (const store of targets) {
      const r = await syncRange(store.node, start, end);
      turnoverExcl += r.totalTurnoverExcl;
      transactions += r.totalTransactions;
      daysWritten += r.daysWritten;
      for (const f of r.failedChunks) failed.push({ node: store.node, ...f });
    }

    return NextResponse.json({
      ok: true,
      stores: targets.length,
      start,
      end,
      daysWritten,
      totalTurnoverExcl: turnoverExcl,
      totalTransactions: transactions,
      failedChunks: failed,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
