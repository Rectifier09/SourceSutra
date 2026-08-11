"use client";

import Link from "next/link";
import { useState } from "react";

export type Badge = { label: string; bg: string; fg: string };
export type CertCard = {
  key: string;
  isAudit: boolean;
  badge: Badge;
  opacity: number;
  // certification / licence
  name?: string;
  issuingBody?: string;
  certNumber?: string;
  scope?: string;
  validityLabel?: string;
  verificationUrl?: string | null;
  // audit
  buyerName?: string;
  auditType?: string;
  auditDate?: string;
};
export type CertGroup = { category: string; records: CertCard[] };

export type ProfileData = {
  orgId: string;
  name: string;
  mission: string | null;
  companyType: string | null;
  location: string | null;
  logoBg: string;
  logoFg: string;
  initials: string;
  production: { factoryArea: string; employees: string; monthlyCapacity: string; productionLines: string };
  trade: { moq: string; incoterms: string; paymentTerms: string; leadTime: string };
  customization: string[];
  products: { name: string; category: string; material: string; priceRange: string }[];
  facilityCount: number;
  certGroups: CertGroup[];
  certSummary: {
    total: number;
    verified: number;
    expiringSoon: number;
    expired: number;
    categoriesCovered: number;
    categoriesTotal: number;
  };
  hasCerts: boolean;
  workHistory: { client: string; role: string; frequency: string; years: string; desc: string }[];
  contact: {
    name: string;
    title: string;
    email: string;
    phone: string;
    languages: string;
    responseTime: string;
    initials: string;
  };
};

const STRIPE = "repeating-linear-gradient(135deg,#EDECF6,#EDECF6 8px,#E4E2F0 8px,#E4E2F0 16px)";

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-semibold uppercase text-muted">{label}</div>
      {children}
    </div>
  );
}

