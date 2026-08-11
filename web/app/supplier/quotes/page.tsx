import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/me";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/app/_components/Header";

const QUOTE_PILL: Record<string, string> = {
  draft: "bg-panel text-muted",
  submitted: "bg-panel2 text-amber",
  under_review: "bg-panel2 text-amber",
  shortlisted: "bg-lav1 text-primary",
  awarded: "bg-sagebg text-sage",
  not_selected: "bg-[#F7ECE8] text-terra",
  closed: "bg-panel text-muted",
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
      <main className="mx-auto w-full max-w-[1080px] flex-1 px-6 pb-20 pt-8">
        <h1 className="mb-4 font-display text-[26px] font-medium text-ink">Quotations</h1>

        <div className="flex flex-col gap-3">
          {(quotes ?? []).map((q: any) => {
            const rfq = Array.isArray(q.rfqs) ? q.rfqs[0] : q.rfqs;
            return (
              <Link
                key={q.id}
                href={`/supplier/rfqs/${q.rfq_id}`}
                className="flex items-center justify-between gap-4 rounded-[12px] border border-line bg-white p-5 transition-colors hover:border-lav3"
              >
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-semibold text-ink">{rfq?.title ?? "RFQ"}</div>
                  <div className="mt-0.5 text-[12.5px] capitalize text-primary2">RFQ {rfq?.status ?? ""}</div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="text-right text-[15px] font-semibold tabular-nums text-ink">
                    {q.currency ?? "INR"} {q.unit_price ?? "—"}
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold capitalize ${QUOTE_PILL[q.status] ?? "bg-panel text-muted"}`}
                  >
                    {q.status.replace("_", " ")}
                  </span>
                </div>
              </Link>
            );
          })}
          {(!quotes || quotes.length === 0) && (
            <div className="rounded-[12px] border border-dashed border-line px-5 py-12 text-center text-[14px] text-muted">
              No quotes yet.{" "}
              <Link href="/supplier/discover" className="font-semibold text-primary underline">
                Discover RFQs
              </Link>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
