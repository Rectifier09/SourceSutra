"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function str(v: FormDataEntryValue | null): string {
  return (v ?? "").toString().trim();
}

// Completes an OAuth (Google) signup — see /auth/callback and
// finish_oauth_signup (migration 0012). provision_account already created a
// default buyer org from Google's claims alone; this fills in what Google
// couldn't (chosen role, company, products, phone, consent).
export async function finishOAuthSignup(formData: FormData) {
  const role = str(formData.get("role")) === "supplier" ? "supplier" : "buyer";
  const company = str(formData.get("company"));
  const phone = [str(formData.get("area_code")), str(formData.get("phone"))].filter(Boolean).join(" ");
  const products = str(formData.get("products_sourced"));
  const productsArr = products ? products.split(",").map((s) => s.trim()).filter(Boolean) : [];

  const supabase = await createClient();
  const { error } = await supabase.rpc("finish_oauth_signup", {
    p_role: role,
    p_company: company,
    p_phone: phone || null,
    p_products: productsArr,
    p_consent_version: "v1",
  });
  if (error) throw new Error(error.message);

  redirect(role === "supplier" ? "/supplier/welcome" : "/buyer");
}
