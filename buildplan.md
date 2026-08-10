# SourceSutra — Build plan: wiring the product

> Companion to [`bizlogic.md`](./bizlogic.md) (rules) and [`userjourney.md`](./userjourney.md) (screens).
> Those say *what* the system does; this says *how we ship it* — the frontend, the remaining backend
> integrations, and the sequence to get from "128 pgTAP green locally" to "a live product."
>
> **Status of the world (2026-08-10):** backend Phases 0–3 are built & green in Postgres (`0001`–`0005`).
> The domain contract — RPCs, RLS, views — is real and tested. What's missing is a real frontend, a few
> stubbed integrations (file storage, OTP, email), and deployment. None of those block *starting* the
> frontend; two of them block *finishing* onboarding. This plan sequences all of it.

---

## 0. Scope — what "v1 complete" means

**In v1 (the shippable marketplace):** the full core loop, live, with real auth and real document
uploads.

- Buyer: register → create/publish RFQ → see applications → triage → award.
- Supplier: Google sign-in → onboard (3 sections, docs, certs, OTP) → get verified → discover RFQs →
  quote → win/lose → invitations.
- In-app notifications for every transition; a minimal reviewer/ops surface to verify suppliers.

**Deliberately deferred past v1** (each is already a `⚑`/Phase-4 item in `bizlogic.md`):

- Real Aadhaar **KYC** (licensed provider) — v1 uses phone/email OTP + a dev Aadhaar stub.
- Document **AV/format scanning** — v1 accepts uploads and marks them `in_progress` without a scan step.
- **Email/WhatsApp delivery** — notification rows persist; in-app is the v1 channel, email is a fast-follow.
- **Phase 4**: post-award projects, messaging, split awards, admin award-reversal, monetization,
  business-performance metrics, public/SEO supplier profiles.

---

## 0.1 Delivery phases

We ship in three build phases. **Build Phase 1 (BP-1) is a real, deployed, self-serve demo of the whole
loop** that *fakes* five integrations rather than building them. Nothing already built is removed — the
fakes call the real backend and swap out later with no schema change.

| Build phase | What ships | Integrations |
|---|---|---|
| **BP-1 · Demo MVP — deploy now** | The full core loop, live on Vercel + Supabase cloud, driven by seeded demo accounts; auto-verified onboarding with prototype-style fakes; in-app notifications. | none real — all five stubbed |
| **BP-2 · Real integrations** | Swap fakes for real: document storage (INT-1), OTP/KYC (INT-2), auth providers + public signup (INT-4), email delivery (INT-3), reviewer/ops console (FE-5). | INT-1…5 |
| **BP-3 · Beyond the core** | Phase 4 — post-award ops, messaging, split awards, admin reversal, WhatsApp, monetization, SEO profiles. | per feature |

**BP-1 — settled tradeoffs (2026-08-10):**

- **Auth = seeded demo accounts only.** No public signup UI. Ship pre-created buyer + supplier logins
  (Supabase email/password under the hood, email confirmation **off**, no Google) as a one-click
  "enter as …" persona login. → the `CustomerRegister` signup flow is deferred to BP-2.
- **Verification = auto-approve on submit.** A guarded, **additive** Phase-1 RPC (`demo_verify_my_section`,
  new migration `0006`) verifies the caller's just-submitted section via the reviewer path, so suppliers
  reach **Onboarding Completed** self-serve. `review_section` is untouched and becomes the console's engine
  in BP-2.
- **Onboarding = prototype-style fakes.** 'Uploads' create a `documents` row (filename + status, **no real
  file**); OTP simulates, then calls `set_identity_check(true)`. Real storage + provider drop in at BP-2
  with no schema change (`documents.storage_path` / `identity_checks` already exist).
- **Kept, not removed:** `review_section`, `identity_checks`, `documents.storage_path`, the email-channel
  notification rows, and every RPC/RLS/test remain — BP-1 simply doesn't exercise the real providers.
- **Still in BP-1 scope:** cloud deploy (Supabase **ap-south-1** + `db push`), Vercel, minimal CI
  (`supabase test db` on PR), and a **curated demo seed** (a verified supplier + an *un-onboarded* supplier
  to demo onboarding + a buyer + sample RFQs/quotes).

