import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/me";
import { DEMO_PERSONAS } from "@/lib/demo";
import { signInAs } from "./actions";

export default async function LoginPage() {
  const me = await getMe();
  if (me) redirect(me.role === "buyer" ? "/buyer" : "/supplier");

  return (
    <main className="flex flex-1 items-center justify-center bg-cream px-6 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="font-display text-[26px] font-semibold text-primary">
            SourceSutra
          </Link>
          <div className="selvedge mx-auto mt-3 w-24 rounded-full" />
          <p className="mt-3 text-[14px] text-muted">Verified B2B textile sourcing — demo sign-in</p>
        </div>

        <div className="flex flex-col gap-3">
          {DEMO_PERSONAS.map((p) => (
            <form key={p.email} action={signInAs}>
              <input type="hidden" name="email" value={p.email} />
              <button
                type="submit"
                className="flex w-full items-center justify-between rounded-[14px] border border-line bg-white px-4 py-3.5 text-left transition hover:border-lav3 hover:shadow-sm"
              >
                <span>
                  <span className="block text-[15px] font-semibold text-ink">{p.label}</span>
                  <span className="block text-[12.5px] text-muted">{p.sublabel}</span>
                </span>
                <span aria-hidden className="text-primary2">
                  →
                </span>
              </button>
            </form>
          ))}
        </div>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-line" />
          <span className="text-[12px] text-muted">new to SourceSutra?</span>
          <div className="h-px flex-1 bg-line" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/register?role=buyer"
            className="rounded-[12px] border border-line bg-white px-4 py-3 text-center text-[13.5px] font-semibold text-primary hover:border-lav3"
          >
            Sign up as a customer
          </Link>
          <Link
            href="/register?role=supplier"
            className="rounded-[12px] border border-line bg-white px-4 py-3 text-center text-[13.5px] font-semibold text-primary hover:border-lav3"
          >
            Sign up as a supplier
          </Link>
        </div>

        <p className="mt-6 text-center text-[12px] text-muted">
          Or use a seeded demo account · password{" "}
          <code className="rounded bg-panel px-1 py-0.5">sourcesutra</code>
        </p>
      </div>
    </main>
  );
}
