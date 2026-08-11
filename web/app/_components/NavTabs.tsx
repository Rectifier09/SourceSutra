"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; exact?: boolean };

// The prototype's tab bar: active tab = indigo text + 2px indigo underline.
export function NavTabs({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((it) => {
        const active = it.exact
          ? pathname === it.href
          : pathname === it.href || pathname.startsWith(it.href + "/");
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[14px] font-semibold transition-colors ${
              active ? "border-primary text-primary" : "border-transparent text-muted hover:text-primary"
            }`}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
