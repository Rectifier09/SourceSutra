import { redirect } from "next/navigation";
import { getMe } from "@/lib/me";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/app/_components/Header";
import { DiscoverClient, type DirRow } from "./_components/DiscoverClient";

// Buyer "Discover suppliers" — the verified directory, reskinned to the prototype
// (CustomerDiscover): monogram cards over a botanical hero, live client-side
// filtering by company type / location / tag chips / search. Data is the enriched
// v_supplier_directory (migration 0008); filtering happens in DiscoverClient.
export default async function DiscoverSuppliers() {
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.role !== "buyer") redirect("/supplier");

  const supabase = await createClient();
  const { data: suppliers } = await supabase
    .from("v_supplier_directory")
    .select("org_id, name, location, mission, years_in_business, company_type, tags, logo_bg, logo_fg")
    .order("name");

  return (
    <>
      <Header me={me} />
      <DiscoverClient suppliers={(suppliers ?? []) as DirRow[]} />
    </>
  );
}
