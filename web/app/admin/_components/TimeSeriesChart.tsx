"use client";

import { useMemo, useState } from "react";
import { fmtBucket } from "./dateFormat";

export type TSRow = { bucket: string; type: string; kind: string | null; count: number };
export type Granularity = "day" | "week" | "month" | "quarter" | "year";

const GRANULARITIES: { value: Granularity; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
];

export type EventOption = { label: string; type: string; kind?: string };

const BLUE = "#2a78d6";
const W = 640;
const H = 220;
const PAD = { top: 12, right: 12, bottom: 28, left: 36 };

export function TimeSeriesChart({
  data,
  eventOptions,
  defaultEventIndex,
}: {
  data: Record<Granularity, TSRow[]>;
  eventOptions: EventOption[];
  defaultEventIndex: number;
}) {
  const [granularity, setGranularity] = useState<Granularity>("week");
  const [eventIndex, setEventIndex] = useState(defaultEventIndex);
  const [hover, setHover] = useState<number | null>(null);
  const ev = eventOptions[eventIndex];

  const points = useMemo(() => {
    const rows = data[granularity].filter(
      (r) => r.type === ev.type && (ev.kind === undefined || r.kind === ev.kind),
    );
    const byBucket = new Map<string, number>();
    for (const r of rows) byBucket.set(r.bucket, (byBucket.get(r.bucket) ?? 0) + r.count);
    return Array.from(byBucket.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([bucket, count]) => ({ bucket, count }));
  }, [data, granularity, ev]);

  const max = Math.max(1, ...points.map((p) => p.count));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length > 1 ? (i / (points.length - 1)) * innerW : innerW / 2);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.count).toFixed(1)}`).join(" ");
  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="rounded-[14px] border border-line bg-cream p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-[16px] font-medium text-ink">{ev.label} over time</h2>
          <p className="text-[12px] text-muted">Hover the line for exact counts.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={eventIndex}
            onChange={(e) => setEventIndex(Number(e.target.value))}
            className="rounded-md border border-line bg-white px-2.5 py-1.5 text-[12.5px] text-ink"
          >
            {eventOptions.map((o, i) => (
              <option key={o.label} value={i}>
                {o.label}
              </option>
            ))}
          </select>
          <div className="flex overflow-hidden rounded-md border border-line">
            {GRANULARITIES.map((g) => (
              <button
                key={g.value}
                onClick={() => setGranularity(g.value)}
                className="px-2.5 py-1.5 text-[12px] font-medium"
                style={{
                  background: granularity === g.value ? BLUE : "#fff",
                  color: granularity === g.value ? "#fff" : "#20202b",
                }}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {points.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-muted">No data yet for this event.</p>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${ev.label} over time`}>
            {gridLines.map((f) => (
              <line
                key={f}
                x1={PAD.left}
                x2={W - PAD.right}
                y1={PAD.top + innerH * f}
                y2={PAD.top + innerH * f}
                stroke="#e4dfd5"
                strokeWidth={1}
              />
            ))}
            <text x={4} y={PAD.top + 4} fontSize={10} fill="#6b6a78">
              {max}
            </text>
            <text x={4} y={PAD.top + innerH} fontSize={10} fill="#6b6a78">
              0
            </text>
            <path d={path} fill="none" stroke={BLUE} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            {points.map((p, i) => (
              <circle key={p.bucket} cx={x(i)} cy={y(p.count)} r={hover === i ? 5 : 3} fill={BLUE} />
            ))}
            {points.map((p, i) => (
              <rect
                key={`hit-${p.bucket}`}
                x={x(i) - innerW / Math.max(points.length, 1) / 2}
                y={PAD.top}
                width={innerW / Math.max(points.length, 1)}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover((h) => (h === i ? null : h))}
              />
            ))}
            {hover !== null && (
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} stroke="#6b6a78" strokeWidth={1} strokeDasharray="3,3" />
            )}
            {points.map(
              (p, i) =>
                (i === 0 || i === points.length - 1 || i % Math.ceil(points.length / 6) === 0) && (
                  <text
                    key={`lbl-${p.bucket}`}
                    x={x(i)}
                    y={H - 6}
                    fontSize={9.5}
                    fill="#6b6a78"
                    textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
                  >
                    {fmtBucket(p.bucket, granularity)}
                  </text>
                ),
            )}
          </svg>
          {hover !== null && (
            <div
              className="pointer-events-none absolute rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] shadow-sm"
              style={{ left: `${(x(hover) / W) * 100}%`, top: 8, transform: "translateX(-50%)" }}
            >
              <div className="font-semibold text-ink">{points[hover].count}</div>
              <div className="text-muted">{fmtBucket(points[hover].bucket, granularity)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
