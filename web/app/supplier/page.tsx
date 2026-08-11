import { redirect } from "next/navigation";
import { getMe } from "@/lib/me";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/app/_components/Header";
import { OtpChannel } from "@/app/supplier/_components/OtpChannel";
import { uploadDoc, removeDoc, addCertification, submitSection } from "@/app/supplier/actions";

const FIN_FYS = ["2023-24", "2022-23", "2021-22"];

const SECTION_PILL: Record<string, { label: string; cls: string }> = {
  not_started: { label: "Not started", cls: "bg-panel text-muted" },
  draft: { label: "Draft", cls: "bg-panel text-muted" },
  submitted_pending: { label: "In review", cls: "bg-panel2 text-amber" },
  remediation: { label: "Needs correction", cls: "bg-[#F7ECE8] text-terra" },
  verified: { label: "Verified", cls: "bg-sagebg text-sage" },
};
const DOC_CHIP: Record<string, { label: string; cls: string }> = {
  uploaded: { label: "Uploaded", cls: "bg-panel text-muted" },
  in_progress: { label: "In review", cls: "bg-panel2 text-amber" },
  verified: { label: "Verified", cls: "bg-sagebg text-sage" },
  needs_correction: { label: "Fix needed", cls: "bg-[#F7ECE8] text-terra" },
};

function Pill({ status }: { status: string }) {
  const p = SECTION_PILL[status] ?? SECTION_PILL.not_started;
  return <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${p.cls}`}>{p.label}</span>;
}

// A single required-document slot: an upload affordance when empty, a status chip when filled.
function DocSlot({
  doc,
  section_kind,
  doc_type,
  fy,
  label,
  locked,
  sealed,
}: {
  doc: any | undefined;
  section_kind: string;
  doc_type: string;
  fy: string | null;
  label: string;
  locked: boolean;
  sealed: boolean; // section verified/in-review → no edits
}) {
  if (doc) {
    const chip = DOC_CHIP[doc.status as string] ?? DOC_CHIP.uploaded;
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-white px-3 py-2.5 text-[14px]">
        <div className="min-w-0">
          <div className="font-semibold text-ink">{label}</div>
          {doc.status === "needs_correction" && doc.remediation_reason && (
            <div className="text-[12px] text-terra">{doc.remediation_reason}</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${chip.cls}`}>{chip.label}</span>
          {!sealed && (
            <form action={removeDoc}>
              <input type="hidden" name="doc_id" value={doc.id} />
              <button className="text-[12px] text-muted hover:text-terra">Remove</button>
            </form>
          )}
        </div>
      </div>
    );
  }
  return (
    <form
      action={uploadDoc}
      className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-line px-3 py-2.5 text-[14px]"
    >
      <input type="hidden" name="section_kind" value={section_kind} />
      <input type="hidden" name="doc_type" value={doc_type} />
      {fy && <input type="hidden" name="fy" value={fy} />}
      <span className="text-muted">{label}</span>
      <button
        disabled={locked}
        className="rounded-lg border border-line bg-white px-3 py-1.5 text-[12px] font-medium text-primary hover:bg-panel disabled:opacity-40"
      >
        Upload
      </button>
    </form>
  );
}

function SubmitButton({ kind, ready, sealed }: { kind: string; ready: boolean; sealed: boolean }) {
  if (sealed) return null;
  return (
    <form action={submitSection} className="mt-4">
      <input type="hidden" name="kind" value={kind} />
      <button
        disabled={!ready}
        className="rounded-lg bg-primary px-4 py-2.5 text-[13.5px] font-semibold text-cream hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Submit for verification
      </button>
    </form>
  );
}

