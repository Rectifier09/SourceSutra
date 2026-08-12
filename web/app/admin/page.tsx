import { createClient } from "@/lib/supabase/server";

// Unlisted, email-gated event-tracking dashboard — not linked from any nav.
// Reads only get_event_counts() (migration 0015), which returns aggregate
// (type, kind, count) rows and nothing org-specific, so even the RPC grant
// to `authenticated` can't leak one org's activity to another — this route
// is the actual access control.
const ADMIN_EMAILS = ["prashantpps09@gmail.com", "prashant090693@gmail.com"];

type Row = { label: string; type: string; kind?: string };
type FunnelSection = { persona: string; rows: Row[] };

const FUNNEL: FunnelSection[] = [
  {
    persona: "All",
    rows: [{ label: "Traffic on the landing page", type: "LandingPageView" }],
  },
  {
    persona: "Supplier",
    rows: [
      { label: "Sign up", type: "SignUp", kind: "supplier" },
      { label: "Login", type: "Login", kind: "supplier" },
      { label: "Identity details provided", type: "SectionSubmitted", kind: "identity" },
      { label: "Identity details verified", type: "SectionVerified", kind: "identity" },
      { label: "Identity details failed", type: "SectionRemediation", kind: "identity" },
      { label: "Financial details provided", type: "SectionSubmitted", kind: "financials" },
      { label: "Financial details verified", type: "SectionVerified", kind: "financials" },
      { label: "Financial details failed", type: "SectionRemediation", kind: "financials" },
      { label: "Portfolio details provided", type: "SectionSubmitted", kind: "portfolio" },
      { label: "Portfolio details verified", type: "SectionVerified", kind: "portfolio" },
      { label: "Portfolio details failed", type: "SectionRemediation", kind: "portfolio" },
      { label: "RFQ viewed", type: "RfqViewed" },
      { label: "RFQ application sent", type: "QuoteSubmitted" },
      { label: "Identity details modified", type: "SectionModified", kind: "identity" },
      { label: "Financial details modified", type: "SectionModified", kind: "financials" },
      { label: "Portfolio details modified", type: "SectionModified", kind: "portfolio" },
    ],
  },
  {
    persona: "Customer",
    rows: [
      { label: "Sign up", type: "SignUp", kind: "buyer" },
      { label: "Login", type: "Login", kind: "buyer" },
      { label: "Profile created", type: "ProfileCreated" },
      { label: "Profile updated", type: "ProfileUpdated" },
      { label: "RFQ created", type: "RfqCreated" },
      { label: "RFQ in draft", type: "RfqInDraft" },
      { label: "RFQ application received", type: "QuoteSubmitted" },
      { label: "Supplier viewed", type: "SupplierViewed" },
      { label: "Supplier invited", type: "SupplierInvited" },
      { label: "RFQ application viewed", type: "RfqApplicationViewed" },
      { label: "RFQ application rejected", type: "QuoteRejected" },
    ],
  },
];

function key(type: string, kind?: string | null) {
  return `${type}::${kind ?? ""}`;
}

export default async function AdminEventsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto max-w-[640px] px-6 py-16 text-center">
        <p className="text-[14px] text-muted">Sign in to view this page.</p>
      </main>
    );
  }
  if (!ADMIN_EMAILS.includes(user.email ?? "")) {
    return (
      <main className="mx-auto max-w-[640px] px-6 py-16 text-center">
        <h1 className="font-display text-[22px] font-medium text-ink">Not authorized</h1>
        <p className="mt-2 text-[14px] text-muted">This page isn&apos;t available for your account.</p>
      </main>
    );
  }

  const { data: counts, error } = await supabase.rpc("get_event_counts");
  const countMap = new Map<string, number>();
  (counts ?? []).forEach((r: { type: string; kind: string | null; count: number }) => {
    countMap.set(key(r.type, r.kind), (countMap.get(key(r.type, r.kind)) ?? 0) + Number(r.count));
  });

  return (
    <main className="mx-auto w-full max-w-[880px] px-6 py-10">
      <h1 className="font-display text-[26px] font-medium text-ink">Event tracking</h1>
      <p className="mt-1 text-[13.5px] text-muted">All-time counts from domain_events, by persona funnel.</p>
      {error && <p className="mt-4 text-[13px] text-terra">Failed to load: {error.message}</p>}

      <div className="mt-8 flex flex-col gap-8">
        {FUNNEL.map((section) => {
          // Anchor % to the first row that actually has data, not always rows[0] —
          // e.g. "Sign up" reads 0 for accounts that predate this migration, which
          // would otherwise blank out every %-of-first-step cell in the funnel.
          const counts = section.rows.map((r) => countMap.get(key(r.type, r.kind)) ?? 0);
          const anchor = counts.find((c) => c > 0) ?? 0;
          return (
            <div key={section.persona} className="rounded-[14px] border border-line bg-cream p-6">
              <h2 className="font-display text-[18px] font-medium text-ink">{section.persona}</h2>
              <table className="mt-4 w-full border-collapse text-[13.5px]">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    <th className="py-2 pr-4">Event</th>
                    <th className="py-2 pr-4 text-right">Count</th>
                    <th className="py-2 text-right">% of first tracked step</th>
                  </tr>
                </thead>
                <tbody>
                  {section.rows.map((r, i) => {
                    const count = counts[i];
                    const pct = anchor > 0 ? Math.round((count / anchor) * 1000) / 10 : null;
                    return (
                      <tr key={r.label} className="border-b border-line/60 last:border-0">
                        <td className="py-2 pr-4 text-ink">{r.label}</td>
                        <td className="py-2 pr-4 text-right font-semibold tabular-nums text-ink">{count}</td>
                        <td className="py-2 text-right tabular-nums text-muted">{pct === null ? "—" : `${pct}%`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </main>
  );
}
