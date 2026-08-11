"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveFinancials, submitOnboardingSection } from "@/app/supplier/actions";

const ROUTING_TYPES = ["IFSC", "SWIFT", "Routing Number", "IBAN", "Other"];
const labelCls = "text-[13px] font-semibold text-muted";
const inputCls = "rounded-lg border border-line bg-white px-3 py-2.5 text-[14.5px] text-ink placeholder:text-muted/60";
const cardCls = "rounded-[14px] border border-line bg-cream p-6";
const req = <span className="text-terra">*</span>;

type Addr = Record<string, string>;
type Mgt = { year: string; uploaded: boolean };

function AddressGrid({ v, on, tax }: { v: Addr; on: (k: string, val: string) => void; tax?: boolean }) {
  const cell = "rounded-lg border border-line bg-white px-3 py-2.5 text-[14px]";
  return (
    <div className="flex flex-col gap-3">
      <input value={v.line1 ?? ""} onChange={(e) => on("line1", e.target.value)} placeholder="Address line 1 *" className={cell} />
      <input value={v.line2 ?? ""} onChange={(e) => on("line2", e.target.value)} placeholder="Address line 2" className={cell} />
      <div className="flex flex-wrap gap-3">
        <input value={v.landmark ?? ""} onChange={(e) => on("landmark", e.target.value)} placeholder="Landmark" className={`${cell} flex-1`} style={{ minWidth: 160 }} />
        <input value={v.city ?? ""} onChange={(e) => on("city", e.target.value)} placeholder="City *" className={`${cell} flex-1`} style={{ minWidth: 120 }} />
        <input value={v.state ?? ""} onChange={(e) => on("state", e.target.value)} placeholder="State *" className={`${cell} flex-1`} style={{ minWidth: 120 }} />
        <input value={v.pincode ?? ""} onChange={(e) => on("pincode", e.target.value)} placeholder="Pincode *" className={`${cell} flex-1`} style={{ minWidth: 90 }} />
      </div>
      {tax && <input value={v.taxCode ?? ""} onChange={(e) => on("taxCode", e.target.value)} placeholder="Tax code" className={cell} />}
    </div>
  );
}

