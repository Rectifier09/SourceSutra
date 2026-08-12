import { redirect } from "next/navigation";
import { getMe } from "@/lib/me";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/app/_components/Header";
import { updateBuyerProfile } from "@/app/buyer/actions";
import { BuyerProfileForm } from "./_components/BuyerProfileForm";
import { APP_BG_CLASS, DEFAULT_BG } from "@/lib/appBackground";

export default async function BuyerProfile() {
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.role !== "buyer") redirect("/supplier");

  const supabase = await createClient();
  const [{ data: org }, { data: acct }, { data: auth }] = await Promise.all([
    supabase.from("orgs").select("name, location").eq("id", me.org_id).maybeSingle(),
    supabase.from("buyer_accounts").select("products_sourced, phone").eq("org_id", me.org_id).maybeSingle(),
    supabase.auth.getUser(),
  ]);

  return (
    <>
      <Header me={me} />
      <main className={`flex flex-1 flex-col ${APP_BG_CLASS}`} style={{ backgroundImage: DEFAULT_BG }}>
        <BuyerProfileForm
          action={updateBuyerProfile}
          fullName={me.full_name ?? ""}
          email={auth?.user?.email ?? "—"}
          orgName={org?.name ?? ""}
          location={org?.location ?? ""}
          phone={acct?.phone ?? ""}
          products={acct?.products_sourced ?? []}
        />
      </main>
    </>
  );
}
