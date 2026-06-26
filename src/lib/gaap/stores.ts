/**
 * BHO (Bootlegger Head Office) store directory.
 *
 * Each store maps a friendly name to its GAAP node, grouped by the operations
 * manager who runs it (from the BHO staff directory) and store format. The
 * dashboard reads metrics from `gaap_daily_metrics` keyed by `node`; this config
 * supplies names + grouping and drives the sync.
 *
 * Stores with no accessible GAAP node yet (need a separate key/system):
 *   - Rockpool  (separate brand, not in C0399 Legacy or our Unity tenants)
 *   - Silo Bakery (Silo Group Unity tenant — needs its own Unity key)
 *   - Ceremony  (not trading yet — "TBC")
 */

export interface StoreConfig {
  node: string;
  name: string;
  manager: "Roubaix" | "Holly" | "Nicole";
  format: string;
  storeNumber: string;
  system: "legacy";
}

export const BHO_STORES: StoreConfig[] = [
  // ── Roubaix ────────────────────────────────────────────────────────────
  { node: "C0399R0001B0014", name: "Harrington", manager: "Roubaix", format: "All Day Café", storeNumber: "CPTG1985", system: "legacy" },
  { node: "C0399R0001B0007", name: "Tokai", manager: "Roubaix", format: "All Day Café", storeNumber: "CPTG1160", system: "legacy" },
  { node: "C0399R0001B0017", name: "Claremont", manager: "Roubaix", format: "All Day Café", storeNumber: "CPTG1998", system: "legacy" },
  { node: "C0399R0001B0004", name: "Kenilworth", manager: "Roubaix", format: "All Day Café", storeNumber: "CPTG1614", system: "legacy" },
  { node: "C0399R0001B0008", name: "Bakoven", manager: "Roubaix", format: "All Day Café", storeNumber: "CPTG1841", system: "legacy" },
  { node: "C0399R0001B0006", name: "Kalk Bay", manager: "Roubaix", format: "All Day Café", storeNumber: "CPTG1713", system: "legacy" },
  { node: "C0399R0001B0013", name: "Greenpoint", manager: "Roubaix", format: "All Day Café", storeNumber: "CPTG1973", system: "legacy" },
  { node: "C0399R0001B0019", name: "Kloof (112 Kloof)", manager: "Roubaix", format: "All Day Café", storeNumber: "CPTG38504", system: "legacy" },
  { node: "C0399R0001B0024", name: "Bree Street", manager: "Roubaix", format: "All Day Café", storeNumber: "CPTG42268", system: "legacy" },
  { node: "C0399R0003B0013", name: "St Cyprian's", manager: "Roubaix", format: "XS", storeNumber: "CPTG054059", system: "legacy" },

  // ── Holly ──────────────────────────────────────────────────────────────
  { node: "C0399R0001B0025", name: "Blouberg", manager: "Holly", format: "All Day Café", storeNumber: "CPTG42231", system: "legacy" },
  { node: "C0399R0001B0029", name: "Bridgewater", manager: "Holly", format: "All Day Café", storeNumber: "CPTG47612", system: "legacy" },
  { node: "C0399R0001B0011", name: "Century City", manager: "Holly", format: "All Day Café", storeNumber: "CPTG1894", system: "legacy" },
  { node: "C0399R0001B0005", name: "Cape Quarter", manager: "Holly", format: "All Day Café", storeNumber: "CPTG1725", system: "legacy" },
  { node: "C0399R0001B0026", name: "Durbanville", manager: "Holly", format: "All Day Café", storeNumber: "CPTG44362", system: "legacy" },
  { node: "C0399R0001B0021", name: "Gardens", manager: "Holly", format: "All Day Café", storeNumber: "CPTG39877", system: "legacy" },
  { node: "C0399R0001B0041", name: "Sandown", manager: "Holly", format: "All Day Café", storeNumber: "CPTG7280", system: "legacy" },
  { node: "C0399R0001B0032", name: "Table Bay Mall", manager: "Holly", format: "All Day Café", storeNumber: "CPTG49282", system: "legacy" },
  { node: "C0399R0001B0027", name: "Vredehoek", manager: "Holly", format: "All Day Café", storeNumber: "CPTG44598", system: "legacy" },
  { node: "C0399R0001B0043", name: "Ndabeni", manager: "Holly", format: "All Day Café", storeNumber: "CPTG052711", system: "legacy" },
  { node: "C0399R0001B0050", name: "Canal Walk", manager: "Holly", format: "All Day Café", storeNumber: "CPTG057772", system: "legacy" },

  // ── Nicole ─────────────────────────────────────────────────────────────
  { node: "C0399R0003B0004", name: "Pineworx", manager: "Nicole", format: "XS", storeNumber: "CPTG052064", system: "legacy" },
  { node: "C0399R0003B0015", name: "Foreshore", manager: "Nicole", format: "XS", storeNumber: "CPTG054291", system: "legacy" },
  { node: "C0399R0003B0035", name: "Riverlands", manager: "Nicole", format: "XS", storeNumber: "CPTG066711", system: "legacy" },
  { node: "C0399R0003B0030", name: "Cavendish", manager: "Nicole", format: "XS", storeNumber: "CPTG065865", system: "legacy" },
  { node: "C0399R0003B0008", name: "Brackenfell", manager: "Nicole", format: "XS", storeNumber: "CPTG047105", system: "legacy" },
  { node: "C0399R0003B0021", name: "Cape Gate", manager: "Nicole", format: "XS", storeNumber: "CPTG056578", system: "legacy" },
  { node: "C0399R0003B0019", name: "Westlake", manager: "Nicole", format: "XS", storeNumber: "CPTG055856", system: "legacy" },
  { node: "C0399R0003B0011", name: "Salt River", manager: "Nicole", format: "XS", storeNumber: "CPTG1884", system: "legacy" },
  { node: "C0399R0003B0010", name: "Sea Point", manager: "Nicole", format: "XS", storeNumber: "CPTG1402", system: "legacy" },
  { node: "C0399R0003B0016", name: "Paardevlei", manager: "Nicole", format: "XS", storeNumber: "CPTG055321", system: "legacy" },
  { node: "C0399R0003B0001", name: "Muizenberg", manager: "Nicole", format: "XS", storeNumber: "CPTG1883", system: "legacy" },
];

/** Stores known to BHO but not yet wired to a data source. */
export const BHO_STORES_NO_DATA = [
  { name: "Rockpool", manager: "Roubaix", reason: "Separate brand — needs its own GAAP key" },
  { name: "Silo Bakery", manager: "Nicole", reason: "Silo Group Unity tenant — needs its own Unity key" },
  { name: "Ceremony", manager: "Nicole", reason: "Not trading yet (TBC)" },
] as const;

export const MANAGERS = ["Roubaix", "Holly", "Nicole"] as const;

/** The two store formats. Every BHO store is one of these. */
export const STORE_TYPES = ["All Day Café", "XS"] as const;
export type StoreType = (typeof STORE_TYPES)[number];

/**
 * Fixed history start for the dashboard + backfill. Anchored to 1 June 2025 so
 * month boundaries are clean and year-on-year comparisons line up later.
 */
export const BHO_START_DATE = "2025-06-01";

export function storeByNode(node: string): StoreConfig | undefined {
  return BHO_STORES.find((s) => s.node === node);
}
