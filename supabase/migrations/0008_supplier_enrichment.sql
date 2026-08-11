-- ============================================================================
-- SourceSutra — migration 0008: supplier profile enrichment (frontend redesign).
-- ADDITIVE ONLY. Adds the profile depth the original prototype shows
-- (SourceSutraCustomer.dc.html -> the SUPPLIERS[] array) so the buyer
-- Discover -> Supplier Profile slice can render monogram cards, tag chips,
-- production / trade terms, catalogue, work history, products, facility photos,
-- contact, and richer certification cards.
--
-- Nothing here is sensitive: every column is buyer-facing directory / profile data
-- (supplier_profiles is world-readable to authenticated users via `profiles_read`,
-- certifications via `certifications_read`). Identity & Financials onboarding stay
-- owner-only exactly as before (decision #5, §A.10). The 12 prototype suppliers'
-- values live in seed.sql (data, not schema).
-- ============================================================================

-- ---------- supplier_profiles: prototype profile depth ----------
alter table supplier_profiles
  add column company_type               text,                                  -- 'Fabric supplier', 'Dyeing & processing', ...
  add column tags                       text[]  not null default '{}',         -- discovery filter chips
  add column logo_bg                    text,                                  -- monogram badge colours (per-supplier)
  add column logo_fg                    text,
  add column customization_capabilities text[]  not null default '{}',
  add column production                 jsonb   not null default '{}'::jsonb,  -- {factoryArea, employees, monthlyCapacity, productionLines}
  add column trade_terms                jsonb   not null default '{}'::jsonb,  -- {moq, incoterms, paymentTerms, leadTime}
  add column catalogue                  jsonb   not null default '[]'::jsonb,  -- [{id, fileName}]
  add column work_history               jsonb   not null default '[]'::jsonb,  -- [{client, role, frequency, start, end, desc}]
  add column products                   jsonb   not null default '[]'::jsonb,  -- [{name, category, material, priceRange}]
  add column facility_photos            jsonb   not null default '[]'::jsonb,  -- placeholder slots -> real images later
  add column contact                    jsonb   not null default '{}'::jsonb;  -- {name, title, email, phone, languages, responseTime}

-- ---------- certifications: fields the prototype cert cards show ----------
alter table certifications
  add column verification_url text,   -- external verification-lookup link
  add column audit_buyer      text,   -- buyer/brand audit: who audited
  add column audit_type       text,   -- buyer/brand audit: audit type
  add column audit_date       date;   -- buyer/brand audit: date performed

-- ---------- extend the buyer directory with the discover-card fields ----------
-- Append-only recreate (CREATE OR REPLACE VIEW keeps the leading columns & order).
-- Still the DEFINER directory of verified suppliers; exposes only non-sensitive
-- card data (never Identity/Financials).
create or replace view v_supplier_directory as
  select o.id as org_id, o.name, o.location,
         sp.mission, sp.years_in_business,
         sp.company_type, sp.tags, sp.logo_bg, sp.logo_fg
  from orgs o
  join supplier_profiles sp on sp.org_id = o.id
  where o.kind = 'supplier'
    and supplier_is_verified(o.id);

grant select on v_supplier_directory to authenticated;

-- New supplier_profiles / certifications columns inherit the existing table grants
-- and RLS policies (`profiles_read`/`profiles_update`, `certifications_read`/mutate).
