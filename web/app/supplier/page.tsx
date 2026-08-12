import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/me";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/app/_components/Header";
import { IdentityForm } from "./_components/IdentityForm";
import { FinancialsForm } from "./_components/FinancialsForm";
import { PortfolioForm } from "./_components/PortfolioForm";
import { VendorProfile } from "./_components/VendorProfile";
import { BasicsForm } from "./_components/BasicsForm";
import { ONBOARDING_BUCKET } from "@/lib/upload";

const BANNER = "url('/img/onboarding-banner.png')";

const CARD_BADGE: Record<string, { label: string; cls: string }> = {
  not_started: { label: "Pending", cls: "bg-panel text-muted" },
  draft: { label: "In progress", cls: "bg-lav1 text-primary" },
  submitted_pending: { label: "In review", cls: "bg-panel2 text-amber" },
  remediation: { label: "Needs correction", cls: "bg-[#F7ECE8] text-terra" },
  verified: { label: "Verified", cls: "bg-sagebg text-sage" },
};

// documents/certifications don't persist the original filename, only the storage path
// ("{org_id}/{section}/{label}-{timestamp}.{ext}") — derive a readable label from it.
function basename(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  return path.split("/").pop();
}

const OVERALL_STYLE: Record<string, { bg: string; border: string; fg: string; desc: string }> = {
  "To be Started": { bg: "bg-panel", border: "border-line", fg: "text-ink", desc: "Start with Identity — Financials unlocks once it's submitted. Portfolio can be built any time." },
  Draft: { bg: "bg-panel", border: "border-line", fg: "text-ink", desc: "Your sections are in draft. Submit each for verification when ready." },
  "Verification In Progress": { bg: "bg-lav1", border: "border-lav2", fg: "text-primary", desc: "We're reviewing your submitted sections. You'll be notified as each is verified." },
  "Verification – Remediation Required": { bg: "bg-[#F7ECE8]", border: "border-[#EAD1C7]", fg: "text-terra", desc: "One or more sections need a correction. Open the flagged section to fix and resubmit." },
  "Verification Completed – Portfolio Required": { bg: "bg-sagebg", border: "border-line", fg: "text-sage", desc: "Identity & Financials are verified — submit your Portfolio to finish onboarding." },
  "Onboarding Completed": { bg: "bg-sagebg", border: "border-line", fg: "text-sage", desc: "You're verified and discoverable to buyers." },
};

