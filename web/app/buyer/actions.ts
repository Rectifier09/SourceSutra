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
