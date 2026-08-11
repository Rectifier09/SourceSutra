import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { createClient } from "@/lib/supabase/server";
import type { Me } from "@/lib/me";
import { NavTabs, type NavItem } from "./NavTabs";

// The app shell, reskinned to the prototype (SourceSutraCustomer / SourceSutra):
// a sticky cream tab-bar — Fraunces brand, role tabs with an indigo active underline,
// inbox bell, and (for buyers) the "+ Create RFQ" CTA. Async so it can resolve the
// caller's unread in-app count for the bell.
export async function Header({ me }: { me: Me }) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("channel", "in_app")
    .is("read_at", null);
  const unread = count ?? 0;

  const tabs: NavItem[] =
    me.role === "buyer"
      ? [
          { href: "/buyer", label: "My RFQs", exact: true },
          { href: "/buyer/suppliers", label: "Discover suppliers" },
          { href: "/buyer/profile", label: "Profile" },
        ]
      : [
          { href: "/supplier", label: "Dashboard", exact: true },
          { href: "/supplier/discover", label: "Discover RFQs" },
          { href: "/supplier/invitations", label: "Invitations" },
          { href: "/supplier/quotes", label: "Quotations" },
          { href: "/supplier/profile", label: "Profile" },
        ];

  const home = me.role === "buyer" ? "/buyer" : "/supplier";

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-cream">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-5 px-6 py-4">
        <Link
          href={home}
          className="whitespace-nowrap font-display text-[20px] font-semibold text-primary"
        >
          SourceSutra
        </Link>

        <NavTabs items={tabs} />

        <div className="flex items-center gap-3">
          <Link
            href="/inbox"
            className="relative rounded-lg border border-line px-3 py-2 text-[13px] font-medium text-muted hover:bg-panel"
          >
            Inbox
            {unread > 0 && (
              <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-terra px-1.5 py-0.5 text-[11px] font-semibold text-cream">
                {unread}
              </span>
            )}
          </Link>

          {me.role === "buyer" && (
            <Link
              href="/buyer/rfqs/new"
              className="whitespace-nowrap rounded-lg bg-primary px-4 py-2.5 text-[13.5px] font-semibold text-cream hover:opacity-90"
            >
              + Create RFQ
            </Link>
          )}

          <div className="hidden text-right leading-tight sm:block">
            <div className="text-[13px] font-semibold text-ink">{me.full_name}</div>
            <div className="text-[12px] text-muted">{me.org_name}</div>
          </div>

          <form action={signOut}>
            <button className="whitespace-nowrap rounded-lg border border-line px-3.5 py-2 text-[13px] font-medium text-muted hover:bg-panel">
              Log out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
