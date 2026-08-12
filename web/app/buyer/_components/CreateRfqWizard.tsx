"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { saveRfqDraft, publishRfqWizard, type RfqDraftPayload } from "@/app/buyer/actions";
import { type WizardState, emptyState } from "./rfqWizardState";

export type { WizardState } from "./rfqWizardState";

// ============================================================================
// Field taxonomies (CustomerCreateRFQ.dc.html) — kept exactly as the prototype
// so labels/options match; only "who can respond" is adapted to the real DB
// enum (open/verified_only/invite) instead of the prototype's extra
// "matching"/"verified-only checkbox" combo, which has no backing logic.
// ============================================================================
const PRODUCT_CATEGORIES = [
  "Men's Apparel", "Women's Apparel", "Kids & Baby", "Sportswear", "Activewear", "Workwear",
  "Uniforms", "Outerwear", "Knitwear", "Denim", "Innerwear", "Fashion Accessories", "Home Textiles", "Other",
];
const CONTRACT_TYPES = [
  "Fabric supply", "Yarn supply", "Dyeing & processing", "Printing (screen/digital)", "Embroidery",
  "Cut-Make-Trim (CMT)", "Full-package / white-label article", "Trims & accessories",
  "Sampling / development", "Finishing & washing", "Other",
];
const ARRANGEMENTS = ["Standard Product", "OEM", "ODM", "Private Label", "Custom Manufacturing"];
const CUSTOMIZATION_OPTIONS = [
  "Fabric", "Colour", "GSM / Fabric weight", "Fit", "Pattern", "Labels", "Hangtags", "Packaging",
  "Embroidery", "Screen printing", "Digital printing", "Heat transfer", "Wash / finish", "Hardware", "Trims",
];
const UNITS = ["Pieces", "Metres", "Kg"];
const PRICING_APPROACHES: { value: "target" | "quote" | "negotiable"; label: string }[] = [
  { value: "target", label: "I have a target price" },
  { value: "quote", label: "Ask suppliers to quote" },
  { value: "negotiable", label: "Open to negotiation" },
];
const CURRENCIES = ["INR", "USD", "EUR"];
const SAMPLE_TYPES = ["Proto", "Fit", "Size set", "Pre-production", "Production", "Other"];
const SAMPLE_SHIP_PAID_BY = ["Buyer", "Supplier", "Negotiable"];
const CERT_TAXONOMY: { category: string; certs: string[] }[] = [
  { category: "Quality Management", certs: ["ISO 9001"] },
  { category: "Environmental Management", certs: ["ISO 14001", "ISO 50001"] },
  { category: "Health & Safety", certs: ["ISO 45001"] },
  { category: "Social Compliance", certs: ["SA8000", "WRAP", "BSCI", "SMETA / SEDEX"] },
  { category: "Sustainable & Organic Textiles", certs: ["GOTS", "OCS", "OEKO-TEX Standard 100"] },
  { category: "Recycled Materials", certs: ["GRS", "RCS"] },
  { category: "Responsible Materials", certs: ["RDS", "RWS", "RMS", "FSC"] },
  {
    category: "Indian Regulatory & Legal Compliance",
    certs: ["Import Export Code (IEC)", "Factory Licence", "Pollution Control / Environmental Consent", "BIS Certification"],
  },
];
const PREFERRED_LOCATIONS = ["Tiruppur", "Bhilwara", "Ludhiana", "Erode", "Surat", "Panipat"];
const WHO_CAN_RESPOND: { value: "open" | "verified_only" | "invite"; label: string; desc: string }[] = [
  { value: "open", label: "All suppliers on the network", desc: "Any supplier can view and quote." },
  { value: "verified_only", label: "Verified suppliers only", desc: "Only Onboarding-Completed suppliers can view and quote." },
  { value: "invite", label: "Invite specific suppliers only", desc: "Only the suppliers you invite below can view and quote." },
];
const SHIPPING_METHODS = ["Road", "Rail", "Air", "Sea", "Courier", "Let supplier recommend"];
const INCOTERMS = ["EXW", "FOB", "CIF", "DDP"];
const DOC_TYPES = ["Tech pack", "Reference images", "Size chart", "Bill of materials", "Brand guidelines", "Other"];

const STEP_NAMES = ["Product & requirements", "Quantity, pricing & samples", "Compliance & preferences", "Logistics & documents", "Review & publish"];

