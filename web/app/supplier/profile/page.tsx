import { redirect } from "next/navigation";
import { getMe } from "@/lib/me";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/app/_components/Header";
import { SupplierNav } from "@/app/supplier/_components/SupplierNav";
import { updateSupplierProfile } from "@/app/supplier/actions";

const field = "mt-1 w-full rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20 dark:bg-transparent";

export default async function SupplierProfileEdit() {
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.role !== "supplier") redirect("/buyer");

  const supabase = await createClient();
  const [{ data: org }, { data: profile }] = await Promise.all([
    supabase.from("orgs").select("name, location").eq("id", me.org_id).maybeSingle(),
    supabase.from("supplier_profiles").select("mission, years_in_business").eq("org_id", me.org_id).maybeSingle(),
  ]);

  return (
    <>
      <Header me={me} />
      <SupplierNav active="/supplier/profile" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <h2 className="text-xl font-semibold tracking-tight">Public profile</h2>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          What buyers see when they discover {org?.name ?? "your company"}.
        </p>

        <form action={updateSupplierProfile} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-xs text-black/55 dark:text-white/55">Location</span>
            <input name="location" defaultValue={org?.location ?? ""} placeholder="City, State" className={field} />
          </label>
          <label className="block">
            <span className="text-xs text-black/55 dark:text-white/55">Years in business</span>
            <input name="years_in_business" type="number" min="0" defaultValue={profile?.years_in_business ?? ""} className={field} />
          </label>
          <label className="block">
            <span className="text-xs text-black/55 dark:text-white/55">Mission / about</span>
            <textarea name="mission" rows={3} defaultValue={profile?.mission ?? ""} placeholder="What your factory does best." className={field} />
          </label>
          <button className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/85 dark:bg-white dark:text-black dark:hover:bg-white/85">
            Save changes
          </button>
        </form>
      </main>
    </>
  );
}
