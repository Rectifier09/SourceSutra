import { redirect } from "next/navigation";
import { getMe } from "@/lib/me";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/app/_components/Header";
import { OtpChannel } from "@/app/supplier/_components/OtpChannel";
import { uploadDoc, removeDoc, addCertification, submitSection } from "@/app/supplier/actions";

const FIN_FYS = ["2023-24", "2022-23", "2021-22"];

const SECTION_PILL: Record<string, { label: string; cls: string }> = {
  not_started: { label: "Not started", cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300" },
  draft: { label: "Draft", cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300" },
  submitted_pending: { label: "In review", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  remediation: { label: "Needs correction", cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  verified: { label: "Verified", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
};
const DOC_CHIP: Record<string, { label: string; cls: string }> = {
  uploaded: { label: "Uploaded", cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300" },
  in_progress: { label: "In review", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  verified: { label: "Verified", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  needs_correction: { label: "Fix needed", cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
};

function Pill({ status }: { status: string }) {
  const p = SECTION_PILL[status] ?? SECTION_PILL.not_started;
  return <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${p.cls}`}>{p.label}</span>;
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
      <div className="flex items-center justify-between gap-3 rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10">
        <div className="min-w-0">
          <div className="font-medium">{label}</div>
          {doc.status === "needs_correction" && doc.remediation_reason && (
            <div className="text-xs text-red-600 dark:text-red-400">{doc.remediation_reason}</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${chip.cls}`}>{chip.label}</span>
          {!sealed && (
            <form action={removeDoc}>
              <input type="hidden" name="doc_id" value={doc.id} />
              <button className="text-xs text-black/40 hover:text-red-600 dark:text-white/40 dark:hover:text-red-400">
                Remove
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }
  return (
    <form
      action={uploadDoc}
      className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-black/15 px-3 py-2 text-sm dark:border-white/15"
    >
      <input type="hidden" name="section_kind" value={section_kind} />
      <input type="hidden" name="doc_type" value={doc_type} />
      {fy && <input type="hidden" name="fy" value={fy} />}
      <span className="text-black/60 dark:text-white/60">{label}</span>
      <button
        disabled={locked}
        className="rounded-md border border-black/15 px-3 py-1 text-xs font-medium hover:bg-black/5 disabled:opacity-40 dark:border-white/20 dark:hover:bg-white/10"
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
        className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
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

  return (
    <>
      <Header me={me} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <h2 className="text-xl font-semibold tracking-tight">Supplier onboarding</h2>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">Welcome, {me.full_name}.</p>

        {/* Overall progress */}
        <div className="mt-6 flex items-center gap-5 rounded-xl border border-black/10 p-5 dark:border-white/15">
          <div className="flex-1">
            <div className="text-xs uppercase tracking-wide text-black/40 dark:text-white/40">Overall</div>
            <div className="mt-0.5 font-medium">{status}</div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
              <div className="h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className="text-2xl font-semibold tabular-nums">{progress}%</div>
        </div>

        {done && (
          <div className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-900/20 dark:text-emerald-300">
            🎉 Onboarding complete — your profile is now discoverable to buyers.
          </div>
        )}

        {/* ── Section 1 · Identity ─────────────────────────────────────────── */}
        <section className="mt-8 rounded-xl border border-black/10 p-5 dark:border-white/15">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">1 · Identity</h3>
            <Pill status={idS} />
          </div>
          <p className="mt-1 text-sm text-black/55 dark:text-white/55">
            Verify contact & Aadhaar (OTP/KYC), then upload GST and PAN.
          </p>

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
        <section className="mt-6 rounded-xl border border-black/10 p-5 dark:border-white/15">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">2 · Financials</h3>
            <Pill status={finS} />
          </div>
          <p className="mt-1 text-sm text-black/55 dark:text-white/55">
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
        <section className="mt-6 rounded-xl border border-black/10 p-5 dark:border-white/15">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">3 · Portfolio</h3>
            <Pill status={portS} />
          </div>
          <p className="mt-1 text-sm text-black/55 dark:text-white/55">
            Add certifications and a facility photo to showcase your capabilities.
          </p>

          <div className="mt-4 space-y-2">
            {(certs ?? []).map((c: any) => (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10">
                <div>
                  <span className="font-medium">{c.name}</span>
                  <span className="ml-2 text-xs text-black/45 dark:text-white/45">{c.category}</span>
                </div>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {c.field_status}
                </span>
              </div>
            ))}
          </div>

          {!sealed(portS) && (
            <form action={addCertification} className="mt-3 flex flex-wrap items-center gap-2">
              <select name="category" className="rounded-md border border-black/15 px-2 py-1.5 text-sm dark:border-white/20 dark:bg-transparent">
                <option value="ISO">ISO</option>
                <option value="GOTS">GOTS</option>
                <option value="OEKO-TEX">OEKO-TEX</option>
                <option value="Factory Licence">Factory Licence</option>
              </select>
              <input name="name" placeholder="Certificate name (e.g. ISO 9001)" className="min-w-0 flex-1 rounded-md border border-black/15 px-2 py-1.5 text-sm dark:border-white/20 dark:bg-transparent" />
              <button className="rounded-md border border-black/15 px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10">
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