// ---------- shared styling (matches IdentityForm/FinancialsForm/PortfolioForm) ----------
const labelCls = "text-[13px] font-semibold text-muted";
const inputCls = "rounded-lg border border-line bg-white px-3 py-2.5 text-[14.5px] text-ink placeholder:text-muted/60";
const smallInput = "rounded-md border border-line bg-white px-3 py-2 text-[13.5px]";
const cardCls = "rounded-[14px] border border-line bg-cream p-6";
const req = <span className="text-terra">*</span>;

export type SupplierOption = { org_id: string; name: string; location: string | null; company_type: string | null };

// ---------- small reusable pieces ----------
function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={labelCls}>
        {label} {required && req}
      </span>
      {children}
      {hint && <span className="text-[11.5px] text-muted">{hint}</span>}
    </label>
  );
}

function ButtonGroup<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className="rounded-lg border px-3.5 py-2 text-[13px] font-medium"
            style={{ background: on ? "#403A77" : "#fff", color: on ? "#FAF8F4" : "#403A77", borderColor: on ? "#403A77" : "#D6D4EC" }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function ChipMultiSelect({ options, value, onChange }: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
            className="rounded-full border px-[13px] py-[7px] text-[12.5px]"
            style={{ background: on ? "#403A77" : "#fff", color: on ? "#FAF8F4" : "#403A77", borderColor: on ? "#403A77" : "#D6D4EC" }}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setDraft("");
  };
  return (
    <div>
      <div className="mb-1.5 flex flex-wrap gap-1.5">
        {value.map((t) => (
          <span key={t} className="flex items-center gap-1.5 rounded-full bg-lav1 px-2.5 py-1 text-[12px] text-primary">
            {t}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} className="text-primary" aria-label={`Remove ${t}`}>
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className={`flex-1 ${inputCls}`}
        />
        <button type="button" onClick={add} className="whitespace-nowrap rounded-lg bg-primary px-3.5 py-2.5 text-[13px] text-cream hover:opacity-90">
          Add
        </button>
      </div>
    </div>
  );
}

function StepDots({ step }: { step: number }) {
  const pct = Math.round((step / STEP_NAMES.length) * 100);
  return (
    <div className="mb-7">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-display text-[13px] font-semibold text-primary2">
          Step {step} of {STEP_NAMES.length} — {STEP_NAMES[step - 1]}
        </span>
        <span className="text-[12.5px] tabular-nums text-muted">{pct}%</span>
      </div>
      <div className="flex gap-1.5">
        {STEP_NAMES.map((name, i) => (
          <div
            key={name}
            className="h-1.5 flex-1 rounded-full"
            style={{ background: i < step ? "#403A77" : i === step - 1 ? "#403A77" : "#E4DFD5" }}
          />
        ))}
      </div>
    </div>
  );
}

export function CreateRfqWizard({
  supplierOptions,
  initialInviteOrgId,
  existingRfqId,
  initialState,
}: {
  supplierOptions: SupplierOption[];
  initialInviteOrgId?: string;
  existingRfqId?: string;
  initialState?: Partial<WizardState>;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [s, setS] = useState<WizardState>(() => {
    if (initialState) return { ...emptyState, ...initialState };
    return initialInviteOrgId ? { ...emptyState, whoCanRespond: "invite", inviteOrgIds: [initialInviteOrgId] } : emptyState;
  });
  const [rfqId, setRfqId] = useState<string | null>(existingRfqId ?? null);
  const [saving, setSaving] = useState(false);
  const [published, setPublished] = useState(false);
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [supplierSearch, setSupplierSearch] = useState("");

  const set = <K extends keyof WizardState>(k: K, v: WizardState[K]) => setS((x) => ({ ...x, [k]: v }));

  // Live "matching suppliers" (advisory) — recomputed as location/experience change.
  useEffect(() => {
    const supabase = createClient();
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("match_count", {
        p_preferred_location: s.preferredLocation || null,
        p_min_years: s.minYearsExperience ? Number(s.minYearsExperience) : null,
      });
      setMatchCount(typeof data === "number" ? data : null);
    }, 300);
    return () => clearTimeout(t);
  }, [s.preferredLocation, s.minYearsExperience]);

  const payload = (): RfqDraftPayload => ({
    title: s.title,
    contractType: s.contractType,
    quantity: s.quantity,
    unit: s.unit,
    whoCanRespond: s.whoCanRespond,
    preferredLocation: s.preferredLocation,
    minYearsExperience: s.minYearsExperience,
    requiredCerts: s.requiredCerts,
    customizationNeeds: s.customizationNeeds,
    pricingApproach: s.pricingApproach,
    targetPrice: s.targetPrice,
    currency: s.currency,
    sampleRequired: !!s.sampleRequired,
    sampleType: s.sampleType,
    sampleCount: s.sampleCount,
    sampleDeadline: s.sampleDeadline,
    sampleShipPaidBy: s.sampleShipPaidBy,
    bidStart: s.bidStart,
    bidEnd: s.bidEnd,
    deliveryDate: s.deliveryDate,
    spec: {
      productCategory: s.productCategory,
      manufacturingArrangement: s.manufacturingArrangement,
      primaryMaterial: s.primaryMaterial,
      fabricWeight: s.fabricWeight,
      sizeRange: s.sizeRange,
      colours: s.colours,
      targetMarket: s.targetMarket,
      additionalRequirements: s.additionalRequirements,
      quantityBreakdown: s.breakdownEnabled ? s.quantityBreakdown : [],
      complianceNotes: s.complianceNotes,
      leadTimeDays: s.leadTimeDays,
      deliveryCity: s.deliveryCity,
      deliveryState: s.deliveryState,
      deliveryPincode: s.deliveryPincode,
      shippingMethod: s.shippingMethod,
      incoterm: s.incoterm,
      paymentTerms: s.paymentTerms,
      packagingNotes: s.packagingNotes,
      documents: s.documents,
    },
  });

  const saveDraft = async () => {
    setSaving(true);
    try {
      const { id } = await saveRfqDraft(rfqId, payload());
      setRfqId(id);
      router.push(`/buyer/rfqs/${id}`);
    } finally {
      setSaving(false);
    }
  };

  const dateOrderOk = !s.bidStart || !s.bidEnd || s.bidStart <= s.bidEnd;
  const deliveryAfterBidOk = !s.bidEnd || !s.deliveryDate || s.deliveryDate > s.bidEnd;

  const step1Valid = !!(s.title.trim() && s.productCategory && s.contractType && s.manufacturingArrangement);
  const step2Valid = !!(s.quantity && s.unit && s.pricingApproach && s.bidStart && s.bidEnd && dateOrderOk && s.sampleRequired !== null);
  const step3Valid = s.whoCanRespond !== "invite" || s.inviteOrgIds.length > 0;
  const step4Valid = !!(s.deliveryDate && deliveryAfterBidOk && s.deliveryCity && s.deliveryState && s.deliveryPincode);
  const allValid = step1Valid && step2Valid && step3Valid && step4Valid;

  const publish = async () => {
    if (!allValid) return;
    setSaving(true);
    try {
      const { id } = await saveRfqDraft(rfqId, payload());
      setRfqId(id);
      await publishRfqWizard(id, s.whoCanRespond === "invite" ? s.inviteOrgIds : []);
      setPublished(true);
    } finally {
      setSaving(false);
    }
  };

  const requiredDone = [step1Valid, step2Valid, step3Valid, step4Valid].filter(Boolean).length;
  const currentStepValid = [step1Valid, step2Valid, step3Valid, step4Valid][step - 1] ?? true;

  const filteredSuppliers = useMemo(() => {
    const q = supplierSearch.trim().toLowerCase();
    if (!q) return supplierOptions;
    return supplierOptions.filter((o) => o.name.toLowerCase().includes(q) || (o.location ?? "").toLowerCase().includes(q));
  }, [supplierOptions, supplierSearch]);

  if (published) {
    return (
      <div className={`${cardCls} flex flex-col items-center gap-4 py-14 text-center`}>
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sagebg text-[26px] text-sage">✓</div>
        <h2 className="font-display text-[24px] font-medium text-ink">Sourcing request published</h2>
        <p className="max-w-[420px] text-[14px] text-muted">
          {s.title || "Your RFQ"} is now live. Eligible suppliers can view it and submit quotes during your bid window.
        </p>
        <div className="mt-2 flex gap-3">
          <Link href="/buyer" className="rounded-lg border border-line px-4 py-2.5 text-[13.5px] font-medium text-primary hover:bg-panel">
            Back to My RFQs
          </Link>
          {rfqId && (
            <Link href={`/buyer/rfqs/${rfqId}`} className="rounded-lg bg-primary px-4 py-2.5 text-[13.5px] font-semibold text-cream hover:opacity-90">
              View RFQ
            </Link>
          )}
        </div>
      </div>
    );
  }

  const NavBar = () => (
    <div className="sticky bottom-0 mt-6 flex flex-wrap items-center justify-between gap-2.5 border-t border-line bg-cream/95 px-1 py-3.5 backdrop-blur">
      <div className="flex gap-2.5">
        <Link href="/buyer" className="rounded-lg border border-line px-4 py-2.5 text-[13.5px] text-muted hover:bg-panel">
          Cancel
        </Link>
        {step > 1 && (
          <button
            type="button"
            onClick={() => setStep((x) => x - 1)}
            className="rounded-lg border border-line px-4 py-2.5 text-[13.5px] text-ink hover:bg-panel"
          >
            Back
          </button>
        )}
      </div>
      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={saveDraft}
          disabled={saving}
          className="rounded-lg border border-primary px-4 py-2.5 text-[13.5px] font-medium text-primary hover:bg-lav1 disabled:opacity-50"
        >
          Save as draft
        </button>
        {step < 5 ? (
          <div className="flex flex-col items-end gap-1.5">
            {!currentStepValid && <span className="text-[12px] text-terra">Fill in the required fields to continue.</span>}
            <button
              type="button"
              onClick={() => setStep((x) => x + 1)}
              disabled={!currentStepValid}
              className="rounded-lg bg-primary px-5 py-2.5 text-[13.5px] font-semibold text-cream hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={publish}
            disabled={saving || !allValid}
            className="rounded-lg bg-primary px-5 py-2.5 text-[13.5px] font-semibold text-cream hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Publish sourcing request
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div>
      <StepDots step={step} />

      {step === 1 && (
        <div className="flex flex-col gap-5">
          <div className={cardCls}>
            <h2 className="mb-4 font-display text-[18px] font-medium text-ink">Product basics</h2>
            <div className="flex flex-col gap-4">
              <Field label="Title" required>
                <input value={s.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Single-jersey T-shirts, basics line" className={inputCls} />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Product category" required>
                  <select value={s.productCategory} onChange={(e) => set("productCategory", e.target.value)} className={inputCls}>
                    <option value="">Select…</option>
                    {PRODUCT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Contract / service type" required>
                  <select value={s.contractType} onChange={(e) => set("contractType", e.target.value)} className={inputCls}>
                    <option value="">Select…</option>
                    {CONTRACT_TYPES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
          </div>

          <div className={cardCls}>
            <h2 className="mb-1 font-display text-[18px] font-medium text-ink">Manufacturing arrangement {req}</h2>
            <p className="mb-3.5 text-[13px] text-muted">How should suppliers approach this — off-the-shelf or built to your spec?</p>
            <ButtonGroup options={ARRANGEMENTS.map((a) => ({ value: a, label: a }))} value={s.manufacturingArrangement} onChange={(v) => set("manufacturingArrangement", v)} />
          </div>

          {s.manufacturingArrangement && s.manufacturingArrangement !== "Standard Product" && (
            <div className={cardCls}>
              <h2 className="mb-1 font-display text-[18px] font-medium text-ink">Customization needs</h2>
              <p className="mb-3.5 text-[13px] text-muted">Recommended — select what suppliers should be able to customize.</p>
              <ChipMultiSelect options={CUSTOMIZATION_OPTIONS} value={s.customizationNeeds} onChange={(v) => set("customizationNeeds", v)} />
            </div>
          )}

          <div className={cardCls}>
            <h2 className="mb-4 font-display text-[18px] font-medium text-ink">Specifications</h2>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Primary material" hint="Recommended">
                  <input value={s.primaryMaterial} onChange={(e) => set("primaryMaterial", e.target.value)} placeholder="e.g. 100% cotton, 24s count" className={inputCls} />
                </Field>
                <Field label="Fabric weight / GSM" hint="Optional">
                  <input value={s.fabricWeight} onChange={(e) => set("fabricWeight", e.target.value)} placeholder="e.g. 180 GSM" className={inputCls} />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Size range" hint="Recommended">
                  <TagInput value={s.sizeRange} onChange={(v) => set("sizeRange", v)} placeholder="e.g. S" />
                </Field>
                <Field label="Colours required" hint="Recommended">
                  <TagInput value={s.colours} onChange={(v) => set("colours", v)} placeholder="e.g. Navy" />
                </Field>
              </div>
              <Field label="Target market / intended use" hint="Optional">
                <input value={s.targetMarket} onChange={(e) => set("targetMarket", e.target.value)} placeholder="e.g. Domestic retail, premium segment" className={inputCls} />
              </Field>
              <Field label="Additional requirements" hint="Optional">
                <textarea value={s.additionalRequirements} onChange={(e) => set("additionalRequirements", e.target.value)} rows={3} className={`${inputCls} resize-y`} />
              </Field>
              <p className="text-[12px] text-muted">Design files and tech packs are uploaded in Step 4.</p>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-5">
          <div className={cardCls}>
            <h2 className="mb-4 font-display text-[18px] font-medium text-ink">Quantity</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Total quantity required" required>
                <input value={s.quantity} onChange={(e) => set("quantity", e.target.value)} type="number" min="0" className={inputCls} />
              </Field>
              <Field label="Unit" required>
                <select value={s.unit} onChange={(e) => set("unit", e.target.value)} className={inputCls}>
                  {UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </Field>
            </div>
            <label className="mt-4 flex items-center gap-2 text-[13px] text-ink">
              <input type="checkbox" checked={s.breakdownEnabled} onChange={(e) => set("breakdownEnabled", e.target.checked)} />
              Break down by colour/size
            </label>
            {s.breakdownEnabled && (
              <div className="mt-3 flex flex-col gap-2">
                {s.quantityBreakdown.map((row, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2.5 rounded-lg border border-line bg-white px-3.5 py-2.5">
                    <input
                      value={row.colour}
                      onChange={(e) => set("quantityBreakdown", s.quantityBreakdown.map((r, j) => (j === i ? { ...r, colour: e.target.value } : r)))}
                      placeholder="Colour"
                      className={`${smallInput} flex-1`}
                      style={{ minWidth: 100 }}
                    />
                    <input
                      value={row.size}
                      onChange={(e) => set("quantityBreakdown", s.quantityBreakdown.map((r, j) => (j === i ? { ...r, size: e.target.value } : r)))}
                      placeholder="Size"
                      className={`${smallInput} flex-1`}
                      style={{ minWidth: 100 }}
                    />
                    <input
                      value={row.qty}
                      onChange={(e) => set("quantityBreakdown", s.quantityBreakdown.map((r, j) => (j === i ? { ...r, qty: e.target.value } : r)))}
                      type="number"
                      placeholder="Qty"
                      className={`${smallInput} flex-1`}
                      style={{ minWidth: 90 }}
                    />
                    <button type="button" onClick={() => set("quantityBreakdown", s.quantityBreakdown.filter((_, j) => j !== i))} className="text-[12.5px] text-terra">
                      Remove
                    </button>
                  </div>
                ))}
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => set("quantityBreakdown", [...s.quantityBreakdown, { colour: "", size: "", qty: "" }])}
                    className="self-start rounded-[7px] border border-primary px-3.5 py-2 text-[13px] text-primary hover:bg-lav1"
                  >
                    + Add row
                  </button>
                  <span className="text-[12.5px] text-muted">
                    Running total: <b className="text-ink">{s.quantityBreakdown.reduce((a, r) => a + (Number(r.qty) || 0), 0)}</b>
                    {s.quantity ? ` / ${s.quantity}` : ""}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className={cardCls}>
            <h2 className="mb-3.5 font-display text-[18px] font-medium text-ink">Pricing approach {req}</h2>
            <ButtonGroup options={PRICING_APPROACHES} value={s.pricingApproach} onChange={(v) => set("pricingApproach", v)} />
            {s.pricingApproach === "target" && (
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Currency">
                  <select value={s.currency} onChange={(e) => set("currency", e.target.value)} className={inputCls}>
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Target unit price">
                  <input value={s.targetPrice} onChange={(e) => set("targetPrice", e.target.value)} type="number" min="0" className={inputCls} />
                </Field>
              </div>
            )}
          </div>

          <div className={cardCls}>
            <h2 className="mb-4 font-display text-[18px] font-medium text-ink">Bid window</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Bid start" required>
                <input value={s.bidStart} onChange={(e) => set("bidStart", e.target.value)} type="date" className={inputCls} />
              </Field>
              <Field label="Bid end" required>
                <input value={s.bidEnd} onChange={(e) => set("bidEnd", e.target.value)} type="date" className={`${inputCls}${!dateOrderOk ? " border-terra" : ""}`} />
              </Field>
            </div>
            {!dateOrderOk && <p className="mt-2 text-[12.5px] text-terra">Bid end must be on or after bid start.</p>}
          </div>

          <div className={cardCls}>
            <h2 className="mb-1 font-display text-[18px] font-medium text-ink">Sample {req}</h2>
            <p className="mb-3.5 text-[13px] text-muted">Do suppliers need to provide a sample before bulk production?</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => set("sampleRequired", true)}
                className="rounded-lg border px-4 py-2 text-[13px] font-medium"
                style={{ background: s.sampleRequired === true ? "#403A77" : "#fff", color: s.sampleRequired === true ? "#FAF8F4" : "#403A77", borderColor: s.sampleRequired === true ? "#403A77" : "#D6D4EC" }}
              >
                Yes, sample required
              </button>
              <button
                type="button"
                onClick={() => set("sampleRequired", false)}
                className="rounded-lg border px-4 py-2 text-[13px] font-medium"
                style={{ background: s.sampleRequired === false ? "#403A77" : "#fff", color: s.sampleRequired === false ? "#FAF8F4" : "#403A77", borderColor: s.sampleRequired === false ? "#403A77" : "#D6D4EC" }}
              >
                No sample needed
              </button>
            </div>
            {s.sampleRequired && (
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Sample type">
                  <select value={s.sampleType} onChange={(e) => set("sampleType", e.target.value)} className={inputCls}>
                    <option value="">Select…</option>
                    {SAMPLE_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Number of samples">
                  <input value={s.sampleCount} onChange={(e) => set("sampleCount", e.target.value)} type="number" min="0" className={inputCls} />
                </Field>
                <Field label="Sample deadline">
                  <input value={s.sampleDeadline} onChange={(e) => set("sampleDeadline", e.target.value)} type="date" className={inputCls} />
                </Field>
                <Field label="Who pays for sample shipping">
                  <select value={s.sampleShipPaidBy} onChange={(e) => set("sampleShipPaidBy", e.target.value)} className={inputCls}>
                    <option value="">Select…</option>
                    {SAMPLE_SHIP_PAID_BY.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </Field>
              </div>
            )}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-5">
          <div className={cardCls}>
            <h2 className="mb-1 font-display text-[18px] font-medium text-ink">Required certifications</h2>
            <p className="mb-4 text-[13px] text-muted">Recommended — advisory only; suppliers aren&apos;t filtered out for missing these.</p>
            <div className="flex flex-col gap-4">
              {CERT_TAXONOMY.map((group) => (
                <div key={group.category}>
                  <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.02em] text-primary2">{group.category}</div>
                  <div className="flex flex-col gap-2">
                    {group.certs.map((certName) => {
                      const existing = s.requiredCerts.find((c) => c.category === group.category && c.name === certName);
                      return (
                        <div key={certName} className="flex flex-wrap items-center gap-2.5">
                          <label className="flex flex-1 items-center gap-2 text-[13.5px] text-ink" style={{ minWidth: 200 }}>
                            <input
                              type="checkbox"
                              checked={!!existing}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  set("requiredCerts", [...s.requiredCerts, { category: group.category, name: certName, priority: "must" }]);
                                } else {
                                  set("requiredCerts", s.requiredCerts.filter((c) => !(c.category === group.category && c.name === certName)));
                                }
                              }}
                            />
                            {certName}
                          </label>
                          {existing && (
                            <div className="flex gap-1.5">
                              {(["must", "nice"] as const).map((p) => (
                                <button
                                  key={p}
                                  type="button"
                                  onClick={() =>
                                    set(
                                      "requiredCerts",
                                      s.requiredCerts.map((c) => (c.category === group.category && c.name === certName ? { ...c, priority: p } : c)),
                                    )
                                  }
                                  className="rounded-full border px-2.5 py-1 text-[11.5px]"
                                  style={{
                                    background: existing.priority === p ? "#403A77" : "#fff",
                                    color: existing.priority === p ? "#FAF8F4" : "#403A77",
                                    borderColor: existing.priority === p ? "#403A77" : "#D6D4EC",
                                  }}
                                >
                                  {p === "must" ? "Must-have" : "Nice-to-have"}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <label className="mt-4 flex flex-col gap-1.5">
              <span className={labelCls}>Additional compliance notes</span>
              <textarea value={s.complianceNotes} onChange={(e) => set("complianceNotes", e.target.value)} rows={2} className={`${inputCls} resize-y`} />
            </label>
          </div>

          <div className={cardCls}>
            <h2 className="mb-4 font-display text-[18px] font-medium text-ink">Supplier preferences</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Minimum years of manufacturing experience" hint="Optional, advisory">
                <input value={s.minYearsExperience} onChange={(e) => set("minYearsExperience", e.target.value)} type="number" min="0" className={inputCls} />
              </Field>
              <Field label="Preferred supplier location" hint="Optional, advisory">
                <select value={s.preferredLocation} onChange={(e) => set("preferredLocation", e.target.value)} className={inputCls}>
                  <option value="">Any</option>
                  {PREFERRED_LOCATIONS.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="mt-3 rounded-lg border border-lav2 bg-lav1 px-3.5 py-2.5 text-[13.5px] text-ink">
              Matching suppliers: <span className="font-semibold tabular-nums text-primary">{matchCount ?? "…"}</span>
              <span className="ml-1 text-[12px] text-muted">(advisory — the real responder set can be larger)</span>
            </div>
          </div>

          <div className={cardCls}>
            <h2 className="mb-1 font-display text-[18px] font-medium text-ink">Who can respond {req}</h2>
            <div className="mt-3 flex flex-col gap-2.5">
              {WHO_CAN_RESPOND.map((o) => (
                <label key={o.value} className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-line bg-white p-3.5">
                  <input type="radio" name="whoCanRespond" className="mt-0.5" checked={s.whoCanRespond === o.value} onChange={() => set("whoCanRespond", o.value)} />
                  <span>
                    <span className="block text-[13.5px] font-semibold text-ink">{o.label}</span>
                    <span className="block text-[12.5px] text-muted">{o.desc}</span>
                  </span>
                </label>
              ))}
            </div>
            {s.whoCanRespond === "invite" && (
              <div className="mt-4">
                <input
                  value={supplierSearch}
                  onChange={(e) => setSupplierSearch(e.target.value)}
                  placeholder="Search suppliers by name or location…"
                  className={`mb-2.5 w-full ${inputCls}`}
                />
                {s.inviteOrgIds.length === 0 && <p className="mb-2 text-[12.5px] text-terra">Select at least one supplier to invite.</p>}
                <div className="max-h-[280px] overflow-y-auto rounded-lg border border-line">
                  {filteredSuppliers.map((sup) => {
                    const on = s.inviteOrgIds.includes(sup.org_id);
                    return (
                      <label key={sup.org_id} className="flex cursor-pointer items-center gap-2.5 border-b border-line px-3.5 py-2.5 last:border-b-0 hover:bg-panel">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() =>
                            set("inviteOrgIds", on ? s.inviteOrgIds.filter((id) => id !== sup.org_id) : [...s.inviteOrgIds, sup.org_id])
                          }
                        />
                        <span className="text-[13.5px] text-ink">{sup.name}</span>
                        <span className="text-[12px] text-muted">{sup.company_type ?? ""} {sup.location ? `· ${sup.location}` : ""}</span>
                      </label>
                    );
                  })}
                  {filteredSuppliers.length === 0 && <p className="px-3.5 py-3 text-[13px] text-muted">No suppliers match.</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-col gap-5">
          <div className={cardCls}>
            <h2 className="mb-4 font-display text-[18px] font-medium text-ink">Delivery</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Required delivery date" required>
                <input value={s.deliveryDate} onChange={(e) => set("deliveryDate", e.target.value)} type="date" className={`${inputCls}${!deliveryAfterBidOk ? " border-terra" : ""}`} />
              </Field>
              <Field label="Preferred production lead time (days)" hint="Optional">
                <input value={s.leadTimeDays} onChange={(e) => set("leadTimeDays", e.target.value)} type="number" min="0" className={inputCls} />
              </Field>
            </div>
            {!deliveryAfterBidOk && <p className="mt-2 text-[12.5px] text-terra">Delivery date must be after the bid window ends.</p>}

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="City" required>
                <input value={s.deliveryCity} onChange={(e) => set("deliveryCity", e.target.value)} className={inputCls} />
              </Field>
              <Field label="State" required>
                <input value={s.deliveryState} onChange={(e) => set("deliveryState", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Pincode" required>
                <input value={s.deliveryPincode} onChange={(e) => set("deliveryPincode", e.target.value)} className={inputCls} />
              </Field>
            </div>
          </div>

          <div className={cardCls}>
            <h2 className="mb-4 font-display text-[18px] font-medium text-ink">Shipping &amp; payment</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Shipping method" hint="Optional">
                <select value={s.shippingMethod} onChange={(e) => set("shippingMethod", e.target.value)} className={inputCls}>
                  <option value="">Select…</option>
                  {SHIPPING_METHODS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </Field>
              <Field label="Incoterm" hint="Optional">
                <select value={s.incoterm} onChange={(e) => set("incoterm", e.target.value)} className={inputCls}>
                  <option value="">Select…</option>
                  {INCOTERMS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Payment terms" hint="Optional">
              <input value={s.paymentTerms} onChange={(e) => set("paymentTerms", e.target.value)} placeholder="e.g. 30% advance, 70% on shipment" className={`mt-4 ${inputCls}`} />
            </Field>
          </div>

          <div className={cardCls}>
            <h2 className="mb-4 font-display text-[18px] font-medium text-ink">Packaging &amp; labelling</h2>
            <textarea value={s.packagingNotes} onChange={(e) => set("packagingNotes", e.target.value)} rows={3} className={`${inputCls} w-full resize-y`} />
          </div>

          <div className={cardCls}>
            <div className="mb-1 flex items-center justify-between">
              <h2 className="font-display text-[18px] font-medium text-ink">Documents &amp; attachments</h2>
              <button
                type="button"
                onClick={() => set("documents", [...s.documents, { fileName: `document-${s.documents.length + 1}.pdf`, docType: "Tech pack" }])}
                className="rounded-[7px] border border-primary px-3.5 py-2 text-[13px] text-primary hover:bg-lav1"
              >
                + Upload document
              </button>
            </div>
            {s.documents.length === 0 && <p className="text-[13.5px] text-muted">No documents added yet.</p>}
            <div className="flex flex-col gap-2.5">
              {s.documents.map((d, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2.5 rounded-lg border border-line bg-white px-3.5 py-2.5">
                  <span className="text-[13px] text-ink">📄 {d.fileName}</span>
                  <select
                    value={d.docType}
                    onChange={(e) => set("documents", s.documents.map((x, j) => (j === i ? { ...x, docType: e.target.value } : x)))}
                    className={`${smallInput} ml-auto`}
                  >
                    {DOC_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => set("documents", s.documents.filter((_, j) => j !== i))} className="text-[12.5px] text-terra">
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="flex flex-col gap-5">
          <div className={cardCls}>
            <h2 className="mb-3 font-display text-[18px] font-medium text-ink">Ready to publish?</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-line bg-white px-3.5 py-3">
                <div className="text-[11px] uppercase text-muted">Required sections complete</div>
                <div className="text-[20px] font-semibold text-ink">{requiredDone} of 4</div>
              </div>
              <div className="rounded-lg border border-line bg-white px-3.5 py-3">
                <div className="text-[11px] uppercase text-muted">Attachments</div>
                <div className="text-[20px] font-semibold text-ink">{s.documents.length}</div>
              </div>
              <div className="rounded-lg border border-line bg-white px-3.5 py-3">
                <div className="text-[11px] uppercase text-muted">Matching suppliers</div>
                <div className="text-[20px] font-semibold text-ink">{matchCount ?? "…"}</div>
              </div>
            </div>
          </div>

          <div className={cardCls}>
            <h2 className="mb-3 font-display text-[18px] font-medium text-ink">Timeline</h2>
            <div className="text-[13.5px] text-ink">
              Bid window: <b>{s.bidStart || "—"}</b> → <b>{s.bidEnd || "—"}</b>
            </div>
            {s.sampleRequired && <div className="mt-1 text-[13.5px] text-ink">Sample deadline: <b>{s.sampleDeadline || "—"}</b></div>}
            <div className="mt-1 text-[13.5px] text-ink">Required delivery: <b>{s.deliveryDate || "—"}</b></div>
          </div>

          {[
            { name: "Product & requirements", ok: step1Valid, jump: 1, lines: [s.title, s.productCategory, s.contractType, s.manufacturingArrangement].filter(Boolean).join(" · ") },
            { name: "Quantity, pricing & samples", ok: step2Valid, jump: 2, lines: [`${s.quantity || "—"} ${s.unit}`, s.pricingApproach, s.sampleRequired ? "Sample required" : "No sample"].filter(Boolean).join(" · ") },
            { name: "Compliance & preferences", ok: step3Valid, jump: 3, lines: [`${s.requiredCerts.length} cert(s)`, WHO_CAN_RESPOND.find((w) => w.value === s.whoCanRespond)?.label].filter(Boolean).join(" · ") },
            { name: "Logistics & documents", ok: step4Valid, jump: 4, lines: [s.deliveryCity, s.deliveryState, s.deliveryPincode].filter(Boolean).join(", ") },
          ].map((g) => (
            <div key={g.name} className={cardCls}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-[14.5px] font-semibold text-ink">
                    {g.name}
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${g.ok ? "bg-sagebg text-sage" : "bg-[#F7ECE8] text-terra"}`}>
                      {g.ok ? "Complete" : "Incomplete"}
                    </span>
                  </div>
                  <div className="mt-1 text-[13px] text-muted">{g.lines || "Not filled in yet"}</div>
                </div>
                <button type="button" onClick={() => setStep(g.jump)} className="whitespace-nowrap text-[13px] text-primary underline">
                  Edit
                </button>
              </div>
            </div>
          ))}

          <div className="rounded-lg border border-lav2 bg-lav1 px-3.5 py-2.5 text-[13px] text-ink">
            {s.whoCanRespond === "invite"
              ? `Visible only to the ${s.inviteOrgIds.length} supplier(s) you invited.`
              : s.whoCanRespond === "verified_only"
                ? "Visible to all Onboarding-Completed suppliers on the network."
                : "Visible to every supplier on the network."}
          </div>
          {!allValid && (
            <p className="text-[13px] text-terra">Some required fields are still missing — check the sections marked Incomplete above.</p>
          )}
        </div>
      )}

      <NavBar />
    </div>
  );
}
