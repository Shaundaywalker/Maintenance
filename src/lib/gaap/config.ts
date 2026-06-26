/**
 * GAAP Legacy API connection + the single store this dashboard tracks.
 *
 * Everything is read from the environment at call-time so secrets never live in
 * the repo. For local dev set these in `.env`; in production they're Railway
 * variables. See `.env.example` for the full list.
 */

export const GAAP_LEGACY_BASE_URL =
  process.env.GAAP_LEGACY_BASE_URL ?? "https://web.gaap.co.za:48800";

/** The store node this dashboard reports on (default: Ndabeni). */
export const GAAP_STORE_NODE = process.env.GAAP_STORE_NODE ?? "C0399R0001B0043";

/** Human-readable store name for headings. */
export const GAAP_STORE_NAME = process.env.GAAP_STORE_NAME ?? "Ndabeni";

export function getLegacyApiKey(): string {
  const key = process.env.GAAP_LEGACY_API_KEY;
  if (!key) {
    throw new Error(
      "GAAP_LEGACY_API_KEY is not set. Add it to .env (local) or Railway variables (prod).",
    );
  }
  return key;
}

/** Shared secret guarding the /api/sync/gaap route. */
export function getSyncSecret(): string | undefined {
  return process.env.GAAP_SYNC_SECRET;
}
