import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/me";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/app/_components/Header";

const QUOTE_PILL: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  submitted: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  under_review: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  shortlisted: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  awarded: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  not_selected: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  closed: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

export default async function Discover() {
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.role !== "supplier") redirect("/buyer");

  const supabase = await createClient();
  const [{ data: rfqs }, { data: myQuotes }, { data: overall }] = await Promise.all([
    // RLS (can_view_rfq) already scopes this to what THIS supplier may see:
    // active RFQs, verified-only if verified, invite-only only if invited.
    supabase
      .from("rfqs")
      .select(
        "id, title, quantity, unit, contract_type, preferred_location, bid_end, delivery_date, who_can_respond, currency, target_price, orgs!rfqs_buyer_org_id_fkey(name, location)"
      )
      .eq("status", "active")
      .order("published_at", { ascending: false }),
    supabase.from("quotes").select("rfq_id, status, unit_price, currency").eq("supplier_org_id", me.org_id),
    supabase.from("v_supplier_overall").select("overall_status").eq("org_id", me.org_id).maybeSingle(),
  ]);

  const quoteOf: Record<string, any> = {};
  (myQuotes ?? []).forEach((q: any) => (quoteOf[q.rfq_id] = q));
  const verified = overall?.overall_status === "Onboarding Completed";

  return (
    <>
      <Header me={me} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <h2 className="text-xl font-semibold tracking-tight">Discover RFQs</h2>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Open buying requests you&apos;re eligible to quote on.
        </p>

        {!verified && (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-900/20 dark:text-amber-300">
            Finish onboarding to become discoverable and quote on RFQs.{" "}
            <Link href="/supplier" className="font-medium underline">
              Go to onboarding
            </Link>
          </div>
        )}

        <div className="mt-6 space-y-3">
          {(rfqs ?? []).map((r: any) => {
            const buyer = Array.isArray(r.orgs) ? r.orgs[0] : r.orgs;
            const mine = quoteOf[r.id];
            return (
              <Link
                key={r.id}
                href={`/supplier/rfqs/${r.id}`}
                className="block rounded-xl border border-black/10 p-4 hover:bg-black/[0.02] dark:border-white/10 dark:hover:bg-white/[0.03]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{r.title}</div>
                    <div className="mt-0.5 text-xs text-black/50 dark:text-white/50">
                      {buyer?.name ?? "Buyer"}
                      {r.preferred_location ? ` · ${r.preferred_location}` : ""}
                      {r.who_can_respond === "invite" ? " · invite-only" : ""}
                    </div>
                  </div>
                  {mine ? (
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${QUOTE_PILL[mine.status] ?? ""}`}>
                      {mine.status.replace("_", " ")}
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-black/5 px-2.5 py-0.5 text-xs font-medium text-black/60 dark:bg-white/10 dark:text-white/60">
                      Not quoted
                    </span>
                  )}
                </div>
                <div className="mt-2 text-sm text-black/60 dark:text-white/60">
                  {r.quantity ? `${r.quantity} ${r.unit ?? ""} · ` : ""}
                  {r.contract_type ? `${r.contract_type} · ` : ""}
                  {r.bid_end ? `bids close ${r.bid_end}` : ""}
                  {r.delivery_date ? ` · delivery ${r.delivery_date}` : ""}
                </div>
              </Link>
            );
          })}
          {(!rfqs || rfqs.length === 0) && (
            <div className="rounded-xl border border-dashed border-black/15 px-5 py-10 text-center text-sm text-black/50 dark:border-white/15 dark:text-white/50">
              No open RFQs you&apos;re eligible for right now.
            </div>
          )}
        </div>
      </main>
    </>
  );
}
