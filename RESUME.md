# SourceSutra — Resume point

> One-page handoff to pick the build back up. Deeper detail: [`buildplan.md`](./buildplan.md) §8 (frontend +
> deploy sequence), [`bizlogic.md`](./bizlogic.md) (rules), [`userjourney.md`](./userjourney.md) (screens).
> **Last updated 2026-08-11.**

---

## ▶ RESUME HERE (2026-08-11) — onboarding rebuild DEPLOYED & LIVE

The full app **reskin is COMPLETE and LIVE**, and the **onboarding-rebuild track is now DEPLOYED & LIVE**
too (pushed `78194d3`; migration `0009` applied to cloud; verified on prod — public `/register` renders and
a completed supplier shows the rich VendorProfile view).

**Git:** `main` pushed through `78194d3`. Migration `0009` is on **both local and cloud**. Everything is live at
https://source-sutra-prod.vercel.app.

**What the onboarding rebuild added** (all browser-verified locally; full detail + phase log in
[`frontend-redesign.md`](./frontend-redesign.md) §"Onboarding rebuild"):
- **Public signup** — `/register` (customer/supplier toggle, mock Google chooser, real `auth.signUp`) →
  supplier goes to `/supplier/welcome` (onboarding animation) → dashboard. Homepage + login wired to it.
- **Migration `0009`** — `supplier_directors` + `supplier_financials` (owner-only RLS), identity detail cols
  on `supplier_profiles`, `documents.doc_number`, cert dates/evidence.
- **Rich vendor onboarding** replacing `/supplier`: `supplier/page.tsx` routes by `?section=` (overview cards
  w/ lock → `IdentityForm` / `FinancialsForm` / `PortfolioForm` in `supplier/_components/`; completed →
  `VendorProfile`). Server actions `saveIdentity`/`saveFinancials`/`savePortfolio` + `verifyChannel` +
  `submitOnboardingSection` in `supplier/actions.ts`. Persistence DB-confirmed (Portfolio round-trip).

**DONE (this deploy):** `npx supabase db push` applied `0009` to cloud; `git push` shipped the FE; verified
live (public `/register` + rich onboarding VendorProfile). `db query --linked -f` remains the way to run any
remote SQL/seed.

**DONE (2026-08-11, backfill):** Suresh Anand (Anand Knitfab) and Meena Kaur (Ludhiana Woolworks) — the two
loginable, verified demo suppliers — backfilled with `0009` Identity/Financials detail (contact, designation,
established date, nature of business, GST/PAN doc numbers, a director, bank + billing address, cert audit
dates/evidence). Added to `seed.sql` (survives `db reset`) and applied live to cloud via
`supabase db query --linked -f`. Verified in-browser on both local and prod — VendorProfile now shows real
values instead of `—`. Anitha Rao (Tiruppur Threads) deliberately left un-onboarded (walk-through account);
the other 10 directory-only suppliers have no login so their owner-only Identity/Financials are moot.

**NEXT STEPS to resume (optional polish, nothing blocking):**
1. **Full walk-through on prod/local** — drive ONE new account all the way: Identity submit → Financials →
   Portfolio submit → completed `VendorProfile`. Renders + a Portfolio save were verified; the end-to-end
   multi-section submit-to-done wasn't exhaustively driven.
2. Deferred still: dark mode; Create-RFQ multi-step wizard; extract shared UI primitives; BP-2 integrations.

**Deferred (unchanged):** dark mode; Create-RFQ multi-step wizard; extracting shared UI primitives; BP-2 real
integrations (INT-1…5) + reviewer console (FE-5).

---

---

## Status in one line

**BP-1 IS LIVE** → **https://source-sutra-prod.vercel.app** (all 8 steps done). Backend `0001`–`0007` +
frontend FE-0→FE-4 on Vercel, backed by Supabase cloud `wtbfwejothkzldfebjbm` (ap-south-1). Verified live for
both personas.

> ⚡ **ACTIVE TRACK = the onboarding rebuild** (see the ▶ RESUME HERE block at the top). The frontend redesign
> (reskin to the `.dc.html` prototype) is **complete and live**; the onboarding rebuild (public signup + rich
> vendor onboarding) is built locally and awaiting deploy. Plan + full phase log in
> **[`frontend-redesign.md`](./frontend-redesign.md)**. Deferred: **BP-2** (real integrations INT-1…5 + reviewer FE-5).

