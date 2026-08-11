# SourceSutra — Resume point

> One-page handoff to pick the build back up. Deeper detail: [`buildplan.md`](./buildplan.md) §8 (frontend +
> deploy sequence), [`bizlogic.md`](./bizlogic.md) (rules), [`userjourney.md`](./userjourney.md) (screens).
> **Last updated 2026-08-11 (six-bug fix batch, commit `c8a649d`).**

---

## ▶ LATEST — six user-reported bugs fixed, verified, and deployed (2026-08-11)

Plan file: `C:\Users\Prashant P Singh\.claude\plans\staged-floating-crystal.md` has full investigation detail
per issue. Commits `130ffff` → `c8a649d`, migration `0014` on cloud.

1. **Google signup was permanently unrecoverable past 10 minutes** — `finish_oauth_signup`'s guard was based
   on org creation time, which never resets on retry. Confirmed on prod: a real Google account
   (`prashantpps09@gmail.com`) got stuck as an unfinished default buyer org. Replaced with
   `profiles.oauth_pending` (migration `0014`) — stronger security property (can never replay after a real
   finish) with no artificial deadline. `/auth/callback` now reads this flag directly instead of guessing from
   `auth.users` timestamps. The stuck prod account was backfilled and can now complete signup normally.
2. **Editing an already-onboarded supplier's section always errored on Submit** — `submit_section` only
   accepted `not_started/draft/remediation` as a starting state, but the existing reopen triggers correctly
   flip an edited verified section to `submitted_pending` (or leave it at `verified` for a Portfolio edit
   touching no certs) *before* submit runs. Widened the accepted states (same migration `0014`); validation
   checks (GST/PAN, 3yr MGT-7, OTP) still run unconditionally.
3. **New-onboarding animation "not playing"** — likely mostly a downstream symptom of #1 (misrouting could
   skip `/onboarding/finish` → `/supplier/welcome` entirely). Also added a `prefers-reduced-motion` check to
   `Intro.tsx`, which had none despite `globals.css` forcing near-zero transition durations under that OS
   setting — now jumps to the final state per the documented spec instead of silently not animating.
4. **Background images washed out** — homepage and supplier-onboarding-banner gradients were 72–92% opacity
   cream, nearly hiding the art. Reduced both to ~20–32%; visually confirmed in-browser, text stays legible.
5. **Buyer couldn't resume a draft RFQ** — clicking a draft only ever showed a static summary + a "Publish"
   button gated on dates already being set. `CreateRfqWizard` only ever supported create-new. Added
   `existingRfqId`/`initialState` props + an inverse DB-row-to-wizard-state mapping
   (`web/app/buyer/_components/rfqWizardState.ts` — **must stay a plain module, not `"use client"`**, since a
   Server Component calling a client-file export throws a real runtime 500, which is exactly what happened on
   first test). `web/app/buyer/rfqs/[id]/page.tsx` now renders the wizard directly for `draft`-status RFQs.
6. **RFQ detail pages hid most of what the wizard collects** — neither buyer nor supplier detail page ever
   rendered `rfq.spec` (product category, material, delivery address, shipping/incoterm/payment terms, etc.)
   or several structured columns (certs, customization needs, sample fields, pricing approach). New shared
   `web/app/_components/RfqDetails.tsx`, used by both pages.

**Verified for real, not just reviewed:** migration `0014` tested via psql (both fixes, including simulating a
2-day-old org to prove the old time guard is truly gone, and confirming replay is still correctly rejected
after a real finish); full draft-save → resume → prefill-confirm → re-save-in-place → publish walkthrough in
the browser; buyer and supplier detail views checked against both the freshly-published rich RFQ and older
sparse seed data (graceful `—` fallbacks). 136 pgTAP pass, `tsc` clean, prod confirmed live after each push.

⚠️ **Browser-automation gotcha hit repeatedly this session** — see [[browser-automation-gotchas]] memory:
`read_page`/`computer` click coordinates drifted from the true DOM layout unpredictably; `javascript_tool` with
the native `HTMLInputElement`/`HTMLSelectElement` value setter + `dispatchEvent` was the reliable fallback.
Also: CSS attribute selectors like `input[type=text]` only match an *explicit* HTML attribute — an input with
no `type=` at all (defaulting to text) won't match; filter by the `.type` property instead.

