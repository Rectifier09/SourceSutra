"use client";

import { useMemo, useState } from "react";
import type { TSRow } from "./TimeSeriesChart";
import { fmtDay, fmtMonth } from "./dateFormat";

// Sequential blue ramp (palette.md), 5 representative steps light -> dark.
const STEPS = ["#e4dfd5", "#b7d3f6", "#6da7ec", "#2a78d6", "#1c5cab", "#0d366b"];
const DAYS_BACK = 182; // ~26 weeks, GitHub-style window
const DOW_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function CalendarHeatmap({ data }: { data: TSRow[] }) {
  const [hover, setHover] = useState<string | null>(null);

  const { weeks, byDay, max } = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const r of data) {
      const k = r.bucket.slice(0, 10);
      byDay.set(k, (byDay.get(k) ?? 0) + r.count);
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - DAYS_BACK);
    // Back up to the most recent Sunday so the grid's first column is a full week.
    start.setUTCDate(start.getUTCDate() - start.getUTCDay());

    const days: { key: string; date: Date }[] = [];
    for (let d = new Date(start); d <= today; d.setUTCDate(d.getUTCDate() + 1)) {
      days.push({ key: dateKey(d), date: new Date(d) });
    }
    const weeks: { key: string; date: Date }[][] = [];
    for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

    const max = Math.max(1, ...Array.from(byDay.values()));
    return { weeks, byDay, max };
  }, [data]);

  const stepFor = (count: number) => {
    if (count === 0) return STEPS[0];
    const frac = count / max;
    const idx = Math.min(STEPS.length - 1, 1 + Math.floor(frac * (STEPS.length - 1)));
    return STEPS[idx];
  };

  let lastMonth = -1;

  return (
    <div className="rounded-[14px] border border-line bg-cream p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-[16px] font-medium text-ink">Daily activity</h2>
          <p className="text-[12px] text-muted">All events, last {Math.round(DAYS_BACK / 7)} weeks.</p>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-muted">
          <span>Less</span>
          {STEPS.map((s) => (
            <span key={s} className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: s }} />
          ))}
          <span>More</span>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <div className="flex flex-col gap-[3px] pt-[18px] text-[9.5px] text-muted">
          {DOW_LABELS.map((l, i) => (
            <div key={i} className="flex h-[13px] items-center">
              {l}
            </div>
          ))}
        </div>
        <div className="flex gap-[3px]">
          {weeks.map((week, wi) => {
            const firstOfMonth = week.find((d) => d.date.getUTCDate() <= 7);
            const showMonth = firstOfMonth && firstOfMonth.date.getUTCMonth() !== lastMonth;
            if (showMonth && firstOfMonth) lastMonth = firstOfMonth.date.getUTCMonth();
            return (
              <div key={wi} className="flex flex-col gap-[3px]">
                <div className="h-[14px] text-[9.5px] text-muted">
                  {showMonth && firstOfMonth ? fmtMonth(firstOfMonth.date) : ""}
                </div>
                {week.map((d) => {
                  const count = byDay.get(d.key) ?? 0;
                  return (
                    <div
                      key={d.key}
                      className="relative h-[13px] w-[13px] rounded-[2px]"
                      style={{ background: stepFor(count) }}
                      onMouseEnter={() => setHover(d.key)}
                      onMouseLeave={() => setHover((h) => (h === d.key ? null : h))}
                    >
                      {hover === d.key && (
                        <div className="pointer-events-none absolute bottom-[16px] left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-white px-2 py-1 text-[11px] shadow-sm">
                          <span className="font-semibold text-ink">{count}</span> event{count === 1 ? "" : "s"}
                          <span className="text-muted"> · {fmtDay(d.date.toISOString())}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
