-- ============================================================================
-- pgTAP proof of Phase 0 — auth & accounts (bizlogic.md §A.2 / Part C.1)
-- Run with:  supabase test db
--
-- Proves:
--   * signup provisioning: a new auth user + metadata => profile, org, membership,
--     and role-specific rows (supplier: profile + 3 onboarding sections; buyer:
--     buyer_account with consent captured)
--   * WRITE policies: an owner can edit their own profile/portfolio (change
--     persists); a stranger cannot edit another org's rows (RLS blocks the write)
--   * onboarding guard: a client CANNOT self-verify a section (reviewer-only),
--     and Financials is locked until Identity is submitted
--
-- NOTE: the auth.users insert below uses the canonical Supabase local-signup
-- column set. If your CLI's auth schema rejects it, that single helper is the
-- only thing to adjust.
-- ============================================================================

create extension if not exists pgtap with schema extensions;

begin;
select plan(14);

-- helper: simulate a Supabase signup (insert into auth.users -> fires provisioning)
create function pg_temp.signup(uid uuid, email text, meta jsonb) returns void
language plpgsql as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', email,
    '$2a$10$abcdefghijklmnopqrstuvwxyz012345678901234567890123456',
    '{"provider":"email","providers":["email"]}', meta, now(), now(),
    '', '', '', ''
  );
end;
$$;

-- helper: set auth context (both forms, version-proof)
create function pg_temp.login(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
end;
$$;

-- ---------------------------------------------------------------- signups --
select pg_temp.signup(
  'eeee0000-0000-0000-0000-0000000000a1', 'supplier@test.in',
  '{"role":"supplier","full_name":"Suresh Anand","company":"Anand Knitfab Test"}');

select pg_temp.signup(
  'eeee0000-0000-0000-0000-0000000000b1', 'buyer@test.in',
  '{"role":"buyer","full_name":"Priya Menon","company":"Vardhman Test","phone":"+91 99999 00000","products_sourced":["Knitwear","Denim"],"consent_version":"v1"}');

-- ------------------------------------------- 1. supplier provisioning --
select is( (select role from profiles where id = 'eeee0000-0000-0000-0000-0000000000a1'),
           'supplier'::org_kind, 'supplier profile created with role=supplier' );
select is( (select count(*)::int from orgs o
              join memberships m on m.org_id = o.id
             where m.user_id = 'eeee0000-0000-0000-0000-0000000000a1'
               and o.kind = 'supplier' and m.role = 'owner'),
           1, 'supplier gets one owner membership on a supplier org' );
select is( (select count(*)::int from supplier_profiles sp
              join memberships m on m.org_id = sp.org_id
             where m.user_id = 'eeee0000-0000-0000-0000-0000000000a1'),
           1, 'supplier_profiles row created' );
select is( (select count(*)::int from onboarding_sections s
              join memberships m on m.org_id = s.org_id
             where m.user_id = 'eeee0000-0000-0000-0000-0000000000a1'),
           3, 'three onboarding sections created' );
select is( (select s.weight from onboarding_sections s
              join memberships m on m.org_id = s.org_id
             where m.user_id = 'eeee0000-0000-0000-0000-0000000000a1' and s.kind = 'identity'),
           40, 'identity section weight is 40' );

-- ------------------------------------------- 2. buyer provisioning --
select is( (select role from profiles where id = 'eeee0000-0000-0000-0000-0000000000b1'),
           'buyer'::org_kind, 'buyer profile created with role=buyer' );
select is( (select o.kind from orgs o
              join memberships m on m.org_id = o.id
             where m.user_id = 'eeee0000-0000-0000-0000-0000000000b1'),
           'buyer'::org_kind, 'buyer org created' );
select is( (select ba.products_sourced from buyer_accounts ba
              join memberships m on m.org_id = ba.org_id
             where m.user_id = 'eeee0000-0000-0000-0000-0000000000b1'),
           array['Knitwear','Denim'], 'buyer products_sourced captured from metadata' );
select ok( (select ba.consent_at is not null from buyer_accounts ba
              join memberships m on m.org_id = ba.org_id
             where m.user_id = 'eeee0000-0000-0000-0000-0000000000b1'),
           'buyer consent timestamp recorded' );

-- --------------------------------- 3. WRITE policies + onboarding guard --
set local role authenticated;
select pg_temp.login('eeee0000-0000-0000-0000-0000000000a1');   -- act as the supplier

-- owner can edit their portfolio shell (assert the change persists)
update supplier_profiles set mission = 'Precision knit, on time.'
  where org_id = (select org_id from memberships where user_id = 'eeee0000-0000-0000-0000-0000000000a1');
select is(
  (select mission from supplier_profiles
     where org_id = (select org_id from memberships where user_id = 'eeee0000-0000-0000-0000-0000000000a1')),
  'Precision knit, on time.', 'owner can update their own supplier profile (write persists)'
);

-- Financials is locked until Identity is submitted (identity still not_started)
select throws_ok(
  $$ update onboarding_sections set status = 'submitted_pending'
       where kind = 'financials'
         and org_id = (select org_id from memberships where user_id = 'eeee0000-0000-0000-0000-0000000000a1') $$,
  'P0001', null,
  'Financials cannot be submitted before Identity'
);

-- a client cannot self-verify a section (reviewer-only)
select throws_ok(
  $$ update onboarding_sections set status = 'verified'
       where kind = 'identity'
         and org_id = (select org_id from memberships where user_id = 'eeee0000-0000-0000-0000-0000000000a1') $$,
  '42501', null,
  'a supplier cannot self-verify their onboarding'
);

-- but the owner CAN submit Identity for review (assert it persisted)
update onboarding_sections set status = 'submitted_pending'
  where kind = 'identity'
    and org_id = (select org_id from memberships where user_id = 'eeee0000-0000-0000-0000-0000000000a1');
select is(
  (select status from onboarding_sections where kind = 'identity'
     and org_id = (select org_id from memberships where user_id = 'eeee0000-0000-0000-0000-0000000000a1')),
  'submitted_pending'::section_status, 'owner can submit Identity for verification'
);

-- a stranger (the buyer) cannot edit the supplier's portfolio.
-- Resolve the org via the publicly-readable orgs.name so the row IS reachable;
-- the write is blocked purely by the update policy => 0 rows affected.
select pg_temp.login('eeee0000-0000-0000-0000-0000000000b1');   -- act as the buyer
select is(
  (with upd as (
     update supplier_profiles set mission = 'hacked'
       where org_id = (select id from orgs where name = 'Anand Knitfab Test')
       returning 1)
   select count(*)::int from upd),
  0, 'a stranger cannot edit another org''s supplier profile (RLS blocks the write)'
);

reset role;

select * from finish();
rollback;
