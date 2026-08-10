import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/me";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/app/_components/Header";
import { SupplierNav } from "@/app/supplier/_components/SupplierNav";
import { submitQuote } from "@/app/supplier/actions";

const QUOTE_PILL: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  submitted: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  under_review: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  shortlisted: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  awarded: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  not_selected: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  closed: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

const field =
  "w-full rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20 dark:bg-transparent";

export default async function SupplierRfqDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.role !== "supplier") redirect("/buyer");

  const supabase = await createClient();
  // RLS (can_view_rfq) returns nothing if this supplier isn't eligible → bounce to discover.
  const { data: rfq } = await supabase.from("rfqs").select("*").eq("id", id).maybeSingle();
  if (!rfq) redirect("/supplier/discover");

  const { data: buyer } = await supabase.from("orgs").select("name, location").eq("id", rfq.buyer_org_id).maybeSingle();

  // The supplier's current live quote (excludes terminal not_selected/closed) — prefill + status.
  const { data: mine } = await supabase
    .from("quotes")
    .select("*")
    .eq("rfq_id", id)
    .eq("supplier_org_id", me.org_id)
    .not("status", "in", "(not_selected,closed)")
    .order("created_at", { ascending: false })
    .maybeSingle();

  const canQuote = rfq.status === "active";
  const q = mine ?? {};

  return (
    <>
      <Header me={me} />
      <SupplierNav active="/supplier/discover" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <Link href="/supplier/discover" className="text-sm text-black/50 hover:underline dark:text-white/50">
          ← Discover
        </Link>

        <div className="mt-2 flex items-start justify-between gap-4">
          <h2 className="text-xl font-semibold tracking-tight">{rfq.title}</h2>
          {mine && (
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${QUOTE_PILL[mine.status] ?? ""}`}>
              your quote · {mine.status.replace("_", " ")}
            </span>
          )}
        </div>
        <div className="mt-2 text-sm text-black/60 dark:text-white/60">
          {buyer?.name ?? "Buyer"}
          {buyer?.location ? ` · ${buyer.location}` : ""}
        </div>

        {/* RFQ spec */}
        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-black/10 p-5 text-sm dark:border-white/10">
          {[
            ["Quantity", rfq.quantity ? `${rfq.quantity} ${rfq.unit ?? ""}` : "—"],
            ["Contract", rfq.contract_type ?? "—"],
            ["Preferred location", rfq.preferred_location ?? "Any"],
            ["Min. experience", rfq.min_years_experience ? `${rfq.min_years_experience} yrs` : "—"],
            ["Bid window", rfq.bid_start && rfq.bid_end ? `${rfq.bid_start} → ${rfq.bid_end}` : "—"],
            ["Delivery by", rfq.delivery_date ?? "—"],
            ["Target price", rfq.target_price ? `${rfq.currency ?? "INR"} ${rfq.target_price}` : "—"],
            ["Audience", rfq.who_can_respond?.replace("_", " ") ?? "open"],
          ].map(([k, v]) => (
            <div key={k as string}>
              <dt className="text-xs uppercase tracking-wide text-black/40 dark:text-white/40">{k}</dt>
              <dd className="mt-0.5 capitalize">{v as string}</dd>
            </div>
          ))}
        </dl>

        {/* Quote form (active RFQs only) */}
        {canQuote ? (
          <form action={submitQuote} className="mt-8 space-y-4">
            <input type="hidden" name="rfq_id" value={rfq.id} />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
              {mine ? "Update your quote" : "Submit a quote"}
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs text-black/55 dark:text-white/55">Unit price *</span>
                <input name="unit_price" type="number" step="0.01" required defaultValue={q.unit_price ?? ""} className={`mt-1 ${field}`} />
              </label>
              <label className="block">
                <span className="text-xs text-black/55 dark:text-white/55">Currency</span>
                <input name="currency" defaultValue={q.currency ?? rfq.currency ?? "INR"} className={`mt-1 ${field}`} />
              </label>
              <label className="block">
                <span className="text-xs text-black/55 dark:text-white/55">Quantity you can fulfil</span>
                <input name="quantity_fulfil" type="number" step="0.01" defaultValue={q.quantity_fulfil ?? ""} className={`mt-1 ${field}`} />
              </label>
              <label className="block">
                <span className="text-xs text-black/55 dark:text-white/55">MOQ</span>
                <input name="moq" type="number" step="0.01" defaultValue={q.moq ?? ""} className={`mt-1 ${field}`} />
              </label>
              <label className="block">
                <span className="text-xs text-black/55 dark:text-white/55">Bulk lead time</span>
                <input name="bulk_lead_time" defaultValue={q.bulk_lead_time ?? ""} placeholder="e.g. 30 days" className={`mt-1 ${field}`} />
              </label>
              <label className="block">
                <span className="text-xs text-black/55 dark:text-white/55">Incoterm</span>
                <input name="incoterm" defaultValue={q.incoterm ?? ""} placeholder="e.g. FOB" className={`mt-1 ${field}`} />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs text-black/55 dark:text-white/55">Payment terms</span>
                <input name="payment_terms" defaultValue={q.payment_terms ?? ""} placeholder="e.g. 30% advance, balance on delivery" className={`mt-1 ${field}`} />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs text-black/55 dark:text-white/55">Notes</span>
                <textarea name="notes" rows={2} defaultValue={q.notes ?? ""} className={`mt-1 ${field}`} />
              </label>
            </div>

            <div className="flex gap-2">
              <button
                name="draft"
                value="1"
                className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
              >
                Save draft
              </button>
              <button className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
                {mine ? "Re-submit quote" : "Submit quote"}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-8 rounded-xl border border-black/10 p-5 text-sm text-black/60 dark:border-white/10 dark:text-white/60">
            This RFQ is <span className="font-medium capitalize">{rfq.status}</span> — it&apos;s no longer open for quotes.
            {mine && ` Your quote is ${mine.status.replace("_", " ")}.`}
          </div>
        )}
      </main>
    </>
  );
}
