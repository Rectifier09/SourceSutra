import { signOut } from "@/app/login/actions";
import type { Me } from "@/lib/me";

export function Header({ me }: { me: Me }) {
  return (
    <header className="border-b border-black/10 dark:border-white/10">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <div className="flex items-baseline gap-3">
          <span className="text-lg font-semibold tracking-tight">SourceSutra</span>
          <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-medium capitalize dark:bg-white/10">
            {me.role}
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="text-right leading-tight">
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
