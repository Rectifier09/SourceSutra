"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function str(v: FormDataEntryValue | null): string | null {
  const s = (v ?? "").toString().trim();
  return s === "" ? null : s;
}

// ============================================================================
// Create-RFQ wizard (5 steps, CustomerCreateRFQ.dc.html) — one structured save
// per step/draft-save, mapped onto the real rfqs columns from migration 0003.
// Fields with no dedicated column (product category, manufacturing arrangement,
// size/colour lists, delivery address parts, shipping/incoterm/payment prefs,
// documents, etc.) go into `spec` jsonb — its stated purpose since 0003:
// "catch-all for descriptive wizard fields not otherwise structured".
// ============================================================================

export type RfqDraftPayload = {
  title: string;
  contractType: string;
  quantity: string;
  unit: string;
  whoCanRespond: "open" | "verified_only" | "invite";
  preferredLocation: string;
  minYearsExperience: string;
  requiredCerts: { category: string; name: string; priority: "must" | "nice" }[];
  customizationNeeds: string[];
  pricingApproach: string;
  targetPrice: string;
  currency: string;
  sampleRequired: boolean;
  sampleType: string;
  sampleCount: string;
  sampleDeadline: string;
  sampleShipPaidBy: string;
  bidStart: string;
  bidEnd: string;
  deliveryDate: string;
  spec: Record<string, unknown>;
};

// Insert (id === null) or update (RLS: only while status='draft') the wizard's
// draft RFQ row. Called on every "Save as draft" and on each step's "Next".
export async function saveRfqDraft(id: string | null, p: RfqDraftPayload): Promise<{ id: string }> {
  const supabase = await createClient();
  const { data: me } = await supabase.from("v_me").select("org_id, role").maybeSingle();
  if (!me || me.role !== "buyer") throw new Error("Not a buyer");

  const row = {
    title: p.title.trim() || "Untitled RFQ",
    contract_type: p.contractType || null,
    quantity: p.quantity ? Number(p.quantity) : null,
    unit: p.unit || null,
    who_can_respond: p.whoCanRespond,
    preferred_location: p.preferredLocation || null,
    min_years_experience: p.minYearsExperience ? Number(p.minYearsExperience) : null,
    required_certs: p.requiredCerts,
    customization_needs: p.customizationNeeds,
    pricing_approach: p.pricingApproach || null,
    target_price: p.targetPrice ? Number(p.targetPrice) : null,
    currency: p.currency || "INR",
    sample_required: p.sampleRequired,
    sample_type: p.sampleRequired ? p.sampleType || null : null,
    sample_count: p.sampleRequired && p.sampleCount ? Number(p.sampleCount) : null,
    sample_deadline: p.sampleRequired ? p.sampleDeadline || null : null,
    sample_ship_paid_by: p.sampleRequired ? p.sampleShipPaidBy || null : null,
    bid_start: p.bidStart || null,
    bid_end: p.bidEnd || null,
    delivery_date: p.deliveryDate || null,
    spec: p.spec,
  };

  if (id) {
    const { error } = await supabase.from("rfqs").update(row).eq("id", id);
    if (error) throw new Error(error.message);
    // The update RLS policy only allows this while status='draft', so a
    // successful update here always means the RFQ is still sitting in draft.
    try {
      await supabase.rpc("log_event", { p_type: "RfqInDraft" });
    } catch {
      // best-effort
    }
    return { id };
  }
  // Generate the id client-side and skip .select() on insert: INSERT...RETURNING requires
  // the new row to pass the rfqs_read SELECT policy (can_view_rfq), whose internal re-query
  // of rfqs doesn't reliably see the not-yet-committed row within the same command.
  const newId = randomUUID();
  const { error } = await supabase.from("rfqs").insert({ ...row, id: newId, buyer_org_id: me.org_id, status: "draft" });
  if (error) throw new Error(error.message);
  try {
    await supabase.rpc("log_event", { p_type: "RfqCreated" });
  } catch {
    // best-effort
  }
  return { id: newId };
}

