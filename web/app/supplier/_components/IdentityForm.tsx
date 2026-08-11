"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveIdentity, verifyChannel, submitOnboardingSection } from "@/app/supplier/actions";
import { uploadOnboardingFile, removeOnboardingFile } from "@/lib/upload";

const DESIGNATIONS = ["Managing Partner", "Director", "Owner", "Proprietor", "CEO", "Operations Head", "Export Manager", "Founder", "Other"];
const LANGUAGES = ["English", "Hindi", "Tamil", "Punjabi", "Gujarati", "Bengali", "Telugu", "Marathi"];
const DEMO_OTP = { email: "2468", phone: "7351", aadhaar: "482917" };

const labelCls = "text-[13px] font-semibold text-muted";
const inputCls = "rounded-lg border border-line bg-white px-3 py-2.5 text-[14.5px] text-ink placeholder:text-muted/60";
const cardCls = "rounded-[14px] border border-line bg-cream p-6";
const req = <span className="text-terra">*</span>;
const rand4 = () => String(Math.floor(1000 + Math.random() * 9000));

type Director = { name: string; contact: string; email: string; aadhaarVerified: boolean; aadhaarLast4: string };
type Doc = { type: "GST" | "PAN" | "MSME" | "CIN"; number: string; uploaded: boolean; storagePath?: string; fileName?: string };