**Cloud coordinates:** Supabase project `wtbfwejothkzldfebjbm` "SourceSutra-Prod" (ap-south-1); an older unused
`igtgcccaqcocmkvwdgre` (ap-northeast-1) also exists — ignore it. Vercel project root = `web/`, env
`NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Cloud auth: email/password, confirm off. Seed
was applied via the dashboard SQL Editor (`db push` does not run seeds on remote). CLI is authed via
`npx supabase` (login persists on this machine; project linked).

| Step | State |
|---|---|
| 1 · Commit baseline | ✅ |
| 2 · `0006` demo shim + loginable seed | ✅ 136 pgTAP |
| 3 · FE-0 shell & demo auth | ✅ verified |
| 4 · FE-1 buyer core (create/publish/triage/award) | ✅ verified |
| 5 · FE-2 supplier onboarding (BP-1 fakes) | ✅ verified + DB-asserted |
| 6 · FE-3 supplier sourcing (discover/quote/invitations) | ✅ verified + DB-asserted |
| 7 · FE-4 notifications & profiles (+ migration `0007`) | ✅ verified + DB-asserted |
| 8 · Deploy (Supabase cloud + Vercel + CI) | ✅ **LIVE** |

**BP-1 done.** Next = **BP-2**: swap the five fakes for real integrations (INT-1…5) + the reviewer console
(FE-5). Start the OTP/KYC provider pick (§6 D1 — the only true external dependency).

**FE-4 adds:** shared `/inbox` (notifications + mark-read) & an unread bell in the (now async) `Header`;
`/buyer/suppliers` discover + `/buyer/suppliers/[orgId]` public profile (badges + portfolio, **never**
identity/financials); `/buyer/profile` + `/supplier/profile` edit; a buyer-side `invite_supplier` control on
the RFQ detail. New migration **`0007_directory.sql`** = `v_supplier_directory` (a **default/definer** view so
it can read verified-status past the owner-only RLS on `onboarding_sections`). Applied live via psql; already
in the migration file for future resets.

---

## How to run (local, from scratch)

```powershell
# 1. Backend — needs Docker Desktop running. (PowerShell)
$env:PATH = "C:\Program Files\Docker\Docker\resources\bin;" + $env:PATH
supabase start ; supabase db reset ; supabase test db      # expect 136 passing
# Studio http://localhost:54323 · DB :54322 · API :54321

# 2. Frontend
cd web ; npm run dev                                        # http://localhost:3000
```

```bash
# DB assertions from the Bash tool (docker isn't on the bash PATH by default):
export PATH="/c/Program Files/Docker/Docker/resources/bin:$PATH"
docker exec -i supabase_db_SourceSutra psql -U postgres -d postgres
```

**If new routes 404 but `/` returns 200:** a stray `npx http-server . -p 3000` is squatting the port. Kill it
(`Get-NetTCPConnection -LocalPort 3000` → `Stop-Process -Id <pid> -Force`) then start `npm run dev`.

---

## Demo accounts (`seed.sql`) — password `sourcesutra` for all

| Who | Email | Seed state |
|---|---|---|
| Priya Menon · Vardhman Textiles (buyer) | priya.menon@vardhmantextiles.in | seeded RFQ + 1 draft |
| Suresh Anand · Anand Knitfab (supplier) | suresh@anandknitfab.in | **verified** (certs/badges) |
| Meena Kaur · Ludhiana Woolworks (supplier) | meena@ludhianawoolworks.in | **verified** |
| Anitha Rao · Tiruppur Threads (supplier) | anitha@tiruppurthreads.in | **un-onboarded** (walk FE-2) |

> ⚠️ **Session test data is NOT seeded.** A `supabase db reset` returns everything to the seed: Anitha
> un-onboarded, the seeded RFQ awarded (from FE-1), and **no active RFQ to discover**. To re-demo FE-2/FE-3
> after a reset, re-walk Anitha's onboarding in the UI and re-run the FE-3 setup SQL below (or fold both into
> `seed.sql` for durability).

### FE-3 test-data setup SQL (recreate active RFQs to discover/quote)

```sql
-- Run via: docker exec -i supabase_db_SourceSutra psql -U postgres -d postgres
do $$
declare buyer uuid := (select id from orgs where name='Vardhman Textiles');
        anitha uuid := (select id from orgs where name='Tiruppur Threads');
        rb uuid;