export function SupplierProfileView({ data }: { data: ProfileData }) {
  const [modal, setModal] = useState<string | null>(null);
  const p = data;

  return (
    <div className="min-h-screen bg-cream">
      <div className="mx-auto max-w-[1180px] px-6 pb-20 pt-10">
        <Link href="/buyer/suppliers" className="mb-6 inline-block text-[14px] text-primary underline">
          ← Back to discover suppliers
        </Link>

        {/* HEADER */}
        <div className="mb-10 flex flex-wrap items-start gap-5">
          <div
            className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-[16px] font-display text-[28px] font-medium"
            style={{ background: p.logoBg, color: p.logoFg }}
          >
            {p.initials}
          </div>
          <div className="min-w-[280px] flex-1">
            <h1 className="mb-1.5 font-display text-[32px] font-medium text-ink">{p.name}</h1>
            <p className="mb-2 text-[15.5px] leading-[1.5] text-muted">{p.mission}</p>
            <div className="flex flex-wrap gap-3 text-[13.5px] text-primary2">
              <span>{p.companyType ?? "—"}</span>
              <span>·</span>
              <span>{p.location ?? "—"}</span>
            </div>
          </div>
          <Link
            href={`/buyer/rfqs/new?invite=${p.orgId}`}
            className="flex-shrink-0 whitespace-nowrap rounded-lg bg-primary px-5 py-3 text-[13.5px] font-semibold text-cream hover:opacity-90"
          >
            Create RFQ
          </Link>
        </div>

        {/* BUSINESS PERFORMANCE (empty state, as in prototype) */}
        <div className="mb-8 rounded-[14px] border border-line bg-cream p-[26px]">
          <h2 className="mb-4 font-display text-[16px] font-medium text-ink">Business performance</h2>
          <div className="rounded-[10px] bg-panel p-5 text-center">
            <p className="mb-2 text-[13.5px] text-muted">Not enough activity yet</p>
            <p className="text-[12px] text-primary2">
              These metrics populate as the supplier completes projects on SourceSutra.
            </p>
          </div>
        </div>

        {/* PRODUCTION SNAPSHOT */}
        <div className="mb-8 rounded-[14px] border border-line bg-cream p-[26px]">
          <h2 className="mb-1 font-display text-[16px] font-medium text-ink">Production snapshot</h2>
          <p className="mb-4 text-[12px] text-primary2">As reported by supplier</p>
          <div className="grid gap-[18px]" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))" }}>
            <Section label="Factory area">
              <div className="text-[16px] font-semibold text-ink">{p.production.factoryArea}</div>
            </Section>
            <Section label="Employees">
              <div className="text-[16px] font-semibold text-ink">{p.production.employees}</div>
            </Section>
            <Section label="Monthly capacity">
              <div className="text-[16px] font-semibold text-ink">{p.production.monthlyCapacity}</div>
            </Section>
            <Section label="Production lines">
              <div className="text-[16px] font-semibold text-ink">{p.production.productionLines}</div>
            </Section>
          </div>
        </div>

        {/* TRADE TERMS */}
        <div className="mb-8 rounded-[14px] border border-line bg-cream p-[26px]">
          <h2 className="mb-4 font-display text-[16px] font-medium text-ink">Trade terms</h2>
          <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))" }}>
            {[
              ["MOQ", p.trade.moq],
              ["Incoterms", p.trade.incoterms],
              ["Payment terms", p.trade.paymentTerms],
              ["Lead time", p.trade.leadTime],
            ].map(([label, val]) => (
              <div key={label}>
                <div className="mb-1 text-[12px] font-medium text-muted">{label}</div>
                <div className="text-[14.5px] font-semibold text-ink">{val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CUSTOMIZATION CAPABILITIES */}
        {p.customization.length > 0 && (
          <div className="mb-8 rounded-[14px] border border-line bg-cream p-[26px]">
            <h2 className="mb-4 font-display text-[16px] font-medium text-ink">Customization capabilities</h2>
            <div className="flex flex-wrap gap-2">
              {p.customization.map((cap) => (
                <div
                  key={cap}
                  className="rounded-md border border-lav2 bg-white px-3 py-2 text-[13px] text-primary"
                >
                  {cap}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PRODUCTS */}
        {p.products.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-4 font-display text-[16px] font-medium text-ink">Products</h2>
            <div className="grid gap-[18px]" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))" }}>
              {p.products.map((prod) => (
                <button
                  key={prod.name}
                  onClick={() => setModal(prod.name)}
                  className="overflow-hidden rounded-[12px] border border-line bg-white text-left transition-colors hover:border-lav3"
                >
                  <div className="h-40" style={{ background: STRIPE }} />
                  <div className="p-3.5">
                    <div className="mb-1 text-[14px] font-semibold text-ink">{prod.name}</div>
                    <div className="mb-2 text-[12px] text-primary2">{prod.category}</div>
                    <div className="text-[12px] text-muted">{prod.material}</div>
                    <div className="mt-2 text-[13px] font-semibold text-primary">{prod.priceRange}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* CERTIFICATIONS */}
        <div className="mb-8">
          <h2 className="mb-1 font-display text-[16px] font-medium text-ink">Certifications &amp; licences</h2>
          <p className="mb-4 text-[12px] text-primary2">
            Expired records stay visible so you can see compliance history, not just current status.
          </p>

          {p.hasCerts ? (
            <>
              <div className="mb-5 flex flex-wrap gap-2.5">
                <div className="rounded-lg border border-line bg-white px-3.5 py-2">
                  <span className="text-[15px] font-semibold text-ink">{p.certSummary.total}</span>{" "}
                  <span className="text-[12px] text-muted">total</span>
                </div>
                <div className="rounded-lg border border-line bg-white px-3.5 py-2">
                  <span className="text-[15px] font-semibold text-sage">{p.certSummary.verified}</span>{" "}
                  <span className="text-[12px] text-muted">verified</span>
                </div>
                <div className="rounded-lg border border-line bg-white px-3.5 py-2">
                  <span className="text-[15px] font-semibold" style={{ color: "#B07A17" }}>
                    {p.certSummary.expiringSoon}
                  </span>{" "}
                  <span className="text-[12px] text-muted">expiring soon</span>
                </div>
                <div className="rounded-lg border border-line bg-white px-3.5 py-2">
                  <span className="text-[15px] font-semibold text-terra">{p.certSummary.expired}</span>{" "}
                  <span className="text-[12px] text-muted">expired</span>
                </div>
                <div className="rounded-lg border border-line bg-white px-3.5 py-2 text-[12px] text-muted">
                  Covers {p.certSummary.categoriesCovered} of {p.certSummary.categoriesTotal} categories
                </div>
              </div>

              <div className="flex flex-col gap-[22px]">
                {p.certGroups.map((grp) => (
                  <div key={grp.category}>
                    <div className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.02em] text-primary2">
                      {grp.category}
                    </div>
                    <div className="flex flex-col gap-3">
                      {grp.records.map((cert) =>
                        cert.isAudit ? (
                          <div
                            key={cert.key}
                            className="rounded-[12px] border border-dashed border-lav3 bg-panel p-4"
                          >
                            <div className="mb-2 flex items-start justify-between gap-3">
                              <div>
                                <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.03em] text-primary">
                                  Audit
                                </div>
                                <div className="text-[14.5px] font-semibold text-ink">{cert.buyerName}</div>
                                <div className="text-[12px] text-primary2">{cert.auditType}</div>
                              </div>
                              <div className="text-right">
                                <div
                                  className="mb-1.5 inline-block rounded-full px-[9px] py-1 text-[11px] font-semibold"
                                  style={{ background: cert.badge.bg, color: cert.badge.fg }}
                                >
                                  {cert.badge.label}
                                </div>
                                <div className="text-[11.5px] text-muted">{cert.auditDate}</div>
                              </div>
                            </div>
                            <button
                              onClick={() => setModal(`${cert.buyerName} — audit report`)}
                              className="text-[12px] text-primary underline"
                            >
                              View report
                            </button>
                          </div>
                        ) : (
                          <div
                            key={cert.key}
                            className="rounded-[12px] border border-line bg-white p-4"
                            style={{ opacity: cert.opacity }}
                          >
                            <div className="mb-2 flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <div className="mb-0.5 text-[14.5px] font-semibold text-ink">{cert.name}</div>
                                <div className="text-[12px] text-primary2">
                                  {cert.issuingBody} · No. {cert.certNumber}
                                </div>
                              </div>
                              <div
                                className="whitespace-nowrap rounded-full px-[9px] py-1 text-[11px] font-semibold"
                                style={{ background: cert.badge.bg, color: cert.badge.fg }}
                              >
                                {cert.badge.label}
                              </div>
                            </div>
                            <p className="mb-2 rounded-md bg-panel px-2.5 py-2 text-[13px] leading-[1.5] text-ink">
                              {cert.scope}
                            </p>
                            <div className="flex flex-wrap items-center justify-between gap-2.5">
                              <div className="text-[12px] text-muted">{cert.validityLabel}</div>
                              <div className="flex items-center gap-3.5">
                                {cert.verificationUrl && (
                                  <a
                                    href={cert.verificationUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[12px] text-primary no-underline"
                                  >
                                    Verify independently →
                                  </a>
                                )}
                                <button
                                  onClick={() => setModal(cert.name ?? "Certificate")}
                                  className="whitespace-nowrap text-[12px] text-primary underline"
                                >
                                  View certificate
                                </button>
                              </div>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-[10px] bg-panel p-5 text-center">
              <p className="text-[13.5px] text-muted">No certifications on file yet.</p>
            </div>
          )}
        </div>

        {/* FACILITY GALLERY */}
        {p.facilityCount > 0 && (
          <div className="mb-8">
            <h2 className="mb-4 font-display text-[16px] font-medium text-ink">Facility gallery</h2>
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))" }}>
              {Array.from({ length: p.facilityCount }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setModal(`Facility photo ${i + 1}`)}
                  className="flex aspect-square items-center justify-center rounded-[10px] border border-line"
                  style={{ background: STRIPE }}
                >
                  <span className="text-[12px] text-primary2">Photo</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* WORK HISTORY */}
        {p.workHistory.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-4 font-display text-[16px] font-medium text-ink">Work history</h2>
            <div className="flex flex-col gap-3.5">
              {p.workHistory.map((w, i) => (
                <div key={i} className="rounded-[12px] border border-line bg-white p-4">
                  <div className="mb-2 flex flex-wrap justify-between gap-2.5">
                    <span className="text-[14.5px] font-semibold text-ink">{w.client}</span>
                    <span className="text-[12px] text-primary2">
                      {w.role} · {w.frequency}
                    </span>
                  </div>
                  <div className="mb-2 text-[12px] text-muted">{w.years}</div>
                  <p className="text-[13.5px] leading-[1.5] text-ink">{w.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CONTACT FOR BUYERS */}
        {p.contact.name !== "—" && (
          <div className="mb-8 rounded-[14px] border border-line bg-cream p-[26px]">
            <h2 className="mb-5 font-display text-[16px] font-medium text-ink">Contact for buyers</h2>
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-[12px] bg-lav1 font-display text-[18px] font-semibold text-primary">
                {p.contact.initials}
              </div>
              <div className="flex-1">
                <div className="mb-0.5 text-[14.5px] font-semibold text-ink">{p.contact.name}</div>
                <div className="mb-3 text-[12.5px] text-primary2">{p.contact.title}</div>
                <div className="flex flex-col gap-1.5">
                  <a href={`mailto:${p.contact.email}`} className="text-[13px] text-primary no-underline">
                    {p.contact.email}
                  </a>
                  <a href={`tel:${p.contact.phone}`} className="text-[13px] text-primary no-underline">
                    {p.contact.phone}
                  </a>
                  <a
                    href={`https://wa.me/${p.contact.phone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 self-start rounded-md bg-sage px-3.5 py-2 text-[12.5px] text-white no-underline"
                  >
                    WhatsApp
                  </a>
                </div>
                <div className="mt-3 text-[12px] text-muted">Languages: {p.contact.languages}</div>
                <div className="text-[12px] text-muted">Typical response: {p.contact.responseTime}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL (preview placeholder — real files land with storage in BP-2) */}
      {modal && (
        <div
          onClick={() => setModal(null)}
          className="fixed inset-0 z-[100] flex items-center justify-center p-5"
          style={{ background: "rgba(32,32,43,0.6)" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[80vh] w-full max-w-[620px] overflow-y-auto rounded-[14px] bg-cream p-[26px]"
          >
            <button
              onClick={() => setModal(null)}
              aria-label="Close"
              className="absolute right-3.5 top-3.5 flex h-8 w-8 items-center justify-center text-[24px] text-muted"
            >
              ×
            </button>
            <h3 className="mb-4 pr-10 font-display text-[18px] font-medium text-ink">{modal}</h3>
            <div
              className="mb-4 flex h-80 items-center justify-center rounded-[10px] font-mono text-[12px] text-primary2"
              style={{ background: "repeating-linear-gradient(135deg,#EDECF6,#EDECF6 10px,#E4E2F0 10px,#E4E2F0 20px)" }}
            >
              preview
            </div>
            <p className="text-[12.5px] text-muted">
              Document previews and downloads become available once verified files are attached.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
