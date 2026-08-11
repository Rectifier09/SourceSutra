"use client";

import Link from "next/link";

// finish_oauth_signup (migration 0012/0014) throws if there's no pending
// OAuth signup for this account — most commonly because it already finished
// (e.g. a double-submit, or revisiting this page after completing setup).
// Show something actionable instead of Next's generic crash screen.
export default function FinishOAuthError({ error, reset }: { error: Error; reset: () => void }) {
  const alreadyDone = error.message.includes("no pending OAuth signup");

  return (
    <main className="flex flex-1 items-center justify-center bg-cream px-6 py-16">
      <div className="w-full max-w-md rounded-[16px] border border-line bg-white p-6 text-center">
        <div className="font-display text-[26px] font-semibold text-primary">SourceSutra</div>
        <h1 className="mt-4 font-display text-[20px] font-medium text-ink">
          {alreadyDone ? "Your account is already set up" : "Something went wrong"}
        </h1>
        <p className="mt-2 text-[13px] text-muted">
          {alreadyDone
            ? "It looks like this signup was already completed. Head to your dashboard, or sign in again if you're not seeing it."
            : error.message || "Please try again."}
        </p>
        <div className="mt-5 flex justify-center gap-3">
          {!alreadyDone && (
            <button
              type="button"
              onClick={reset}
              className="rounded-lg border border-line bg-white px-4 py-2.5 text-[13.5px] font-semibold text-ink hover:bg-panel"
            >
              Try again
            </button>
          )}
          <Link
            href="/register"
            className="rounded-lg bg-primary px-4 py-2.5 text-[13.5px] font-semibold text-cream hover:opacity-90"
          >
            Back to sign up
          </Link>
        </div>
      </div>
    </main>
  );
}
