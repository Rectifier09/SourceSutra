"use client";

import Link from "next/link";

// finish_oauth_signup (migration 0012) throws for a handful of real reasons —
// most commonly its 10-minute window elapsing on a stale/reloaded link. Show
// something actionable instead of Next's generic crash screen.
export default function FinishOAuthError({ error, reset }: { error: Error; reset: () => void }) {
  const expired = error.message.includes("shortly after signup");

  return (
    <main className="flex flex-1 items-center justify-center bg-cream px-6 py-16">
      <div className="w-full max-w-md rounded-[16px] border border-line bg-white p-6 text-center">
        <div className="font-display text-[26px] font-semibold text-primary">SourceSutra</div>
        <h1 className="mt-4 font-display text-[20px] font-medium text-ink">
          {expired ? "This signup link has expired" : "Something went wrong"}
        </h1>
        <p className="mt-2 text-[13px] text-muted">
          {expired
            ? "Account setup needs to finish within a few minutes of signing in. Please sign in with Google again to continue."
            : error.message || "Please try again."}
        </p>
        <div className="mt-5 flex justify-center gap-3">
          {!expired && (
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
