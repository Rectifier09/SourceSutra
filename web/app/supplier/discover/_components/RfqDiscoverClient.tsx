"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type RfqRow = {
  id: string;
  title: string;
  quantity: number | null;
  unit: string | null;
  contract_type: string | null;
  preferred_location: string | null;
  bid_end: string | null;
  delivery_date: string | null;
  who_can_respond: string | null;
  buyerName: string | null;
  myStatus: string | null;
};

const QUOTE_PILL: Record<string, string> = {
  draft: "bg-panel text-muted",
  submitted: "bg-panel2 text-amber",
  under_review: "bg-panel2 text-amber",
  shortlisted: "bg-lav1 text-primary",
  awarded: "bg-sagebg text-sage",
  not_selected: "bg-[#F7ECE8] text-terra",
  closed: "bg-panel text-muted",
};

export function RfqDiscoverClient({ rfqs }: { rfqs: RfqRow[] }) {
  const [activeType, setActiveType] = useState("");
  const [activeLocation, setActiveLocation] = useState("");
  const [search, setSearch] = useState("");

  const contractTypes = useMemo(
    () => [...new Set(rfqs.map((r) => r.contract_type).filter(Boolean) as string[])].sort(),
    [rfqs],
  );
  const locations = useMemo(
    () => [...new Set(rfqs.map((r) => r.preferred_location).filter(Boolean) as string[])].sort(),
    [rfqs],
  );

  const q = search.trim().toLowerCase();
  const filtered = rfqs.filter(
    (r) =>
      (!activeType || r.contract_type === activeType) &&
      (!activeLocation || r.preferred_location === activeLocation) &&
      (!q || r.title.toLowerCase().includes(q) || (r.buyerName ?? "").toLowerCase().includes(q)),
  );
  const hasActiveFilters = !!(activeType || activeLocation || q);
  const clear = () => {
    setActiveType("");
    setActiveLocation("");
    setSearch("");
  };

  return (
    <>
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <select
          value={activeType}
          onChange={(e) => setActiveType(e.target.value)}
          className="rounded-lg border border-line bg-white px-3 py-2.5 text-[13.5px] text-ink"
        >
          <option value="">All contract types</option>
          {contractTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={activeLocation}
          onChange={(e) => setActiveLocation(e.target.value)}
          className="rounded-lg border border-line bg-white px-3 py-2.5 text-[13.5px] text-ink"
        >
          <option value="">All locations</option>
          {locations.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search RFQs…"
          className="min-w-[200px] flex-1 rounded-lg border border-line bg-white px-3 py-2.5 text-[13.5px]"
        />
      </div>

      {hasActiveFilters && (
        <div className="mb-3.5">
          <button onClick={clear} className="text-[12.5px] text-primary underline">
            Clear filters
          </button>
        </div>
      )}

      <div className="mb-4 text-[13px] text-muted">
        {filtered.length} of {rfqs.length} open RFQs
      </div>

      {filtered.length > 0 ? (
        <div className="flex flex-col gap-3">
          {filtered.map((r) => (
            <Link
              key={r.id}
              href={`/supplier/rfqs/${r.id}`}
              className="flex flex-wrap items-start justify-between gap-4 rounded-[12px] border border-line bg-white p-5 transition-colors hover:border-lav3"
            >
              <div className="min-w-[220px] flex-1">
                <div className="mb-1 text-[15px] font-semibold text-ink">{r.title}</div>
                <div className="mb-2 text-[12.5px] text-primary2">
                  {r.contract_type ?? "RFQ"} · {r.buyerName ?? "Buyer"}
                  {r.who_can_respond === "invite" ? " · invite-only" : ""}
                </div>
                <div className="text-[12px] text-muted">
                  {r.quantity ? `${r.quantity.toLocaleString()} ${r.unit ?? ""}` : "Quantity TBD"}
                  {r.preferred_location ? ` · ${r.preferred_location}` : ""}
                </div>
              </div>
              <div className="text-right">
                {r.myStatus ? (
                  <span
                    className={`mb-2 inline-block rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold capitalize ${QUOTE_PILL[r.myStatus] ?? "bg-panel text-muted"}`}
                  >
                    {r.myStatus.replace("_", " ")}
                  </span>
                ) : (
                  <span className="mb-2 inline-block rounded-full bg-panel px-2.5 py-0.5 text-[11.5px] font-semibold text-muted">
                    Not quoted
                  </span>
                )}
                <div className="text-[11px] font-semibold uppercase text-muted">Bids close</div>
                <div className="text-[13.5px] font-semibold text-amber">{r.bid_end ?? "—"}</div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="px-5 py-[60px] text-center text-muted">
          <p className="mb-3 text-[14.5px]">No RFQs match these filters — clear a filter to see more.</p>
          <button onClick={clear} className="rounded-lg bg-primary px-[18px] py-2.5 text-[13.5px] text-cream">
            Clear filters
          </button>
        </div>
      )}
    </>
  );
}
