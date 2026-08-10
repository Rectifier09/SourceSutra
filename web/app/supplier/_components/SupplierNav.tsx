import Link from "next/link";

const LINKS = [
  { href: "/supplier", label: "Onboarding" },
  { href: "/supplier/discover", label: "Discover RFQs" },
  { href: "/supplier/quotes", label: "My Quotes" },
  { href: "/supplier/invitations", label: "Invitations" },
];

// Sub-nav for the supplier workspace. `active` is the href of the current page.
export function SupplierNav({ active }: { active: string }) {
  return (
    <nav className="border-b border-black/10 dark:border-white/10">
      <div className="mx-auto flex max-w-3xl gap-1 px-6">
        {LINKS.map((l) => {
          const on = l.href === active;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`-mb-px border-b-2 px-3 py-3 text-sm ${
                on
                  ? "border-black font-medium dark:border-white"
                  : "border-transparent text-black/55 hover:text-black dark:text-white/55 dark:hover:text-white"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
