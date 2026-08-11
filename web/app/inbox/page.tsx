import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/me";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/app/_components/Header";
import { markRead, markAllRead } from "@/app/inbox/actions";

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default async function Inbox() {
  const me = await getMe();
  if (!me) redirect("/login");

  const supabase = await createClient();
  // in_app only — notify() also writes an 'email' row per event (BP-2 delivery).
  const { data: notes } = await supabase
    .from("notifications")
    .select("id, type, title, body, read_at, created_at, ref_rfq_id")
    .eq("channel", "in_app")
    .order("created_at", { ascending: false })
    .limit(100);

  const rfqBase = me.role === "buyer" ? "/buyer/rfqs" : "/supplier/rfqs";
  const hasUnread = (notes ?? []).some((n: any) => !n.read_at);

  return (
    <>
      <Header me={me} />
      <main className="mx-auto w-full max-w-[720px] flex-1 px-6 pb-20 pt-8">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-[26px] font-medium text-ink">Notifications</h1>
          {hasUnread && (
            <form action={markAllRead}>
              <button className="text-[13px] text-primary hover:underline">Mark all read</button>
            </form>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-2">
          {(notes ?? []).map((n: any) => {
            const unread = !n.read_at;
            return (
              <div
                key={n.id}
                className={`rounded-[12px] border border-line p-4 ${unread ? "bg-panel" : "bg-cream"}`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${unread ? "bg-sage" : "bg-transparent"}`}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <div className={`truncate text-[14.5px] text-ink ${unread ? "font-semibold" : "font-medium"}`}>
                        {n.title}
                      </div>
                      <div className="shrink-0 text-[12px] text-muted">{ago(n.created_at)}</div>
                    </div>
                    {n.body && <div className="mt-0.5 text-[13.5px] text-muted">{n.body}</div>}
                    <div className="mt-2 flex items-center gap-3 text-[12.5px]">
                      {n.ref_rfq_id && (
                        <Link href={`${rfqBase}/${n.ref_rfq_id}`} className="font-semibold text-primary hover:underline">
                          View RFQ →
                        </Link>
                      )}
                      {unread && (
                        <form action={markRead}>
                          <input type="hidden" name="id" value={n.id} />
                          <button className="text-muted hover:underline">Mark read</button>
                        </form>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {(!notes || notes.length === 0) && (
            <div className="rounded-[12px] border border-dashed border-line px-5 py-12 text-center text-[14px] text-muted">
              No notifications yet.
            </div>
          )}
        </div>
      </main>
    </>
  );
}
