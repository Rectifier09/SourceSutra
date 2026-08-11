"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { savePortfolio, submitOnboardingSection } from "@/app/supplier/actions";
import { uploadOnboardingFile, removeOnboardingFile } from "@/lib/upload";

const CAPABILITIES = ["Fabric", "Colour", "GSM", "Fit", "Labels", "Hangtags", "Hardware", "Packaging", "Pattern", "Embroidery", "Printing"];
const CERT_CATEGORIES = ["Quality Management", "Environmental Management", "Health & Safety", "Social Compliance", "Sustainable & Organic Textiles", "Recycled Materials", "Chemical & Product Safety", "Responsible Materials", "Indian Regulatory & Legal Compliance", "Buyer / Brand Audits", "Other"];
const AUDIT_TYPES = ["Social compliance audit", "Quality audit", "Environmental audit", "Technical audit"];
const OUTCOMES = ["Passed", "Passed with corrective actions", "Failed", "Pending"];
const ROLES = ["Sub-Contractor", "Primary Contractor", "Supplier"];
const FREQS = ["One-time", "Recurring", "Annual Maintenance Contract"];
const SUGGESTED = ["Knitted fabric", "Woven fabric", "Garment CMT", "Dyeing & processing", "Embroidery", "Trims & accessories", "Home textiles", "Greige fabric"];

const labelCls = "text-[13px] font-semibold text-muted";
const inputCls = "rounded-lg border border-line bg-white px-3 py-2.5 text-[14px] text-ink placeholder:text-muted/60";
const smallInput = "rounded-md border border-line bg-white px-3 py-2 text-[13.5px]";
const cardCls = "rounded-[14px] border border-line bg-cream p-6";
const req = <span className="text-terra">*</span>;

type Product = { name: string; category: string; material: string; moq: string; priceRange: string };
type Work = { clientName: string; role: string; frequency: string; startYear: string; endYear: string; description: string };
type MediaItem = { fileName: string; storagePath?: string };
type Cert = {
  category: string; name: string; number: string; issuingBody: string; scope: string; facility: string;
  issueDate: string; expiryDate: string; doesNotExpire: boolean; lastAuditDate: string; nextAuditDate: string;
  verificationUrl: string; buyerName: string; auditType: string; auditDate: string; outcome: string;
};
const emptyCert = (): Cert => ({ category: "", name: "", number: "", issuingBody: "", scope: "", facility: "", issueDate: "", expiryDate: "", doesNotExpire: false, lastAuditDate: "", nextAuditDate: "", verificationUrl: "", buyerName: "", auditType: "", auditDate: "", outcome: "" });

