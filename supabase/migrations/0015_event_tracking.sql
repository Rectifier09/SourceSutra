-- ============================================================================
-- SourceSutra — migration 0015: event tracking for the /admin funnel dashboard.
--
-- domain_events (0004) is already an append-only outbox populated by DB
-- triggers for ~12 lifecycle events, but has no client-facing write path.
-- Adds:
--   * SignUp + ProfileCreated, folded into provision_account() (the existing
--     new-user provisioning trigger, 0002) — no new trigger needed.
--   * SectionModified, folded into BOTH section-reopen triggers — content
--     (documents/certifications, trg_content_reopen, 0004) AND detail
--     (supplier_directors/supplier_financials, trg_detail_reopen, 0009).
--     saveIdentity/saveFinancials touch the *_directors/*_financials tables
--     first, so on a real edit trg_detail_reopen is what actually flips a
--     verified section back to submitted_pending — trg_content_reopen's own
--     update then finds nothing left to do. Fires only when a real re-open
--     of an already-VERIFIED section happens (not on first-time submission).
--   * log_event(): a narrow, allow-listed RPC for the events that only make
--     sense from application code (page views, logins, RFQ draft saves,
--     profile edits) — granted to anon too, since landing-page traffic
--     includes logged-out visitors. org_id is resolved server-side from
--     auth.uid(), never trusted from the caller.
--   * get_event_counts(): the dashboard's only read path — returns aggregate
--     (type, kind, count) rows only, never org_id/rfq_id/quote_id/payload, so
--     granting it to `authenticated` can't leak any one org's activity to
--     another. The /admin route itself is separately email-gated in the app.
-- ============================================================================

create or replace function provision_account(p_user uuid, p_meta jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role    org_kind := coalesce((p_meta->>'role')::org_kind, 'buyer');  -- app passes 'role'
  v_name    text     := coalesce(p_meta->>'full_name', p_meta->>'name', 'New user');
  v_company text     := coalesce(p_meta->>'company', v_name);
  v_org     uuid;
begin
  insert into profiles (id, full_name, role) values (p_user, v_name, v_role)
    on conflict (id) do nothing;

  insert into orgs (kind, name) values (v_role, v_company) returning id into v_org;
  insert into memberships (org_id, user_id, role) values (v_org, p_user, 'owner');
  -- payload key is 'kind' (not 'persona') so it groups the same way as the
  -- onboarding-section events under get_event_counts() below.
  perform emit_event('SignUp', v_org, null, null, jsonb_build_object('kind', v_role));

  if v_role = 'supplier' then
    insert into supplier_profiles (org_id) values (v_org);
    insert into onboarding_sections (org_id, kind, status, weight) values
      (v_org, 'identity',   'not_started', 40),
      (v_org, 'financials', 'not_started', 40),
      (v_org, 'portfolio',  'not_started', 20);
  else
    insert into buyer_accounts (org_id, products_sourced, phone, consent_version, consent_at)
    values (
      v_org,
      coalesce(
        (select array_agg(v) from jsonb_array_elements_text(
           coalesce(p_meta->'products_sourced', '[]'::jsonb)) as t(v)),
        '{}'),
      p_meta->>'phone',
      p_meta->>'consent_version',
      case when p_meta ? 'consent_version' then now() else null end
    );
    perform emit_event('ProfileCreated', v_org);
  end if;
end;
$$;

create or replace function trg_content_reopen()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_kind section_kind;
begin
  if coalesce(current_setting('sourcesutra.reviewer', true), '') = 'on' then
    return new;
  end if;
  if tg_table_name = 'certifications' then
    v_kind := 'portfolio';
  else
    v_kind := new.section_kind;
  end if;
  update onboarding_sections set status = 'submitted_pending'
    where org_id = new.org_id and kind = v_kind and status = 'verified';
  if found then
    perform emit_event('SectionModified', new.org_id, null, null, jsonb_build_object('kind', v_kind));
  end if;
  return new;
end;
$$;

create or replace function trg_detail_reopen()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_kind section_kind := tg_argv[0]::section_kind;
begin
  if coalesce(current_setting('sourcesutra.reviewer', true), '') = 'on' then
    return new;
  end if;
  update onboarding_sections set status = 'submitted_pending'
    where org_id = new.org_id and kind = v_kind and status = 'verified';
  if found then
    perform emit_event('SectionModified', new.org_id, null, null, jsonb_build_object('kind', v_kind));
  end if;
  return new;
end;
$$;

-- ============================================================================
-- log_event: the only client-facing write onto domain_events. Allow-listed so
-- a caller can never spoof an internal lifecycle event (e.g. QuoteAwarded).
-- ============================================================================
create or replace function log_event(p_type text, p_payload jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  if p_type not in (
    'LandingPageView', 'Login', 'RfqViewed', 'SupplierViewed',
    'RfqApplicationViewed', 'RfqCreated', 'RfqInDraft', 'ProfileUpdated'
  ) then
    raise exception 'log_event: type % not allowed', p_type using errcode = '42501';
  end if;

  select m.org_id into v_org from memberships m where m.user_id = auth.uid() limit 1;
  insert into domain_events (type, org_id, payload) values (p_type, v_org, coalesce(p_payload, '{}'::jsonb));
end;
$$;

grant execute on function log_event(text, jsonb) to anon, authenticated;

-- ============================================================================
-- get_event_counts: the /admin dashboard's only read of domain_events.
-- Aggregate-only (no org_id/rfq_id/quote_id/payload beyond `kind`), so it's
-- safe to grant broadly — the route itself is separately email-gated.
-- ============================================================================
create or replace function get_event_counts()
returns table (type text, kind text, count bigint)
language sql security definer set search_path = public as $$
  select type, payload->>'kind' as kind, count(*)
  from domain_events
  group by type, payload->>'kind';
$$;

grant execute on function get_event_counts() to authenticated;
