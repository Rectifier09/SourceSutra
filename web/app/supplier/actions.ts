"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function str(v: FormDataEntryValue | null): string | null {
  const s = (v ?? "").toString().trim();
  return s === "" ? null : s;
}
function num(v: FormDataEntryValue | null): number | null {
  const s = str(v);
  return s === null ? null : Number(s);
}

// Resolve the caller and assert supplier — every action below mutates supplier-owned rows.
async function supplierClient() {
  const supabase = await createClient();
  const { data: me } = await supabase.from("v_me").select("org_id, role").maybeSingle();
  if (!me || me.role !== "supplier") throw new Error("Not a supplier");
  return { supabase, org_id: me.org_id as string };
}

// BP-1 FAKE upload: create a `documents` row (type + status, NO real file). Real
// storage (INT-1) swaps in at BP-2 with no schema change (documents.storage_path).
// Re-clicking is harmless: the (org, doc_type, coalesce(fy,'-')) unique index → 23505 → ignore.
export async function uploadDoc(formData: FormData) {
  const { supabase, org_id } = await supplierClient();
  const section_kind = String(formData.get("section_kind"));
  const doc_type = String(formData.get("doc_type"));
  const fy = str(formData.get("fy"));
  const { error } = await supabase
    .from("documents")
    .insert({ org_id, section_kind, doc_type, fy, status: "uploaded" });
  if (error && error.code !== "23505") throw new Error(error.message);
  revalidatePath("/supplier");
}

export async function removeDoc(formData: FormData) {
  const { supabase } = await supplierClient();
  const id = String(formData.get("doc_id"));
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/supplier");
}

