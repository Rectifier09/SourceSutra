import { createClient } from "@/lib/supabase/server";

// Mirrors the v_me view (0002): the caller's profile + org + role.
export type Me = {
  id: string;
  full_name: string | null;
  role: "buyer" | "supplier";
  org_id: string;
  org_kind: "buyer" | "supplier";
  org_name: string;
};

// Resolves the signed-in user's identity, or null if not authenticated.
export async function getMe(): Promise<Me | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("v_me").select("*").maybeSingle();
  return (data as Me) ?? null;
}
