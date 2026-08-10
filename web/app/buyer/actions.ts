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

// Create a draft RFQ (RLS allows a buyer to insert their own draft).
export async function createRfq(formData: FormData) {
  const supabase = await createClient();
  const { data: me } = await supabase.from("v_me").select("org_id, role").maybeSingle();
  if (!me || me.role !== "buyer") throw new Error("Not a buyer");

  const { data, error } = await supabase
    .from("rfqs")
    .insert({
      buyer_org_id: me.org_id,
      status: "draft",
      title: str(formData.get("title")) ?? "Untitled RFQ",
      who_can_respond: str(formData.get("who_can_respond")) ?? "open",
      quantity: num(formData.get("quantity")),
      unit: str(formData.get("unit")),
      contract_type: str(formData.get("contract_type")),
      preferred_location: str(formData.get("preferred_location")),
      min_years_experience: num(formData.get("min_years_experience")),
      bid_start: str(formData.get("bid_start")),
      bid_end: str(formData.get("bid_end")),
      delivery_date: str(formData.get("delivery_date")),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  redirect(`/buyer/rfqs/${data.id}`);
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
  revalidatePath("/buyer/profile");
}
