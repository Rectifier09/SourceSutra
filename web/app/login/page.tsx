import { redirect } from "next/navigation";
import { getMe } from "@/lib/me";
import { DEMO_PERSONAS } from "@/lib/demo";
import { signInAs } from "./actions";

export default async function LoginPage() {
  const me = await getMe();
  if (me) redirect(me.role === "buyer" ? "/buyer" : "/supplier");

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">SourceSutra</h1>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            Verified B2B textile sourcing — demo sign-in
          </p>
        </div>

        <div className="space-y-3">
          {DEMO_PERSONAS.map((p) => (
            <form key={p.email} action={signInAs}>
              <input type="hidden" name="email" value={p.email} />
              <button
                type="submit"
                className="flex w-full items-center justify-between rounded-xl border border-black/10 bg-white px-4 py-3 text-left transition hover:border-black/30 hover:shadow-sm dark:border-white/15 dark:bg-white/5 dark:hover:border-white/40"
              >
                <span>
                  <span className="block font-medium">{p.label}</span>
                  <span className="block text-xs text-black/50 dark:text-white/50">
                    {p.sublabel}
                  </span>
                </span>
                <span aria-hidden className="text-black/30 dark:text-white/40">
                  →
                </span>
              </button>
            </form>
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-black/40 dark:text-white/40">
          Seeded demo accounts · password <code>sourcesutra</code> · BP-1 (no public signup yet)
        </p>
      </div>
    </main>
  );
}
