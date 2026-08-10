import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/me";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/app/_components/Header";
import { publishRfq, triageQuote, awardQuote, rejectQuote, inviteSupplier } from "@/app/buyer/actions";

const RSTATUS: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  awarded: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  foreclosed: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  lapsed: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};
const QSTATUS: Record<string, string> = {
  submitted: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  under_review: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  shortlisted: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  awarded: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  not_selected: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  closed: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

export default async function RfqDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.role !== "buyer") redirect("/supplier");

  const supabase = await createClient();
  const { data: rfq } = await supabase.from("rfqs").select("*").eq("id", id).maybeSingle();
  if (!rfq || rfq.buyer_org_id !== me.org_id) redirect("/buyer");

  const { data: quotes } = await supabase
    .from("quotes")
    .select("id, status, unit_price, currency, supplier_org_id, orgs(name, location)")
    .eq("rfq_id", id)
    .order("unit_price", { ascending: true });

  // Invite panel (active RFQs): verified suppliers + who's already invited.
  const [{ data: directory }, { data: invites }] = await Promise.all([
    supabase.from("v_supplier_directory").select("org_id, name").order("name"),
    supabase
      .from("invitations")
      .select("supplier_org_id, status, orgs!invitations_supplier_org_id_fkey(name)")
      .eq("rfq_id", id),
  ]);
  const invitedIds = new Set((invites ?? []).map((i: any) => i.supplier_org_id));
  const invitable = (directory ?? []).filter((s: any) => !invitedIds.has(s.org_id));

  const datesReady = rfq.bid_start && rfq.bid_end && rfq.delivery_date;

  return (
    <>
      <Header me={me} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <Link href="/buyer" className="text-sm text-black/50 hover:underline dark:text-white/50">
          ← My RFQs
        </Link>

        <div className="mt-2 flex items-start justify-between gap-4">
          <h2 className="text-xl font-semibold tracking-tight">{rfq.title}</h2>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${RSTATUS[rfq.status] ?? ""}`}>
            {rfq.status}
          </span>
        </div>
        <div className="mt-2 text-sm text-black/60 dark:text-white/60">
          {rfq.quantity ? `${rfq.quantity} ${rfq.unit ?? ""} · ` : ""}
          {rfq.contract_type ? `${rfq.contract_type} · ` : ""}
          {datesReady ? `bids ${rfq.bid_start} → ${rfq.bid_end} · delivery ${rfq.delivery_date}` : "no bid window yet"}
        </div>

        {rfq.status === "draft" && (
          <div className="mt-6 rounded-xl border border-black/10 p-5 dark:border-white/10">
            {datesReady ? (
              <form action={publishRfq}>
                <input type="hidden" name="rfq_id" value={rfq.id} />
                <p className="text-sm text-black/60 dark:text-white/60">
                  This RFQ is a draft. Publishing fans it out to eligible suppliers.
                </p>
                <button className="mt-3 rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/85 dark:bg-white dark:text-black dark:hover:bg-white/85">
                  Publish RFQ
                </button>
              </form>
            ) : (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                This draft needs a bid window + delivery date before it can be published. (Editing a draft&apos;s
                dates isn&apos;t in BP-1 yet — create a new RFQ with dates.)
              </p>
            )}
          </div>
        )}

        {rfq.status === "active" && (
          <section className="mt-8 rounded-xl border border-black/10 p-5 dark:border-white/10">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
              Invite suppliers
            </h3>
            {(invites ?? []).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {(invites ?? []).map((i: any) => {
                  const o = Array.isArray(i.orgs) ? i.orgs[0] : i.orgs;
                  return (
                    <span key={i.supplier_org_id} className="rounded-full bg-black/5 px-2.5 py-1 text-xs dark:bg-white/10">
                      {o?.name ?? "Supplier"} · {i.status}
                    </span>
                  );
                })}
              </div>
            )}
            {invitable.length > 0 ? (
              <form action={inviteSupplier} className="mt-3 flex flex-wrap items-center gap-2">
                <input type="hidden" name="rfq_id" value={rfq.id} />
                <select name="supplier_org" className="rounded-md border border-black/15 px-2 py-1.5 text-sm dark:border-white/20 dark:bg-transparent">
                  {invitable.map((s: any) => (
                    <option key={s.org_id} value={s.org_id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <button className="rounded-md border border-black/15 px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10">
                  Invite
                </button>
              </form>
            ) : (
              <p className="mt-3 text-sm text-black/45 dark:text-white/45">All verified suppliers invited.</p>
            )}
          </section>
        )}

        {rfq.status !== "draft" && (
          <section className="mt-8">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
              Applications ({quotes?.length ?? 0})
            </h3>
            <div className="mt-3 space-y-3">
              {(quotes ?? []).map((q: any) => {
                const org = Array.isArray(q.orgs) ? q.orgs[0] : q.orgs;
                const terminal = ["awarded", "not_selected", "closed"].includes(q.status);
                return (
                  <div key={q.id} className="rounded-xl border border-black/10 p-4 dark:border-white/10">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium">{org?.name ?? "Supplier"}</div>
                        <div className="text-xs text-black/50 dark:text-white/50">{org?.location ?? ""}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold tabular-nums">
                          {q.currency ?? "INR"} {q.unit_price}
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${QSTATUS[q.status] ?? ""}`}>
                          {q.status.replace("_", " ")}
                        </span>
                      </div>
                    </div>

                    {rfq.status === "active" && !terminal && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {(["under_review", "shortlisted", "submitted"] as const)
                          .filter((s) => s !== q.status)
                          .map((s) => (
                            <form key={s} action={triageQuote}>
                              <input type="hidden" name="quote_id" value={q.id} />
                              <input type="hidden" name="rfq_id" value={rfq.id} />
                              <input type="hidden" name="status" value={s} />
                              <button className="rounded-md border border-black/15 px-2.5 py-1 text-xs capitalize hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10">
                                {s.replace("_", " ")}
                              </button>
                            </form>
                          ))}
                        <div className="ml-auto flex gap-2">
                          <form action={rejectQuote}>
                            <input type="hidden" name="quote_id" value={q.id} />
                            <input type="hidden" name="rfq_id" value={rfq.id} />
                            <button className="rounded-md border border-red-300 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10">
                              Reject
                            </button>
                          </form>
                          <form action={awardQuote}>
                            <input type="hidden" name="quote_id" value={q.id} />
                            <input type="hidden" name="rfq_id" value={rfq.id} />
                            <button className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700">
                              Award (final)
                            </button>
                          </form>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {(!quotes || quotes.length === 0) && (
                <div className="rounded-xl border border-dashed border-black/15 px-5 py-8 text-center text-sm text-black/50 dark:border-white/15 dark:text-white/50">
                  No applications yet.
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
