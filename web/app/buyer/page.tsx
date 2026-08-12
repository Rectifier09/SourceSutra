import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/me";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/app/_components/Header";
import { RFQ_BANNER, rfqBannerClass } from "@/lib/rfqBackground";

// RFQ status → badge colours, in the warm design-system palette.
const STATUS_STYLES: Record<string, string> = {
  draft: "bg-panel text-muted",
  active: "bg-sagebg text-sage",
  awarded: "bg-lav1 text-primary",
  foreclosed: "bg-panel2 text-amber",
  lapsed: "bg-[#F7ECE8] text-terra",
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
      <main className={`mx-auto w-full max-w-[1180px] flex-1 px-6 py-10 ${rfqBannerClass}`} style={{ backgroundImage: RFQ_BANNER }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-[28px] font-medium text-ink">My RFQs</h1>
            <p className="mt-1 text-[14px] text-muted">
              Requests for quotation you&apos;ve published, drafted, or awarded.
            </p>
          </div>
          <Link
            href="/buyer/rfqs/new"
            className="whitespace-nowrap rounded-lg bg-primary px-4 py-2.5 text-[13.5px] font-semibold text-cream hover:opacity-90"
          >
            + Create RFQ
          </Link>
        </div>

        <div className="mt-7 overflow-hidden rounded-[14px] border border-line bg-cream">
          {(rfqs ?? []).map((r: any, i: number) => (
            <Link
              key={r.id}
              href={`/buyer/rfqs/${r.id}`}
              className={`flex items-center justify-between gap-4 px-5 py-4 hover:bg-panel ${
                i > 0 ? "border-t border-line" : ""
              }`}
            >
              <div className="min-w-0">
                <div className="truncate text-[15px] font-semibold text-ink">{r.title}</div>
                <div className="mt-0.5 text-[12px] text-muted">
                  {r.bid_start && r.bid_end ? `Bids ${r.bid_start} → ${r.bid_end}` : "No bid window yet"}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-[12px] text-muted">{r.quotes?.[0]?.count ?? 0} quotes</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold capitalize ${
                    STATUS_STYLES[r.status] ?? "bg-panel text-muted"
                  }`}
                >
                  {r.status}
                </span>
              </div>
            </Link>
          ))}
          {(!rfqs || rfqs.length === 0) && (
            <div className="px-5 py-12 text-center text-[14px] text-muted">
              No RFQs yet — create your first one.
            </div>
          )}
        </div>
      </main>
    </>
  );
}
