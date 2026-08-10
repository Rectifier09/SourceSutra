# SourceSutra — Resume point

> One-page handoff to pick the build back up. Deeper detail: [`buildplan.md`](./buildplan.md) §8 (frontend +
> deploy sequence), [`bizlogic.md`](./bizlogic.md) (rules), [`userjourney.md`](./userjourney.md) (screens).
> **Last updated 2026-08-10 — FE-3 complete.**

---

## Status in one line

BP-1 (deployed self-serve demo, five integrations faked) is **6 of 8 steps done**: backend `0001`–`0006`
(**136 pgTAP green**) + frontend **FE-0 → FE-3** built, verified in-browser, and committed at
**`c4fff22`** "FE2 & F3 completed and tested by claude" (clean tree). **Next = FE-4 (notifications &
profiles)**, then **Deploy**.

| Step | State |
|---|---|
| 1 · Commit baseline | ✅ |
| 2 · `0006` demo shim + loginable seed | ✅ 136 pgTAP |
| 3 · FE-0 shell & demo auth | ✅ verified |
| 4 · FE-1 buyer core (create/publish/triage/award) | ✅ verified |
| 5 · FE-2 supplier onboarding (BP-1 fakes) | ✅ verified + DB-asserted |
| 6 · FE-3 supplier sourcing (discover/quote/invitations) | ✅ verified + DB-asserted |
| 7 · **FE-4 notifications & profiles** | ⬜ **← NEXT** |
| 8 · Deploy (Supabase cloud + Vercel + CI) | ⬜ |

Then **BP-2** swaps the five fakes for real integrations (INT-1…5) + the reviewer console (FE-5).

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

## What FE-4 needs (the next task)

Screens: in-app inbox, buyer "discover suppliers" (`CustomerDiscover`), supplier public profile
(`CustomerSupplierProfile`), buyer profile (`CustomerProfile`).

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
