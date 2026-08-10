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

### NEXT (in order)
1. **Schema enrichment — migration `0008`** (see "Content / schema gap" above): add supplier profile depth
   + seed the 12 prototype suppliers (their data is in the `<script type="text/x-dc">` block of
   `SourceSutraCustomer.dc.html`, the `SUPPLIERS = [...]` array — company type, tags, logoBg/logoFg,
   catalogue, workHistory, production, tradeTerms, products, facilityPhotos, rich certifications, contact).
   Then `npx supabase db push` to cloud + reseed (SQL Editor). Keep it ADDITIVE.
2. **Vertical slice** (task): reskin `web/app/buyer/suppliers/page.tsx` (Discover — filters, tag chips,
   search, monogram cards over imagery; ref `CustomerDiscover.dc.html` + the rendered shot) and
   `.../[orgId]/page.tsx` (rich profile; ref `CustomerSupplierProfile.dc.html`). Pixel-faithful.
3. Then roll the design system across the rest (R3 buyer, R4 supplier, R5 inbox/entry) per the Phases list.
   Extract shared primitives (Button/Card/Chip/Monogram/Tab/Shell) into `web/app/_components/ui/` as they recur.

### Asset map so far (`uploads/` → `web/public/img/`, renamed)
- `ChatGPT ...09_45_20 PM-d4fa2418.png` → `hero-bg.png` (landing fixed bg) ✓
- `ChatGPT ...10_33_52 AM.png` → `hero-panel.png` (landing right panel) ✓
- Still to map as screens are built: the other 10 PNGs (supplier-card backgrounds / heroes),
  `onboardingbanner.png` (supplier onboarding), the intro `gif`/`mp4`/`mp3` (intro/landing animation).

### Deploy note
Vercel auto-deploys on push to `main` (~45s). Pushing mid-redesign puts new + old skin live together — the
user OK'd shipping the homepage now; hold further pushes until a flow (e.g. buyer) is coherent, unless asked.
