"use client";

import { useMemo, useState } from "react";
import type { Granularity, TSRow } from "./TimeSeriesChart";
import { fmtBucket } from "./dateFormat";

const GRANULARITIES: { value: Granularity; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
];

const SUPPLIER = "#2a78d6"; // categorical slot 1
const BUYER = "#eb6834"; // categorical slot 2

export function PersonaMixChart({ data }: { data: Record<Granularity, TSRow[]> }) {
  const [granularity, setGranularity] = useState<Granularity>("week");
  const [hover, setHover] = useState<number | null>(null);

  const bars = useMemo(() => {
    const rows = data[granularity].filter((r) => r.type === "SignUp");
    const byBucket = new Map<string, { buyer: number; supplier: number }>();
    for (const r of rows) {
      const entry = byBucket.get(r.bucket) ?? { buyer: 0, supplier: 0 };
      if (r.kind === "buyer") entry.buyer += r.count;
      if (r.kind === "supplier") entry.supplier += r.count;
      byBucket.set(r.bucket, entry);
    }
    return Array.from(byBucket.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([bucket, v]) => ({ bucket, ...v }));
  }, [data, granularity]);

  const max = Math.max(1, ...bars.map((b) => b.buyer + b.supplier));

  return (
    <div className="rounded-[14px] border border-line bg-cream p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-[16px] font-medium text-ink">Sign-up mix over time</h2>
          <div className="mt-1 flex items-center gap-3 text-[12px]">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: SUPPLIER }} /> Supplier
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: BUYER }} /> Customer
            </span>
          </div>
        </div>
        <div className="flex overflow-hidden rounded-md border border-line">
          {GRANULARITIES.map((g) => (
            <button
              key={g.value}
              onClick={() => setGranularity(g.value)}
              className="px-2.5 py-1.5 text-[12px] font-medium"
              style={{
                background: granularity === g.value ? "#403a77" : "#fff",
                color: granularity === g.value ? "#fff" : "#20202b",
              }}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {bars.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-muted">No sign-ups yet.</p>
      ) : (
        <div className="flex h-[180px] items-end gap-2 border-b border-line pb-1">
          {bars.map((b, i) => {
            const total = b.buyer + b.supplier;
            const supplierH = (b.supplier / max) * 160;
            const buyerH = (b.buyer / max) * 160;
            return (
              <div
                key={b.bucket}
                className="flex flex-1 flex-col items-center justify-end gap-0"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover((h) => (h === i ? null : h))}
              >
                {hover === i && (
                  <div className="mb-1 whitespace-nowrap rounded-md border border-line bg-white px-2 py-1 text-[11px] shadow-sm">
                    <span className="font-semibold text-ink">{total}</span> total ·{" "}
                    <span style={{ color: SUPPLIER }}>{b.supplier} supplier</span> ·{" "}
                    <span style={{ color: BUYER }}>{b.buyer} customer</span>
                  </div>
                )}
                <div className="flex w-full max-w-[28px] flex-col items-stretch">
                  {b.buyer > 0 && <div style={{ height: Math.max(buyerH, 2), background: BUYER }} className="rounded-t-[2px]" />}
                  {b.buyer > 0 && b.supplier > 0 && <div style={{ height: 2 }} className="bg-cream" />}
                  {b.supplier > 0 && (
                    <div
                      style={{ height: Math.max(supplierH, 2), background: SUPPLIER }}
                      className={b.buyer === 0 ? "rounded-t-[2px]" : ""}
                    />
                  )}
                </div>
                <div className="mt-1.5 whitespace-nowrap text-[9.5px] text-muted">{fmtBucket(b.bucket, granularity)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
