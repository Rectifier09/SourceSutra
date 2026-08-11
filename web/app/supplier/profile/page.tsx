import { redirect } from "next/navigation";
import { getMe } from "@/lib/me";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/app/_components/Header";
import { updateSupplierProfile } from "@/app/supplier/actions";

const labelText = "text-[13px] font-semibold text-muted";
const input = "rounded-lg border border-line bg-white px-3 py-2.5 text-[14.5px] text-ink placeholder:text-muted/60";

export default async function SupplierProfileEdit() {
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.role !== "supplier") redirect("/buyer");

  const supabase = await createClient();
  const [{ data: org }, { data: profile }] = await Promise.all([
    supabase.from("orgs").select("name, location").eq("id", me.org_id).maybeSingle(),
    supabase.from("supplier_profiles").select("mission, years_in_business").eq("org_id", me.org_id).maybeSingle(),
  ]);

  const initials =
    (org?.name ?? me.org_name ?? "")
      .split(" ")
      .slice(0, 2)
      .map((w: string) => w[0])
      .join("")
      .toUpperCase() || "SS";

  return (
    <>
      <Header me={me} />
      <main className="mx-auto w-full max-w-[860px] flex-1 px-6 pb-20 pt-8">
        <div className="mb-5 flex flex-wrap items-center gap-4">
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-[16px] bg-lav1 font-display text-[22px] font-semibold text-primary">
            {initials}
          </div>
          <div>
            <h1 className="font-display text-[26px] font-medium text-ink">{org?.name ?? me.org_name}</h1>
            <p className="text-[13.5px] text-muted">Public profile · what buyers see when they discover you</p>
          </div>
          <span className="ml-auto whitespace-nowrap rounded-full bg-sagebg px-3 py-1.5 text-[11.5px] font-semibold text-sage">
            Supplier
          </span>
        </div>

        <form action={updateSupplierProfile} className="rounded-[16px] border border-line bg-cream px-6 py-7 sm:px-8">
          <div className="flex flex-col gap-3.5">
            <label className="flex flex-col gap-1.5">
              <span className={labelText}>Mission / about</span>
              <textarea
                name="mission"
                rows={3}
                defaultValue={profile?.mission ?? ""}
                placeholder="What your factory does best."
                className={input}
              />
            </label>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className={labelText}>City / region</span>
                <input name="location" defaultValue={org?.location ?? ""} placeholder="e.g. Tiruppur, Tamil Nadu" className={input} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelText}>Years in business</span>
                <input name="years_in_business" type="number" min="0" defaultValue={profile?.years_in_business ?? ""} className={input} />
              </label>
            </div>
          </div>

          <div className="mt-6">
            <button className="rounded-lg bg-primary px-5 py-3 text-[14.5px] font-semibold text-cream hover:opacity-90">
              Save changes
            </button>
          </div>
        </form>
      </main>
    </>
  );
}
