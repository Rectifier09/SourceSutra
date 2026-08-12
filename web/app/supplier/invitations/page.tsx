import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/me";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/app/_components/Header";
import { respondInvitation } from "@/app/supplier/actions";
import { RFQ_BANNER, rfqBannerClass } from "@/lib/rfqBackground";

const INV_PILL: Record<string, string> = {
  invited: "bg-panel2 text-amber",
  responded: "bg-sagebg text-sage",
  declined: "bg-[#F7ECE8] text-terra",
};

export default async function Invitations() {
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.role !== "supplier") redirect("/buyer");

  const supabase = await createClient();
  const { data: invites } = await supabase
    .from("v_my_invitations")
    .select("rfq_id, invitation_status, created_at, title, bid_end, rfq_status")
    .order("created_at", { ascending: false });

  return (
    <>
      <Header me={me} />
      <main className={`mx-auto w-full max-w-[1080px] flex-1 px-6 pb-20 pt-8 ${rfqBannerClass}`} style={{ backgroundImage: RFQ_BANNER }}>
        <h1 className="font-display text-[26px] font-medium text-ink">Invitations</h1>
        <p className="mb-5 mt-1 text-[13.5px] text-muted">RFQs a buyer invited you to quote on directly.</p>

        <div className="flex flex-col gap-3">
          {(invites ?? []).map((i: any) => (
            <div key={i.rfq_id} className="rounded-[12px] border border-line bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[15px] font-semibold text-ink">{i.title}</div>
                  <div className="mt-0.5 text-[12.5px] capitalize text-primary2">
                    RFQ {i.rfq_status}
                    {i.bid_end ? ` · bids close ${i.bid_end}` : ""}
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold capitalize ${INV_PILL[i.invitation_status] ?? "bg-panel text-muted"}`}
                >
                  {i.invitation_status}
                </span>
              </div>

              <div className="mt-3 flex items-center gap-2">
                {i.invitation_status === "invited" ? (
                  <>
                    <form action={respondInvitation}>
                      <input type="hidden" name="rfq_id" value={i.rfq_id} />
                      <input type="hidden" name="accept" value="1" />
                      <button className="rounded-lg bg-sage px-3.5 py-2 text-[12.5px] font-semibold text-white hover:opacity-90">
                        Accept
                      </button>
                    </form>
                    <form action={respondInvitation}>
                      <input type="hidden" name="rfq_id" value={i.rfq_id} />
                      <input type="hidden" name="accept" value="0" />
                      <button className="rounded-lg border border-line px-3.5 py-2 text-[12.5px] font-medium text-terra hover:bg-panel">
                        Decline
                      </button>
                    </form>
                  </>
                ) : (
                  i.invitation_status === "responded" &&
                  i.rfq_status === "active" && (
                    <Link
                      href={`/supplier/rfqs/${i.rfq_id}`}
                      className="rounded-lg border border-line px-3.5 py-2 text-[12.5px] font-medium text-primary hover:bg-panel"
                    >
                      View &amp; quote →
                    </Link>
                  )
                )}
              </div>
            </div>
          ))}
          {(!invites || invites.length === 0) && (
            <div className="rounded-[12px] border border-dashed border-line px-5 py-12 text-center text-[14px] text-muted">
              No invitations yet.
            </div>
          )}
        </div>
      </main>
    </>
  );
}
