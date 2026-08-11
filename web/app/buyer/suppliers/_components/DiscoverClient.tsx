"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type DirRow = {
  org_id: string;
  name: string;
  location: string | null;
  mission: string | null;
  years_in_business: number | null;
  company_type: string | null;
  tags: string[] | null;
  logo_bg: string | null;
  logo_fg: string | null;
};

// Monogram initials — ported from the prototype (CustomerDiscover renderVals).
function initials(name: string): string {
  const parts = name.split(" ").filter((w) => w.length > 2 || /[A-Z]/.test(w[0] ?? ""));
  const r = parts
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return r || name.slice(0, 2).toUpperCase();
}

export function DiscoverClient({ suppliers }: { suppliers: DirRow[] }) {
  const [activeType, setActiveType] = useState("");
  const [activeLocation, setActiveLocation] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const companyTypes = useMemo(
    () => [...new Set(suppliers.map((s) => s.company_type).filter(Boolean) as string[])].sort(),
    [suppliers],
  );
  const locations = useMemo(
    () => [...new Set(suppliers.map((s) => s.location).filter(Boolean) as string[])].sort(),
    [suppliers],
  );
  const allTags = useMemo(
    () => [...new Set(suppliers.flatMap((s) => s.tags ?? []))].sort(),
    [suppliers],
  );

  const q = searchQuery.trim().toLowerCase();
  const filtered = suppliers.filter(
    (s) =>
      (!activeType || s.company_type === activeType) &&
      (!activeLocation || s.location === activeLocation) &&
      (activeTags.length === 0 || activeTags.some((t) => (s.tags ?? []).includes(t))) &&
      (!q || s.name.toLowerCase().includes(q) || (s.mission ?? "").toLowerCase().includes(q)),
  );

  const hasActiveFilters = !!(activeType || activeLocation || activeTags.length || q);
  const toggleTag = (t: string) =>
    setActiveTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  const clearFilters = () => {
    setActiveType("");
    setActiveLocation("");
    setActiveTags([]);
    setSearchQuery("");
  };

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-fixed"
      style={{ backgroundImage: "url('/img/discover-bg.png')" }}
    >
      <div className="mx-auto max-w-[1180px] px-6 pb-24 pt-12">
        {/* Filter bar */}
        <div className="mb-[34px] flex flex-wrap items-center gap-3">
          <select
            value={activeType}
            onChange={(e) => setActiveType(e.target.value)}
            className="rounded-lg border border-line bg-white px-3 py-2.5 text-[13.5px] text-ink"
          >
            <option value="">All company types</option>
            {companyTypes.map((t) => (
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

          <div className="flex flex-wrap gap-1.5">
            {allTags.map((tag) => {
              const active = activeTags.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className="rounded-full border px-[13px] py-[7px] text-[12.5px] transition-colors"
                  style={{
                    background: active ? "#403A77" : "#fff",
                    color: active ? "#FAF8F4" : "#403A77",
                    borderColor: active ? "#403A77" : "#D6D4EC",
                  }}
                >
                  {tag}
                </button>
              );
            })}
          </div>

          <div className="ml-auto flex items-center">
            {searchOpen ? (
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onBlur={() => setSearchOpen(false)}
                placeholder="Search suppliers…"
                className="w-[220px] rounded-lg border border-primary px-3 py-2.5 text-[13.5px]"
              />
            ) : (
              <button
                onClick={() => setSearchOpen(true)}
                aria-label="Search suppliers"
                className="h-[38px] w-[38px] rounded-lg border border-line bg-white text-[15px] hover:bg-lav1"
              >
                🔍
              </button>
            )}
          </div>
        </div>

        {hasActiveFilters && (
          <div className="mb-[18px]">
            <button onClick={clearFilters} className="text-[12.5px] text-primary underline">
              Clear filters
            </button>
          </div>
        )}

        <div className="mb-4 text-[13px] text-muted">
          {filtered.length} of {suppliers.length} suppliers
        </div>

        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((s) => (
              <Link
                key={s.org_id}
                href={`/buyer/suppliers/${s.org_id}`}
                className="flex flex-col gap-3 rounded-[14px] border p-5 transition-colors"
                style={{
                  background: "rgba(250,248,244,0.55)",
                  backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)",
                  border: "1px solid rgba(255,255,255,0.5)",
                  boxShadow: "0 8px 24px rgba(32,32,43,0.08)",
                }}
              >
                <div
                  className="flex h-[52px] w-[52px] items-center justify-center rounded-[12px] font-display text-[16px] font-medium"
                  style={{ background: s.logo_bg ?? "#EDECF6", color: s.logo_fg ?? "#403A77" }}
                >
                  {initials(s.name)}
                </div>
                <div>
                  <div className="mb-1 text-[15.5px] font-semibold text-ink">{s.name}</div>
                  <div className="text-[13px] leading-[1.45] text-muted">{s.mission}</div>
                </div>
                <div className="mt-auto text-[11.5px] text-primary2">
                  {s.location}
                  {s.company_type ? ` · ${s.company_type}` : ""}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="px-5 py-[60px] text-center text-muted">
            <p className="mb-3 text-[14.5px]">No suppliers match these filters — clear a filter to see more.</p>
            <button
              onClick={clearFilters}
              className="rounded-lg bg-primary px-[18px] py-2.5 text-[13.5px] text-cream"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