The frontend phases map to BP-1 as: **FE-0…FE-4 are BP-1** (demo login · buyer core · onboarding-with-fakes
· supplier sourcing · notifications & profiles). **FE-5 (reviewer console) is BP-2.**

---

## 1. Architecture

```
Browser ──▶ Next.js (App Router, Vercel) ──▶ Supabase
              │  @supabase/ssr (cookie sessions)      │
              │  RPC calls (.rpc) + RLS reads (.from)  ├─ Postgres  (0001–0005: tables, RPCs, RLS, views)
              │  Storage upload (.storage)             ├─ Auth      (Google OAuth · email+password)
              └─ Server Actions / Route Handlers ──────├─ Storage   (private onboarding-docs bucket)
                 (service_role for admin/email only)   └─ Edge Fns  (OTP verify · email send · doc scan)
```

- **One source of truth for behavior: the database.** The frontend never re-implements a rule — it calls
  an RPC or reads a view. All mutations go through the SECURITY DEFINER functions; all reads are
  RLS-scoped. This is why the frontend is mostly "glue," not logic.
- **Auth:** `@supabase/ssr` for cookie-based sessions that work in Server Components + Route Handlers.
  `select * from v_me` resolves `{user, org, role}` on every request → drives the persona split.
- **service_role stays server-only** — used only by Edge Functions and a couple of admin Server Actions
  (verification queue, email send). Never shipped to the browser.