export function PortfolioForm({
  orgId,
  initial,
  certs: initialCerts,
}: {
  orgId: string;
  initial: {
    mission: string; logoUploaded: boolean; logoPath?: string; production: Record<string, string>; tradeTerms: Record<string, string>;
    capabilities: string[]; products: Product[]; facilityPhotos: MediaItem[]; workHistory: Work[]; catalogue: MediaItem[]; tags: string[];
  };
  certs: Cert[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mission, setMission] = useState(initial.mission);
  const [logo, setLogo] = useState<{ uploaded: boolean; storagePath?: string }>({ uploaded: initial.logoUploaded, storagePath: initial.logoPath });
  const [prod, setProd] = useState<Record<string, string>>(initial.production ?? {});
  const [trade, setTrade] = useState<Record<string, string>>(initial.tradeTerms ?? {});
  const [caps, setCaps] = useState<string[]>(initial.capabilities ?? []);
  const [products, setProducts] = useState<Product[]>(initial.products ?? []);
  const [openP, setOpenP] = useState<number | null>(null);
  const [certs, setCerts] = useState<Cert[]>(initialCerts ?? []);
  const [openC, setOpenC] = useState<number | null>(null);
  const [photos, setPhotos] = useState<MediaItem[]>(initial.facilityPhotos ?? []);
  const [work, setWork] = useState<Work[]>(initial.workHistory ?? []);
  const [openW, setOpenW] = useState<number | null>(null);
  const [cat, setCat] = useState<MediaItem[]>(initial.catalogue ?? []);
  const [tags, setTags] = useState<string[]>(initial.tags ?? []);
  const [tagDraft, setTagDraft] = useState("");

  const setPr = (i: number, k: keyof Product, v: string) => setProducts((x) => x.map((y, j) => (j === i ? { ...y, [k]: v } : y)));
  const setW = (i: number, k: keyof Work, v: string) => setWork((x) => x.map((y, j) => (j === i ? { ...y, [k]: v } : y)));
  const setC = (i: number, patch: Partial<Cert>) => setCerts((x) => x.map((y, j) => (j === i ? { ...y, ...patch } : y)));
  const addTag = (v: string) => { const t = v.trim(); if (t && !tags.includes(t)) setTags((x) => [...x, t]); setTagDraft(""); };

  const uploadLogo = (file: File) =>
    start(async () => {
      const path = await uploadOnboardingFile(orgId, "portfolio", "logo", file);
      setLogo({ uploaded: true, storagePath: path });
    });
  const removeLogo = () => {
    void removeOnboardingFile(logo.storagePath);
    setLogo({ uploaded: false });
  };
  const uploadPhoto = (file: File) =>
    start(async () => {
      const path = await uploadOnboardingFile(orgId, "portfolio", `facility-${photos.length + 1}`, file);
      setPhotos((p) => [...p, { fileName: file.name, storagePath: path }]);
    });
  const removePhoto = (i: number) => {
    void removeOnboardingFile(photos[i].storagePath);
    setPhotos((p) => p.filter((_, j) => j !== i));
  };
  const uploadCatalogueImg = (file: File) =>
    start(async () => {
      const path = await uploadOnboardingFile(orgId, "portfolio", `catalogue-${cat.length + 1}`, file);
      setCat((c) => [...c, { fileName: file.name, storagePath: path }]);
    });
  const removeCatalogueImg = (i: number) => {
    void removeOnboardingFile(cat[i].storagePath);
    setCat((c) => c.filter((_, j) => j !== i));
  };

  const payload = () => ({
    mission, logoUploaded: logo.uploaded, logoPath: logo.storagePath, production: prod, tradeTerms: trade, capabilities: caps,
    products, facilityPhotos: photos, workHistory: work, catalogue: cat, tags, certs,
  });
  const canSubmit = !!(mission.trim() && logo.uploaded && products.some((p) => p.name.trim()));

  const save = () => start(async () => { await savePortfolio(payload()); });
  const submit = () => start(async () => { await savePortfolio(payload()); await submitOnboardingSection("portfolio"); router.push("/supplier"); });

  const ActionBar = ({ sticky }: { sticky?: boolean }) => (
    <div className={sticky ? "sticky bottom-0 flex justify-end gap-2.5 border-t border-line bg-cream px-1 py-3.5" : "flex flex-wrap gap-2.5"}>
      <Link href="/supplier" className="rounded-lg border border-line px-4 py-2.5 text-[13.5px] text-muted hover:bg-panel">Cancel</Link>
      <button onClick={save} disabled={pending} className="rounded-lg border border-primary px-4 py-2.5 text-[13.5px] font-medium text-primary hover:bg-lav1 disabled:opacity-50">Save draft</button>
      <button onClick={submit} disabled={pending || !canSubmit} className="rounded-lg bg-primary px-4 py-2.5 text-[13.5px] font-semibold text-cream hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">Submit portfolio</button>
    </div>
  );

  const Tiles = ({ items, onAddFile, onRemove, addLabel, withName }: { items: MediaItem[]; onAddFile: (file: File) => void; onRemove: (i: number) => void; addLabel: string; withName?: boolean }) => (
    <div className="flex flex-wrap gap-3.5">
      {items.map((it, i) => (
        <div key={i} className="relative h-[140px] w-[140px] overflow-hidden rounded-[10px] border border-line" style={{ background: "repeating-linear-gradient(135deg,#EDECF6,#EDECF6 8px,#E4E2F0 8px,#E4E2F0 16px)" }}>
          {withName && <div className="absolute bottom-0 w-full truncate bg-primary/85 px-2 py-1.5 text-[11px] text-cream">{it.fileName}</div>}
          <button onClick={() => onRemove(i)} className="absolute right-1 top-1 flex h-[22px] w-[22px] items-center justify-center rounded-md text-[13px] text-cream" style={{ background: "rgba(32,32,43,0.7)" }}>×</button>
        </div>
      ))}
      <label className="flex h-[140px] w-[140px] cursor-pointer items-center justify-center rounded-[10px] border border-dashed border-lav3 bg-panel text-center text-[13px] text-primary hover:bg-lav1">
        {pending ? "Uploading…" : addLabel}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={pending}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onAddFile(file);
            e.target.value = "";
          }}
        />
      </label>
    </div>
  );

  return (
    <main className="mx-auto w-full max-w-[820px] px-6 pb-28 pt-6">
      <Link href="/supplier" className="inline-block py-3 text-[14px] text-primary">← Back to overview</Link>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-medium text-ink">Portfolio</h1>
          <p className="text-[12.5px] text-muted">Fields marked with {req} are required.</p>
        </div>
        <ActionBar />
      </div>

      {/* Logo & mission */}
      <div className={`${cardCls} mb-5`}>
        <h2 className="mb-1 font-display text-[18px] font-medium text-ink">Company logo &amp; mission</h2>
        <p className="mb-4 text-[13px] text-muted">Your identity on customer-facing cards and your profile.</p>
        <div className="flex flex-wrap items-start gap-5">
          <div>
            <div className="mb-2 text-[13px] font-semibold text-muted">Company logo {req}</div>
            <div className="relative h-24 w-24 overflow-hidden rounded-[14px] border border-line">
              {logo.uploaded ? (
                <>
                  <div className="flex h-full w-full items-center justify-center font-display text-[13px] text-primary" style={{ background: "repeating-linear-gradient(135deg,#EDECF6,#EDECF6 8px,#E4E2F0 8px,#E4E2F0 16px)" }}>Logo</div>
                  <button onClick={removeLogo} className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-md text-[12px] text-cream" style={{ background: "rgba(32,32,43,0.7)" }}>×</button>
                </>
              ) : (
                <label className="flex h-full w-full cursor-pointer items-center justify-center border border-dashed border-lav3 bg-panel text-center text-[11.5px] text-primary">
                  {pending ? "Uploading…" : "Upload logo"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={pending}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadLogo(file);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>
          </div>
          <div className="min-w-[240px] flex-1">
            <div className="mb-2 text-[13px] font-semibold text-muted">Company mission {req}</div>
            <input value={mission} maxLength={100} onChange={(e) => setMission(e.target.value)} placeholder="e.g. Precision knit fabric, delivered on time, every time." className={`w-full ${inputCls}`} />
            <div className="mt-1.5 flex justify-between text-[11.5px] text-muted">
              <span>This is your headline, visible to customers.</span>
              <span>{mission.length}/100</span>
            </div>
          </div>
        </div>
      </div>

      {/* Production snapshot */}
      <div className={`${cardCls} mb-5`}>
        <h2 className="font-display text-[18px] font-medium text-ink">Production snapshot {req}</h2>
        <p className="mb-4 text-[13px] text-muted">Self-declared — shown to customers as reported by you.</p>
        <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
          {[["factoryArea", "Factory area (e.g. 12,500 m²)"], ["employees", "Number of employees"], ["monthlyCapacity", "Monthly capacity (e.g. 45,000 pcs)"], ["productionLines", "Number of production lines"]].map(([k, ph]) => (
            <input key={k} value={prod[k] ?? ""} onChange={(e) => setProd((p) => ({ ...p, [k]: e.target.value }))} placeholder={ph} className={smallInput} />
          ))}
        </div>
      </div>

      {/* Trade terms */}
      <div className={`${cardCls} mb-5`}>
        <h2 className="font-display text-[18px] font-medium text-ink">Trade terms {req}</h2>
        <p className="mb-4 text-[13px] text-muted">Presented to customers as a clean spec sheet.</p>
        <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
          {[["moq", "MOQ (e.g. 500 pieces)"], ["incoterms", "Incoterms (e.g. FOB Chennai)"], ["paymentTerms", "Payment terms"], ["leadTime", "Lead time"]].map(([k, ph]) => (
            <input key={k} value={trade[k] ?? ""} onChange={(e) => setTrade((t) => ({ ...t, [k]: e.target.value }))} placeholder={ph} className={smallInput} />
          ))}
        </div>
      </div>

      {/* Customization capabilities */}
      <div className={`${cardCls} mb-5`}>
        <h2 className="mb-1 font-display text-[18px] font-medium text-ink">Customization capabilities</h2>
        <p className="mb-4 text-[13px] text-muted">Select what you can customize for buyers.</p>
        <div className="flex flex-wrap gap-2">
          {CAPABILITIES.map((c) => {
            const on = caps.includes(c);
            return (
              <button key={c} onClick={() => setCaps((x) => (on ? x.filter((y) => y !== c) : [...x, c]))} className="rounded-full border px-[13px] py-[7px] text-[12.5px]" style={{ background: on ? "#403A77" : "#fff", color: on ? "#FAF8F4" : "#403A77", borderColor: on ? "#403A77" : "#D6D4EC" }}>{c}</button>
            );
          })}
        </div>
      </div>

      {/* Products (accordion) */}
      <div className={`${cardCls} mb-5`}>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-display text-[18px] font-medium text-ink">Products {req}</h2>
          <button onClick={() => { setProducts((p) => [...p, { name: "", category: "", material: "", moq: "", priceRange: "" }]); setOpenP(products.length); }} className="rounded-[7px] border border-primary px-3.5 py-2 text-[13px] text-primary hover:bg-lav1">+ Add product</button>
        </div>
        <p className="mb-4 text-[13px] text-muted">Name, category, material/GSM, MOQ, and price range for each product.</p>
        {products.length === 0 && <p className="text-[13.5px] text-muted">No products added yet.</p>}
        <div className="flex flex-col gap-3">
          {products.map((pr, i) => (
            <div key={i} className="overflow-hidden rounded-[10px] border border-line bg-white">
              <button onClick={() => setOpenP(openP === i ? null : i)} className="flex w-full items-center justify-between px-4 py-3.5 text-left text-[14px] font-semibold text-ink">
                {pr.name || "New product"}
                <span className="text-[12px] text-primary">{openP === i ? "Collapse" : "Expand"}</span>
              </button>
              {openP === i && (
                <div className="flex flex-col gap-2.5 px-4 pb-4">
                  <input value={pr.name} onChange={(e) => setPr(i, "name", e.target.value)} placeholder="Product name *" className={smallInput} />
                  <div className="flex flex-wrap gap-2.5">
                    <input value={pr.category} onChange={(e) => setPr(i, "category", e.target.value)} placeholder="Category" className={`${smallInput} flex-1`} style={{ minWidth: 140 }} />
                    <input value={pr.material} onChange={(e) => setPr(i, "material", e.target.value)} placeholder="Material / GSM" className={`${smallInput} flex-1`} style={{ minWidth: 140 }} />
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    <input value={pr.moq} onChange={(e) => setPr(i, "moq", e.target.value)} placeholder="MOQ" className={`${smallInput} flex-1`} style={{ minWidth: 140 }} />
                    <input value={pr.priceRange} onChange={(e) => setPr(i, "priceRange", e.target.value)} placeholder="Price range (e.g. ₹280–₹340/kg)" className={`${smallInput} flex-1`} style={{ minWidth: 140 }} />
                  </div>
                  <button onClick={() => setProducts((x) => x.filter((_, j) => j !== i))} className="self-start text-[12.5px] text-terra">Remove product</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Certifications (accordion) */}
      <div className={`${cardCls} mb-5`}>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-display text-[18px] font-medium text-ink">Certifications &amp; licences</h2>
          <button onClick={() => { setCerts((c) => [...c, emptyCert()]); setOpenC(certs.length); }} className="rounded-[7px] border border-primary px-3.5 py-2 text-[13px] text-primary hover:bg-lav1">+ Add record</button>
        </div>
        <p className="mb-4 text-[13px] text-muted">Certifications, statutory licences, and buyer/brand audits — each needs a clear scope so buyers know exactly what it covers.</p>
        {certs.length === 0 && <p className="text-[13.5px] text-muted">No certifications or licences added yet.</p>}
        <div className="flex flex-col gap-3">
          {certs.map((ct, i) => {
            const isAudit = ct.category === "Buyer / Brand Audits";
            return (
              <div key={i} className="overflow-hidden rounded-[10px] border border-line bg-white">
                <button onClick={() => setOpenC(openC === i ? null : i)} className="flex w-full items-center justify-between px-4 py-3.5 text-left text-[14px] font-semibold text-ink">
                  {isAudit ? ct.buyerName || "New audit" : ct.name || ct.category || "New record"}
                  <span className="text-[12px] text-primary">{openC === i ? "Collapse" : "Expand"}</span>
                </button>
                {openC === i && (
                  <div className="flex flex-col gap-2.5 px-4 pb-4">
                    <select value={ct.category} onChange={(e) => setC(i, { category: e.target.value })} className={smallInput}>
                      <option value="">Category *</option>
                      {CERT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {isAudit ? (
                      <>
                        <input value={ct.buyerName} onChange={(e) => setC(i, { buyerName: e.target.value })} placeholder="Buyer / brand name *" className={smallInput} />
                        <select value={ct.auditType} onChange={(e) => setC(i, { auditType: e.target.value })} className={smallInput}>
                          <option value="">Audit type *</option>
                          {AUDIT_TYPES.map((a) => <option key={a} value={a}>{a}</option>)}
                        </select>
                        <input type="date" value={ct.auditDate} onChange={(e) => setC(i, { auditDate: e.target.value })} className={smallInput} />
                        <select value={ct.outcome} onChange={(e) => setC(i, { outcome: e.target.value })} className={smallInput}>
                          <option value="">Outcome *</option>
                          {OUTCOMES.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </>
                    ) : (
                      <>
                        <input value={ct.name} onChange={(e) => setC(i, { name: e.target.value })} placeholder="Certification / licence name *" className={smallInput} />
                        <div className="flex flex-wrap gap-2.5">
                          <input value={ct.number} onChange={(e) => setC(i, { number: e.target.value })} placeholder="Certificate / licence number" className={`${smallInput} flex-1`} style={{ minWidth: 160 }} />
                          <input value={ct.issuingBody} onChange={(e) => setC(i, { issuingBody: e.target.value })} placeholder="Issuing body (e.g. Control Union, SGS)" className={`${smallInput} flex-1`} style={{ minWidth: 200 }} />
                        </div>
                        <textarea value={ct.scope} onChange={(e) => setC(i, { scope: e.target.value })} placeholder="Scope of certification *" rows={2} className={`${smallInput} resize-y`} />
                        <input value={ct.facility} onChange={(e) => setC(i, { facility: e.target.value })} placeholder="Facility / unit covered (optional)" className={smallInput} />
                        <div className="flex flex-wrap items-center gap-2.5">
                          <input type="date" value={ct.issueDate} onChange={(e) => setC(i, { issueDate: e.target.value })} className={`${smallInput} flex-1`} style={{ minWidth: 140 }} />
                          <input type="date" value={ct.expiryDate} disabled={ct.doesNotExpire} onChange={(e) => setC(i, { expiryDate: e.target.value })} className={`${smallInput} flex-1`} style={{ minWidth: 140, opacity: ct.doesNotExpire ? 0.5 : 1 }} />
                          <label className="flex items-center gap-1.5 whitespace-nowrap text-[12.5px] text-muted">
                            <input type="checkbox" checked={ct.doesNotExpire} onChange={(e) => setC(i, { doesNotExpire: e.target.checked })} /> Does not expire
                          </label>
                        </div>
                        <input value={ct.verificationUrl} onChange={(e) => setC(i, { verificationUrl: e.target.value })} placeholder="Verification URL (optional)" className={smallInput} />
                      </>
                    )}
                    <button onClick={() => setCerts((x) => x.filter((_, j) => j !== i))} className="self-start text-[12.5px] text-terra">Remove record</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Facility gallery */}
      <div className={`${cardCls} mb-5`}>
        <h2 className="mb-1 font-display text-[18px] font-medium text-ink">Facility gallery</h2>
        <p className="mb-4 text-[13px] text-muted">Photos of your factory floor, machines, and workspaces.</p>
        <Tiles items={photos} onAddFile={uploadPhoto} onRemove={removePhoto} addLabel="+ Add photo" />
      </div>

      {/* Work history (accordion) */}
      <div className={`${cardCls} mb-5`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-[18px] font-medium text-ink">Work history</h2>
          <button onClick={() => { setWork((w) => [...w, { clientName: "", role: "Sub-Contractor", frequency: "Recurring", startYear: "", endYear: "", description: "" }]); setOpenW(work.length); }} className="rounded-[7px] border border-primary px-3.5 py-2 text-[13px] text-primary hover:bg-lav1">+ Add engagement</button>
        </div>
        {work.length === 0 && <p className="text-[13.5px] text-muted">No engagements added yet.</p>}
        <div className="flex flex-col gap-3">
          {work.map((w, i) => (
            <div key={i} className="overflow-hidden rounded-[10px] border border-line bg-white">
              <button onClick={() => setOpenW(openW === i ? null : i)} className="flex w-full items-center justify-between px-4 py-3.5 text-left text-[14px] font-semibold text-ink">
                {w.clientName ? `${w.clientName} · ${w.role}` : "New engagement"}
                <span className="text-[12px] text-primary">{openW === i ? "Collapse" : "Expand"}</span>
              </button>
              {openW === i && (
                <div className="flex flex-col gap-2.5 px-4 pb-4">
                  <input value={w.clientName} onChange={(e) => setW(i, "clientName", e.target.value)} placeholder="Client name *" className={smallInput} />
                  <div className="flex flex-wrap gap-2.5">
                    <select value={w.role} onChange={(e) => setW(i, "role", e.target.value)} className={`${smallInput} flex-1`} style={{ minWidth: 160 }}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select>
                    <select value={w.frequency} onChange={(e) => setW(i, "frequency", e.target.value)} className={`${smallInput} flex-1`} style={{ minWidth: 160 }}>{FREQS.map((r) => <option key={r} value={r}>{r}</option>)}</select>
                  </div>
                  <div className="flex gap-2.5">
                    <input value={w.startYear} onChange={(e) => setW(i, "startYear", e.target.value)} placeholder="Start year" className={`${smallInput} flex-1`} />
                    <input value={w.endYear} onChange={(e) => setW(i, "endYear", e.target.value)} placeholder="End year (or present)" className={`${smallInput} flex-1`} />
                  </div>
                  <textarea value={w.description} maxLength={1000} onChange={(e) => setW(i, "description", e.target.value)} placeholder="Provide details of the engagement" rows={3} className={`${smallInput} resize-y`} />
                  <div className="flex items-center justify-between">
                    <span className="text-[11.5px] text-muted">{w.description.length}/1000</span>
                    <button onClick={() => setWork((x) => x.filter((_, j) => j !== i))} className="text-[12.5px] text-terra">Remove engagement</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Catalogue */}
      <div className={`${cardCls} mb-5`}>
        <h2 className="mb-1 font-display text-[18px] font-medium text-ink">Catalogue</h2>
        <p className="mb-4 text-[13px] text-muted">Your visual proof — fabrics, finished articles, line sheet.</p>
        <Tiles items={cat} withName onAddFile={uploadCatalogueImg} onRemove={removeCatalogueImg} addLabel="+ Add image" />
      </div>

      {/* Search tags */}
      <div className={`${cardCls} mb-5`}>
        <h2 className="mb-1 font-display text-[18px] font-medium text-ink">Search tags</h2>
        <p className="mb-3.5 text-[13px] text-muted">How manufacturers will discover you.</p>
        <div className="mb-3.5 flex flex-wrap gap-2">
          {tags.map((t) => (
            <span key={t} className="flex items-center gap-1.5 rounded-full border border-lav2 bg-lav1 px-3 py-1.5 text-[13px] text-primary">
              {t} <button onClick={() => setTags((x) => x.filter((y) => y !== t))} className="text-primary">×</button>
            </span>
          ))}
        </div>
        <div className="mb-3.5 flex gap-2">
          <input value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(tagDraft); } }} placeholder="e.g. embroidery" className={`flex-1 ${inputCls}`} />
          <button onClick={() => addTag(tagDraft)} className="rounded-lg bg-primary px-4 py-2.5 text-[13.5px] text-cream hover:opacity-90">Add tag</button>
        </div>
        <div className="mb-2 text-[12px] text-muted">Suggested:</div>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED.filter((s) => !tags.includes(s)).map((s) => (
            <button key={s} onClick={() => addTag(s)} className="rounded-full border border-dashed border-terra2 bg-white px-3 py-1.5 text-[12.5px] text-amber">+ {s}</button>
          ))}
        </div>
      </div>

      <ActionBar sticky />
    </main>
  );
}
