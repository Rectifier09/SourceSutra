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