// Step 5 "Publish": invite anyone picked (invite-only audience) then publish
// (draft -> active; V6/V7 bid-window/delivery-date checks enforced in the DB).
export async function publishRfqWizard(id: string, inviteOrgIds: string[]) {
  const supabase = await createClient();
  for (const orgId of inviteOrgIds) {
    const { error } = await supabase.rpc("invite_supplier", { p_rfq_id: id, p_supplier_org: orgId });
    if (error) throw new Error(error.message);
  }
  const { error } = await supabase.rpc("publish_rfq", { p_rfq_id: id });
  if (error) throw new Error(error.message);
  revalidatePath(`/buyer/rfqs/${id}`);
  revalidatePath("/buyer");
}

// draft -> active (V6/V7 enforced in the DB function).
export async function publishRfq(formData: FormData) {
  const id = String(formData.get("rfq_id"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("publish_rfq", { p_rfq_id: id });
  if (error) throw new Error(error.message);
  revalidatePath(`/buyer/rfqs/${id}`);
}

// Manual, reversible triage: submitted <-> under_review <-> shortlisted.
export async function triageQuote(formData: FormData) {
  const quote_id = String(formData.get("quote_id"));
  const rfq_id = String(formData.get("rfq_id"));
  const p_new_status = String(formData.get("status"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_quote_triage", { p_quote_id: quote_id, p_new_status });
  if (error) throw new Error(error.message);
  revalidatePath(`/buyer/rfqs/${rfq_id}`);
}

// The atomic award (irreversible in v1).
export async function awardQuote(formData: FormData) {
  const quote_id = String(formData.get("quote_id"));
  const rfq_id = String(formData.get("rfq_id"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("award_quote", { p_quote_id: quote_id });
  if (error) throw new Error(error.message);
  revalidatePath(`/buyer/rfqs/${rfq_id}`);
}

export async function rejectQuote(formData: FormData) {
  const quote_id = String(formData.get("quote_id"));
  const rfq_id = String(formData.get("rfq_id"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_quote", { p_quote_id: quote_id });
  if (error) throw new Error(error.message);
  revalidatePath(`/buyer/rfqs/${rfq_id}`);
}

// FE-4: invite a specific verified supplier to an RFQ (invite-only audience).
export async function inviteSupplier(formData: FormData) {
  const rfq_id = String(formData.get("rfq_id"));
  const supplier_org = String(formData.get("supplier_org"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("invite_supplier", { p_rfq_id: rfq_id, p_supplier_org: supplier_org });
  if (error) throw new Error(error.message);
  revalidatePath(`/buyer/rfqs/${rfq_id}`);
}

// FE-4: buyer edits their own org + account details.
export async function updateBuyerProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: me } = await supabase.from("v_me").select("org_id, role").maybeSingle();
  if (!me || me.role !== "buyer") throw new Error("Not a buyer");

  const name = str(formData.get("org_name"));
  const products = str(formData.get("products_sourced"));
  const productsArr = products ? products.split(",").map((s) => s.trim()).filter(Boolean) : [];

  const orgPatch: Record<string, string | null> = { location: str(formData.get("location")) };
  if (name) orgPatch.name = name; // orgs.name is NOT NULL — only overwrite when provided
  const { error: e1 } = await supabase.from("orgs").update(orgPatch).eq("id", me.org_id);
  if (e1) throw new Error(e1.message);

  const { error: e2 } = await supabase
    .from("buyer_accounts")
    .update({ phone: str(formData.get("phone")), products_sourced: productsArr })
    .eq("org_id", me.org_id);
  if (e2) throw new Error(e2.message);
  try {
    await supabase.rpc("log_event", { p_type: "ProfileUpdated" });
  } catch {
    // best-effort
  }
  revalidatePath("/buyer/profile");
}
