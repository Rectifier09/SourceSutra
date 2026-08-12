import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/me";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/app/_components/Header";
import { publishRfq, triageQuote, awardQuote, rejectQuote, inviteSupplier } from "@/app/buyer/actions";
import { CreateRfqWizard } from "@/app/buyer/_components/CreateRfqWizard";
import { mapRfqToWizardState } from "@/app/buyer/_components/rfqWizardState";
import { RfqDetails, Row } from "@/app/_components/RfqDetails";

const RSTATUS: Record<string, string> = {
  draft: "bg-panel text-muted",
  active: "bg-sagebg text-sage",
  awarded: "bg-lav1 text-primary",
  foreclosed: "bg-panel2 text-amber",
  lapsed: "bg-[#F7ECE8] text-terra",
};
const QSTATUS: Record<string, string> = {
  submitted: "bg-panel text-muted",
  under_review: "bg-panel2 text-amber",
  shortlisted: "bg-lav1 text-primary",
  awarded: "bg-sagebg text-sage",
  not_selected: "bg-[#F7ECE8] text-terra",
  closed: "bg-panel text-muted",
};
const sectionHead = "text-[12px] font-semibold uppercase tracking-[0.02em] text-primary2";

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
    .select(
      "id, status, unit_price, currency, supplier_org_id, quantity_fulfil, moq, bulk_lead_time, incoterm, payment_terms, notes, submitted_at, orgs(name, location)"
    )
    .eq("rfq_id", id)
    .order("unit_price", { ascending: true });

  // Invite panel (active RFQs) needs org_id/name; the draft-resume wizard below
  // needs the full SupplierOption shape (same fields rfqs/new/page.tsx fetches).
  const [{ data: directory }, { data: invites }] = await Promise.all([
    supabase.from("v_supplier_directory").select("org_id, name, location, company_type").order("name"),
    supabase
      .from("invitations")
      .select("supplier_org_id, status, orgs!invitations_supplier_org_id_fkey(name)")
      .eq("rfq_id", id),
  ]);
  const invitedIds = new Set((invites ?? []).map((i: any) => i.supplier_org_id));
  const invitable = (directory ?? []).filter((s: any) => !invitedIds.has(s.org_id));

  const datesReady = rfq.bid_start && rfq.bid_end && rfq.delivery_date;

  // A draft reopens the same wizard it was created in, pre-filled, so the buyer can
  // actually finish it — the old static "Publish" block only ever worked once every
  // date field already happened to be set, with no way to fill in anything else.
  if (rfq.status === "draft") {
    return (
      <>
        <Header me={me} />
        <main className="mx-auto w-full max-w-[900px] flex-1 px-6 pb-20 pt-8">
          <Link href="/buyer" className="text-[14px] text-primary underline">
            ← My RFQs
          </Link>
          <h1 className="mt-3 font-display text-[28px] font-medium text-ink">Continue your draft</h1>
          <p className="mb-6 mt-1 text-[14px] text-muted">Pick up where you left off, then publish to eligible suppliers.</p>
          <CreateRfqWizard supplierOptions={directory ?? []} existingRfqId={rfq.id} initialState={mapRfqToWizardState(rfq)} />
        </main>
      </>
    );
  }

  return (
    <>
      <Header me={me} />
      <main className="mx-auto w-full max-w-[900px] flex-1 px-6 pb-20 pt-8">
        <Link href="/buyer" className="text-[14px] text-primary underline">
          ← My RFQs
        </Link>

        <div className="mt-3 flex items-start justify-between gap-4">
          <h1 className="font-display text-[28px] font-medium text-ink">{rfq.title}</h1>
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold capitalize ${RSTATUS[rfq.status] ?? "bg-panel text-muted"}`}
          >
            {rfq.status}
          </span>
        </div>
        <div className="mt-2 text-[13.5px] text-muted">
          {rfq.quantity ? `${rfq.quantity} ${rfq.unit ?? ""} · ` : ""}
          {rfq.contract_type ? `${rfq.contract_type} · ` : ""}
          {datesReady ? `bids ${rfq.bid_start} → ${rfq.bid_end} · delivery ${rfq.delivery_date}` : "no bid window yet"}
        </div>

        <RfqDetails rfq={rfq} />

        {rfq.status === "active" && (
          <section className="mt-8 rounded-[14px] border border-line bg-cream p-5">
            <h2 className={sectionHead}>Invite suppliers</h2>
            {(invites ?? []).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {(invites ?? []).map((i: any) => {
                  const o = Array.isArray(i.orgs) ? i.orgs[0] : i.orgs;
                  return (
                    <span key={i.supplier_org_id} className="rounded-full bg-lav1 px-2.5 py-1 text-[12px] text-primary">
                      {o?.name ?? "Supplier"} · {i.status}
                    </span>
                  );
                })}
              </div>
            )}
            {invitable.length > 0 ? (
              <form action={inviteSupplier} className="mt-3 flex flex-wrap items-center gap-2">
                <input type="hidden" name="rfq_id" value={rfq.id} />
                <select name="supplier_org" className="rounded-lg border border-line bg-white px-2.5 py-2 text-[13.5px]">
                  {invitable.map((s: any) => (
                    <option key={s.org_id} value={s.org_id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <button className="rounded-lg border border-line px-3.5 py-2 text-[13px] font-medium text-primary hover:bg-panel">
                  Invite
                </button>
              </form>
            ) : (
              <p className="mt-3 text-[13.5px] text-muted">All verified suppliers invited.</p>
            )}
          </section>
        )}

        <section className="mt-8">
          <h2 className={sectionHead}>Applications ({quotes?.length ?? 0})</h2>
            <div className="mt-3 flex flex-col gap-3">
              {(quotes ?? []).map((q: any) => {
                const org = Array.isArray(q.orgs) ? q.orgs[0] : q.orgs;
                const terminal = ["awarded", "not_selected", "closed"].includes(q.status);
                return (
                  <div key={q.id} className="rounded-[12px] border border-line bg-white p-4">
                    <details className="group">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                        <div>
                          <div className="text-[15px] font-semibold text-ink">{org?.name ?? "Supplier"}</div>
                          <div className="text-[12px] text-muted">{org?.location ?? ""}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-[18px] font-semibold tabular-nums text-ink">
                              {q.currency ?? "INR"} {q.unit_price}
                            </div>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold capitalize ${QSTATUS[q.status] ?? "bg-panel text-muted"}`}
                            >
                              {q.status.replace("_", " ")}
                            </span>
                          </div>
                          <span className="text-[12px] text-primary group-open:hidden">View details</span>
                          <span className="hidden text-[12px] text-primary group-open:inline">Hide details</span>
                        </div>
                      </summary>

                      <div className="mt-4 border-t border-line pt-4">
                        <Row
                          items={[
                            ["Quantity supplier can fulfil", q.quantity_fulfil ? `${q.quantity_fulfil} ${rfq.unit ?? ""}` : "—"],
                            ["MOQ", q.moq ?? "—"],
                            ["Bulk lead time", q.bulk_lead_time ?? "—"],
                            ["Incoterm", q.incoterm ?? "—"],
                            ["Payment terms", q.payment_terms ?? "—"],
                            ["Submitted", q.submitted_at ? new Date(q.submitted_at).toLocaleDateString() : "—"],
                          ]}
                        />
                        {!!q.notes && (
                          <div className="mt-3">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Notes</div>
                            <p className="mt-0.5 text-[13.5px] text-ink">{q.notes}</p>
                          </div>
                        )}
                      </div>
                    </details>

                    {rfq.status === "active" && !terminal && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {(["under_review", "shortlisted", "submitted"] as const)
                          .filter((s) => s !== q.status)
                          .map((s) => (
                            <form key={s} action={triageQuote}>
                              <input type="hidden" name="quote_id" value={q.id} />
                              <input type="hidden" name="rfq_id" value={rfq.id} />
                              <input type="hidden" name="status" value={s} />
                              <button className="rounded-lg border border-line px-2.5 py-1.5 text-[12px] capitalize text-ink hover:bg-panel">
                                {s.replace("_", " ")}
                              </button>
                            </form>
                          ))}
                        <div className="ml-auto flex gap-2">
                          <form action={rejectQuote}>
                            <input type="hidden" name="quote_id" value={q.id} />
                            <input type="hidden" name="rfq_id" value={rfq.id} />
                            <button className="rounded-lg border border-line px-2.5 py-1.5 text-[12px] text-terra hover:bg-panel">
                              Reject
                            </button>
                          </form>
                          <form action={awardQuote}>
                            <input type="hidden" name="quote_id" value={q.id} />
                            <input type="hidden" name="rfq_id" value={rfq.id} />
                            <button className="rounded-lg bg-sage px-2.5 py-1.5 text-[12px] font-semibold text-white hover:opacity-90">
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
                <div className="rounded-[12px] border border-dashed border-line px-5 py-8 text-center text-[14px] text-muted">
                  No applications yet.
                </div>
              )}
            </div>
          </section>
      </main>
    </>
  );
}
