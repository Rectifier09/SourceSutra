# SourceSutra web (Next.js 16)

The real front end for SourceSutra — **Build Phase 1 (BP-1)**. Wired to the Supabase backend in `../supabase`.
Product/architecture context: [`../buildplan.md`](../buildplan.md) (see **§8** for the resume point).

> ⚠️ **Next.js 16, not the one you may remember.** `middleware.ts` is now **`proxy.ts`**, and `cookies()`
> is **async**. `AGENTS.md` warns about this; the bundled docs are at `node_modules/next/dist/docs/`. Read
> before changing auth/session code.

## Run it

1. **Backend first** (Docker Desktop running):
   ```powershell
   $env:PATH = "C:\Program Files\Docker\Docker\resources\bin;" + $env:PATH
   supabase start ; supabase db reset      # loads migrations 0001–0006 + the demo seed
   ```
2. **This app:**
   ```powershell
   cd web ; npm run dev                     # http://localhost:3000
   ```

`.env.local` points at the local stack (`NEXT_PUBLIC_SUPABASE_URL` = http://127.0.0.1:54321 + the anon key).
It is gitignored — recreate it from `supabase status` if missing.

## Sign in (BP-1 = seeded demo accounts, no public signup)

Password for all: **`sourcesutra`**

| Persona | Email | Use for |
|---|---|---|
| Priya Menon (buyer) | `priya.menon@vardhmantextiles.in` | My RFQs, create/publish, applications, award |
| Suresh Anand (supplier) | `suresh@anandknitfab.in` | a verified/discoverable supplier |
| Anitha Rao (supplier) | `anitha@tiruppurthreads.in` | **un-onboarded** — walk the onboarding flow (FE-2) |

## How it's wired

- **Auth/session:** `@supabase/ssr`. `proxy.ts` refreshes the session each request; `lib/supabase/server.ts`
  (Server Components / Actions, async `cookies()`) and `lib/supabase/client.ts` (browser).
- **Identity:** `lib/me.ts` reads the `v_me` view → routes to `/buyer` or `/supplier`.
- **Mutations** go through the DB's SECURITY DEFINER RPCs via Server Actions (e.g. `app/buyer/actions.ts`:
  `publish_rfq`, `set_quote_triage`, `award_quote`, …). **Reads** are RLS-scoped `.from()` queries. The
  frontend never re-implements a rule — the database is the source of truth.

## Status

- ✅ **FE-0** — persona login, `proxy.ts` session, role-routed buyer/supplier shells.
- ✅ **FE-1** — buyer core: My RFQs, Create RFQ (live `match_count`), applications (triage / reject / award).
- ⬜ **FE-2 (next)** — supplier onboarding with BP-1 fakes (mock uploads + simulated OTP →
  `submit_section` → `demo_verify_my_section`). Then FE-3 (sourcing), FE-4 (notifications/profiles), deploy.

**Gotcha:** `rfqs↔quotes` has two FKs — embed counts as `quotes!quotes_rfq_id_fkey(count)`, not `quotes(count)`.
