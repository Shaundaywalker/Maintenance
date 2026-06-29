const zar = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  maximumFractionDigits: 0,
});

const zar2 = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  maximumFractionDigits: 2,
});

const num = new Intl.NumberFormat("en-ZA");

/** R1,234,567 — whole rands. */
export function fmtZAR(n: number): string {
  return zar.format(n ?? 0);
}

/** R123.45 — rands with cents (for per-transaction figures). */
export function fmtZAR2(n: number): string {
  return zar2.format(n ?? 0);
}

/** 12,345 */
export function fmtNum(n: number): string {
  return num.format(n ?? 0);
}

/** 64.2% */
export function fmtPct(n: number): string {
  return `${(n ?? 0).toFixed(1)}%`;
}

/** Signed growth: "+12.3%", "−4.1%", or "—" when not comparable. */
export function fmtGrowth(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${Math.abs(n).toFixed(1)}%`;
}

/** Compact rands for chart axes: R1.2m / R45k / R900 */
export function fmtZARCompact(n: number): string {
  const v = n ?? 0;
  if (Math.abs(v) >= 1_000_000) return `R${(v / 1_000_000).toFixed(1)}m`;
  if (Math.abs(v) >= 1_000) return `R${Math.round(v / 1_000)}k`;
  return `R${Math.round(v)}`;
}

/** "2026-06-26" -> "Fri, 26 Jun 2026" */
export function fmtDayLong(d: string): string {
  return new Date(d + "T00:00:00Z").toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** A from–to label: single day reads as one date, otherwise "26 Jun – 30 Jun 2026". */
export function fmtPeriod(from: string, to: string): string {
  if (from === to) return fmtDayLong(from);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  const f = new Date(from + "T00:00:00Z").toLocaleDateString("en-ZA", opts);
  const t = new Date(to + "T00:00:00Z").toLocaleDateString("en-ZA", opts);
  return `${f} – ${t}`;
}

/** "2025-08" -> "Aug '25" */
export function fmtMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, (m ?? 1) - 1, 1));
  return d.toLocaleDateString("en-ZA", { month: "short" }) + " '" + String(y).slice(2);
}
