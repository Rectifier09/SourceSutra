# SourceSutra

A verified B2B textile sourcing network for the Indian market. Suppliers (fabric mills, garment CMT
units, dyers, trims makers) get verified **once**, thoroughly, and become discoverable to
manufacturers/buyers who raise **RFQs** and award work against supplier **quotes**.

The repo has two layers:

- **Clickable prototype** — the front-end design: `*.dc.html` screens + the `support.js` runtime +
  the `rfq-store.js` `localStorage` store. Two persona apps (supplier / buyer), synced to the Claude
  design project *"Demo flows and design system"*.
- **Supabase backend** (`supabase/`) — the domain logic made real in Postgres. Step #1 + Phases 0–3
  are built & green (**128 pgTAP tests**).

## Start here

| Doc | What it is |
|---|---|
| [`userjourney.md`](userjourney.md) | End-to-end **product/design** walkthrough — personas, every screen, the onboarding + RFQ state machines, data models, prototype gaps, and the change log. |
| [`bizlogic.md`](bizlogic.md) | The **domain rules + architecture + MVP roadmap** (Parts A / B / C) and the decision log (§C.6). How the system is meant to behave. |
| [`supabase/README.md`](supabase/README.md) | The **backend** — schema, migrations, and how to run the local proof (Docker + Supabase CLI). |

## Run it

- **Prototype:** serve the repo over **HTTP** (not `file://`) and open `SourceSutra.dc.html` (supplier)
  or `SourceSutraCustomer.dc.html` (buyer). Needs internet at runtime (React/fonts from CDN). Details in
  `userjourney.md` §12.
- **Backend:** see `supabase/README.md` — `supabase start && supabase db reset && supabase test db`
  (expect **128 passing**). Studio at http://localhost:54323.

## Status (2026-08-10)

- ✅ **Prototype** — 15 screens + shared `RFQStore`; the intro no longer auto-skips (click **Enter dashboard**).
- ✅ **Backend** — Step #1 (award transaction) + Phases 0–3: auth & accounts, RFQ ↔ Quote ↔ Award,
  onboarding & verification, notifications & invitations. 128 pgTAP green; lapse job scheduled via pg_cron.
- ⬜ **Next** — real OTP/KYC + document storage/scanning, Phase 4 (post-award ops + admin console), then
  the Next.js frontend on Vercel.

## Layout

```
*.dc.html            prototype screens (Supplier* / Customer* / Screen*)
support.js           generated React runtime for the .dc.html format
rfq-store.js         shared localStorage RFQ + Quote store
uploads/             prototype image / media assets
supabase/            Postgres backend — migrations, pgTAP tests, seed, README
bizlogic.md          domain rules, architecture, roadmap, decision log
userjourney.md       product & design walkthrough
```
