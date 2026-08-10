-- ============================================================================
-- SourceSutra — Phase 0: auth & accounts (bizlogic.md §A.2, Part C.1)
--
-- Integrates with Supabase Auth:
--   * profiles + buyer_accounts, and the memberships -> auth.users FK
--   * automatic provisioning on signup (a trigger on auth.users): the app passes
--     role/company/etc. in the signup metadata; we create the org, membership,
--     and role-specific rows (supplier: profile + 3 onboarding sections; buyer:
--     buyer_account with consent).
--   * WRITE RLS policies for the auto-API, + a guard so clients can't self-verify
--     onboarding and Financials stays locked until Identity is submitted.
-- ============================================================================

-- ---------- per-user profile (role + name), one per auth user ----------
-- Reuses org_kind {supplier,buyer} as the user's primary role.
create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  role       org_kind not null,
  created_at timestamptz not null default now()
);

-- ---------- buyer account details, one per buyer org ----------
create table buyer_accounts (
  org_id           uuid primary key references orgs(id) on delete cascade,
  products_sourced text[] not null default '{}',
  phone            text,
  consent_version  text,
  consent_at       timestamptz
);

-- Now that auth is integrated, tie memberships to real auth users.
alter table memberships
  add constraint memberships_user_fk
  foreign key (user_id) references auth.users(id) on delete cascade;

-- ============================================================================
-- Provisioning: turn a new auth user + signup metadata into a full account.
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

-- Fire provisioning after every new auth user (the classic Supabase pattern).
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform provision_account(new.id, coalesce(new.raw_user_meta_data, '{}'::jsonb));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================================
-- Onboarding write guard (§A.3): protects the auto-API write path.
--   * clients can NEVER set a section to verified/remediation — reviewer-only.
--     The Phase-1 verification function will `set local sourcesutra.reviewer='on'`.
--   * Financials stays locked until Identity is at least submitted (V2).
-- ============================================================================
create or replace function trg_section_guard()
returns trigger
language plpgsql
as $$
declare
  v_identity section_status;
begin
  if new.status in ('verified', 'remediation')
     and coalesce(current_setting('sourcesutra.reviewer', true), '') <> 'on' then
    raise exception 'section %.% -> % is reviewer-only', new.org_id, new.kind, new.status
      using errcode = '42501';
  end if;

  if new.kind = 'financials' and new.status in ('draft', 'submitted_pending') then
    select status into v_identity from onboarding_sections
      where org_id = new.org_id and kind = 'identity';
    if coalesce(v_identity, 'not_started') = 'not_started' then
      raise exception 'Financials is locked until Identity is submitted'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

create trigger section_guard
  before insert or update on onboarding_sections
  for each row execute function trg_section_guard();

-- ============================================================================
-- "GET /me" — the app's identity read (caller's profile + org + role).
-- security_invoker so RLS applies as the calling user.
-- ============================================================================
create view v_me with (security_invoker = on) as
  select p.id, p.full_name, p.role,
         m.org_id, o.kind as org_kind, o.name as org_name
  from profiles p
  join memberships m on m.user_id = p.id
  join orgs o on o.id = m.org_id
  where p.id = auth.uid();

-- ============================================================================
-- RLS — new tables + the WRITE policies (reads from 0001 stay in force)
-- ============================================================================
alter table profiles       enable row level security;
alter table buyer_accounts enable row level security;

-- profiles: a user sees & edits only their own.
create policy profiles_self_read   on profiles for select using (id = auth.uid());
create policy profiles_self_update on profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- memberships: a user can see their own memberships (needed by v_me).
create policy memberships_self_read on memberships for select using (user_id = auth.uid());

-- orgs: members may edit their own org (rename / location). Creation is trigger-only.
create policy orgs_member_update on orgs for update using (is_member(id)) with check (is_member(id));

-- supplier_profiles: owner edits the portfolio shell.
create policy supplier_profiles_update on supplier_profiles
  for update using (is_member(org_id)) with check (is_member(org_id));

-- onboarding_sections: owner may save/submit (legality enforced by section_guard).
create policy onboarding_owner_update on onboarding_sections
  for update using (is_member(org_id)) with check (is_member(org_id));

-- buyer_accounts: owner reads & edits.
create policy buyer_accounts_read   on buyer_accounts for select using (is_member(org_id));
create policy buyer_accounts_update on buyer_accounts for update using (is_member(org_id)) with check (is_member(org_id));

grant select on v_me to authenticated;

-- table grants for the 0002 tables (RLS policies above gate the rows).
grant select, update on profiles       to authenticated;
grant select, update on buyer_accounts to authenticated;