**Stack:** Next.js (App Router) · TypeScript · `@supabase/supabase-js` + `@supabase/ssr` · Tailwind (port
the prototype's look) · Vercel (host) · Supabase (ap-south-1, Mumbai).

---

## 2. The backend contract the frontend consumes

Everything below already exists and is tested — this is the API the app codes against.

### RPCs (`supabase.rpc(...)`, role `authenticated` unless noted)

| Function | Persona | Purpose |
|---|---|---|
| `submit_section(kind)` | supplier | submit Identity/Financials/Portfolio for review (V3/V4/V5) |
| `set_identity_check(channel, verified, last4?)` | supplier | record an OTP/KYC **result** (called by the OTP Edge Fn) |
| `submit_quote(rfq_id, unit_price, …, submit)` | supplier | upsert the one live quote (V11/V12); `submit=false` saves draft |
| `respond_invitation(rfq_id, accept)` | supplier | accept/decline an invite |
| `publish_rfq(rfq_id)` | buyer | draft → active (V6/V7), fan-out |
| `set_quote_triage(quote_id, status)` | buyer | submitted ↔ under_review ↔ shortlisted |
| `award_quote(quote_id, idempotency_key?)` | buyer | the atomic award |
| `reject_quote(quote_id, reason?)` | buyer | not_selected; RFQ stays active |
| `foreclose_rfq(rfq_id, reason?)` / `reopen_rfq(rfq_id, new_end)` | buyer | close early / extend a lapsed RFQ |
| `invite_supplier(rfq_id, supplier_org)` | buyer | invite-only audience |
| `match_count(location?, min_years?)` | buyer | live "matching suppliers" in the RFQ wizard |
| `review_section(org, kind, decision, flags?)` | **service_role** | reviewer verify / remediate |
| `lapse_expired_rfqs()` | **service_role / pg_cron** | bid-window sweeper (already scheduled) |

### Reads (RLS-scoped `.from()` / views)

| Read | Backing |
|---|---|
| `v_me` | caller's profile + org + role |
| `v_supplier_overall` | derived overall status + `progress_pct` |
| `v_cert_badges` | computed supplier/buyer badge per certification |
| `v_my_invitations` | the supplier Invitations tab |
| `notifications` | in-app inbox (own org); `update` marks read |
| tables: `orgs`, `supplier_profiles`, `buyer_accounts`, `onboarding_sections`, `documents`, `certifications`, `rfqs`, `quotes`, `invitations` | RLS enforces the §A.10 matrix |

### Direct writes RLS already allows (no RPC needed)

- `rfqs` insert/update **while draft, by owner** (the wizard); transitions still go through RPCs.
- `documents` / `certifications` full CRUD by owner; `supplier_profiles`, `profiles`, `buyer_accounts`
  update by owner; `onboarding_sections` update for draft-saving.

> Gap this exposes: **document uploads have nowhere to go yet** — `documents.storage_path` is a
> placeholder. That's integration **INT-1** below.

---

## 3. Remaining backend integrations

These run **in parallel** with the frontend; each unblocks a specific frontend phase.

| # | Integration | What it is | Unblocks | Effort |
|---|---|---|---|---|
| **INT-1** | **Document storage** | Migration `0006`: a private `onboarding-docs` bucket + `storage.objects` RLS keyed on `org_id/section/…` (identity/financials → owner+reviewer only; portfolio → any authenticated). App uploads via `supabase.storage`, then writes `documents.storage_path`. | Supplier onboarding uploads (FE-2) | S–M |
| **INT-2** | **OTP / KYC** | An Edge Function that calls a provider (phone/email OTP e.g. MSG91/Twilio; Aadhaar KYC provider later), verifies, then calls `set_identity_check`. **Dev path first:** a guarded dev function that marks verified so onboarding is testable end-to-end before contracts are signed. | Identity submit / V4 (FE-2) | M (dev: S) |
| **INT-3** | **Email delivery** | Edge Function consuming `notifications where channel='email' and sent_at is null` (add the column) via Resend/Supabase SMTP; scheduled or webhook-triggered. | Email channel (FE-4, soft) | S–M |
| **INT-4** | **Auth providers** | Enable Google OAuth + email/password in Supabase dashboard + `config.toml`; set Vercel redirect URLs. | Login (FE-0) | S |
| **INT-5** | **Cloud + CI** | Supabase project (ap-south-1) + `supabase db push`; Vercel project + env; GitHub Actions (`supabase test db` on PR, `db push` on main). | A live environment | M |

> **The one real external dependency to decide early: the OTP/KYC provider** (Aadhaar KYC in India needs a
> licensed provider — cost + onboarding lead time). Everything else is buildable in-house. Start the dev
> stub so nothing waits on it, but pick the provider before v1 "complete."

---

## 4. Frontend phases (each ships end-to-end with a done-bar)

Built against the **local** stack first, deployed once INT-5 lands. Prototype screens in `()` are the
visual spec to port.

| Phase | Screens | Backend it calls | Done-bar |
|---|---|---|---|
| **FE-0 · Shell & auth** | landing/intro, register (`CustomerRegister`), the two app shells (`SourceSutra`, `SourceSutraCustomer`) | `auth.signUp/signInWithOAuth`, `v_me` | Google sign-in (supplier) & email/pw (buyer) land on the right shell; session survives refresh; sign-out. *(needs INT-4)* |
| **FE-1 · Buyer core** | create RFQ (`CustomerCreateRFQ`), my RFQs (`CustomerMyRFQs`), applications view | insert `rfqs` (draft) + `match_count`; `publish_rfq`; read `quotes`; `set_quote_triage`; `award_quote`/`reject_quote`; `foreclose`/`reopen` | Buyer publishes → sees applications → triages → awards; siblings flip; UI matches DB exactly. |
| **FE-2 · Supplier onboarding** | onboarding sections (`ScreenDashboard`), profile edit | `documents` upload, `certifications`, `set_identity_check`, `submit_section`; `v_supplier_overall` (progress/overall); remediation view | Supplier completes 3 sections → **Onboarding Completed** → appears in discovery; reviewer flags a field → remediation → resubmit → verified. *(needs INT-1, INT-2)* |
| **FE-3 · Supplier sourcing** | discover RFQs (`SupplierDiscoverRFQs`), RFQ detail (`SupplierRFQDetail`), create quote (`SupplierCreateQuote`), quotations + invitations (`SupplierQuotations`) | read eligible `rfqs` (RLS/`can_view_rfq`); `submit_quote`; `v_my_invitations` + `respond_invitation` | Eligible supplier discovers → quotes → sees status; invite-only RFQs visible only to invitees. |
| **FE-4 · Notifications & profiles** | in-app inbox, discover suppliers (`CustomerDiscover`), supplier public profile (`CustomerSupplierProfile`), buyer profile (`CustomerProfile`) | `notifications` (read + mark read); `supplier_profiles` + `v_cert_badges` + portfolio `documents` | Every transition shows in-app; buyer browses verified suppliers & badges; profiles render (Identity/Financials never leak). |
| **FE-5 · Reviewer/ops console** | (new — not in prototype) verification queue | list `onboarding_sections` in `submitted_pending`; `review_section` via a service_role Server Action | A human reviewer can verify or flag a supplier from a protected admin route. |

**Cross-cutting for every phase:** loading/empty/error states, optimistic updates where safe, form
validation mirroring §A.9 (client-side UX; the DB still enforces), and killing each prototype fake per the
`bizlogic.md §C.7` map as its screen is built.

---

## 5. BP-1 build order (what we're doing now)

Built against the **local** stack first, deployed once the app runs green.

1. ⏳ **Commit** the backend Phase 1/3 work + `web/` → tag the baseline. *(user commits)*
2. ✅ **`0006_phase1_demo.sql`** — `demo_verify_my_section(kind)` (auto-approve) + `v_supplier_overall`
   exposed to the app; **loginable demo seed** (`seed.sql`: buyer + verified supplier + un-onboarded
   supplier + sample RFQs/quotes). **136 pgTAP green.**
3. ✅ **FE-0 · Scaffold + demo auth** — Next.js 16 in `web/`, Supabase clients + `proxy.ts`, persona login
   → `v_me`-routed shells. Verified in-browser.
4. ✅ **FE-1 · Buyer core** — My RFQs, Create RFQ (+ live `match_count`), applications (triage / reject /
   award). Verified in-browser: award drove the real atomic flip + notifications.
5. ✅ **FE-2 · Onboarding (with fakes)** — three section cards, mock uploads, simulated OTP, `submit_section`
   → `demo_verify_my_section` → Onboarding Completed; progress/overall from `v_supplier_overall`. Verified
   in-browser as Anitha + DB-asserted: 3 sections verified, 100%, `supplier_is_verified`=true, aadhaar last-4
   only, events SectionSubmitted×3 / SectionVerified×3 / SupplierOnboarded×1.
6. ✅ **FE-3 · Supplier sourcing** — discover RFQs (RLS `can_view_rfq`), RFQ detail + quote form, My Quotes,
   Invitations tab (`respond_invitation`). Verified in-browser as Anitha + DB-asserted: discovered open +
   invited RFQs, submitted a quote (INR 232, appears buyer-side as 1 application), accepted an invite
   (→ responded + InvitationResponded event). SupplierNav ties the workspace together.
7. ⬜ **FE-4 · Notifications & profiles** — in-app inbox, discover suppliers, supplier/buyer profiles. **← NEXT**
8. ⬜ **Deploy** — Supabase cloud (ap-south-1) + `db push` + seed, Vercel, minimal CI. → BP-1 is live.

Then **BP-2** swaps each fake for its real integration (§3, INT-1…5) + the reviewer console (FE-5).

---

## 6. Open decisions to settle before/at kickoff

| # | Decision | Why it matters |
|---|---|---|
| D1 | **OTP/KYC provider** (phone/email + Aadhaar) | Only true external dependency; India KYC needs a licensed provider (cost + lead time). Dev stub unblocks build, but pick before v1. |
| D2 | **Reviewer identity model** | `review_section` is `service_role` today. Who is a reviewer — a flagged `profiles.role='admin'`, an allow-list, Supabase Studio only? Decides FE-5's auth. |
| D3 | **Storage bucket layout & scanning** | Path convention + RLS for identity/financial docs (must never leak); whether v1 skips AV scan (recommended: skip, mark `in_progress`). |
| D4 | **Styling approach** | Port the prototype's design system into Tailwind components, or adopt a component lib themed to match? Affects FE velocity. |
| D5 | **Email now or fast-follow** | In-app is enough for v1 demo; email (INT-3) can slip to just after. Confirm. |

---

## 7. Risks

- **KYC lead time** (D1) is the schedule risk — start provider selection in parallel with FE-0/FE-1.
- **Document-ACL correctness** — the single most important rule (§A.10: buyers never see Identity/
  Financials) now spans **two** enforcement points (table RLS *and* Storage RLS). INT-1 must get the
  Storage policies right; add a test.
- **Prototype ≠ code** — the `.dc.html` files are a design spec, not reusable React. FE effort is a real
  build, not a port-in-place. Budget accordingly.
- **No frontend tests yet** — decide a minimum (Playwright on the core loop) so the UI doesn't drift from
  the (well-tested) backend.

---

## 8. Progress log & resume point (2026-08-10)

**Where we are:** BP-1 steps 1–6 done (FE-0 → FE-3). Backend `0001`–`0006`, **136 pgTAP green**. The `web/`
app (Next 16) runs against the local Supabase stack with **auth + shells (FE-0), buyer core (FE-1), supplier
onboarding (FE-2), and supplier sourcing (FE-3)** all working and verified in-browser + DB-asserted.
**Committed** through **`c4fff22`** "FE2 & F3 completed and tested by claude" (clean tree). **Next = FE-4
(notifications & profiles)**, then **Deploy** (step 8) → BP-1 is live. See the standalone [`RESUME.md`](./RESUME.md)
for the one-page resume.

### What's built in `web/`
```
web/
  proxy.ts                      Next-16 session refresh (was middleware.ts)
  .env.local                    NEXT_PUBLIC_SUPABASE_URL/ANON_KEY → local stack (gitignored)
  lib/supabase/{client,server}  browser + server (async cookies()) clients
  lib/me.ts                     getMe() → v_me  ·  lib/demo.ts → seeded personas + password
  app/login/{page,actions}      persona login (signInAs / signOut server actions)
  app/page.tsx                  root → redirects by role  ·  _components/Header.tsx (org/role + sign-out)
  app/buyer/page.tsx            My RFQs  ·  buyer/actions.ts (create/publish/triage/award/reject)
  app/buyer/rfqs/new/           Create RFQ (+ _components/CreateRfqForm.tsx live match_count)
  app/buyer/rfqs/[id]/          RFQ detail + Applications
  --- FE-2 (onboarding, BP-1 fakes) ---
  app/supplier/page.tsx         Onboarding dashboard: 3 section cards + progress (v_supplier_overall)
  app/supplier/actions.ts       uploadDoc/removeDoc/verifyIdentityChannel/addCertification/submitSection
                                + submitQuote/respondInvitation (FE-3)
  app/supplier/_components/OtpChannel.tsx    client: simulated send-code→verify + countdown
  --- FE-3 (sourcing) ---
  app/supplier/_components/SupplierNav.tsx   Onboarding·Discover·My Quotes·Invitations sub-nav
  app/supplier/discover/page.tsx             active RFQs (RLS can_view_rfq)
  app/supplier/rfqs/[id]/page.tsx            RFQ detail + quote form (submit_quote)
  app/supplier/quotes/page.tsx               my quotes + status
  app/supplier/invitations/page.tsx          v_my_invitations + accept/decline (respond_invitation)
```

### How to run (from scratch)
```powershell
# 1. Backend (Docker Desktop running). Full paths per memory local-supabase-run.
$env:PATH = "C:\Program Files\Docker\Docker\resources\bin;" + $env:PATH
supabase start ; supabase db reset ; supabase test db     # expect 136 passing
# Studio http://localhost:54323 · DB :54322

# 2. Frontend
cd web ; npm run dev                                        # http://localhost:3000

# DB assertions (bash): export PATH so docker resolves, then exec psql:
#   export PATH="/c/Program Files/Docker/Docker/resources/bin:$PATH"
#   docker exec -i supabase_db_SourceSutra psql -U postgres -d postgres
```

### Demo accounts (seed.sql) — password `sourcesutra` for all
| Who | Email | State |
|---|---|---|
| Priya Menon · Vardhman Textiles (buyer) | priya.menon@vardhmantextiles.in | seeded RFQ (now awarded from FE-1) + 1 draft |
| Suresh Anand · Anand Knitfab (supplier) | suresh@anandknitfab.in | **verified**, has certs/badges |
| Meena Kaur · Ludhiana Woolworks (supplier) | meena@ludhianawoolworks.in | **verified** |
| Anitha Rao · Tiruppur Threads (supplier) | anitha@tiruppurthreads.in | seeded **un-onboarded**; after a `db reset`, re-walk FE-2 to onboard |

> ⚠️ **Session test data is NOT in `seed.sql`.** FE-2 onboarded Anitha and FE-3 SQL-inserted two active RFQs
> ("Combed cotton polo, 20k pcs" open; "Merino base layer, invite pilot" invite-only, Anitha invited) off
> Vardhman Textiles. A `supabase db reset` drops all of it back to seed state (Anitha un-onboarded, seeded RFQ
> awarded, no open RFQs to discover). To demo FE-3 after a reset, either re-run the FE-3 setup SQL (see
> `RESUME.md`) or fold those rows into `seed.sql`.

### Gotchas learned (don't rediscover)
- **Next 16:** `middleware.ts` → **`proxy.ts`** (export `proxy`); `cookies()` is **async**. Repo warns via
  `web/AGENTS.md`; docs are bundled at `web/node_modules/next/dist/docs/`.
- **Stray port-3000 squatter:** a leftover `npx http-server . -p 3000` (static server) can hold :3000 → new
  Next routes 404 while `/` 200s. Tell-tale: 404 with `Accept-Ranges: bytes` and no `X-Powered-By`. Fix:
  `Get-NetTCPConnection -LocalPort 3000` → `Stop-Process`, then `cd web && npm run dev`.
- **PostgREST embed ambiguity:** `rfqs↔quotes` has two FKs (`quotes.rfq_id`, `rfqs.awarded_quote_id`) — pin
  the FK on every embed: `quotes!quotes_rfq_id_fkey(...)`, `rfqs!quotes_rfq_id_fkey(...)`,
  `orgs!rfqs_buyer_org_id_fkey(...)`. A bare embed errors PGRST201 and supabase-js nulls the row.
- **submit_quote is one live quote (V12):** re-submitting updates the existing non-terminal quote, never
  duplicates. Client gates should mirror the DB (V3/V4/V5 onboarding, V11 quote) so the Submit button only
  enables when the RPC would pass.
- **Loginable seed:** GoTrue password login needs bcrypt (`extensions.crypt`) + `email_confirmed_at` + an
  `auth.identities` email row (all three) — see `seed.sql`.
- **pgTAP helpers acting as another role:** make `orgof(uid)` `SECURITY DEFINER`, else RLS on `memberships`
  hides other orgs and `where org_id = <null>` yields false 0s.

### NEXT — FE-4 (notifications & profiles) — the last frontend phase before deploy
Screens: in-app inbox, buyer "discover suppliers" (`CustomerDiscover`), supplier public profile
(`CustomerSupplierProfile`), buyer profile (`CustomerProfile`).
- **In-app inbox:** read `notifications` (own org, RLS) newest-first; `update sent/read` marks read. Every
  transition already writes rows (Phase-3 triggers) — surface unread count in the header ideally.
- **Buyer discover suppliers:** list verified suppliers (`supplier_is_verified`), show `v_cert_badges`
  (buyer-facing labels) + portfolio docs. Identity/Financials must **never** render to a buyer (decision #5:
  logged-in-only, owner/admin for sensitive sections; RLS already enforces — don't fetch them).
- **Profiles:** supplier public profile (mission, years, certs, portfolio) and buyer profile.
- **Small carry-over from FE-3:** wire a buyer-side **invite** control on the buyer RFQ detail
  (`invite_supplier(rfq_id, supplier_org)`) so the invite loop is fully clickable — needs the supplier list
  from the discover surface above.
Then **step 8 · Deploy:** Supabase cloud (ap-south-1) + `db push` + seed, Vercel + env, minimal CI.

---

*Last updated 2026-08-10 (FE-3 complete). Sequenced MVP-first; each phase is usable before the next. Settle
§6 with product before kickoff. Resume point + run instructions in §8; one-pager in `RESUME.md`.*