export function FinancialsForm({
  initial,
  mgt7: initialMgt,
  singleDocs,
  otherDocs: initialOther,
}: {
  initial: { bankCountry: string; bankName: string; beneficiaryName: string; routingType: string; routingCode: string; accountNumber: string; billing: Addr; legal: Addr };
  mgt7: Mgt[];
  singleDocs: { signedForm: boolean; rpt: boolean; taxDoc: boolean };
  otherDocs: { fileName: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState(initial);
  const [confirmAcct, setConfirmAcct] = useState(initial.accountNumber);
  const [billing, setBilling] = useState<Addr>(initial.billing ?? {});
  const [legal, setLegal] = useState<Addr>(initial.legal ?? {});
  const [taxDoc, setTaxDoc] = useState(singleDocs.taxDoc);
  const [mgt7, setMgt7] = useState<Mgt[]>(initialMgt);
  const [signedForm, setSignedForm] = useState(singleDocs.signedForm);
  const [rpt, setRpt] = useState(singleDocs.rpt);
  const [other, setOther] = useState<{ fileName: string }[]>(initialOther);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const acctMismatch = !!f.accountNumber && !!confirmAcct && f.accountNumber !== confirmAcct;

  const payload = () => ({
    bankCountry: f.bankCountry, bankName: f.bankName, beneficiaryName: f.beneficiaryName,
    routingType: f.routingType, routingCode: f.routingCode, accountNumber: f.accountNumber,
    billing, legal, mgt7, signedForm, rpt, taxDoc, otherDocs: other,
  });

  const canSubmit = !!(f.bankName && f.beneficiaryName && f.routingCode && f.accountNumber && !acctMismatch) && mgt7.filter((m) => m.uploaded).length >= 3;

  const save = () => start(async () => { await saveFinancials(payload()); });
  const submit = () => start(async () => { await saveFinancials(payload()); await submitOnboardingSection("financials"); router.push("/supplier"); });

  const ActionBar = ({ sticky }: { sticky?: boolean }) => (
    <div className={sticky ? "sticky bottom-0 flex justify-end gap-2.5 border-t border-line bg-cream px-1 py-3.5" : "flex flex-wrap gap-2.5"}>
      <Link href="/supplier" className="rounded-lg border border-line px-4 py-2.5 text-[13.5px] text-muted hover:bg-panel">Cancel</Link>
      <button onClick={save} disabled={pending} className="rounded-lg border border-primary px-4 py-2.5 text-[13.5px] font-medium text-primary hover:bg-lav1 disabled:opacity-50">Save draft</button>
      <button onClick={submit} disabled={pending || !canSubmit} className="rounded-lg bg-primary px-4 py-2.5 text-[13.5px] font-semibold text-cream hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">Submit for verification</button>
    </div>
  );

  const UploadRow = ({ label, on, uploaded, off }: { label: string; on: () => void; uploaded: boolean; off: () => void }) => (
    <div className="rounded-lg border border-line bg-white p-3.5">
      <div className="mb-2 text-[13px] font-semibold text-muted">{label}</div>
      {uploaded ? (
        <div className="flex items-center gap-2.5 text-[12.5px] text-ink">📄 uploaded.pdf <button onClick={off} className="text-terra">Remove</button></div>
      ) : (
        <button onClick={on} className="rounded-[7px] border border-dashed border-lav3 bg-panel px-3.5 py-2 text-[12.5px] text-primary hover:bg-lav1">Upload</button>
      )}
    </div>
  );

  return (
    <main className="mx-auto w-full max-w-[820px] px-6 pb-28 pt-6">
      <Link href="/supplier" className="inline-block py-3 text-[14px] text-primary">← Back to overview</Link>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-medium text-ink">Financials</h1>
          <p className="text-[12.5px] text-muted">Fields marked with {req} are required.</p>
        </div>
        <ActionBar />
      </div>

      {/* Bank details */}
      <div className={`${cardCls} mb-5`}>
        <h2 className="mb-4 font-display text-[18px] font-medium text-ink">Bank details</h2>
        <div className="flex flex-col gap-3.5">
          <div className="flex flex-wrap gap-3.5">
            <label className="flex flex-1 flex-col gap-1.5" style={{ minWidth: 200 }}>
              <span className={labelCls}>Bank account country</span>
              <input value={f.bankCountry} onChange={set("bankCountry")} className={inputCls} />
            </label>
            <label className="flex flex-1 flex-col gap-1.5" style={{ minWidth: 200 }}>
              <span className={labelCls}>Bank name {req}</span>
              <input value={f.bankName} onChange={set("bankName")} placeholder="e.g. HDFC Bank" className={inputCls} />
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Beneficiary name {req}</span>
            <input value={f.beneficiaryName} onChange={set("beneficiaryName")} className={inputCls} />
          </label>
          <div className="flex flex-wrap gap-3.5">
            <label className="flex flex-1 flex-col gap-1.5" style={{ minWidth: 200 }}>
              <span className={labelCls}>Routing type</span>
              <select value={f.routingType} onChange={set("routingType")} className={inputCls}>
                {ROUTING_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label className="flex flex-1 flex-col gap-1.5" style={{ minWidth: 200 }}>
              <span className={labelCls}>Routing code {req}</span>
              <input value={f.routingCode} onChange={set("routingCode")} placeholder="e.g. HDFC0001234" className={inputCls} />
            </label>
          </div>
          <div className="flex flex-wrap gap-3.5">
            <label className="flex flex-1 flex-col gap-1.5" style={{ minWidth: 200 }}>
              <span className={labelCls}>Account number {req}</span>
              <input value={f.accountNumber} onChange={set("accountNumber")} className={inputCls} />
            </label>
            <label className="flex flex-1 flex-col gap-1.5" style={{ minWidth: 200 }}>
              <span className={labelCls}>Confirm account number {req}</span>
              <input value={confirmAcct} onChange={(e) => setConfirmAcct(e.target.value)} className={`rounded-lg border bg-white px-3 py-2.5 text-[14.5px] ${acctMismatch ? "border-terra" : "border-line"}`} />
            </label>
          </div>
          {acctMismatch && <div className="text-[12.5px] text-terra">Account numbers don&apos;t match.</div>}
        </div>
      </div>

      {/* Billing address */}
      <div className={`${cardCls} mb-5`}>
        <h2 className="mb-4 font-display text-[18px] font-medium text-ink">Billing address</h2>
        <AddressGrid v={billing} on={(k, val) => setBilling((b) => ({ ...b, [k]: val }))} />
      </div>

      {/* Legal entity address */}
      <div className={`${cardCls} mb-5`}>
        <h2 className="mb-4 font-display text-[18px] font-medium text-ink">Legal entity address</h2>
        <AddressGrid v={legal} on={(k, val) => setLegal((l) => ({ ...l, [k]: val }))} tax />
        <div className="mt-4">
          <UploadRow label="Tax documents" uploaded={taxDoc} on={() => setTaxDoc(true)} off={() => setTaxDoc(false)} />
        </div>
      </div>

      {/* Company documents */}
      <div className={`${cardCls} mb-5`}>
        <h2 className="mb-1 font-display text-[18px] font-medium text-ink">Company documents</h2>
        <div className="mb-3 text-[13px] font-semibold text-muted">Form MGT-7 with challan — last three financial years {req}</div>
        <div className="mb-5 flex flex-col gap-2.5">
          {mgt7.map((m, i) => (
            <div key={m.year} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-white px-3.5 py-2.5">
              <span className="min-w-[110px] text-[13px] font-semibold text-ink">{m.year}</span>
              {m.uploaded ? (
                <>
                  <span className="text-[12.5px] text-ink">📄 mgt7-{m.year}.pdf</span>
                  <button onClick={() => setMgt7((x) => x.map((y, j) => (j === i ? { ...y, uploaded: false } : y)))} className="text-[12px] text-terra">Remove</button>
                </>
              ) : (
                <button onClick={() => setMgt7((x) => x.map((y, j) => (j === i ? { ...y, uploaded: true } : y)))} className="rounded-[7px] border border-dashed border-lav3 bg-panel px-3 py-1.5 text-[12.5px] text-primary hover:bg-lav1">Upload</button>
              )}
            </div>
          ))}
        </div>

        <div className="mb-4 flex flex-col gap-3">
          <UploadRow label="Signed copy of the company form" uploaded={signedForm} on={() => setSignedForm(true)} off={() => setSignedForm(false)} />
          <UploadRow label="Declaration of related-party transactions (RPT)" uploaded={rpt} on={() => setRpt(true)} off={() => setRpt(false)} />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-muted">Other supporting documents</span>
          <button onClick={() => setOther((o) => [...o, { fileName: `document-${o.length + 1}.pdf` }])} className="rounded-[7px] border border-primary px-3 py-1.5 text-[12.5px] text-primary hover:bg-lav1">+ Add document</button>
        </div>
        <div className="mt-2.5 flex flex-col gap-2.5">
          {other.map((o, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-line bg-white px-3.5 py-2.5 text-[12.5px] text-ink">
              📄 {o.fileName}
              <button onClick={() => setOther((x) => x.filter((_, j) => j !== i))} className="ml-auto text-terra">Remove</button>
            </div>
          ))}
        </div>
      </div>

      <ActionBar sticky />
    </main>
  );
}
