import { createClient } from "@/lib/supabase/server";
import { TimeSeriesChart, type EventOption, type Granularity, type TSRow } from "./_components/TimeSeriesChart";
import { PersonaMixChart } from "./_components/PersonaMixChart";
import { CalendarHeatmap } from "./_components/CalendarHeatmap";

// Unlisted, email-gated event-tracking dashboard — not linked from any nav.
// Reads only get_event_counts()/get_event_timeseries() (migrations 0015/0016),
// which return aggregate rows and nothing org-specific, so even the RPC grant
// to `authenticated` can't leak one org's activity to another — this route
// is the actual access control.
const ADMIN_EMAILS = ["prashantpps09@gmail.com", "prashant090693@gmail.com"];
const GRANULARITIES: Granularity[] = ["day", "week", "month", "quarter", "year"];

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

const TREND_EVENTS: EventOption[] = [
  { label: "Logins (all)", type: "Login" },
  { label: "Sign ups (all)", type: "SignUp" },
  { label: "Landing page traffic", type: "LandingPageView" },
  { label: "RFQ applications sent", type: "QuoteSubmitted" },
  { label: "Identity verified", type: "SectionVerified", kind: "identity" },
  { label: "Financials verified", type: "SectionVerified", kind: "financials" },
  { label: "Portfolio verified", type: "SectionVerified", kind: "portfolio" },
  { label: "Suppliers invited", type: "SupplierInvited" },
];

const KPI_EVENTS: EventOption[] = [
  { label: "Logins", type: "Login" },
  { label: "Sign ups", type: "SignUp" },
  { label: "Landing page traffic", type: "LandingPageView" },
  { label: "RFQ applications sent", type: "QuoteSubmitted" },
];

function key(type: string, kind?: string | null) {
  return `${type}::${kind ?? ""}`;
}

// Monday 00:00 UTC of the week containing d — matches Postgres date_trunc('week', ts).
function isoWeekStart(d: Date): string {
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString();
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

  const [{ data: counts, error }, ...tsResults] = await Promise.all([
    supabase.rpc("get_event_counts"),
    ...GRANULARITIES.map((g) => supabase.rpc("get_event_timeseries", { p_granularity: g })),
  ]);

  const countMap = new Map<string, number>();
  (counts ?? []).forEach((r: { type: string; kind: string | null; count: number }) => {
    countMap.set(key(r.type, r.kind), (countMap.get(key(r.type, r.kind)) ?? 0) + Number(r.count));
  });

  const tsData = {} as Record<Granularity, TSRow[]>;
  GRANULARITIES.forEach((g, i) => {
    tsData[g] = (tsResults[i].data ?? []).map((r: any) => ({ ...r, count: Number(r.count) }));
  });

  // KPI strip: this ISO week vs last, for a handful of pinned events.
  const now = new Date();
  const thisWeek = isoWeekStart(now);
  const lastWeekDate = new Date(now);
  lastWeekDate.setUTCDate(lastWeekDate.getUTCDate() - 7);
  const lastWeek = isoWeekStart(lastWeekDate);

  const weekRows = tsData.week;
  const kpis = KPI_EVENTS.map((ev) => {
    const sum = (bucket: string) =>
      weekRows
        .filter((r) => r.bucket === bucket && r.type === ev.type && (ev.kind === undefined || r.kind === ev.kind))
        .reduce((s, r) => s + r.count, 0);
    const current = sum(thisWeek);
    const previous = sum(lastWeek);
    const delta = previous > 0 ? Math.round(((current - previous) / previous) * 1000) / 10 : null;
    return { label: ev.label, current, previous, delta };
  });

  return (
    <main className="mx-auto w-full max-w-[960px] px-6 py-10">
      <h1 className="font-display text-[26px] font-medium text-ink">Event tracking</h1>
      <p className="mt-1 text-[13.5px] text-muted">Live counts and trends from domain_events.</p>
      {error && <p className="mt-4 text-[13px] text-terra">Failed to load: {error.message}</p>}

      {/* KPI strip */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-[12px] border border-line bg-cream p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{k.label}</div>
            <div className="mt-1 font-display text-[24px] font-medium text-ink">{k.current}</div>
            <div className="mt-0.5 text-[12px]">
              {k.delta === null ? (
                <span className="text-muted">this week</span>
              ) : (
                <span className="inline-flex items-center gap-1" style={{ color: k.delta >= 0 ? "#0ca30c" : "#d03b3b" }}>
                  {k.delta >= 0 ? "▲" : "▼"} {Math.abs(k.delta)}% vs last week
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="mt-8 flex flex-col gap-6">
        <TimeSeriesChart data={tsData} eventOptions={TREND_EVENTS} defaultEventIndex={0} />
        <PersonaMixChart data={tsData} />
        <CalendarHeatmap data={tsData.day} />
      </div>

      {/* Funnel bars */}
      <div className="mt-8 flex flex-col gap-8">
        {FUNNEL.map((section) => {
          const rowCounts = section.rows.map((r) => countMap.get(key(r.type, r.kind)) ?? 0);
          const anchor = rowCounts.find((c) => c > 0) ?? 0;
          return (
            <div key={section.persona} className="rounded-[14px] border border-line bg-cream p-6">
              <h2 className="font-display text-[18px] font-medium text-ink">{section.persona}</h2>
              <div className="mt-4 flex flex-col gap-1.5">
                {section.rows.map((r, i) => {
                  const count = rowCounts[i];
                  const pct = anchor > 0 ? Math.round((count / anchor) * 1000) / 10 : null;
                  const barWidth = anchor > 0 ? Math.max((count / anchor) * 100, count > 0 ? 2 : 0) : 0;
                  return (
                    <div key={r.label} className="relative overflow-hidden rounded-[8px] border border-line/60 bg-white">
                      <div className="absolute inset-y-0 left-0 bg-lav1" style={{ width: `${barWidth}%` }} />
                      <div className="relative flex items-center justify-between gap-4 px-3 py-2 text-[13px]">
                        <span className="text-ink">{r.label}</span>
                        <span className="flex shrink-0 items-center gap-3">
                          <span className="font-semibold tabular-nums text-ink">{count}</span>
                          <span className="w-12 text-right tabular-nums text-muted">{pct === null ? "—" : `${pct}%`}</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