---

## ▶ LATEST FIX (2026-08-11) — Google signup completion page was missing identity fields

Real report: "post google auth Email should be auto populated along with First name and surname and password
field should be hidden... [then] able to login as either as buyer or supplier basis the selection." Root
cause: `/onboarding/finish` (the page real Google OAuth lands on post-redirect) never showed Email/First
name/Last name at all — it jumped straight to Company/Products/Phone, which read as a broken/incomplete
continuation of signup. Password was already correctly absent (never a bug). Fixed in commit `7035c31`:
- `page.tsx` now reads the authenticated user's `user_metadata` (Google's `given_name`/`family_name`, with a
  `full_name`/`name` split as fallback for providers that only send a combined name) and passes Email/First
  name/Last name into the form.
- `FinishOAuthForm.tsx` shows Email read-only, First/Last name editable+pre-filled, and a **role toggle**
  (buyer/supplier) so the choice can still be corrected after the Google redirect, not just locked in from
  before it.
- `actions.ts` now also writes the (possibly user-corrected) name to `profiles.full_name`.
- Added `error.tsx` (this route had none, and neither does any other route in the app — the whole codebase's
  server actions blind-`throw`, which Next renders as a raw "This page couldn't load" crash screen with no
  app-level boundary anywhere). Scoped to just this route rather than a sweeping app-wide fix. Catches
  `finish_oauth_signup`'s 10-minute expiry guard specifically with an actionable message + a way back to
  `/register`.
- **Verified for real**, not just by code review: pre-fill confirmed via a real session (Anitha's persona,
  both to exercise the full_name-split fallback path); a genuinely fresh scratch OAuth-shaped user (proper
  `auth.identities` row + non-null token columns, or GoTrue 500s with "Database error finding user") confirmed
  the full submit path — `profiles.full_name` update and `finish_oauth_signup` both succeed within the
  10-minute window; re-tested against Anitha's stale account to confirm the new error boundary renders the
  friendly "signup link has expired" message instead of the crash screen. Local pgTAP still 136/136, `tsc`
  clean, prod confirmed serving the updated `/register` page after deploy.
- ⚠️ **Browser-automation gotcha hit repeatedly this session:** `read_page`'s ref-based coordinates and the
  `computer` tool's click coordinates were drifting from the true DOM layout (confirmed via
  `getBoundingClientRect()` — real position nowhere near the ref/screenshot-implied one). Root cause not
  pinned down. Workaround: `javascript_tool` — read/set real values via `getBoundingClientRect`/direct DOM
  access, and dispatch real events (`el.click()` for buttons/checkboxes; the native `HTMLInputElement.value`
  setter + an `input` event for React-controlled text fields, since a plain `el.value = x` is silently
  ignored by React). Try this first if clicks stop landing again.

---

## ▶ RESUME HERE (2026-08-11) — BP-2 COMPLETE: all four integrations (INT-1/3/4/5) CONFIRMED LIVE

Create-RFQ wizard shipped, then **BP-2's four approved integrations were built, deployed, and individually
verified end-to-end** (commit `c88abcc` + follow-ups, migrations `0010`–`0012` on cloud): **INT-1 real
document storage**, **INT-5 CI cloud-deploy job**, **INT-3 email delivery**, and **INT-4 Google OAuth** —
every one actually exercised for real (not just "deployed"), see the per-item detail below. **INT-2 (OTP/KYC)
deferred** per plan — the only integration needing a licensed provider — and the reviewer/ops console (FE-5)
is the remaining unbuilt piece of the original plan.

