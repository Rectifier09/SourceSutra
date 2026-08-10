import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/me";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/app/_components/Header";

const BADGE_CLS: Record<string, string> = {
  Certified: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  Registered: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  "Expiring soon": "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  Expired: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  "Needs correction": "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  Claimed: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
};

export default async function SupplierProfile({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.role !== "buyer") redirect("/supplier");

  const supabase = await createClient();
  const [{ data: org }, { data: profile }, { data: badges }, { data: portfolio }] = await Promise.all([
    supabase.from("orgs").select("name, location").eq("id", orgId).maybeSingle(),
    supabase.from("supplier_profiles").select("mission, years_in_business").eq("org_id", orgId).maybeSingle(),
    supabase.from("v_cert_badges").select("id, name, category, badge_buyer, expiry_date").eq("org_id", orgId),
    // Portfolio docs ONLY. Identity/Financials are never fetched — and documents RLS
    // would hide them from a non-member buyer anyway (decision #5, §A.10).
    supabase.from("documents").select("id, doc_type, status").eq("org_id", orgId).eq("section_kind", "portfolio"),
  ]);

  if (!org) redirect("/buyer/suppliers");

  return (
    <>
      <Header me={me} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <Link href="/buyer/suppliers" className="text-sm text-black/50 hover:underline dark:text-white/50">
          ← Verified suppliers
        </Link>

        <div className="mt-2 flex items-center gap-2">
          <h2 className="text-xl font-semibold tracking-tight">{org.name}</h2>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            Verified
          </span>
        </div>
        <div className="mt-0.5 text-sm text-black/60 dark:text-white/60">
          {org.location ?? "—"}
          {profile?.years_in_business ? ` · ${profile.years_in_business} yrs in business` : ""}
        </div>
        {profile?.mission && <p className="mt-4 text-black/80 dark:text-white/80">{profile.mission}</p>}

        {/* Certifications & badges (buyer-facing labels) */}
        <section className="mt-8">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            Certifications
          </h3>
          <div className="mt-3 space-y-2">
            {(badges ?? []).map((b: any) => (
              <div key={b.id} className="flex items-center justify-between gap-3 rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10">
                <div>
                  <span className="font-medium">{b.name}</span>
                  <span className="ml-2 text-xs text-black/45 dark:text-white/45">
                    {b.category}
                    {b.expiry_date ? ` · exp ${b.expiry_date}` : ""}
                  </span>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_CLS[b.badge_buyer] ?? "bg-black/5 text-black/60 dark:bg-white/10 dark:text-white/60"}`}>
                  {b.badge_buyer}
                </span>
              </div>
            ))}
            {(!badges || badges.length === 0) && (
              <div className="text-sm text-black/45 dark:text-white/45">No certifications listed.</div>
            )}
          </div>
        </section>

        {/* Portfolio (public docs only) */}
        <section className="mt-8">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            Portfolio
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {(portfolio ?? []).map((d: any) => (
              <span key={d.id} className="rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10">
                {d.doc_type}
              </span>
            ))}
            {(!portfolio || portfolio.length === 0) && (
              <div className="text-sm text-black/45 dark:text-white/45">No portfolio items yet.</div>
            )}
          </div>
          <p className="mt-3 text-xs text-black/40 dark:text-white/40">
            Identity & financial documents are private and never shown to buyers.
          </p>
        </section>
      </main>
    </>
  );
}
