# SourceSutra — Frontend redesign to the original design

> Goal: replace the functional-but-off-brand BP-1 UI with the **original prototype design** (the `.dc.html`
> files / Claude Design project "Demo flows and design system"). Companion to [`buildplan.md`](./buildplan.md)
> and [`RESUME.md`](./RESUME.md). Started 2026-08-10.

## The core insight
**The engine is right; the skin is wrong.** Auth, RLS reads, RPCs, routing, and the live Supabase/Vercel
deploy all work (verified in production). This is a **reskin over a proven spine** — keep every server action
and data read, replace the presentation to match the prototype.

## Settled decisions (2026-08-10)
1. **Match the prototype exactly** — tab-bar shell, overlay modals (Create-RFQ, Supplier Profile), and the
   **Customer/Supplier toggle kept as a demo persona-switcher** (flips between seeded buyer/supplier accounts;
   real role still comes from login).
2. **Enrich schema + seed** — add the profile depth the prototype shows (production, trade terms, work
   history, catalogue, products, richer certs) and seed the **12 prototype suppliers**. Its own phase
   (migration `0008` → cloud `db push` → reseed).
3. **Pixel-faithful** fidelity.
4. **Homepage is the default screen** at `/` (was a role-redirect).
5. **Reuse `uploads/` assets** — no new art. Move to `web/public/img/` with clean names, web-optimize.
6. **Approach: vertical slice first** — buyer **Discover → Supplier Profile** end-to-end to prove the look,
   then roll the design system across every screen.

## Design system (extracted from the prototypes)
- **Fonts:** `Fraunces` (serif) for display/headings, `Inter` (sans) for body/UI.
- **Palette:** cream `#FAF8F4` / panel `#F2EEE6` / `#FBF1DE` · ink `#20202B`,`#2B2620` · muted `#6B6A78` ·
  **primary indigo `#403A77`** / `#6C6AA0` · lavender `#EDECF6`,`#D6D4EC`,`#C9C4E8` · **terracotta `#B5654A`**,
  `#E2792A`,`#D9700F` · **sage `#5B7A5B`**,`#EFF3EE` · borders `#E4DFD5`,`#E8DFC8`.
- **Motifs:** the **selvedge** divider (`repeating-linear-gradient` indigo/orange stripe); **monogram badges**
  (2-letter, per-supplier `logoBg`/`logoFg`); botanical-image heroes and supplier-card backgrounds; rounded
  14–18px cards; focus ring `2px solid #403A77`.

## Screen map (prototype → route → status)
| Prototype | Route | Notes |
|---|---|---|
| `ScreenLanding` (+`ScreenIntro`) | **`/` (new default)** | marketing homepage; CTAs → `/login` |
| `CustomerRegister` | `/login` (+ signup later) | prototype has Google signup; BP-1 = persona login |
| `SourceSutraCustomer` | buyer shell | sticky tab header + toggle |
| `CustomerDiscover` | `/buyer/suppliers` | filters, tag chips, search, monogram cards |
| `CustomerSupplierProfile` | `/buyer/suppliers/[orgId]` | rich profile (needs enrichment) |
| `CustomerMyRFQs` | `/buyer` | |
| `CustomerCreateRFQ` | `/buyer/rfqs/new` | full wizard; overlay in prototype |
| `CustomerProfile` | `/buyer/profile` | |
| `SourceSutra` | supplier shell | |
| `ScreenDashboard` | `/supplier` | onboarding; richest screen |
| `SupplierDiscoverRFQs` | `/supplier/discover` | |
| `SupplierRFQDetail` | `/supplier/rfqs/[id]` | |
| `SupplierCreateQuote` | (quote form) | |
| `SupplierQuotations` | `/supplier/quotes` + `/supplier/invitations` | |

