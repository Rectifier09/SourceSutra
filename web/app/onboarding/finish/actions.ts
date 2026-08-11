"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function str(v: FormDataEntryValue | null): string {
  return (v ?? "").toString().trim();
}

// Completes an OAuth (Google) signup — see /auth/callback and
// finish_oauth_signup (migration 0012). provision_account already created a
// default buyer org from Google's claims alone; this fills in what Google
// couldn't (final role choice, company, products, phone, consent) and lets
// the user correct the name Google supplied before it's saved.
export async function finishOAuthSignup(formData: FormData) {
  const role = str(formData.get("role")) === "supplier" ? "supplier" : "buyer";
  const full_name = `${str(formData.get("first_name"))} ${str(formData.get("last_name"))}`.trim();
  const company = str(formData.get("company"));
  const phone = [str(formData.get("area_code")), str(formData.get("phone"))].filter(Boolean).join(" ");
  const products = str(formData.get("products_sourced"));
  const productsArr = products ? products.split(",").map((s) => s.trim()).filter(Boolean) : [];

  const supabase = await createClient();

  if (full_name) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { error: nameError } = await supabase.from("profiles").update({ full_name }).eq("id", user.id);
      if (nameError) throw new Error(nameError.message);
    }
  }

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
