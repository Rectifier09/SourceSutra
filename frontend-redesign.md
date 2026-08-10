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
