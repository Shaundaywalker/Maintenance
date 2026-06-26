import { NextResponse } from "next/server";
import { syncRange } from "@/lib/gaap/sync";
import { GAAP_STORE_NODE, getSyncSecret } from "@/lib/gaap/config";

/**
 * Nightly / on-demand refresh endpoint.
 *
 *   POST /api/sync/gaap
 *   Header: X-Sync-Secret: <GAAP_SYNC_SECRET>
 *   Body (optional): { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" }
 *
 * Defaults to the last 3 days (a small overlap heals any gaps). Point a Railway
 * cron / external scheduler at this once a night.
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

  let body: { start?: string; end?: string } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine — use defaults
  }

  const start = body.start ?? daysAgo(3);
  const end = body.end ?? daysAgo(0);

  try {
    const result = await syncRange(GAAP_STORE_NODE, start, end);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
