-- ============================================================================
-- SourceSutra — FE-4 support: the verified-supplier directory (buyer discovery).
-- ADDITIVE. A buyer needs to browse verified suppliers, but verification derives
-- from onboarding_sections, whose RLS is owner-only — a buyer can't read another
-- org's sections. This view is the public directory of that fact.
--
-- Deliberately a DEFAULT view (security_invoker OFF) so it runs with the definer's
-- rights and can evaluate supplier_is_verified() past the caller's RLS. It exposes
-- ONLY non-sensitive directory fields (name, location, mission, years) of suppliers
-- that have reached Onboarding Completed — never Identity/Financials (decision #5).
-- ============================================================================
create view v_supplier_directory as
  select o.id as org_id, o.name, o.location,
         sp.mission, sp.years_in_business
  from orgs o
  join supplier_profiles sp on sp.org_id = o.id
  where o.kind = 'supplier'
    and supplier_is_verified(o.id);

grant select on v_supplier_directory to authenticated;
