"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function str(v: FormDataEntryValue | null): string {
  return (v ?? "").toString().trim();
}

// Public sign-up (BP-2): create a real Supabase account. The provisioning trigger
// (handle_new_user → provision_account, migration 0002) reads role/full_name/company/
// phone/products_sourced/consent_version from the signup metadata and creates the org,
// membership, and role-specific rows (supplier: profile + 3 onboarding sections;
// buyer: buyer_account). Email confirmations are OFF (local + cloud) → the session is
// established immediately, so we can redirect straight into the app.
//
// Google signup is a separate path — see RegisterForm's "Continue with Google"
// (supabase.auth.signInWithOAuth) → /auth/callback → /onboarding/finish, which
// completes provisioning via the finish_oauth_signup RPC (migration 0012) since
// OAuth never reaches this action at all.
export async function signUp(formData: FormData) {
  const email = str(formData.get("email"));
  const role = str(formData.get("role")) === "supplier" ? "supplier" : "buyer";
  const password = str(formData.get("password"));

  const full_name = `${str(formData.get("first_name"))} ${str(formData.get("last_name"))}`.trim();
  const company = str(formData.get("company"));
  const phone = [str(formData.get("area_code")), str(formData.get("phone"))].filter(Boolean).join(" ");
  const products = str(formData.get("products_sourced"));
  const productsArr = products ? products.split(",").map((s) => s.trim()).filter(Boolean) : [];

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role,
        full_name: full_name || "New user",
        company: company || full_name || "New company",
        phone,
        products_sourced: productsArr,
        consent_version: "v1",
      },
    },
  });
  if (error) throw new Error(error.message);

  // Confirmations off → a session should already exist. Belt-and-braces for any env
  // where it doesn't: sign in with the same credentials.
  if (!data.session) {
    const { error: e2 } = await supabase.auth.signInWithPassword({ email, password });
    if (e2) throw new Error(e2.message);
  }

  // Suppliers get the onboarding welcome/animation; buyers go straight to their dashboard.
  redirect(role === "supplier" ? "/supplier/welcome" : "/buyer");
}
