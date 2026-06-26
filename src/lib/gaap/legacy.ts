import { Agent, fetch as undiciFetch } from "undici";
import { GAAP_LEGACY_BASE_URL, getLegacyApiKey } from "./config";

/**
 * Legacy GAAP runs on a self-signed cert, so we scope a TLS-bypass dispatcher
 * to *these* fetch calls only (rather than the blunt NODE_TLS_REJECT_UNAUTHORIZED
 * env flag, which would weaken every other HTTPS call in the process).
 */
const selfSignedAgent = new Agent({ connect: { rejectUnauthorized: false } });

type Params = Record<string, string>;

async function fetchLegacy<T = unknown>(
  endpoint: string,
  params: Params,
): Promise<T> {
  const url = new URL(GAAP_LEGACY_BASE_URL + endpoint);
  url.searchParams.set("apikey", getLegacyApiKey());
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await undiciFetch(url, { dispatcher: selfSignedAgent });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 200);
    throw new Error(`GAAP ${endpoint} HTTP ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

/** Retry wrapper with exponential backoff — Legacy can be flaky under load. */
async function withRetry<T>(fn: () => Promise<T>, tries = 5): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < tries - 1) await sleep(1500 * (i + 1)); // 1.5s, 3s, 4.5s, 6s
    }
  }
  throw lastErr;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Response row shapes (only the fields we use) ─────────────────────────────

export interface DailySummaryRow {
  NODE: string;
  STORE?: string;
  REPORTDATE: string; // ISO, e.g. "2026-06-15T00:00:00"
  TURNOVER: number;
  COSTOFSALES: number;
  GP?: number;
  GROSSPROFIT?: number;
  VOIDS?: number;
  WASTAGE?: number;
  SHRINKAGE?: number;
}

export interface SalesLineRow {
  NODE: string;
  REPORTDATE: string;
  DOCUMENTNR: string;
  ITEMINDEX?: number | string;
  ITEMCODE?: string;
  DEPARTMENTCODE?: string;
  DEPARTMENTNAME?: string;
  TRANSACTIONTIME?: string;
  QTY?: number;
  LINETOTAL?: number;
  LINETAX?: number;
  LINECOST?: number;
  TRANSACTIONTOTAL?: number;
  TRANSMODE?: string;
}

export function fetchDailySummary(
  node: string,
  startdate: string,
  enddate: string,
): Promise<DailySummaryRow[]> {
  return withRetry(() =>
    fetchLegacy<DailySummaryRow[]>("/dailysummary", { node, startdate, enddate }),
  );
}

export function fetchSalesLines(
  node: string,
  startdate: string,
  enddate: string,
): Promise<SalesLineRow[]> {
  return withRetry(() =>
    fetchLegacy<SalesLineRow[]>("/saleslines_v2", { node, startdate, enddate }),
  );
}

/** Whole-estate store list (uses the C0R0B0 company-root wildcard). */
export function fetchStores(): Promise<Array<Record<string, string>>> {
  return withRetry(() =>
    fetchLegacy<Array<Record<string, string>>>("/stores_extra", { node: "C0R0B0" }),
  );
}
