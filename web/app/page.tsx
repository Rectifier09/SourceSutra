import Link from "next/link";
import { getMe } from "@/lib/me";

// The public homepage — the product's default screen. Ports the prototype's ScreenLanding.
export default async function Home() {
  const me = await getMe();
  const dashHref = me ? (me.role === "buyer" ? "/buyer" : "/supplier") : null;

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-fixed"
      style={{ backgroundImage: "linear-gradient(rgba(250,248,244,0.72),rgba(250,248,244,0.86)), url('/img/hero-bg.png')" }}
    >
      <div className="mx-auto max-w-[1180px] px-6 pb-24">
        {/* Top bar */}
        <header className="flex flex-wrap items-center justify-between gap-4 py-7">
          <span className="font-display text-[23px] font-semibold tracking-tight text-primary">SourceSutra</span>
          <div className="flex items-center gap-3">
            {dashHref ? (
              <Link
                href={dashHref}
                className="rounded-lg bg-primary px-[18px] py-2.5 text-sm font-semibold text-cream hover:opacity-90"
              >
                Go to dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/register"
                  className="rounded-lg border border-primary2 px-[18px] py-2.5 text-sm text-primary2 hover:bg-lav1"
                >
                  Sign up
                </Link>
                <Link
                  href="/login"
                  className="rounded-lg border border-line px-[18px] py-2.5 text-sm text-ink hover:bg-panel"
                >
                  Log in
                </Link>
              </>
            )}
          </div>
        </header>

        {/* Hero */}
        <section className="flex flex-wrap items-center gap-12 py-4 pb-14">
          <div className="min-w-[300px] flex-[1_1_420px]">
            <div className="mb-3.5 font-display text-[13px] font-medium uppercase tracking-[0.08em] text-primary2">
              Trusted by manufacturers across India
            </div>
            <h1 className="m-0 mb-5 font-display text-[clamp(32px,4.5vw,54px)] font-medium leading-[1.12] text-ink">
              A trusted network of verified suppliers, for every need.
            </h1>
            <p className="m-0 mb-7 max-w-[520px] text-[17px] leading-relaxed text-muted">
              SourceSutra brings together fabric mills, garment CMT units, and trims &amp; accessory suppliers —
              each verified once, thoroughly, so manufacturers can source with confidence. Whatever you need —
              knits, wovens, dyeing, or a complete white-label article — find it here, already vetted.
            </p>
            <div className="flex flex-wrap items-center gap-3.5">
              <Link
                href="/register?role=supplier"
                className="inline-flex items-center gap-2.5 rounded-[9px] bg-primary px-[22px] py-3.5 text-[15px] font-semibold text-cream hover:opacity-90"
              >
                Get started
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2.5 rounded-[9px] border border-primary2 px-[22px] py-3.5 text-[15px] font-semibold text-primary2 hover:bg-lav1"
              >
                Enter the demo
              </Link>
            </div>
            <span className="mt-2 block text-[13px] text-muted">
              Create a real account, or use a seeded buyer/supplier demo — one click.
            </span>
          </div>
          <div className="min-h-[460px] flex-[1_1_560px] self-stretch overflow-hidden rounded-2xl border border-lav2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/img/hero-panel.png"
              alt="Sourcing the best of India — handlooms, handicrafts, and modern apparel manufacturing"
              className="block h-full w-full object-cover"
            />
          </div>
        </section>

        <div className="selvedge" />

        {/* How onboarding works */}
        <section className="py-12">
          <h2 className="m-0 mb-2 font-display text-[30px] font-medium text-ink">How onboarding works</h2>
          <p className="m-0 mb-8 max-w-[640px] text-[15px] text-muted">
            Identity and Financials build on each other, in order. Portfolio can be filled in alongside either
            one, at your own pace — but it&apos;s the last piece needed to finish.
          </p>
          <div className="flex flex-wrap gap-5">
            {[
              { step: "Step 1", title: "Identity", body: "Company details, contact verification, GST/PAN/MSME/CIN. Submitted first — Financials unlocks once this is in review.", accent: false },
              { step: "Step 2", title: "Financials", body: "Bank details, addresses, and company filings. Locked until Identity is submitted for verification.", accent: false },
              { step: "Alongside, then last", title: "Portfolio", body: "Work history, catalogue, and tags. Build it any time from day one — it's the final gate before onboarding is complete.", accent: true },
            ].map((c) => (
              <div
                key={c.title}
                className={`min-w-[240px] flex-[1_1_280px] rounded-[14px] border p-6 ${
                  c.accent ? "border-lav2 bg-lav1" : "border-line bg-cream"
                }`}
              >
                <div className={`mb-2.5 font-display text-[13px] font-medium uppercase tracking-[0.06em] ${c.accent ? "text-primary2" : "text-primary"}`}>
                  {c.step}
                </div>
                <h3 className="m-0 mb-2 font-display text-[20px] font-medium text-ink">{c.title}</h3>
                <p className="m-0 text-sm leading-[1.55] text-muted">{c.body}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="selvedge" />

        {/* Stats */}
        <section className="flex flex-wrap gap-8 py-12">
          {[
            { value: "500+", label: "Verified suppliers across India" },
            { value: "1000+", label: "Sourcing requests monthly" },
            { value: "25+", label: "States covered" },
          ].map((s) => (
            <div key={s.label} className="min-w-[200px] flex-[1_1_220px]">
              <div className="font-display text-[36px] font-medium text-amber">{s.value}</div>
              <div className="mt-1.5 text-sm text-muted">{s.label}</div>
            </div>
          ))}
        </section>

        <div className="selvedge" />

        {/* Testimonials */}
        <section className="py-12">
          <h2 className="m-0 mb-7 font-display text-[28px] font-medium text-ink">From sub-contractors on the network</h2>
          <div className="flex flex-wrap gap-6">
            {[
              { quote: "SourceSutra made it so easy to find new buyers. The verification was thorough and fair.", name: "Arjun Sharma", role: "Owner", place: "Tiruppur Knits" },
              { quote: "One platform, one verification, and suddenly we're discoverable to everyone. Game-changing for a 30-person unit.", name: "Priya Menon", role: "Operations Head", place: "Vardhman Textiles" },
            ].map((t) => (
              <div key={t.name} className="min-w-[280px] flex-[1_1_380px] rounded-[14px] border border-l-4 border-line border-l-terra2 bg-panel p-[26px]">
                <p className="m-0 mb-[18px] font-display text-[18px] leading-[1.5] text-ink">“{t.quote}”</p>
                <div className="text-sm font-semibold text-primary">{t.name}</div>
                <div className="text-[13px] text-muted">{t.role} · {t.place}</div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA band */}
        <section className="mt-6 flex flex-wrap items-center justify-between gap-6 rounded-[18px] bg-primary px-9 py-11">
          <div>
            <h2 className="m-0 mb-2 font-display text-[26px] font-medium text-cream">Ready to be found, not chased?</h2>
            <p className="m-0 text-sm text-lav2">One verification. Discoverable to every manufacturer on the network after.</p>
          </div>
          <Link
            href="/login"
            className="whitespace-nowrap rounded-[9px] bg-cream px-6 py-3.5 text-[15px] font-semibold text-primary hover:opacity-90"
          >
            Enter the demo
          </Link>
        </section>
      </div>
    </div>
  );
}