export default async function SupplierHome({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.role !== "supplier") redirect("/buyer");

  const { section } = await searchParams;
  const supabase = await createClient();

  const [{ data: overall }, { data: sectionRows }, { data: profile }, { data: org }, { data: idc }, { data: docs }, { data: directors }, { data: financials }, { data: certs }, { data: auth }] =
    await Promise.all([
      supabase.from("v_supplier_overall").select("overall_status, progress_pct").eq("org_id", me.org_id).maybeSingle(),
      supabase.from("onboarding_sections").select("kind, status").eq("org_id", me.org_id),
      supabase.from("supplier_profiles").select("*").eq("org_id", me.org_id).maybeSingle(),
      supabase.from("orgs").select("name, location").eq("id", me.org_id).maybeSingle(),
      supabase.from("identity_checks").select("*").eq("org_id", me.org_id).maybeSingle(),
      supabase.from("documents").select("*").eq("org_id", me.org_id),
      supabase.from("supplier_directors").select("*").eq("org_id", me.org_id).order("created_at"),
      supabase.from("supplier_financials").select("*").eq("org_id", me.org_id).maybeSingle(),
      supabase.from("certifications").select("*").eq("org_id", me.org_id),
      supabase.auth.getUser(),
    ]);

  const status = overall?.overall_status ?? "To be Started";
  const progress = overall?.progress_pct ?? 0;
  const completed = status === "Onboarding Completed";

  const sec: Record<string, string> = {};
  (sectionRows ?? []).forEach((r: any) => (sec[r.kind] = r.status));
  const p: any = profile ?? {};
  const docList: any[] = docs ?? [];
  const email = auth?.user?.email ?? "";

  // ── Section detail forms ────────────────────────────────────────────────
  if (section === "identity") {
    return (
      <>
        <Header me={me} />
        <IdentityForm
          orgId={me.org_id}
          initial={{
            company: org?.name ?? "",
            contactName: p.contact_name ?? "",
            designation: p.designation ?? "",
            email,
            emailLanguage: p.email_language ?? "English",
            phone: p.phone ?? "",
            altContact: p.alt_contact ?? "",
            website: p.website ?? "",
            established: p.established_date ?? "",
            yearsInBusiness: p.years_in_business != null ? String(p.years_in_business) : "",
            natureOfBusiness: p.nature_of_business ?? "",
          }}
          verified={{
            email: !!idc?.email_verified,
            phone: !!idc?.phone_verified,
            aadhaar: !!idc?.aadhaar_verified,
            aadhaarLast4: idc?.aadhaar_last4 ?? "",
          }}
          directors={(directors ?? []).map((d: any) => ({
            name: d.name ?? "",
            contact: d.contact ?? "",
            email: d.email ?? "",
            aadhaarVerified: !!d.aadhaar_verified,
            aadhaarLast4: d.aadhaar_last4 ?? "",
          }))}
          docs={["GST", "PAN", "MSME", "CIN"].map((t) => {
            const d = docList.find((x) => x.doc_type === t);
            return { type: t as "GST", number: d?.doc_number ?? "", uploaded: !!d, storagePath: d?.storage_path ?? undefined, fileName: basename(d?.storage_path) };
          })}
        />
      </>
    );
  }

  if (section === "financials") {
    const f: any = financials ?? {};
    return (
      <>
        <Header me={me} />
        <FinancialsForm
          orgId={me.org_id}
          initial={{
            bankCountry: f.bank_country ?? "India",
            bankName: f.bank_name ?? "",
            beneficiaryName: f.beneficiary_name ?? "",
            routingType: f.routing_type ?? "IFSC",
            routingCode: f.routing_code ?? "",
            accountNumber: f.account_number ?? "",
            billing: f.billing ?? {},
            legal: f.legal ?? {},
          }}
          mgt7={["2023-24", "2022-23", "2021-22"].map((y) => {
            const d = docList.find((x) => x.doc_type === "MGT7" && x.fy === y);
            return { year: y, uploaded: !!d, storagePath: d?.storage_path ?? undefined, fileName: basename(d?.storage_path) };
          })}
          singleDocs={{
            signedForm: (() => {
              const d = docList.find((x) => x.doc_type === "SignedForm");
              return { uploaded: !!d, storagePath: d?.storage_path ?? undefined, fileName: basename(d?.storage_path) };
            })(),
            rpt: (() => {
              const d = docList.find((x) => x.doc_type === "RPT");
              return { uploaded: !!d, storagePath: d?.storage_path ?? undefined, fileName: basename(d?.storage_path) };
            })(),
            taxDoc: (() => {
              const d = docList.find((x) => x.doc_type === "TaxDoc");
              return { uploaded: !!d, storagePath: d?.storage_path ?? undefined, fileName: basename(d?.storage_path) };
            })(),
          }}
          otherDocs={docList.filter((d) => d.doc_type === "OtherFin").map((d) => ({ fileName: basename(d.storage_path) ?? "document.pdf", storagePath: d.storage_path ?? undefined }))}
        />
      </>
    );
  }

  if (section === "portfolio") {
    return (
      <>
        <Header me={me} />
        <PortfolioForm
          orgId={me.org_id}
          initial={{
            mission: p.mission ?? "",
            logoUploaded: !!p.logo_path,
            logoPath: p.logo_path ?? undefined,
            production: p.production ?? {},
            tradeTerms: p.trade_terms ?? {},
            capabilities: p.customization_capabilities ?? [],
            products: (p.products ?? []).map((pr: any) => ({
              name: pr.name ?? "",
              category: pr.category ?? "",
              material: pr.material ?? "",
              moq: pr.moq ?? "",
              priceRange: pr.priceRange ?? "",
            })),
            facilityPhotos: ((p.facility_photos ?? []) as any[]).map((ph: any, i: number) => ({
              fileName: ph.fileName ?? `facility-${i + 1}.jpg`,
              storagePath: ph.path ?? undefined,
            })),
            workHistory: (p.work_history ?? []).map((w: any) => ({
              clientName: w.client ?? "",
              role: w.role ?? "Sub-Contractor",
              frequency: w.frequency ?? "Recurring",
              startYear: w.start ?? "",
              endYear: w.end ?? "",
              description: w.desc ?? "",
              website: w.website ?? "",
              evidenceStoragePath: w.evidencePath ?? undefined,
              evidenceFileName: w.evidenceFileName ?? undefined,
            })),
            catalogue: (p.catalogue ?? []).map((c: any) => ({ fileName: c.fileName ?? "image.jpg", storagePath: c.path ?? undefined })),
            tags: p.tags ?? [],
          }}
          certs={(certs ?? []).map((c: any) => ({
            category: c.category ?? "",
            name: c.name ?? "",
            number: c.number ?? "",
            issuingBody: c.issuer ?? "",
            scope: c.scope ?? "",
            facility: c.facility ?? "",
            issueDate: c.issue_date ?? "",
            expiryDate: c.expiry_date ?? "",
            doesNotExpire: !!c.does_not_expire,
            lastAuditDate: c.last_audit_date ?? "",
            nextAuditDate: c.next_audit_date ?? "",
            verificationUrl: c.verification_url ?? "",
            buyerName: c.audit_buyer ?? "",
            auditType: c.audit_type ?? "",
            auditDate: c.audit_date ?? "",
            outcome:
              c.audit_outcome === "passed"
                ? "Passed"
                : c.audit_outcome === "passed_with_corrective"
                  ? "Passed with corrective actions"
                  : c.audit_outcome === "failed"
                    ? "Failed"
                    : c.audit_outcome
                      ? "Pending"
                      : "",
            docUploaded: !!c.storage_path,
            docStoragePath: c.storage_path ?? undefined,
            docFileName: basename(c.storage_path),
          }))}
        />
      </>
    );
  }

  if (section === "basics") {
    return (
      <>
        <Header me={me} />
        <BasicsForm
          initial={{
            mission: p.mission ?? "",
            location: org?.location ?? "",
            yearsInBusiness: p.years_in_business != null ? String(p.years_in_business) : "",
          }}
        />
      </>
    );
  }

  // ── Completed → vendor profile view ─────────────────────────────────────
  if (completed) {
    const catalogueItems: { fileName: string; path?: string }[] = (p.catalogue ?? []).map((c: any) => ({
      fileName: c.fileName ?? "image",
      path: c.path ?? undefined,
    }));
    const cataloguePaths = catalogueItems.map((c) => c.path).filter((path): path is string => !!path);
    const { data: signedCatalogue } =
      cataloguePaths.length > 0
        ? await supabase.storage.from(ONBOARDING_BUCKET).createSignedUrls(cataloguePaths, 3600)
        : { data: null };
    const urlByPath: Record<string, string> = {};
    (signedCatalogue ?? []).forEach((s: any) => {
      if (s.signedUrl && s.path) urlByPath[s.path] = s.signedUrl;
    });

    return (
      <>
        <Header me={me} />
        <VendorProfile
          company={org?.name ?? me.org_name}
          mission={p.mission ?? ""}
          location={org?.location ?? ""}
          yearsInBusiness={p.years_in_business != null ? String(p.years_in_business) : ""}
          contactName={p.contact_name ?? ""}
          designation={p.designation ?? ""}
          established={p.established_date ?? ""}
          natureOfBusiness={p.nature_of_business ?? ""}
          docChips={["GST", "PAN", "MSME", "CIN"].filter((t) => docList.some((d) => d.doc_type === t))}
          bankName={financials?.bank_name ?? ""}
          accountMasked={financials?.account_number ? `••••${String(financials.account_number).slice(-4)}` : "—"}
          billingLocation={[financials?.billing?.city, financials?.billing?.state].filter(Boolean).join(", ") || "—"}
          catalogue={catalogueItems.map((c) => ({ fileName: c.fileName, url: c.path ? urlByPath[c.path] : undefined }))}
          workHistory={(p.work_history ?? []).map((w: any) => ({
            client: w.client ?? "",
            role: w.role ?? "",
            start: w.start ?? "",
            end: w.end ?? "",
            desc: w.desc ?? "",
          }))}
          tags={p.tags ?? []}
        />
      </>
    );
  }

  // ── Overview (section cards) ────────────────────────────────────────────
  const finLocked = (sec.identity ?? "not_started") === "not_started";
  const cards = [
    { id: "identity", title: "Identity", desc: "Company details, directors, contact verification, and GST/PAN/MSME/CIN. Submitted first — Financials unlocks once this is in review.", status: sec.identity ?? "not_started", locked: false, lockReason: "" },
    { id: "financials", title: "Financials", desc: "Bank details, billing & legal addresses, and company filings (MGT-7).", status: sec.financials ?? "not_started", locked: finLocked, lockReason: "Unlocks once Identity is submitted." },
    { id: "portfolio", title: "Portfolio", desc: "Logo, products, certifications, work history, and catalogue — how buyers discover you.", status: sec.portfolio ?? "not_started", locked: false, lockReason: "" },
  ];
  const ov = OVERALL_STYLE[status] ?? OVERALL_STYLE["To be Started"];

  return (
    <>
      <Header me={me} />
      <main className="min-h-[calc(100vh-70px)] bg-cover bg-center bg-fixed" style={{ backgroundImage: BANNER }}>
        <div className="mx-auto w-full max-w-[1080px] px-6 pb-20 pt-8">
          <h1 className="font-display text-[26px] font-medium text-ink">Supplier onboarding</h1>
          <p className="mt-1 text-[14px] text-muted">Welcome, {me.full_name}.</p>

          <div className={`mt-6 flex flex-wrap items-center justify-between gap-5 rounded-[16px] border p-7 ${ov.bg} ${ov.border}`}>
            <div>
              <div className={`font-display text-[12px] uppercase tracking-[0.06em] opacity-80 ${ov.fg}`}>Overall status</div>
              <div className={`mt-1 font-display text-[24px] font-medium ${ov.fg}`}>{status}</div>
              <div className={`mt-1.5 max-w-[560px] text-[14px] opacity-90 ${ov.fg}`}>{ov.desc}</div>
            </div>
            <div className="text-right">
              <div className="font-display text-[30px] font-semibold tabular-nums text-primary">{progress}%</div>
              <div className="mt-1 h-2 w-32 overflow-hidden rounded-full bg-white/60">
                <div className="h-full rounded-full bg-sage" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-1 gap-[18px] sm:grid-cols-3">
            {cards.map((c) => {
              const badge = CARD_BADGE[c.status] ?? CARD_BADGE.not_started;
              const inner = (
                <>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h2 className="font-display text-[19px] font-medium text-ink">{c.title}</h2>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${badge.cls}`}>{badge.label}</span>
                  </div>
                  <p className="text-[13.5px] leading-[1.5] text-muted">{c.desc}</p>
                  {c.locked && <p className="mt-2.5 text-[12.5px] text-terra">🔒 {c.lockReason}</p>}
                </>
              );
              return c.locked ? (
                <div key={c.id} className="rounded-[14px] border border-line bg-cream p-6 opacity-60">{inner}</div>
              ) : (
                <Link key={c.id} href={`/supplier?section=${c.id}`} className="rounded-[14px] border border-line bg-cream p-6 transition-colors hover:border-lav3">
                  {inner}
                </Link>
              );
            })}
          </div>
        </div>
      </main>
    </>
  );
}
