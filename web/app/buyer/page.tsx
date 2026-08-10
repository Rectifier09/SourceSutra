import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/me";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/app/_components/Header";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  awarded: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  foreclosed: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  lapsed: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

export default async function BuyerHome() {
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.role !== "buyer") redirect("/supplier");

  const supabase = await createClient();
  const { data: rfqs } = await supabase
    .from("rfqs")
    // pin the FK: rfqs<->quotes has two relationships (rfq_id and awarded_quote_id)
    .select("id, title, status, bid_start, bid_end, quotes!quotes_rfq_id_fkey(count)")
    .eq("buyer_org_id", me.org_id)
    .order("created_at", { ascending: false });

  return (
    <>
      <Header me={me} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight">My RFQs</h2>
          <Link
            href="/buyer/rfqs/new"
            className="rounded-md bg-black px-3.5 py-2 text-sm font-medium text-white hover:bg-black/85 dark:bg-white dark:text-black dark:hover:bg-white/85"
          >
            New RFQ
          </Link>
        </div>

        <div className="mt-6 divide-y divide-black/5 overflow-hidden rounded-xl border border-black/10 dark:divide-white/5 dark:border-white/10">
          {(rfqs ?? []).map((r: any) => (
            <Link
              key={r.id}
              href={`/buyer/rfqs/${r.id}`}
              className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{r.title}</div>
                <div className="mt-0.5 text-xs text-black/50 dark:text-white/50">
                  {r.bid_start && r.bid_end ? `Bids ${r.bid_start} → ${r.bid_end}` : "No bid window yet"}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-xs text-black/50 dark:text-white/50">
                  {r.quotes?.[0]?.count ?? 0} quotes
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[r.status] ?? ""}`}>
                  {r.status}
                </span>
              </div>
            </Link>
          ))}
          {(!rfqs || rfqs.length === 0) && (
            <div className="px-5 py-10 text-center text-sm text-black/50 dark:text-white/50">
              No RFQs yet — create your first one.
            </div>
          )}
        </div>
      </main>
    </>
  );
}
