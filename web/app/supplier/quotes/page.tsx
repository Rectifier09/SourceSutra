import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/me";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/app/_components/Header";
import { SupplierNav } from "@/app/supplier/_components/SupplierNav";

const QUOTE_PILL: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  submitted: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  under_review: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  shortlisted: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  awarded: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  not_selected: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  closed: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

export default async function MyQuotes() {
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.role !== "supplier") redirect("/buyer");

  const supabase = await createClient();
  const { data: quotes } = await supabase
    .from("quotes")
    // pin the FK: rfqs<->quotes has two relationships (rfq_id + awarded_quote_id)
    .select("id, rfq_id, status, unit_price, currency, submitted_at, rfqs!quotes_rfq_id_fkey(title, status)")
    .eq("supplier_org_id", me.org_id)
    .order("created_at", { ascending: false });

  return (
    <>
      <Header me={me} />
      <SupplierNav active="/supplier/quotes" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <h2 className="text-xl font-semibold tracking-tight">My Quotes</h2>

        <div className="mt-6 space-y-3">
          {(quotes ?? []).map((q: any) => {
            const rfq = Array.isArray(q.rfqs) ? q.rfqs[0] : q.rfqs;
            return (
              <Link
                key={q.id}
                href={`/supplier/rfqs/${q.rfq_id}`}
                className="flex items-center justify-between gap-4 rounded-xl border border-black/10 p-4 hover:bg-black/[0.02] dark:border-white/10 dark:hover:bg-white/[0.03]"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{rfq?.title ?? "RFQ"}</div>
                  <div className="mt-0.5 text-xs text-black/50 dark:text-white/50 capitalize">
                    RFQ {rfq?.status ?? ""}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="text-right font-semibold tabular-nums">
                    {q.currency ?? "INR"} {q.unit_price ?? "—"}
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${QUOTE_PILL[q.status] ?? ""}`}>
                    {q.status.replace("_", " ")}
                  </span>
                </div>
              </Link>
            );
          })}
          {(!quotes || quotes.length === 0) && (
            <div className="rounded-xl border border-dashed border-black/15 px-5 py-10 text-center text-sm text-black/50 dark:border-white/15 dark:text-white/50">
              No quotes yet.{" "}
              <Link href="/supplier/discover" className="font-medium underline">
                Discover RFQs
              </Link>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