begin
  insert into rfqs (buyer_org_id, title, status, who_can_respond, quantity, unit, contract_type,
                    preferred_location, min_years_experience, bid_start, bid_end, delivery_date,
                    currency, target_price, published_at)
  values (buyer, 'Combed cotton polo, 20k pcs', 'active', 'open', 20000, 'pcs', 'Bulk production',
          'Tiruppur', 2, current_date, current_date + 20, current_date + 60, 'INR', 240, now());

  insert into rfqs (buyer_org_id, title, status, who_can_respond, quantity, unit, contract_type,
                    preferred_location, bid_start, bid_end, delivery_date, currency, target_price, published_at)
  values (buyer, 'Merino base layer, invite pilot', 'active', 'invite', 5000, 'pcs', 'Sample + bulk',
          'Tiruppur', current_date, current_date + 15, current_date + 45, 'INR', 520, now())
  returning id into rb;
  insert into invitations (rfq_id, supplier_org_id) values (rb, anitha) on conflict do nothing;
end $$;
```

---

## Architecture (unchanged)

Next.js 16 (App Router, TS, Tailwind v4) in `web/` + `@supabase/ssr` (cookie sessions) → Supabase. **The DB
is the single source of behavior:** the frontend only calls SECURITY DEFINER RPCs and reads RLS-scoped views
(`v_me`, `v_supplier_overall`, `v_cert_badges`, `v_my_invitations`). `service_role` stays server-only.
Host = Vercel; DB = Supabase cloud ap-south-1 (at deploy). See `buildplan.md` §1–§2 for the RPC/read contract.

**BP-1 fakes** (all reversible, no schema change to swap at BP-2): demo persona login (no public signup),
`demo_verify_my_section` auto-approve (migration `0006`), mock uploads = `documents` rows (no file),
simulated OTP = `set_identity_check`.

---

## FE-4 — DONE. Next task: Deploy (checklist in the status section above)

FE-4 delivered these screens, all verified in-browser + DB-asserted: in-app inbox, buyer "discover suppliers"
(`CustomerDiscover`), supplier public profile (`CustomerSupplierProfile`), buyer profile (`CustomerProfile`).
What each does (kept for reference when swapping fakes at BP-2):

- **In-app inbox** — read `notifications` (own org, RLS, newest-first); `update` marks read. Phase-3 triggers
  already write a row on every transition. Consider an unread badge in `Header`.
- **Buyer discover suppliers** — list verified suppliers (`supplier_is_verified`), render `v_cert_badges`
  (buyer-facing labels) + portfolio docs. **Identity/Financials must never render to a buyer** (decision #5:
  logged-in-only; owner/admin for sensitive sections — RLS already enforces, so don't even fetch them).
- **Profiles** — supplier public (mission, years, certs, portfolio) + buyer profile.
- **Carry-over from FE-3** — wire a buyer-side **invite** control on the buyer RFQ detail
  (`invite_supplier(rfq_id, supplier_org)`) using the supplier list from discover, so the invite loop is
  fully clickable.

Reuse the established patterns: server components fetch RLS-scoped reads; mutations go through
`"use server"` actions calling RPCs (see `app/buyer/actions.ts`, `app/supplier/actions.ts`).

---

## Key gotchas (don't rediscover)

- **Next 16:** `middleware.ts` → **`proxy.ts`** (export `proxy`); `cookies()` is **async**. `web/AGENTS.md`
  warns; docs bundled at `web/node_modules/next/dist/docs/`.
- **PostgREST embeds:** pin the FK on every `rfqs↔quotes`/`rfqs↔orgs` embed (two-FK ambiguity) —
  `quotes!quotes_rfq_id_fkey`, `rfqs!quotes_rfq_id_fkey`, `orgs!rfqs_buyer_org_id_fkey`.
- **Client gates mirror DB rules** so a Submit button only enables when the RPC would pass (V3/V4/V5 onboarding,
  V11/V12 quote). The DB still enforces regardless.
- **Loginable seed** needs bcrypt + `email_confirmed_at` + an `auth.identities` row (all three).
- **No frontend tests yet** — a Playwright pass over the core loop is the recommended minimum before/around
  deploy (see §7 risks).

---

## Open product decisions before BP-2 (buildplan §6)

D1 OTP/KYC provider (only real external dependency — India Aadhaar KYC needs a licensed provider) ·
D2 reviewer identity model (drives FE-5 auth) · D3 storage bucket layout & scanning · D4 styling approach ·
D5 email now vs fast-follow.
