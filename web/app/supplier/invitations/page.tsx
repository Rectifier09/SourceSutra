import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/me";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/app/_components/Header";
import { respondInvitation } from "@/app/supplier/actions";

const INV_PILL: Record<string, string> = {
  invited: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  responded: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  declined: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
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
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <h2 className="text-xl font-semibold tracking-tight">Invitations</h2>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          RFQs a buyer invited you to quote on directly.
        </p>

        <div className="mt-6 space-y-3">
          {(invites ?? []).map((i: any) => (
            <div key={i.rfq_id} className="rounded-xl border border-black/10 p-4 dark:border-white/10">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium">{i.title}</div>
                  <div className="mt-0.5 text-xs text-black/50 dark:text-white/50">
                    RFQ {i.rfq_status}
                    {i.bid_end ? ` · bids close ${i.bid_end}` : ""}
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${INV_PILL[i.invitation_status] ?? ""}`}>
                  {i.invitation_status}
                </span>
              </div>

              <div className="mt-3 flex items-center gap-2">
                {i.invitation_status === "invited" ? (
                  <>
                    <form action={respondInvitation}>
                      <input type="hidden" name="rfq_id" value={i.rfq_id} />
                      <input type="hidden" name="accept" value="1" />
                      <button className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">
                        Accept
                      </button>
                    </form>
                    <form action={respondInvitation}>
                      <input type="hidden" name="rfq_id" value={i.rfq_id} />
                      <input type="hidden" name="accept" value="0" />
                      <button className="rounded-md border border-red-300 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10">
                        Decline
                      </button>
                    </form>
                  </>
                ) : (
                  i.invitation_status === "responded" &&
                  i.rfq_status === "active" && (
                    <Link
                      href={`/supplier/rfqs/${i.rfq_id}`}
                      className="rounded-md border border-black/15 px-3 py-1.5 text-xs font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
                    >
                      View & quote →
                    </Link>
                  )
                )}
              </div>
            </div>
          ))}
          {(!invites || invites.length === 0) && (
            <div className="rounded-xl border border-dashed border-black/15 px-5 py-10 text-center text-sm text-black/50 dark:border-white/15 dark:text-white/50">
              No invitations yet.
            </div>
          )}
        </div>
      </main>
    </>
  );
}