export default async function SupplierHome() {
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.role !== "supplier") redirect("/buyer");

  const supabase = await createClient();
  const [{ data: overall }, { data: sectionRows }, { data: docs }, { data: idc }, { data: certs }] =
    await Promise.all([
      supabase.from("v_supplier_overall").select("overall_status, progress_pct").eq("org_id", me.org_id).maybeSingle(),
      supabase.from("onboarding_sections").select("kind, status").eq("org_id", me.org_id),
      supabase.from("documents").select("id, section_kind, doc_type, fy, status, remediation_reason").eq("org_id", me.org_id),
      supabase.from("identity_checks").select("email_verified, phone_verified, aadhaar_verified, aadhaar_last4").eq("org_id", me.org_id).maybeSingle(),
      supabase.from("certifications").select("id, category, name, field_status").eq("org_id", me.org_id),
    ]);

  const status = overall?.overall_status ?? "To be Started";
  const progress = overall?.progress_pct ?? 0;
  const done = status === "Onboarding Completed";

  const sec: Record<string, string> = {};
  (sectionRows ?? []).forEach((r: any) => (sec[r.kind] = r.status));
  const idS = sec.identity ?? "not_started";
  const finS = sec.financials ?? "not_started";
  const portS = sec.portfolio ?? "not_started";

  const docOf = (type: string, fy: string | null) =>
    (docs ?? []).find((d: any) => d.doc_type === type && (d.fy ?? null) === fy);
  const submittable = (s: string) => ["not_started", "draft", "remediation"].includes(s);
  const sealed = (s: string) => ["submitted_pending", "verified"].includes(s);

  // Identity readiness (mirrors V3 + V4 the DB enforces).
  const idOk =
    !!idc?.email_verified && !!idc?.phone_verified && !!idc?.aadhaar_verified &&
    !!docOf("GST", null) && !!docOf("PAN", null);
  // Financials readiness (V5: 3 distinct FY MGT-7).
  const finReady = FIN_FYS.every((fy) => !!docOf("MGT7", fy));
  const finLocked = idS === "not_started";
  // Portfolio: DB has no gate; require at least one item for a sensible demo.
  const portHasContent = (certs?.length ?? 0) > 0 || !!docOf("FacilityPhoto", null);

  const sectionCard = "mt-6 rounded-[14px] border border-line bg-cream p-6";
  const sectionHead = "font-display text-[16px] font-medium text-ink";
  const sectionDesc = "mt-1 text-[13.5px] text-muted";

  return (
    <>
      <Header me={me} />
      <main className="mx-auto w-full max-w-[900px] flex-1 px-6 pb-20 pt-8">
        <h1 className="font-display text-[26px] font-medium text-ink">Supplier onboarding</h1>
        <p className="mt-1 text-[14px] text-muted">Welcome, {me.full_name}.</p>

        {/* Overall progress */}
        <div className="mt-6 flex items-center gap-5 rounded-[14px] border border-line bg-cream p-6">
          <div className="flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Overall</div>
            <div className="mt-0.5 font-display text-[18px] font-medium text-ink">{status}</div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-panel">
              <div className="h-full rounded-full bg-sage transition-[width]" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className="font-display text-[28px] font-semibold tabular-nums text-primary">{progress}%</div>
        </div>

        {done && (
          <div className="mt-4 rounded-[14px] border border-line bg-sagebg p-4 text-[13.5px] text-sage">
            🎉 Onboarding complete — your profile is now discoverable to buyers.
          </div>
        )}

        {/* ── Section 1 · Identity ─────────────────────────────────────────── */}
        <section className={sectionCard}>
          <div className="flex items-center justify-between gap-3">
            <h2 className={sectionHead}>1 · Identity</h2>
            <Pill status={idS} />
          </div>
          <p className={sectionDesc}>Verify contact &amp; Aadhaar (OTP/KYC), then upload GST and PAN.</p>

          <div className="mt-4 space-y-2">
            <OtpChannel channel="email" label="Email OTP" hint="Simulated — one click to verify" verified={!!idc?.email_verified} />
            <OtpChannel channel="phone" label="Phone OTP" hint="Simulated — one click to verify" verified={!!idc?.phone_verified} />
            <OtpChannel channel="aadhaar" label="Aadhaar KYC" hint="Simulated — stores masked last-4 only" verified={!!idc?.aadhaar_verified} last4={idc?.aadhaar_last4} />
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <DocSlot doc={docOf("GST", null)} section_kind="identity" doc_type="GST" fy={null} label="GST certificate" locked={false} sealed={sealed(idS)} />
            <DocSlot doc={docOf("PAN", null)} section_kind="identity" doc_type="PAN" fy={null} label="PAN card" locked={false} sealed={sealed(idS)} />
          </div>

          <SubmitButton kind="identity" ready={submittable(idS) && idOk} sealed={sealed(idS)} />
        </section>

        {/* ── Section 2 · Financials ───────────────────────────────────────── */}
        <section className={sectionCard}>
          <div className="flex items-center justify-between gap-3">
            <h2 className={sectionHead}>2 · Financials</h2>
            <Pill status={finS} />
          </div>
          <p className={sectionDesc}>
            {finLocked ? "Locked until Identity is submitted." : "Upload MGT-7 for the last three financial years."}
          </p>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {FIN_FYS.map((fy) => (
              <DocSlot
                key={fy}
                doc={docOf("MGT7", fy)}
                section_kind="financials"
                doc_type="MGT7"
                fy={fy}
                label={`MGT-7 · ${fy}`}
                locked={finLocked}
                sealed={sealed(finS)}
              />
            ))}
          </div>

          <SubmitButton kind="financials" ready={submittable(finS) && !finLocked && finReady} sealed={sealed(finS)} />
        </section>

        {/* ── Section 3 · Portfolio ────────────────────────────────────────── */}
        <section className={sectionCard}>
          <div className="flex items-center justify-between gap-3">
            <h2 className={sectionHead}>3 · Portfolio</h2>
            <Pill status={portS} />
          </div>
          <p className={sectionDesc}>Add certifications and a facility photo to showcase your capabilities.</p>

          <div className="mt-4 space-y-2">
            {(certs ?? []).map((c: any) => (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-white px-3 py-2.5 text-[14px]">
                <div>
                  <span className="font-semibold text-ink">{c.name}</span>
                  <span className="ml-2 text-[12px] text-muted">{c.category}</span>
                </div>
                <span className="rounded-full bg-panel px-2 py-0.5 text-[11.5px] capitalize text-muted">
                  {c.field_status}
                </span>
              </div>
            ))}
          </div>

          {!sealed(portS) && (
            <form action={addCertification} className="mt-3 flex flex-wrap items-center gap-2">
              <select name="category" className="rounded-lg border border-line bg-white px-2.5 py-2 text-[13.5px]">
                <option value="ISO">ISO</option>
                <option value="GOTS">GOTS</option>
                <option value="OEKO-TEX">OEKO-TEX</option>
                <option value="Factory Licence">Factory Licence</option>
              </select>
              <input name="name" placeholder="Certificate name (e.g. ISO 9001)" className="min-w-0 flex-1 rounded-lg border border-line bg-white px-2.5 py-2 text-[13.5px]" />
              <button className="rounded-lg border border-line px-3.5 py-2 text-[13px] font-medium text-primary hover:bg-panel">
                Add
              </button>
            </form>
          )}

          <div className="mt-3">
            <DocSlot doc={docOf("FacilityPhoto", null)} section_kind="portfolio" doc_type="FacilityPhoto" fy={null} label="Facility photo" locked={false} sealed={sealed(portS)} />
          </div>

          <SubmitButton kind="portfolio" ready={submittable(portS) && portHasContent} sealed={sealed(portS)} />
        </section>
      </main>
    </>
  );
}
