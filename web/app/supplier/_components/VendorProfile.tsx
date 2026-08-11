import Link from "next/link";

// The onboarding-completed vendor profile view (ports ScreenDashboard isVendorProfile).
// A read-only summary of what the supplier submitted, with Edit links back into each section.
export function VendorProfile({
  company,
  mission,
  contactName,
  designation,
  established,
  natureOfBusiness,
  docChips,
  bankName,
  accountMasked,
  billingLocation,
  catalogue,
  workHistory,
  tags,
}: {
  company: string;
  mission: string;
  contactName: string;
  designation: string;
  established: string;
  natureOfBusiness: string;
  docChips: string[];
  bankName: string;
  accountMasked: string;
  billingLocation: string;
  catalogue: string[];
  workHistory: { client: string; role: string; start: string; end: string; desc: string }[];
  tags: string[];
}) {
  const initials = company.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const editBtn = "rounded-[7px] border border-primary px-3.5 py-1.5 text-[12.5px] text-primary hover:bg-lav1";
  const card = "mb-5 rounded-[14px] border border-line bg-cream p-6";
  const stat = (label: string, val: string) => (
    <div>
      <div className="text-[11.5px] text-muted">{label}</div>
      <div className="text-[13.5px] font-semibold text-ink">{val || "—"}</div>
    </div>
  );

  return (
    <main className="mx-auto w-full max-w-[1080px] px-6 pb-20 pt-8">
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex h-[76px] w-[76px] flex-shrink-0 items-center justify-center rounded-[16px] bg-lav1 font-display text-[22px] font-medium text-primary">
          {initials || "SS"}
        </div>
        <div className="flex-1" style={{ minWidth: 300 }}>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-[26px] font-medium text-ink">{company}</h1>
            <span className="rounded-full bg-sage px-2.5 py-1 text-[11px] font-semibold text-white">✓ Onboarding completed</span>
          </div>
          <p className="mt-1.5 text-[14.5px] text-muted">{mission}</p>
        </div>
      </div>

      {/* Identity */}
      <div className={card}>
        <div className="mb-3.5 flex items-center justify-between">
          <h2 className="font-display text-[17px] font-medium text-ink">Identity</h2>
          <Link href="/supplier?section=identity" className={editBtn}>Edit</Link>
        </div>
        <div className="flex flex-wrap gap-7">
          {stat("Primary contact", [contactName, designation].filter(Boolean).join(" · "))}
          {stat("Established", established)}
          {stat("Nature of business", natureOfBusiness)}
        </div>
        {docChips.length > 0 && (
          <div className="mt-3.5 flex flex-wrap gap-2">
            {docChips.map((d) => (
              <span key={d} className="rounded-full border border-[#D6E3D6] bg-sagebg px-2.5 py-1 text-[11.5px] font-semibold text-sage">✓ {d}</span>
            ))}
          </div>
        )}
      </div>

      {/* Financials */}
      <div className={card}>
        <div className="mb-3.5 flex items-center justify-between">
          <h2 className="font-display text-[17px] font-medium text-ink">Financials</h2>
          <Link href="/supplier?section=financials" className={editBtn}>Edit</Link>
        </div>
        <div className="flex flex-wrap gap-7">
          {stat("Bank", bankName)}
          {stat("Account", accountMasked)}
          {stat("Billing location", billingLocation)}
        </div>
      </div>

      {/* Portfolio */}
      <div className="rounded-[16px] border border-lav2 bg-lav1 p-7">
        <div className="mb-1.5 flex items-center justify-between">
          <h2 className="font-display text-[20px] font-medium text-ink">Portfolio</h2>
          <Link href="/supplier?section=portfolio" className={editBtn}>Edit</Link>
        </div>
        <p className="mb-5 text-[13px] text-muted">What customers see first — kept prominent here too.</p>

        <div className="mb-5.5">
          <div className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.04em] text-primary2">Catalogue</div>
          <div className="flex flex-wrap gap-3.5">
            {catalogue.length === 0 && <p className="text-[13px] text-muted">No catalogue images yet.</p>}
            {catalogue.map((c, i) => (
              <div key={i} className="flex h-[160px] w-[160px] items-end overflow-hidden rounded-[12px] border border-lav2" style={{ background: "repeating-linear-gradient(135deg,#FAF8F4,#FAF8F4 8px,#F2EEE6 8px,#F2EEE6 16px)" }}>
                <div className="w-full bg-primary/85 px-2 py-1.5 text-[11px] text-cream">{c}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="my-5">
          <div className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.04em] text-primary2">Work history</div>
          <div className="flex flex-col gap-2.5">
            {workHistory.length === 0 && <p className="text-[13px] text-muted">No engagements yet.</p>}
            {workHistory.map((w, i) => (
              <div key={i} className="rounded-[10px] border border-lav2 bg-cream px-4 py-3.5">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="text-[14px] font-semibold text-ink">{w.client}</span>
                  <span className="text-[12px] text-primary2">{w.role} · {w.start}–{w.end}</span>
                </div>
                <p className="mt-1.5 text-[13px] text-muted">{w.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.04em] text-primary2">Search tags</div>
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <span key={t} className="rounded-full border border-lav2 bg-cream px-3 py-1.5 text-[12.5px] text-primary">{t}</span>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