**What's live vs. what needs one more step from you:**
- ✅ **INT-1 document storage** — fully live, no further action.
- ✅ **INT-5 CI job — CONFIRMED LIVE (2026-08-11).** User added `SUPABASE_ACCESS_TOKEN` +
  `SUPABASE_DB_PASSWORD` as GitHub repo secrets; verification run (commit `6774893`) went green end-to-end —
  both the "Link the cloud project" and "Push migrations to cloud" steps succeeded
  ([run 31516737140](https://github.com/Rectifier09/SourceSutra/actions/runs/31516737140)). Every future push
  to `main` touching `supabase/**` now auto-runs `supabase db push` against prod.
- ✅ **INT-3 email delivery — CONFIRMED LIVE (2026-08-11).** User set `RESEND_API_KEY` +
  `NOTIFICATIONS_FROM_ADDRESS` (sandbox sender `onboarding@resend.dev`, since `sourcesutra.app` isn't a
  verified Resend domain). Verified with a real send: inserted a scratch org + auth user (email
  `prashantpps09@gmail.com`) + an unsent notification directly on prod, temporarily scoped the function's
  query to that one org (reverted immediately after), invoked it, got `{"sent":1,"failed":0}`, confirmed
  `sent_at` was set, and the email actually arrived. Scratch org/user/notification all deleted afterward —
  nothing left on prod. **Security fix found along the way:** the function was reachable with *no*
  authentication at all (omitting a `[functions.*]` entry in `config.toml` does NOT default to
  `verify_jwt=true` the way the docs imply) — fixed by pinning `verify_jwt = true` explicitly (commit
  `e5c33d9`); confirmed an unauthenticated call now gets a `401`.
  - ⚠️ **Known limitation, not yet fixed:** permanently-undeliverable notifications (wrong sandbox recipient,
    or an org with no real login member) never get `sent_at` set, so they get re-selected by every future
    batch run forever — with ~50+ such rows already in prod (stale seed/demo backlog), a real BATCH_SIZE=50
    run can get stuck never reaching genuinely new notifications. Not urgent (harmless until Cron is wired
    up), but worth a real fix (e.g. a `failed_attempts`/`skip` marker) before relying on this for real users.
  - **Still needed to actually run automatically:** schedule it — Supabase Dashboard → Edge Functions →
    send-notification-emails → Cron (no scheduler wired up yet, so nothing sends until either that or a
    manual authenticated invoke happens).
- ✅ **INT-4 Google OAuth — CONFIRMED LIVE (2026-08-11).** User created a Google Cloud OAuth Client ID (Web
  application, redirect URI `https://wtbfwejothkzldfebjbm.supabase.co/auth/v1/callback`) and enabled it in
  **Supabase Dashboard → Authentication → Providers → Google**. Verified for real in the browser on prod:
  clicked "Continue with Google" on `/register?role=supplier` and landed on the actual
  `accounts.google.com` sign-in page, with a real `client_id`, `redirect_uri` correctly pointing at
  Supabase's callback, and `redirect_to` correctly carrying `role=supplier` through to
  `/auth/callback`. Did not complete an actual Google sign-in (no Google account credentials were used or
  should be) — reaching the real consent screen is definitive proof the whole chain (button →
  `signInWithOAuth` → GoTrue → Google) is wired correctly. `finish_oauth_signup` (migration `0012`) was
  already verified separately via psql (role-switch, buyer-stays-buyer upsert, 10-minute replay guard, auth
  guard). **All four planned BP-2 integrations (INT-1/3/4/5) are now fully live and verified.** Only INT-3's
  Cron schedule and its stale-backlog cleanup remain as small follow-ups (see above); nothing is blocking.

Earlier in this track: the full app **reskin is COMPLETE and LIVE**, the **onboarding-rebuild track is
DEPLOYED & LIVE** (pushed `78194d3`; migration `0009` applied to cloud; verified on prod — public `/register`
renders and a completed supplier shows the rich VendorProfile view), and the **Create-RFQ multi-step wizard**
was pushed as `643690f` (live before this session's BP-2 work began).

**Git:** `main` pushed through `e5c33d9`. Migrations `0001`–`0012` are on **both local and cloud**. Everything
is live at https://source-sutra-prod.vercel.app.

**What the onboarding rebuild added** (all browser-verified locally; full detail + phase log in
[`frontend-redesign.md`](./frontend-redesign.md) §"Onboarding rebuild"):
- **Public signup** — `/register` (customer/supplier toggle, real `auth.signUp` password path or real
  `signInWithOAuth` Google path — the original mock Google chooser was replaced by INT-4, see above) →
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

**DONE (2026-08-11, full walk-through):** Drove Anitha Rao (Tiruppur Threads, the un-onboarded demo account)
through the whole flow on local — Identity (contact, directors, Aadhaar/email/phone OTP, GST/PAN upload) →
submit → auto-verified → Financials (bank, billing/legal address, 3× MGT-7) → submit → auto-verified →
Portfolio (logo, production, trade terms, capabilities, 1 product, work history, catalogue, tags) → submit →
`Onboarding Completed`, 100%. Confirmed the completed `VendorProfile` renders every field, and that the new
supplier shows up live in the buyer's Discover Suppliers directory with Identity/Financials correctly hidden
(only Portfolio-derived fields render on the buyer-facing profile). No bugs found in the onboarding→discovery
path. (Hit one unrelated dev-server hiccup — a stale `next dev` process throwing on Next's internal
`jest-worker` — fixed by restarting `npm run dev`; not a code issue.)

**DONE (2026-08-11, Create-RFQ wizard, local only — not pushed):** Rebuilt `/buyer/rfqs/new` as the
prototype's true 5-step wizard (`CustomerCreateRFQ.dc.html`) — Product & requirements → Quantity/pricing/
samples → Compliance & preferences → Logistics & documents → Review & publish — with step dots, sticky nav,
jump-to-step Edit links, and a publish confirmation screen. New `web/app/buyer/_components/CreateRfqWizard.tsx`
+ `saveRfqDraft`/`publishRfqWizard` server actions; deleted the old single-page `CreateRfqForm`. No new
migration — every field maps onto existing `0003` `rfqs` columns or the `spec` jsonb catch-all. **Found +
fixed a real local-DB bug along the way:** `insert().select()` on `rfqs` was failing RLS because
`INSERT...RETURNING` needs the new row to pass the `can_view_rfq` SELECT policy, whose internal re-query
doesn't reliably see the not-yet-committed row on this Postgres instance — fixed by generating the id
client-side and skipping `.select()` (would have equally broken the old form, just never re-exercised).
Walked the full wizard start-to-publish in-browser locally, verified the resulting RFQ persists correctly and
the pre-existing invite/quote UI still works. `tsc` clean. Full detail in `frontend-redesign.md`
§"Create-RFQ wizard".

**NEXT STEPS to resume (nothing blocking):**
1. Schedule `send-notification-emails` via Supabase Dashboard → Edge Functions → Cron so INT-3 actually runs
   automatically (it's proven to work when invoked, it's just not on a schedule yet).
2. Worth fixing sometime: the stale-backlog issue noted under INT-3 above (permanently-failing notifications
   never get marked and block the batch window).
3. Deferred: dark mode; extract shared UI primitives; INT-2 (OTP/KYC — needs a licensed provider); reviewer/ops
   console (FE-5).

---

---

## Status in one line

**BP-1 IS LIVE** → **https://source-sutra-prod.vercel.app** (all 8 steps done). Backend `0001`–`0007` +
frontend FE-0→FE-4 on Vercel, backed by Supabase cloud `wtbfwejothkzldfebjbm` (ap-south-1). Verified live for
both personas.

> ⚡ **BP-2 real integrations are DONE** (see the ▶ RESUME HERE block at the top). The frontend redesign,
> onboarding rebuild, and INT-1/INT-3/INT-4/INT-5 are all **complete, live, and individually verified**.
> Plan + full phase log in **[`frontend-redesign.md`](./frontend-redesign.md)**. Deferred: **INT-2** (OTP/KYC)
> + reviewer console (FE-5) — those are what's left before a true BP-3.

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

**BP-1 done. BP-2 INT-1/3/4/5 done and confirmed live** (see the ▶ RESUME HERE block for how each was
verified). Remaining: INT-2 (OTP/KYC — needs a licensed provider) + the reviewer console (FE-5).

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