export function IdentityForm({
  orgId,
  initial,
  verified,
  directors: initialDirectors,
  docs: initialDocs,
}: {
  orgId: string;
  initial: {
    company: string; contactName: string; designation: string; email: string; emailLanguage: string;
    phone: string; altContact: string; website: string; established: string; yearsInBusiness: string; natureOfBusiness: string;
  };
  verified: { email: boolean; phone: boolean; aadhaar: boolean; aadhaarLast4: string };
  directors: Director[];
  docs: Doc[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState(initial);
  const [dirs, setDirs] = useState<Director[]>(initialDirectors);
  const [docs, setDocs] = useState<Doc[]>(initialDocs.length ? initialDocs : (["GST", "PAN", "MSME", "CIN"] as const).map((t) => ({ type: t, number: "", uploaded: false })));

  const [emailV, setEmailV] = useState(verified.email);
  const [phoneV, setPhoneV] = useState(verified.phone);
  const [aadhaarV, setAadhaarV] = useState(verified.aadhaar);
  const [aLast4, setALast4] = useState(verified.aadhaarLast4);
  const [stage, setStage] = useState<{ email: boolean; phone: boolean; aadhaar: boolean }>({ email: false, phone: false, aadhaar: false });

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const setDoc = (i: number, patch: Partial<Doc>) => setDocs((d) => d.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const uploadDocFile = (i: number, file: File) =>
    start(async () => {
      const path = await uploadOnboardingFile(orgId, "identity", docs[i].type, file);
      setDoc(i, { uploaded: true, storagePath: path, fileName: file.name });
    });
  const removeDocFile = (i: number) => {
    const path = docs[i].storagePath;
    setDoc(i, { uploaded: false, storagePath: undefined, fileName: undefined });
    void removeOnboardingFile(path);
  };

  const confirm = (ch: "email" | "phone" | "aadhaar") => {
    const last4 = ch === "aadhaar" ? rand4() : undefined;
    start(async () => {
      await verifyChannel(ch, last4);
      if (ch === "email") setEmailV(true);
      if (ch === "phone") setPhoneV(true);
      if (ch === "aadhaar") {
        setAadhaarV(true);
        setALast4(last4 ?? "");
      }
      setStage((s) => ({ ...s, [ch]: false }));
    });
  };

  const payload = () => ({ ...f, directors: dirs, docs });
  const gst = docs.find((d) => d.type === "GST");
  const pan = docs.find((d) => d.type === "PAN");
  const canSubmit =
    !!(f.company && f.contactName && f.designation && f.established && f.yearsInBusiness && f.natureOfBusiness) &&
    emailV && phoneV && aadhaarV && !!gst?.uploaded && !!pan?.uploaded;

  const save = () => start(async () => { await saveIdentity(payload()); });
  const submit = () =>
    start(async () => {
      await saveIdentity(payload());
      await submitOnboardingSection("identity");
      router.push("/supplier");
    });

  const ActionBar = ({ sticky }: { sticky?: boolean }) => (
    <div className={sticky ? "sticky bottom-0 flex justify-end gap-2.5 border-t border-line bg-cream px-1 py-3.5" : "flex flex-wrap gap-2.5"}>
      <Link href="/supplier" className="rounded-lg border border-line px-4 py-2.5 text-[13.5px] text-muted hover:bg-panel">Cancel</Link>
      <button onClick={save} disabled={pending} className="rounded-lg border border-primary px-4 py-2.5 text-[13.5px] font-medium text-primary hover:bg-lav1 disabled:opacity-50">Save draft</button>
      <button onClick={submit} disabled={pending || !canSubmit} className="rounded-lg bg-primary px-4 py-2.5 text-[13.5px] font-semibold text-cream hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">Submit for verification</button>
    </div>
  );

  return (
    <main className="mx-auto w-full max-w-[820px] px-6 pb-28 pt-6">
      <Link href="/supplier" className="inline-block py-3 text-[14px] text-primary">← Back to overview</Link>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-medium text-ink">Identity</h1>
          <p className="text-[12.5px] text-muted">Fields marked with {req} are required.</p>
        </div>
        <ActionBar />
      </div>

      {/* Company identity */}
      <div className={`${cardCls} mb-5`}>
        <h2 className="mb-4 font-display text-[18px] font-medium text-ink">Company identity</h2>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Company / firm name {req}</span>
            <input value={f.company} onChange={set("company")} placeholder="e.g. Anand Knitfab" className={inputCls} />
          </label>
          <div className="flex flex-wrap gap-3.5">
            <label className="flex flex-1 flex-col gap-1.5" style={{ minWidth: 240 }}>
              <span className={labelCls}>Primary contact — name {req}</span>
              <input value={f.contactName} onChange={set("contactName")} placeholder="e.g. Suresh Anand" className={inputCls} />
            </label>
            <label className="flex flex-1 flex-col gap-1.5" style={{ minWidth: 200 }}>
              <span className={labelCls}>Designation {req}</span>
              <select value={f.designation} onChange={set("designation")} className={inputCls}>
                <option value="">Select…</option>
                {DESIGNATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
          </div>

          {/* Aadhaar */}
          <div className="rounded-[10px] border border-line bg-panel p-4">
            <div className="mb-2 text-[13px] font-semibold text-muted">Aadhaar</div>
            {aadhaarV ? (
              <div className="text-[13.5px] font-semibold text-sage">✓ Verified via Aadhaar OTP <span className="font-normal text-muted">— XXXX-XXXX-{aLast4 || "••••"}</span></div>
            ) : stage.aadhaar ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] text-muted">Demo OTP sent — enter <b>{DEMO_OTP.aadhaar}</b></span>
                <input placeholder="Enter OTP" className="w-[110px] rounded-md border border-line bg-white px-2.5 py-2 text-[13.5px]" />
                <button onClick={() => confirm("aadhaar")} className="rounded-md bg-primary px-3.5 py-2 text-[13px] text-cream hover:opacity-90">Confirm</button>
              </div>
            ) : (
              <button onClick={() => setStage((s) => ({ ...s, aadhaar: true }))} className="rounded-[7px] border border-primary bg-white px-4 py-2 text-[13.5px] text-primary hover:bg-lav1">Verify via Aadhaar OTP</button>
            )}
            <div className="mt-2 text-[11.5px] text-muted">Only the verification result is kept — never the Aadhaar number or a copy of the card.</div>
          </div>

          {/* Email + phone with OTP */}
          {(["email", "phone"] as const).map((ch) => {
            const isV = ch === "email" ? emailV : phoneV;
            return (
              <div key={ch} className="flex flex-wrap gap-3.5">
                <div className="flex flex-1 flex-col gap-1.5" style={{ minWidth: 240 }}>
                  <span className={labelCls}>{ch === "email" ? "Email" : "Primary phone"} {req}</span>
                  <input value={ch === "email" ? f.email : f.phone} onChange={ch === "email" ? set("email") : set("phone")} placeholder={ch === "email" ? "owner@company.in" : "+91 98430 11267"} className={inputCls} />
                  {isV ? (
                    <span className="text-[12.5px] font-semibold text-sage">✓ Verified</span>
                  ) : stage[ch] ? (
                    <div className="flex items-center gap-1.5">
                      <input placeholder={`Enter OTP (${DEMO_OTP[ch]})`} className="w-[130px] rounded-md border border-line bg-white px-2 py-1.5 text-[13px]" />
                      <button onClick={() => confirm(ch)} className="rounded-md bg-primary px-3 py-1.5 text-[12.5px] text-cream hover:opacity-90">Confirm</button>
                    </div>
                  ) : (
                    <button onClick={() => setStage((s) => ({ ...s, [ch]: true }))} className="self-start rounded-md border border-line bg-white px-3 py-1.5 text-[12.5px] text-primary hover:bg-panel">Send OTP to verify</button>
                  )}
                </div>
                {ch === "email" ? (
                  <label className="flex flex-1 flex-col gap-1.5" style={{ minWidth: 200 }}>
                    <span className={labelCls}>Email language preference</span>
                    <select value={f.emailLanguage} onChange={set("emailLanguage")} className={inputCls}>
                      {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </label>
                ) : (
                  <label className="flex flex-1 flex-col gap-1.5" style={{ minWidth: 200 }}>
                    <span className={labelCls}>Alternate contact</span>
                    <input value={f.altContact} onChange={set("altContact")} placeholder="+91 —" className={inputCls} />
                  </label>
                )}
              </div>
            );
          })}

          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Company website</span>
            <input value={f.website} onChange={set("website")} placeholder="https://" className={inputCls} />
          </label>
        </div>
      </div>

      {/* Directors */}
      <div className={`${cardCls} mb-5`}>
        <div className="mb-3.5 flex items-center justify-between">
          <h2 className="font-display text-[18px] font-medium text-ink">Company directors</h2>
          <button onClick={() => setDirs((d) => [...d, { name: "", contact: "", email: "", aadhaarVerified: false, aadhaarLast4: "" }])} className="rounded-[7px] border border-primary px-3.5 py-2 text-[13px] text-primary hover:bg-lav1">+ Add director</button>
        </div>
        {dirs.length === 0 && <p className="text-[13.5px] text-muted">No directors added yet.</p>}
        <div className="flex flex-col gap-3.5">
          {dirs.map((d, i) => (
            <div key={i} className="rounded-[10px] border border-line bg-white p-4">
              <div className="flex justify-end">
                <button onClick={() => setDirs((x) => x.filter((_, j) => j !== i))} className="text-[12.5px] text-terra">Remove</button>
              </div>
              <div className="mb-2.5 flex flex-wrap gap-3">
                <input value={d.name} onChange={(e) => setDirs((x) => x.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} placeholder="Director name" className="flex-1 rounded-md border border-line px-3 py-2 text-[13.5px]" style={{ minWidth: 180 }} />
                <input value={d.contact} onChange={(e) => setDirs((x) => x.map((y, j) => (j === i ? { ...y, contact: e.target.value } : y)))} placeholder="Contact number" className="flex-1 rounded-md border border-line px-3 py-2 text-[13.5px]" style={{ minWidth: 150 }} />
                <input value={d.email} onChange={(e) => setDirs((x) => x.map((y, j) => (j === i ? { ...y, email: e.target.value } : y)))} placeholder="Contact email" className="flex-1 rounded-md border border-line px-3 py-2 text-[13.5px]" style={{ minWidth: 180 }} />
              </div>
              {d.aadhaarVerified ? (
                <div className="text-[12.5px] font-semibold text-sage">✓ Verified via Aadhaar OTP — XXXX-XXXX-{d.aadhaarLast4 || "••••"}</div>
              ) : (
                <button onClick={() => setDirs((x) => x.map((y, j) => (j === i ? { ...y, aadhaarVerified: true, aadhaarLast4: rand4() } : y)))} className="rounded-md border border-primary bg-white px-3 py-1.5 text-[12.5px] text-primary hover:bg-lav1">Verify via Aadhaar OTP</button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* General information + registration docs */}
      <div className={`${cardCls} mb-5`}>
        <h2 className="mb-4 font-display text-[18px] font-medium text-ink">General information</h2>
        <div className="mb-4 flex flex-wrap gap-3.5">
          <label className="flex flex-1 flex-col gap-1.5" style={{ minWidth: 200 }}>
            <span className={labelCls}>Established date {req}</span>
            <input type="date" value={f.established} onChange={set("established")} className={inputCls} />
          </label>
          <label className="flex flex-1 flex-col gap-1.5" style={{ minWidth: 200 }}>
            <span className={labelCls}>Years in business {req}</span>
            <input value={f.yearsInBusiness} onChange={set("yearsInBusiness")} placeholder="e.g. 15" className={inputCls} />
          </label>
        </div>
        <label className="mb-5 flex flex-col gap-1.5">
          <span className={labelCls}>Nature of business {req}</span>
          <input value={f.natureOfBusiness} onChange={set("natureOfBusiness")} placeholder="e.g. Knit fabric manufacturing & garment CMT" className={inputCls} />
        </label>

        <div className="flex flex-col gap-4">
          {docs.map((d, i) => (
            <div key={d.type} className="rounded-[10px] border border-line bg-white p-4">
              <div className="mb-2.5 flex items-center justify-between gap-2.5">
                <span className={labelCls}>{d.type} number{d.type === "GST" || d.type === "PAN" ? " *" : ""}</span>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${d.uploaded ? "bg-sagebg text-sage" : "bg-panel text-muted"}`}>{d.uploaded ? "Uploaded" : "Pending"}</span>
              </div>
              <input value={d.number} onChange={(e) => setDoc(i, { number: e.target.value })} placeholder="Enter number" className="mb-2.5 w-full rounded-md border border-line px-3 py-2.5 text-[14px]" />
              {d.uploaded ? (
                <div className="flex items-center justify-between gap-2.5 rounded-lg border border-line bg-panel px-3.5 py-2.5">
                  <span className="text-[13px] text-ink">📄 {d.fileName ?? `${d.type.toLowerCase()}-certificate.pdf`}</span>
                  <button onClick={() => removeDocFile(i)} className="text-[12.5px] text-terra">Remove</button>
                </div>
              ) : (
                <label className="block w-full cursor-pointer rounded-lg border border-dashed border-lav3 bg-panel px-3.5 py-2.5 text-center text-[13px] text-primary hover:bg-lav1">
                  {pending ? "Uploading…" : "Upload document"}
                  <input
                    type="file"
                    className="hidden"
                    disabled={pending}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadDocFile(i, file);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>
          ))}
        </div>
      </div>

      <ActionBar sticky />
    </main>
  );
}
