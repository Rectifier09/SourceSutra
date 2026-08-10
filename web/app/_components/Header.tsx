import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { createClient } from "@/lib/supabase/server";
import type { Me } from "@/lib/me";

// Async server component: also resolves the caller's unread in-app count for the bell.
export async function Header({ me }: { me: Me }) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("channel", "in_app")
    .is("read_at", null);
  const unread = count ?? 0;

  // Buyer nav lives in the header; suppliers get SupplierNav as a sub-nav instead.
  const buyerNav =
    me.role === "buyer"
      ? [
          { href: "/buyer", label: "My RFQs" },
          { href: "/buyer/suppliers", label: "Suppliers" },
          { href: "/buyer/profile", label: "Profile" },
        ]
      : [];

  return (
    <header className="border-b border-black/10 dark:border-white/10">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-5">
          <Link href={me.role === "buyer" ? "/buyer" : "/supplier"} className="text-lg font-semibold tracking-tight">
            SourceSutra
          </Link>
          <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-medium capitalize dark:bg-white/10">
            {me.role}
          </span>
          <nav className="hidden gap-4 text-sm text-black/60 sm:flex dark:text-white/60">
            {buyerNav.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-black dark:hover:text-white">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <Link
            href="/inbox"
            className="relative rounded-md border border-black/15 px-3 py-1.5 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
          >
            Inbox
            {unread > 0 && (
              <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1.5 py-0.5 text-xs font-semibold text-white">
                {unread}
              </span>
            )}
          </Link>
          <div className="hidden text-right leading-tight sm:block">
            <div className="font-medium">{me.full_name}</div>
            <div className="text-black/50 dark:text-white/50">{me.org_name}</div>
          </div>
          <form action={signOut}>
            <button className="rounded-md border border-black/15 px-3 py-1.5 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
