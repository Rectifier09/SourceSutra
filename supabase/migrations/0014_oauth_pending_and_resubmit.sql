-- ============================================================================
-- SourceSutra — migration 0014: two real bug fixes found in production use.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Bug 1 — Google signup was permanently unrecoverable once 10 minutes passed.
--
-- finish_oauth_signup (0012) gated on orgs.created_at + 10 minutes. That
-- timestamp is fixed at first Google sign-in and never resets — a user who
-- simply took longer than 10 minutes filling out /onboarding/finish got
-- permanently locked out, since every retry re-links to the SAME auth.users
-- row. Confirmed live on prod: a real account (Google sign-in, full name
-- "Prashant Pratap Singh") got auto-provisioned as a default buyer org and
-- never finished, almost certainly for exactly this reason.
--
-- Fix: replace the time-based guard with an explicit, resettable-by-design
-- flag. This is actually a STRONGER guarantee than the old one — it can
-- never be replayed against an account that already finished, regardless of
-- elapsed time, instead of approximating "already in real use" via a clock.
-- ----------------------------------------------------------------------------

alter table profiles add column oauth_pending boolean not null default false;

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
  -- OAuth (Google) signups never carry our own 'role' key — only their own
  -- provider claims — so its absence is the existing signal this codebase
  -- already relies on to tell an OAuth signup apart from a password one.
  v_oauth_pending boolean := not (p_meta ? 'role');
begin
  insert into profiles (id, full_name, role, oauth_pending) values (p_user, v_name, v_role, v_oauth_pending)
    on conflict (id) do nothing;

  insert into orgs (kind, name) values (v_role, v_company) returning id into v_org;
  insert into memberships (org_id, user_id, role) values (v_org, p_user, 'owner');

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
  end if;
end;
$$;

create or replace function finish_oauth_signup(
  p_role             org_kind,
  p_company          text,
  p_phone            text default null,
  p_products         text[] default '{}',
  p_consent_version  text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user         uuid := auth.uid();
  v_org          uuid;
  v_current_kind org_kind;
  v_pending      boolean;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select oauth_pending into v_pending from profiles where id = v_user;
  if v_pending is null or not v_pending then
    raise exception 'no pending OAuth signup to finish for this account' using errcode = 'P0001';
  end if;

  select o.id, o.kind into v_org, v_current_kind
    from memberships m join orgs o on o.id = m.org_id
    where m.user_id = v_user;

  if v_org is null then
    raise exception 'no org found for current user' using errcode = 'P0001';
  end if;

  if v_current_kind <> p_role then
    if v_current_kind = 'supplier' then
      delete from onboarding_sections where org_id = v_org;
      delete from supplier_profiles where org_id = v_org;
    else
      delete from buyer_accounts where org_id = v_org;
    end if;

    update orgs set kind = p_role where id = v_org;
    update profiles set role = p_role where id = v_user;

    if p_role = 'supplier' then
      insert into supplier_profiles (org_id) values (v_org);
      insert into onboarding_sections (org_id, kind, status, weight) values
        (v_org, 'identity',   'not_started', 40),
        (v_org, 'financials', 'not_started', 40),
        (v_org, 'portfolio',  'not_started', 20);
    end if;
  end if;

  update orgs set name = coalesce(nullif(p_company, ''), name) where id = v_org;

  if p_role = 'buyer' then
    insert into buyer_accounts (org_id, products_sourced, phone, consent_version, consent_at)
    values (
      v_org, coalesce(p_products, '{}'), p_phone, p_consent_version,
      case when p_consent_version is not null then now() else null end
    )
    on conflict (org_id) do update set
      products_sourced = excluded.products_sourced,
      phone             = coalesce(excluded.phone, buyer_accounts.phone),
      consent_version   = coalesce(excluded.consent_version, buyer_accounts.consent_version),
      consent_at        = coalesce(buyer_accounts.consent_at, excluded.consent_at);
  end if;

  update profiles set oauth_pending = false where id = v_user;
end;
$$;

-- One-time backfill: the real stuck prod account found while diagnosing this
-- bug. Safe to keep in the migration (idempotent no-op everywhere else,
-- including local/fresh databases where this id never exists).
update profiles set oauth_pending = true where id = 'b56f0069-e59e-4789-947a-56286e9732da';

-- ----------------------------------------------------------------------------
-- Bug 2 — editing an already-onboarded supplier's section always errored.
--
-- Editing content on a verified section correctly reopens it for review via
-- trg_detail_reopen/trg_content_reopen (0004/0009), which flips status to
-- submitted_pending as a side effect of the save (or, for a Portfolio edit
-- that touches no certs, leaves it at verified untouched). But submit_section
-- (0004) only ever accepted not_started/draft/remediation as a starting
-- state, so the client's save-then-submit sequence always threw on an edit.
-- ----------------------------------------------------------------------------

create or replace function submit_section(p_kind section_kind)
returns onboarding_sections language plpgsql security definer set search_path = public as $$
declare
  v_org uuid; v_kind org_kind; v_sec onboarding_sections; v_chk identity_checks; n int;
begin
  select m.org_id, o.kind into v_org, v_kind
    from memberships m join orgs o on o.id = m.org_id where m.user_id = auth.uid() limit 1;
  if v_org is null or v_kind <> 'supplier' then
    raise exception 'only a supplier may submit onboarding' using errcode = '42501';
  end if;

  select * into v_sec from onboarding_sections where org_id = v_org and kind = p_kind for update;
  if not found then raise exception 'section % not found', p_kind using errcode = 'P0002'; end if;
  if v_sec.status not in ('not_started', 'draft', 'remediation', 'submitted_pending', 'verified') then
    raise exception 'section % is % (only a draft/remediation/verified section can be submitted)', p_kind, v_sec.status
      using errcode = 'P0001';
  end if;

  if p_kind = 'identity' then
    select * into v_chk from identity_checks where org_id = v_org;                 -- V4
    if v_chk is null or not (v_chk.email_verified and v_chk.phone_verified and v_chk.aadhaar_verified) then
      raise exception 'identity: email, phone and Aadhaar must be OTP/KYC-verified first (V4)' using errcode = 'P0001';
    end if;
    select count(*) into n from documents                                          -- V3 (docs)
      where org_id = v_org and section_kind = 'identity' and doc_type in ('GST', 'PAN') and status <> 'empty';
    if n < 2 then
      raise exception 'identity: GST and PAN documents are required (V3)' using errcode = 'P0001';
    end if;

  elsif p_kind = 'financials' then
    select count(distinct fy) into n from documents                                -- V5
      where org_id = v_org and section_kind = 'financials' and doc_type = 'MGT7'
        and fy is not null and status <> 'empty';
    if n < 3 then
      raise exception 'financials: MGT-7 is required for each of the last 3 FYs (V5)' using errcode = 'P0001';
    end if;
  end if;

  update onboarding_sections set status = 'submitted_pending'
    where org_id = v_org and kind = p_kind returning * into v_sec;
  update documents set status = 'in_progress', updated_at = now()
    where org_id = v_org and section_kind = p_kind and status in ('uploaded', 'needs_correction');
  return v_sec;
end;
$$;
