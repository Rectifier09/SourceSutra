"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEMO_PASSWORD, DEMO_PERSONAS } from "@/lib/demo";

// Sign in as one of the seeded demo personas (BP-1 — no public signup).
export async function signInAs(formData: FormData) {
  const email = String(formData.get("email"));
  const persona = DEMO_PERSONAS.find((p) => p.email === email);
  if (!persona) throw new Error("Unknown demo persona");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: DEMO_PASSWORD,
  });
  if (error) throw new Error(error.message);

  redirect(persona.role === "buyer" ? "/buyer" : "/supplier");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