## Content / schema gap (drives migration `0008`)
Prototype supplier data not yet stored: `type` (company type), `tags`, `logoBg`/`logoFg`, `catalogue[]`,
`workHistory[]`, `production{}` (factoryArea, employees, monthlyCapacity, productionLines),
`tradeTerms{}` (moq, incoterms, paymentTerms, leadTime), `products[]`, `facilityPhotos[]`, richer
`certifications` (issuingBody, certNumber, scope, issue/expiry, verificationUrl, buyer-audit outcome),
`contact{}`. Plan: add columns/jsonb to `supplier_profiles` (+ maybe `supplier_products`), extend
`certifications`, seed all 12 prototype suppliers. Live RFQ/quote/onboarding data stays real.

## Assets (`uploads/` → `web/public/img/`)
12 botanical/textile/facility PNGs (~2.5 MB each) → heroes + card backgrounds; `onboardingbanner.png` →
onboarding banner; the intro `gif`/`mp4`/`mp3` → landing/intro animation. Rename to clean slugs; compress.

## Phases
- **R0** — design-system foundation: Fraunces+Inter, palette tokens, primitives (Button/Card/Chip/Badge/
  Monogram/Tab/Shell/Selvedge/Hero).
- **R1** — homepage at `/` (this proves the look publicly) + app shells (tab header, toggle, overlay pattern).
- **R2 (slice)** — buyer Discover → Supplier Profile, pixel-faithful, with enriched data.
- **R3** — remaining buyer screens (My RFQs, Create-RFQ wizard, Profile).
- **R4** — supplier screens (onboarding dashboard, discover, quote, quotations, profile).
- **R5** — inbox, entry screens (intro/register), responsive + dark-mode call, redeploy.

