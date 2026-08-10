-- ============================================================================
-- SourceSutra — Build Phase 1 (BP-1) demo shim. ADDITIVE + REMOVABLE.
--
-- BP-1 ships the whole loop WITHOUT the real reviewer/ops console (see buildplan.md
-- §0.1). This one function lets a supplier's just-submitted section be auto-approved
-- so onboarding is self-serve in the demo. It changes NOTHING already built —
-- `review_section` (the real reviewer engine) is untouched and takes over in BP-2.
--
-- ⚠️ This intentionally lets a supplier verify their OWN section. That's acceptable
--    only for the seeded-demo deployment. DROP this function when the reviewer
--    console (FE-5 / BP-2) lands.
-- ============================================================================

create or replace function demo_verify_my_section(p_kind section_kind)
returns onboarding_sections language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_kind org_kind; v_sec onboarding_sections;
begin
  select m.org_id, o.kind into v_org, v_kind
    from memberships m join orgs o on o.id = m.org_id where m.user_id = auth.uid() limit 1;
  if v_org is null or v_kind <> 'supplier' then
    raise exception 'only a supplier may auto-verify their onboarding' using errcode = '42501';
  end if;

  select * into v_sec from onboarding_sections where org_id = v_org and kind = p_kind;
  if not found then raise exception 'section % not found', p_kind using errcode = 'P0002'; end if;
  if v_sec.status <> 'submitted_pending' then
    raise exception 'section % is % (auto-verify only applies to a submitted section)', p_kind, v_sec.status
      using errcode = 'P0001';
  end if;

  -- reuse the real reviewer path (owner postgres can execute it regardless of grant);
  -- this emits SectionVerified / SupplierOnboarded + notifications exactly as a human review would.
  return review_section(v_org, p_kind, 'verify');
end;
$$;

grant execute on function demo_verify_my_section(section_kind) to authenticated;