// BP-1 FAKE OTP/KYC: simulate the provider then persist the RESULT only (A.11.5).
// set_identity_check stores result + masked last-4; the full number is never sent.
export async function verifyIdentityChannel(formData: FormData) {
  const { supabase } = await supplierClient();
  const channel = String(formData.get("channel")); // email | phone | aadhaar
  const last4 = str(formData.get("last4"));
  const { error } = await supabase.rpc("set_identity_check", {
    p_channel: channel,
    p_verified: true,
    p_last4: last4,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/supplier");
}

// Portfolio certification. Insert re-opens a verified portfolio (content-reopen trigger) — fine.
export async function addCertification(formData: FormData) {
  const { supabase, org_id } = await supplierClient();
  const category = str(formData.get("category")) ?? "ISO";
  const name = str(formData.get("name")) ?? category;
  const { error } = await supabase.from("certifications").insert({
    org_id,
    kind: "standard",
    category,
    name,
    field_status: "uploaded",
    does_not_expire: true,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/supplier");
}

// Submit a section for review, then AUTO-VERIFY it (BP-1 demo shim). submit_section
// enforces the V3/V4/V5 gates in the DB; demo_verify_my_section runs the real reviewer
// path. The UI disables Submit until gates are met, so a thrown gate error is a safety net.
export async function submitSection(formData: FormData) {
  const { supabase } = await supplierClient();
  const kind = String(formData.get("kind"));
  const { error: subErr } = await supabase.rpc("submit_section", { p_kind: kind });
  if (subErr) throw new Error(subErr.message);
  const { error: verErr } = await supabase.rpc("demo_verify_my_section", { p_kind: kind });
  if (verErr) throw new Error(verErr.message);
  revalidatePath("/supplier");
}

// ============================================================================
// Rich onboarding (design-faithful) — one structured save per section. Each takes
// the whole section payload from its client form and persists it (profile columns,
// the 0008/0009 jsonb + detail tables, and demo "uploaded" document rows). Editing
// re-opens a verified section via the content/detail reopen triggers (decision #2).
// ============================================================================

export type IdentityPayload = {
  company: string;
  contactName: string;
  designation: string;
  email: string;
  emailLanguage: string;
  phone: string;
  altContact: string;
  website: string;
  established: string; // yyyy-mm-dd
  yearsInBusiness: string;
  natureOfBusiness: string;
  directors: { name: string; contact: string; email: string; aadhaarVerified: boolean; aadhaarLast4: string }[];
  docs: { type: "GST" | "PAN" | "MSME" | "CIN"; number: string; uploaded: boolean; storagePath?: string }[];
};

export async function saveIdentity(p: IdentityPayload) {
  const { supabase, org_id } = await supplierClient();

  if (p.company?.trim()) {
    const { error } = await supabase.from("orgs").update({ name: p.company.trim() }).eq("id", org_id);
    if (error) throw new Error(error.message);
  }

  const { error: eProf } = await supabase
    .from("supplier_profiles")
    .update({
      contact_name: p.contactName || null,
      designation: p.designation || null,
      email_language: p.emailLanguage || null,
      phone: p.phone || null,
      alt_contact: p.altContact || null,
      website: p.website || null,
      established_date: p.established || null,
      years_in_business: p.yearsInBusiness ? Number(p.yearsInBusiness) : null,
      nature_of_business: p.natureOfBusiness || null,
    })
    .eq("org_id", org_id);
  if (eProf) throw new Error(eProf.message);

  // Directors — replace the whole set.
  await supabase.from("supplier_directors").delete().eq("org_id", org_id);
  const dirs = (p.directors ?? [])
    .filter((d) => d.name?.trim())
    .map((d) => ({
      org_id,
      name: d.name.trim(),
      contact: d.contact || null,
      email: d.email || null,
      aadhaar_verified: !!d.aadhaarVerified,
      aadhaar_last4: d.aadhaarLast4 || null,
    }));
  if (dirs.length) {
    const { error } = await supabase.from("supplier_directors").insert(dirs);
    if (error) throw new Error(error.message);
  }

  // Registration docs (GST/PAN/MSME/CIN) — replace, storing the number + demo "uploaded".
  await supabase.from("documents").delete().eq("org_id", org_id).eq("section_kind", "identity").in("doc_type", ["GST", "PAN", "MSME", "CIN"]);
  const docs = (p.docs ?? [])
    .filter((d) => d.number?.trim() || d.uploaded)
    .map((d) => ({ org_id, section_kind: "identity", doc_type: d.type, doc_number: d.number || null, status: "uploaded", storage_path: d.storagePath || null }));
  if (docs.length) {
    const { error } = await supabase.from("documents").insert(docs);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/supplier");
}

export type FinancialsPayload = {
  bankCountry: string;
  bankName: string;
  beneficiaryName: string;
  routingType: string;
  routingCode: string;
  accountNumber: string;
  billing: Record<string, string>;
  legal: Record<string, string>;
  mgt7: { year: string; uploaded: boolean; storagePath?: string }[];
  signedForm: { uploaded: boolean; storagePath?: string };
  rpt: { uploaded: boolean; storagePath?: string };
  taxDoc: { uploaded: boolean; storagePath?: string };
  otherDocs: { fileName: string; storagePath?: string }[];
};

export async function saveFinancials(p: FinancialsPayload) {
  const { supabase, org_id } = await supplierClient();

  const { error: eFin } = await supabase.from("supplier_financials").upsert(
    {
      org_id,
      bank_country: p.bankCountry || null,
      bank_name: p.bankName || null,
      beneficiary_name: p.beneficiaryName || null,
      routing_type: p.routingType || null,
      routing_code: p.routingCode || null,
      account_number: p.accountNumber || null,
      billing: p.billing ?? {},
      legal: p.legal ?? {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id" },
  );
  if (eFin) throw new Error(eFin.message);

  // Financial docs — replace MGT7 (per FY) + single docs.
  await supabase.from("documents").delete().eq("org_id", org_id).eq("section_kind", "financials");
  const rows: any[] = [];
  (p.mgt7 ?? []).forEach((m) => {
    if (m.uploaded) rows.push({ org_id, section_kind: "financials", doc_type: "MGT7", fy: m.year, status: "uploaded", storage_path: m.storagePath || null });
  });
  if (p.signedForm?.uploaded) rows.push({ org_id, section_kind: "financials", doc_type: "SignedForm", status: "uploaded", storage_path: p.signedForm.storagePath || null });
  if (p.rpt?.uploaded) rows.push({ org_id, section_kind: "financials", doc_type: "RPT", status: "uploaded", storage_path: p.rpt.storagePath || null });
  if (p.taxDoc?.uploaded) rows.push({ org_id, section_kind: "financials", doc_type: "TaxDoc", status: "uploaded", storage_path: p.taxDoc.storagePath || null });
  (p.otherDocs ?? []).forEach((o, i) =>
    rows.push({ org_id, section_kind: "financials", doc_type: "OtherFin", fy: `other-${i}`, status: "uploaded", storage_path: o.storagePath || null }),
  );
  if (rows.length) {
    const { error } = await supabase.from("documents").insert(rows);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/supplier");
}

export type PortfolioPayload = {
  mission: string;
  logoUploaded: boolean;
  logoPath?: string;
  production: Record<string, string>;
  tradeTerms: Record<string, string>;
  capabilities: string[];
  products: { name: string; category: string; material: string; moq: string; priceRange: string }[];
  facilityPhotos: { fileName: string; storagePath?: string }[];
  workHistory: { clientName: string; role: string; frequency: string; startYear: string; endYear: string; description: string }[];
  catalogue: { fileName: string; storagePath?: string }[];
  tags: string[];
  certs: {
    category: string;
    name: string;
    number: string;
    issuingBody: string;
    scope: string;
    facility: string;
    issueDate: string;
    expiryDate: string;
    doesNotExpire: boolean;
    lastAuditDate: string;
    nextAuditDate: string;
    verificationUrl: string;
    buyerName: string;
    auditType: string;
    auditDate: string;
    outcome: string;
  }[];
};

const OUTCOME_MAP: Record<string, string> = {
  Passed: "passed",
  "Passed with corrective actions": "passed_with_corrective",
  Failed: "failed",
  Pending: "pending",
};

export async function savePortfolio(p: PortfolioPayload) {
  const { supabase, org_id } = await supplierClient();

  const { error: eProf } = await supabase
    .from("supplier_profiles")
    .update({
      mission: p.mission || null,
      logo_path: p.logoUploaded ? p.logoPath || "uploaded" : null,
      production: p.production ?? {},
      trade_terms: p.tradeTerms ?? {},
      customization_capabilities: p.capabilities ?? [],
      products: p.products ?? [],
      facility_photos: (p.facilityPhotos ?? []).map((ph) => ({ fileName: ph.fileName, path: ph.storagePath || null })),
      // map the form's work-history shape to the 0008 shape the buyer profile reads
      work_history: (p.workHistory ?? []).map((w) => ({
        client: w.clientName,
        role: w.role,
        frequency: w.frequency,
        start: w.startYear,
        end: w.endYear,
        desc: w.description,
      })),
      catalogue: (p.catalogue ?? []).map((c) => ({ fileName: c.fileName, path: c.storagePath || null })),
      tags: p.tags ?? [],
    })
    .eq("org_id", org_id);
  if (eProf) throw new Error(eProf.message);

  // Certifications — replace the whole set.
  await supabase.from("certifications").delete().eq("org_id", org_id);
  const certs = (p.certs ?? [])
    .filter((c) => c.category)
    .map((c) => {
      const isAudit = c.category === "Buyer / Brand Audits";
      const isRegulatory = c.category === "Indian Regulatory & Legal Compliance";
      return {
        org_id,
        kind: isAudit ? "audit" : isRegulatory ? "regulatory" : "standard",
        category: c.category,
        name: isAudit ? c.auditType || "Audit" : c.name || c.category,
        issuer: c.issuingBody || null,
        number: c.number || null,
        scope: c.scope || null,
        facility: c.facility || null,
        issue_date: c.issueDate || null,
        expiry_date: c.doesNotExpire ? null : c.expiryDate || null,
        does_not_expire: !!c.doesNotExpire,
        field_status: "uploaded",
        last_audit_date: c.lastAuditDate || null,
        next_audit_date: c.nextAuditDate || null,
        verification_url: c.verificationUrl || null,
        audit_buyer: isAudit ? c.buyerName || null : null,
        audit_type: isAudit ? c.auditType || null : null,
        audit_date: isAudit ? c.auditDate || null : null,
        audit_outcome: isAudit ? OUTCOME_MAP[c.outcome] ?? "pending" : null,
      };
    });
  if (certs.length) {
    const { error } = await supabase.from("certifications").insert(certs);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/supplier");
}

// Object-form OTP verify (rich Identity form calls this directly on each confirm).
export async function verifyChannel(channel: "email" | "phone" | "aadhaar", last4?: string) {
  const { supabase } = await supplierClient();
  const { error } = await supabase.rpc("set_identity_check", { p_channel: channel, p_verified: true, p_last4: last4 ?? null });
  if (error) throw new Error(error.message);
  revalidatePath("/supplier");
}

// Object-form section submit → auto-verify (demo). Gates enforced in the DB.
export async function submitOnboardingSection(kind: "identity" | "financials" | "portfolio") {
  const { supabase } = await supplierClient();
  const { error: subErr } = await supabase.rpc("submit_section", { p_kind: kind });
  if (subErr) throw new Error(subErr.message);
  const { error: verErr } = await supabase.rpc("demo_verify_my_section", { p_kind: kind });
  if (verErr) throw new Error(verErr.message);
  revalidatePath("/supplier");
}

// ── FE-3 · sourcing ─────────────────────────────────────────────────────────

// Upsert the supplier's one live quote (V12). draft=1 saves without submitting;
// otherwise submit_quote enforces V11 (RFQ active + verified + invited-if-invite-only).
export async function submitQuote(formData: FormData) {
  const { supabase } = await supplierClient();
  const rfq_id = String(formData.get("rfq_id"));
  const asDraft = formData.get("draft") === "1";
  const { error } = await supabase.rpc("submit_quote", {
    p_rfq_id: rfq_id,
    p_unit_price: num(formData.get("unit_price")),
    p_currency: str(formData.get("currency")) ?? "INR",
    p_quantity_fulfil: num(formData.get("quantity_fulfil")),
    p_moq: num(formData.get("moq")),
    p_bulk_lead_time: str(formData.get("bulk_lead_time")),
    p_incoterm: str(formData.get("incoterm")),
    p_payment_terms: str(formData.get("payment_terms")),
    p_notes: str(formData.get("notes")),
    p_submit: !asDraft,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/supplier/rfqs/${rfq_id}`);
  revalidatePath("/supplier/quotes");
  redirect("/supplier/quotes");
}

export async function respondInvitation(formData: FormData) {
  const { supabase } = await supplierClient();
  const rfq_id = String(formData.get("rfq_id"));
  const accept = formData.get("accept") === "1";
  const { error } = await supabase.rpc("respond_invitation", { p_rfq_id: rfq_id, p_accept: accept });
  if (error) throw new Error(error.message);
  revalidatePath("/supplier/invitations");
}

// FE-4: supplier edits their own public profile.
export async function updateSupplierProfile(formData: FormData) {
  const { supabase, org_id } = await supplierClient();
  const { error: e1 } = await supabase.from("orgs").update({ location: str(formData.get("location")) }).eq("id", org_id);
  if (e1) throw new Error(e1.message);
  const { error: e2 } = await supabase
    .from("supplier_profiles")
    .update({ mission: str(formData.get("mission")), years_in_business: num(formData.get("years_in_business")) })
    .eq("org_id", org_id);
  if (e2) throw new Error(e2.message);
  revalidatePath("/supplier/profile");
}