## Preserve (do NOT change behavior)
Every `"use server"` action + RLS read + RPC call + route contract is live-verified — reskin the JSX only.
Backend `0001`–`0007` + the live deploy (https://source-sutra-prod.vercel.app) stay; `0008` extends, never rewrites.

---

## Progress log & resume point (2026-08-10)

### Done — R0 + homepage, LIVE
- **R0 · Design system** (`web/app/layout.tsx`, `web/app/globals.css`):
  - Fonts: `Fraunces` (`--font-display`) + `Inter` (`--font-sans`) via `next/font/google`.
  - Palette + motifs as Tailwind v4 theme tokens in `globals.css` (`@theme inline`): use as
    `text-primary`, `bg-cream`, `border-line`, `text-terra`, `bg-lav1`, `font-display`, etc.
    Token names: cream/panel/panel2/ink/ink2/muted/primary/primary2/lav1-3/terra/terra2/amber/sage/sagebg/line/line2.
  - `.selvedge` divider class (indigo/orange repeating-gradient).
- **Homepage** (`web/app/page.tsx`) = pixel-faithful port of `ScreenLanding`, now the **default screen at `/`**
  (no more role-redirect; logged-in users get a "Go to dashboard" button). Assets: `web/public/img/hero-bg.png`
  + `hero-panel.png` (copied from `uploads/`).
- **Committed `cdec337`, pushed, and DEPLOYED** — the live site now opens on the real brand. Inner pages
  (dashboards/discover/etc.) still carry the OLD skin — that's the next rollout.

### Gotchas learned (don't rediscover)
- **Tailwind v4 cascade layers:** unlayered base rules (e.g. `a { color: ... }`) BEAT utility classes
  (utilities live in a layer; unlayered CSS wins). Put base element styles in `@layer base { }` so
  `text-*`/`bg-*` can override — otherwise link text renders in the `a` color (was indigo-on-indigo = invisible).
- **CSS comment trap:** a `*/` sequence inside comment text (e.g. writing `text-*/bg-*`) closes the comment
  early → Lightning CSS parse error + blank page. Avoid `*/` inside comment prose.
- **Rendering the prototypes for reference:** they need `support.js`, so serve the repo root over HTTP and
  open the `.dc.html` (e.g. `npx http-server . -p 8145` → `http://localhost:8145/SourceSutraCustomer.dc.html`).
  A static server may squat a port — see the buildplan port-3000 gotcha.

### Done — migration `0008` + the buyer Discover→Profile slice (2026-08-11, LOCAL, not yet pushed)
- **Migration `0008_supplier_enrichment.sql`** (ADDITIVE): `supplier_profiles` gained `company_type`,
  `tags[]`, `logo_bg`/`logo_fg`, `customization_capabilities[]`, and jsonb `production`, `trade_terms`,
  `catalogue`, `work_history`, `products`, `facility_photos`, `contact`; `certifications` gained
  `verification_url`, `audit_buyer`, `audit_type`, `audit_date`; `v_supplier_directory` recreated
  (append-only) to also expose `company_type`, `tags`, `logo_bg`, `logo_fg` for the discover cards.
- **Seed** (`seed.sql`): all **12 prototype suppliers** enriched + verified — 10 new directory-only orgs
  (no auth user; "verified" derives from `onboarding_sections`) + the 2 existing loginable ones (Anand
  Knitfab, Ludhiana Woolworks). Prototype certs for the 6 rich suppliers; **badges left to the engine**
  (`cert_badge()` derives Verified/Registered/Expiring soon/Expired/Needs correction/Passed from dates+kind,
  so seed only sets `field_status` = verified vs needs_correction). Verified locally via `supabase db reset`.
- **Discover** (`web/app/buyer/suppliers/page.tsx` + `_components/DiscoverClient.tsx`): server fetches
  `v_supplier_directory`; client does live filtering (type/location select, tag-chip toggle, expanding
  search) + monogram glass cards over the botanical hero (`web/public/img/discover-bg.png`, from
  `uploads/ChatGPT …04_07_47 PM.png`).
- **Profile** (`.../[orgId]/page.tsx` + `_components/SupplierProfileView.tsx`): server shapes the enriched
  data + replicates the prototype's cert grouping/badge logic (`CERT_CATEGORIES_ORDER`, summary counts,
  audit vs cert cards, expired-dim); client renders header, production/trade/customization/products,
  grouped certs, facility gallery, work history, contact, and the view-doc modal. Guards to verified
  suppliers only (redirects if the org isn't in `v_supplier_directory`).
- **Verified in-browser** (localhost:3000, Priya buyer): discover shows 12/12 with the hero + filters;
  Anand Knitfab profile shows production/trade/certs (ISO 9001 → *Expired* dimmed, RCS → *Certified*;
  summary 2 total · 1 verified · 1 expiring soon · 1 expired), gallery, work history, modal all correct.
- **NOT pushed yet.** `tsc --noEmit` clean. Cloud still needs `npx supabase db push` (migration) + reseed
  via SQL Editor before this goes live; Vercel auto-deploys the FE on push to `main`.

### Done — deploy + shared shell + buyer home (2026-08-11, cont.)
- **Cloud migration `0008` APPLIED** to the deployed Supabase project via `npx supabase db push` (verified
  `migration list` shows `0008` local+remote). The **cloud seed** is the one manual step left: paste
  **`supabase/snippets/0008_seed_cloud.sql`** into the dashboard SQL Editor + Run (idempotent, guarded org
  inserts + cert delete/reinsert). Until then the live directory shows only the 2 originally-verified suppliers
  (no error — just sparse). FE was committed + pushed by the user (Vercel auto-deploys).
- **Shared shell reskinned** — `web/app/_components/Header.tsx` is now the prototype sticky cream tab-bar
  (Fraunces brand, role tabs with indigo active underline via new client `web/app/_components/NavTabs.tsx`,
  inbox bell, buyer-only "+ Create RFQ" CTA, Log out). Works for **both** roles. Removed the old-skin
  `SupplierNav` (deleted the component + its 6 usages) that duplicated the header tabs on supplier pages.
- **Buyer My RFQs** (`web/app/buyer/page.tsx`) reskinned to the design system (Fraunces heading, warm status
  badges: active=sage, draft=panel, awarded=lav, lapsed=terra).
- `tsc` clean; verified in-browser for both Priya (buyer) and Suresh (supplier).

### DEFERRED decision to revisit
- **Persona toggle** (decision #1: Customer/Supplier switch as a demo persona-switcher) is NOT in the reskinned
  Header yet — it needs a real "sign-in-as the seeded counterpart" action, so it's a small feature, not pure
  reskin. Add it when reskinning entry/auth (R5) or sooner if wanted.

### NEXT (in order)
1. ~~Cloud seed~~ **DONE** — applied to prod via `npx supabase db query --linked -f supabase/snippets/0008_seed_cloud.sql`
   (the CLI CAN seed a remote DB via the Management API; `db push` only does migrations). Shell also LIVE
   (commit `1adfb3b`). Live directory shows 13 (12 prototype + Tiruppur Threads, verified on prod via demo).
2. ~~R3 buyer~~ **DONE**: buyer profile (`buyer/profile` + client `BuyerProfileForm`, tag input), Create-RFQ
   form (`buyer/rfqs/new` + `_components/CreateRfqForm`, kept single-page — the prototype wizard is a bigger
   feature, deferred), buyer RFQ detail (`buyer/rfqs/[id]`, publish/invite/triage/reject/award preserved).
3. ~~R4 supplier~~ **DONE**: onboarding dashboard (`supplier/page.tsx` + `OtpChannel`), discover
   (`supplier/discover` + client `RfqDiscoverClient` filters), RFQ detail + quote form (`supplier/rfqs/[id]`),
   quotations (`supplier/quotes`), invitations (`supplier/invitations`), supplier profile (`supplier/profile`).
   All server actions preserved; `tsc` clean; onboarding dashboard + buyer profile browser-verified.
4. ~~R5~~ **MOSTLY DONE**: inbox (`/inbox`) reskinned; login (`/login`) reskinned (Fraunces + `.selvedge`
   motif + persona cards); **persona toggle LIVE in the Header** — a Customer/Supplier pill group that
   flips between the seeded buyer (Priya) & supplier (Suresh) accounts via `signInAs` (decision #1 done).
   Header polished to a single clean row (nav scrolls with hidden scrollbar; right cluster `shrink-0`).

### The redesign is now COMPLETE across the whole app (all screens on-brand & live).
Remaining polish / deferred (not blocking):
- **Dark mode** — intentionally deferred; `globals.css` commits to a single light look for now.
- **Entry intro/register** (`ScreenIntro`, `CustomerRegister`) — these are for a future PUBLIC-SIGNUP flow;
  BP-1 has no public signup (persona login is the entry), so they're out of scope until signup lands.
- **Create-RFQ multi-step wizard** (`CustomerCreateRFQ.dc.html`) — current form is single-page & functional;
  the wizard is a feature-sized rebuild, do it if/when desired.
- **Shared primitives** — extract Button/Card/Chip/Monogram/Tab/section-label into `web/app/_components/ui/`
  as a refactor (the patterns now repeat across many files).

### Asset map so far (`uploads/` → `web/public/img/`, renamed)
- `ChatGPT ...09_45_20 PM-d4fa2418.png` → `hero-bg.png` (landing fixed bg) ✓
- `ChatGPT ...10_33_52 AM.png` → `hero-panel.png` (landing right panel) ✓
- `ChatGPT ...04_07_47 PM.png` → `discover-bg.png` (buyer discover fixed hero, 2.2 MB — compress later) ✓
- Still to map as screens are built: the other 10 PNGs (supplier-card backgrounds / heroes),
  `onboardingbanner.png` (supplier onboarding), the intro `gif`/`mp4`/`mp3` (intro/landing animation).

### Deploy note
Vercel auto-deploys on push to `main` (~45s). Pushing mid-redesign puts new + old skin live together — the
user OK'd shipping the homepage now; hold further pushes until a flow (e.g. buyer) is coherent, unless asked.
