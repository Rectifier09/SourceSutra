# SourceSutra

A verified B2B textile sourcing network for the Indian market. Suppliers (fabric mills, garment CMT
units, dyers, trims makers) get verified **once**, thoroughly, and become discoverable to
manufacturers/buyers who raise **RFQs** and award work against supplier **quotes**.

The repo has three layers:

- **Real web app** (`web/`) — the product being built: a **Next.js 16** app wired to the Supabase
  backend. Build Phase 1 (BP-1) is a deployed, self-serve demo of the whole loop that *fakes* five
  integrations (storage, OTP/KYC, email, auth providers, admin console) — see [`buildplan.md`](buildplan.md).
  FE-0 (auth + shells) and FE-1 (buyer core) are done.
- **Supabase backend** (`supabase/`) — the domain logic made real in Postgres. Step #1 + Phases 0–3
  are built & green (**136 pgTAP tests**).
- **Clickable prototype** — the original front-end design: `*.dc.html` screens + the `support.js`
  runtime + the `rfq-store.js` `localStorage` store. The **visual spec** the real app ports from; synced
  to the Claude design project *"Demo flows and design system"*.

## Start here

| Doc | What it is |
|---|---|
| [`userjourney.md`](userjourney.md) | End-to-end **product/design** walkthrough — personas, every screen, the onboarding + RFQ state machines, data models, prototype gaps, and the change log. |
| [`bizlogic.md`](bizlogic.md) | The **domain rules + architecture + MVP roadmap** (Parts A / B / C) and the decision log (§C.6). How the system is meant to behave. |
| [`supabase/README.md`](supabase/README.md) | The **backend** — schema, migrations, and how to run the local proof (Docker + Supabase CLI). |
| [`buildplan.md`](buildplan.md) | The **frontend + integrations build plan** — BP-1/2/3 phases, the RPC/view contract, screen map, and the **resume point** (§8: what's built, how to run, gotchas, what's next). |

## Run it

- **Web app (BP-1):** start the backend, then `cd web && npm run dev` → http://localhost:3000. Sign in with
  a **seeded demo account** (password `sourcesutra`): `priya.menon@vardhmantextiles.in` (buyer),
  `suresh@anandknitfab.in` (verified supplier), `anitha@tiruppurthreads.in` (un-onboarded supplier). See
  `buildplan.md` §8.
- **Backend:** see `supabase/README.md` — `supabase start && supabase db reset && supabase test db`
  (expect **136 passing**). Studio at http://localhost:54323.
- **Prototype (visual spec):** serve the repo over **HTTP** (not `file://`) and open `SourceSutra.dc.html`
  (supplier) or `SourceSutraCustomer.dc.html` (buyer). Needs internet at runtime. Details in `userjourney.md` §12.

## Status (2026-08-10)

- ✅ **Backend** — Step #1 (award transaction) + Phases 0–3: auth & accounts, RFQ ↔ Quote ↔ Award,
  onboarding & verification, notifications & invitations. **136 pgTAP green**; lapse job scheduled via pg_cron.
- 🟡 **Web app (BP-1)** — FE-0 (persona auth + role-routed shells) and FE-1 (buyer core: My RFQs, create RFQ
  with live match-count, applications, triage, award) done & verified in-browser. **Next: FE-2** (supplier
  onboarding with fakes), then FE-3/FE-4, then deploy.
- ✅ **Prototype** — 15 screens + shared `RFQStore`; the visual reference the real app ports from.
- ⬜ **BP-2 (later)** — real OTP/KYC + document storage/scanning + email + auth providers + reviewer console.

## Layout

```
web/                 the real Next.js 16 app (BP-1) — auth, buyer core; see buildplan.md
supabase/            Postgres backend — migrations, pgTAP tests, seed, README
buildplan.md         frontend + integrations build plan + resume point (§8)
bizlogic.md          domain rules, architecture, roadmap, decision log
userjourney.md       product & design walkthrough
*.dc.html            prototype screens (visual spec: Supplier* / Customer* / Screen*)
support.js           generated React runtime for the .dc.html format
rfq-store.js         shared localStorage RFQ + Quote store
uploads/             prototype image / media assets
```
