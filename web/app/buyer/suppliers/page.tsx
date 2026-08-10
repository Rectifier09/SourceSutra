import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/me";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/app/_components/Header";

export default async function DiscoverSuppliers() {
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.role !== "buyer") redirect("/supplier");

  const supabase = await createClient();
  const [{ data: suppliers }, { data: badges }] = await Promise.all([
    // v_supplier_directory = verified suppliers only (definer view past onboarding RLS).
    supabase.from("v_supplier_directory").select("org_id, name, location, mission, years_in_business").order("name"),
    supabase.from("v_cert_badges").select("org_id, name, badge_buyer"),
  ]);

  const badgesByOrg: Record<string, any[]> = {};
  (badges ?? []).forEach((b: any) => (badgesByOrg[b.org_id] ??= []).push(b));

  return (
    <>
      <Header me={me} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <h2 className="text-xl font-semibold tracking-tight">Verified suppliers</h2>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Onboarded, verified textile suppliers you can invite to your RFQs.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {(suppliers ?? []).map((s: any) => {
            const bs = badgesByOrg[s.org_id] ?? [];
            return (
              <Link
                key={s.org_id}
                href={`/buyer/suppliers/${s.org_id}`}
                className="block rounded-xl border border-black/10 p-5 hover:bg-black/[0.02] dark:border-white/10 dark:hover:bg-white/[0.03]"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{s.name}</span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    Verified
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-black/50 dark:text-white/50">
                  {s.location ?? "—"}
                  {s.years_in_business ? ` · ${s.years_in_business} yrs in business` : ""}
                </div>
                {s.mission && <p className="mt-2 text-sm text-black/70 dark:text-white/70">{s.mission}</p>}
                {bs.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {bs.slice(0, 4).map((b: any, i: number) => (
                      <span key={i} className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-black/60 dark:bg-white/10 dark:text-white/60">
                        {b.name} · {b.badge_buyer}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            );
          })}
          {(!suppliers || suppliers.length === 0) && (
            <div className="rounded-xl border border-dashed border-black/15 px-5 py-10 text-center text-sm text-black/50 sm:col-span-2 dark:border-white/15 dark:text-white/50">
              No verified suppliers yet.
            </div>
          )}
        </div>
      </main>
    </>
  );
}
