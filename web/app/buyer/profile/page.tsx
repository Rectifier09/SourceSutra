import { redirect } from "next/navigation";
import { getMe } from "@/lib/me";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/app/_components/Header";
import { updateBuyerProfile } from "@/app/buyer/actions";

const field = "mt-1 w-full rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20 dark:bg-transparent";

export default async function BuyerProfile() {
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.role !== "buyer") redirect("/supplier");

  const supabase = await createClient();
  const [{ data: org }, { data: acct }] = await Promise.all([
    supabase.from("orgs").select("name, location").eq("id", me.org_id).maybeSingle(),
    supabase.from("buyer_accounts").select("products_sourced, phone").eq("org_id", me.org_id).maybeSingle(),
  ]);

  return (
    <>
      <Header me={me} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <h2 className="text-xl font-semibold tracking-tight">Company profile</h2>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">Your buyer organisation details.</p>

        <form action={updateBuyerProfile} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-xs text-black/55 dark:text-white/55">Company name</span>
            <input name="org_name" required defaultValue={org?.name ?? ""} className={field} />
          </label>
          <label className="block">
            <span className="text-xs text-black/55 dark:text-white/55">Location</span>
            <input name="location" defaultValue={org?.location ?? ""} placeholder="City, State" className={field} />
          </label>
          <label className="block">
            <span className="text-xs text-black/55 dark:text-white/55">Phone</span>
            <input name="phone" defaultValue={acct?.phone ?? ""} className={field} />
          </label>
          <label className="block">
            <span className="text-xs text-black/55 dark:text-white/55">Products sourced (comma-separated)</span>
            <input name="products_sourced" defaultValue={(acct?.products_sourced ?? []).join(", ")} placeholder="Knitwear, Woven tops" className={field} />
          </label>
          <button className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/85 dark:bg-white dark:text-black dark:hover:bg-white/85">
            Save changes
          </button>
        </form>
      </main>
    </>
  );
}
