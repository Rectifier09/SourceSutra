import type { Granularity } from "./TimeSeriesChart";

// Deterministic, locale-independent formatting — toLocaleDateString(undefined, …)
// resolves to different locales on the SSR host vs the browser, which caused a
// real hydration mismatch ("Jun 1" server / "1 Jun" client) the first time this
// shipped. Never use the user's locale for chart labels rendered on the server.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function fmtBucket(iso: string, g: Granularity): string {
  const d = new Date(iso);
  const month = MONTHS[d.getUTCMonth()];
  if (g === "day" || g === "week") return `${month} ${d.getUTCDate()}`;
  if (g === "month") return `${month} '${String(d.getUTCFullYear()).slice(2)}`;
  if (g === "quarter") return `Q${Math.floor(d.getUTCMonth() / 3) + 1} '${String(d.getUTCFullYear()).slice(2)}`;
  return String(d.getUTCFullYear());
}

export function fmtDay(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function fmtMonth(d: Date): string {
  return MONTHS[d.getUTCMonth()];
}
