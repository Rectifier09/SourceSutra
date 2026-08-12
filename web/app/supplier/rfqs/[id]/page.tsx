import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/me";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/app/_components/Header";
import { submitQuote } from "@/app/supplier/actions";
import { RfqDetails } from "@/app/_components/RfqDetails";
import { RFQ_BANNER, rfqBannerClass } from "@/lib/rfqBackground";

const QUOTE_PILL: Record<string, string> = {
  draft: "bg-panel text-muted",
  submitted: "bg-panel2 text-amber",
  under_review: "bg-panel2 text-amber",
  shortlisted: "bg-lav1 text-primary",
  awarded: "bg-sagebg text-sage",
  not_selected: "bg-[#F7ECE8] text-terra",
  closed: "bg-panel text-muted",
};

const labelText = "text-[13px] font-semibold text-muted";
const input = "mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-[14.5px] text-ink placeholder:text-muted/60";

export default async function SupplierRfqDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.role !== "supplier") redirect("/buyer");

  const supabase = await createClient();
  // RLS (can_view_rfq) returns nothing if this supplier isn't eligible → bounce to discover.
  const { data: rfq } = await supabase.from("rfqs").select("*").eq("id", id).maybeSingle();
  if (!rfq) redirect("/supplier/discover");

  try {
    await supabase.rpc("log_event", { p_type: "RfqViewed" });
  } catch {
    // best-effort
  }

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
      <main className={`mx-auto w-full max-w-[900px] flex-1 px-6 pb-20 pt-8 ${rfqBannerClass}`} style={{ backgroundImage: RFQ_BANNER }}>
        <Link href="/supplier/discover" className="text-[14px] text-primary underline">
          ← Discover
        </Link>

        <div className="mt-3 flex items-start justify-between gap-4">
          <h1 className="font-display text-[28px] font-medium text-ink">{rfq.title}</h1>
          {mine && (
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold capitalize ${QUOTE_PILL[mine.status] ?? "bg-panel text-muted"}`}
            >
              your quote · {mine.status.replace("_", " ")}
            </span>
          )}
        </div>
        <div className="mt-2 text-[13.5px] text-muted">
          {buyer?.name ?? "Buyer"}
          {buyer?.location ? ` · ${buyer.location}` : ""}
        </div>

        <RfqDetails rfq={rfq} />

        {/* Quote form (active RFQs only) */}
        {canQuote ? (
          <form action={submitQuote} className="mt-8 rounded-[14px] border border-line bg-cream p-6">
            <input type="hidden" name="rfq_id" value={rfq.id} />
            <h2 className="mb-4 font-display text-[16px] font-medium text-ink">
              {mine ? "Update your quote" : "Submit a quote"}
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={labelText}>Unit price *</span>
                <input name="unit_price" type="number" step="0.01" required defaultValue={q.unit_price ?? ""} className={input} />
              </label>
              <label className="block">
                <span className={labelText}>Currency</span>
                <input name="currency" defaultValue={q.currency ?? rfq.currency ?? "INR"} className={input} />
              </label>
              <label className="block">
                <span className={labelText}>Quantity you can fulfil</span>
                <input name="quantity_fulfil" type="number" step="0.01" defaultValue={q.quantity_fulfil ?? ""} className={input} />
              </label>
              <label className="block">
                <span className={labelText}>MOQ</span>
                <input name="moq" type="number" step="0.01" defaultValue={q.moq ?? ""} className={input} />
              </label>
              <label className="block">
                <span className={labelText}>Bulk lead time</span>
                <input name="bulk_lead_time" defaultValue={q.bulk_lead_time ?? ""} placeholder="e.g. 30 days" className={input} />
              </label>
              <label className="block">
                <span className={labelText}>Incoterm</span>
                <input name="incoterm" defaultValue={q.incoterm ?? ""} placeholder="e.g. FOB" className={input} />
              </label>
              <label className="block sm:col-span-2">
                <span className={labelText}>Payment terms</span>
                <input name="payment_terms" defaultValue={q.payment_terms ?? ""} placeholder="e.g. 30% advance, balance on delivery" className={input} />
              </label>
              <label className="block sm:col-span-2">
                <span className={labelText}>Notes</span>
                <textarea name="notes" rows={2} defaultValue={q.notes ?? ""} className={input} />
              </label>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                name="draft"
                value="1"
                className="rounded-lg border border-line px-4 py-2.5 text-[13.5px] font-medium text-muted hover:bg-panel"
              >
                Save draft
              </button>
              <button className="rounded-lg bg-primary px-4 py-2.5 text-[13.5px] font-semibold text-cream hover:opacity-90">
                {mine ? "Re-submit quote" : "Submit quote"}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-8 rounded-[14px] border border-line bg-cream p-5 text-[13.5px] text-muted">
            This RFQ is <span className="font-semibold capitalize text-ink">{rfq.status}</span> — it&apos;s no
            longer open for quotes.
            {mine && ` Your quote is ${mine.status.replace("_", " ")}.`}
          </div>
        )}
      </main>
    </>
  );
}
