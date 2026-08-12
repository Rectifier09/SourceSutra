import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/me";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/app/_components/Header";
import { RfqDiscoverClient, type RfqRow } from "./_components/RfqDiscoverClient";
import { RFQ_BANNER, rfqBannerClass } from "@/lib/rfqBackground";

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

  const rows: RfqRow[] = (rfqs ?? []).map((r: any) => {
    const buyer = Array.isArray(r.orgs) ? r.orgs[0] : r.orgs;
    return {
      id: r.id,
      title: r.title,
      quantity: r.quantity,
      unit: r.unit,
      contract_type: r.contract_type,
      preferred_location: r.preferred_location,
      bid_end: r.bid_end,
      delivery_date: r.delivery_date,
      who_can_respond: r.who_can_respond,
      buyerName: buyer?.name ?? null,
      myStatus: quoteOf[r.id]?.status ?? null,
    };
  });

  return (
    <>
      <Header me={me} />
      <main className={`mx-auto w-full max-w-[1080px] flex-1 px-6 pb-20 pt-8 ${rfqBannerClass}`} style={{ backgroundImage: RFQ_BANNER }}>
        <h1 className="mb-4 font-display text-[26px] font-medium text-ink">Discover RFQs</h1>

        {!verified && (
          <div className="mb-5 rounded-[12px] border border-line2 bg-panel2 p-4 text-[13.5px] text-ink2">
            Finish onboarding to become discoverable and quote on RFQs.{" "}
            <Link href="/supplier" className="font-semibold text-primary underline">
              Go to onboarding
            </Link>
          </div>
        )}

        {rows.length > 0 ? (
          <RfqDiscoverClient rfqs={rows} />
        ) : (
          <div className="rounded-[12px] border border-dashed border-line px-5 py-12 text-center text-[14px] text-muted">
            No open RFQs you&apos;re eligible for right now.
          </div>
        )}
      </main>
    </>
  );
}
