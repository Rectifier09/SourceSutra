-- ============================================================================
-- pgTAP proof of the BP-1 demo shim (0006). Runs against 0001–0006.
--
-- Proves the self-serve onboarding path: a supplier submits each section (with the
-- prototype-style fakes — set_identity_check + mock doc rows) and auto-approves it,
-- reaching Onboarding Completed with no human reviewer; and that the shim refuses a
-- non-submitted section and a non-supplier caller.
-- The '60000000-…' namespace never collides with seed.sql. The test rolls back.
-- ============================================================================

create extension if not exists pgtap with schema extensions;

begin;
select plan(8);

create function pg_temp.login(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
end;
$$;

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
    '{"provider":"email","providers":["email"]}', meta, now(), now(), '', '', '', ''
  );
end;
$$;

create function pg_temp.orgof(uid uuid) returns uuid language sql stable
security definer set search_path = public as $$
  select org_id from memberships where user_id = uid limit 1;
$$;

-- ---------------------------------------------------------------- fixtures --
select pg_temp.signup('60000000-0000-0000-0000-0000000000c1', 'bp1_s1@test.in',
  '{"role":"supplier","full_name":"BP1 Sup","company":"BP1 Supplier"}');
select pg_temp.signup('60000000-0000-0000-0000-0000000000b1', 'bp1_b1@test.in',
  '{"role":"buyer","full_name":"BP1 Buyer","company":"BP1 Buyer Co"}');

-- mock uploads (BP-1 fake: rows, no real files) for the identity + financials gates
insert into documents (org_id, section_kind, doc_type, status) values
  (pg_temp.orgof('60000000-0000-0000-0000-0000000000c1'), 'identity', 'GST', 'uploaded'),
  (pg_temp.orgof('60000000-0000-0000-0000-0000000000c1'), 'identity', 'PAN', 'uploaded');
insert into documents (org_id, section_kind, doc_type, fy, status) values
  (pg_temp.orgof('60000000-0000-0000-0000-0000000000c1'), 'financials', 'MGT7', '2023-24', 'uploaded'),
  (pg_temp.orgof('60000000-0000-0000-0000-0000000000c1'), 'financials', 'MGT7', '2022-23', 'uploaded'),
  (pg_temp.orgof('60000000-0000-0000-0000-0000000000c1'), 'financials', 'MGT7', '2021-22', 'uploaded');

-- ---------------------------------------------------------------- act as S1 --
select pg_temp.login('60000000-0000-0000-0000-0000000000c1');

-- identity: simulated OTP (fake) -> submit -> auto-verify
select set_identity_check('email',   true);
select set_identity_check('phone',   true);
select set_identity_check('aadhaar', true, '4321');
select submit_section('identity');
select demo_verify_my_section('identity');
select is( (select status from onboarding_sections
              where org_id = pg_temp.orgof('60000000-0000-0000-0000-0000000000c1') and kind = 'identity'),
           'verified'::section_status, 'identity: submit + auto-verify -> verified' );

-- financials: submit -> auto-verify
select submit_section('financials');
select demo_verify_my_section('financials');
select is( (select status from onboarding_sections
              where org_id = pg_temp.orgof('60000000-0000-0000-0000-0000000000c1') and kind = 'financials'),
           'verified'::section_status, 'financials: submit + auto-verify -> verified' );

-- portfolio: submit -> auto-verify
select submit_section('portfolio');
select demo_verify_my_section('portfolio');
select is( (select status from onboarding_sections
              where org_id = pg_temp.orgof('60000000-0000-0000-0000-0000000000c1') and kind = 'portfolio'),
           'verified'::section_status, 'portfolio: submit + auto-verify -> verified' );

-- the whole point: self-serve onboarding reaches completion + discovery eligibility
select is( (select overall_status from v_supplier_overall
              where org_id = pg_temp.orgof('60000000-0000-0000-0000-0000000000c1')),
           'Onboarding Completed', 'supplier reaches Onboarding Completed with no human reviewer' );
select ok( supplier_is_verified(pg_temp.orgof('60000000-0000-0000-0000-0000000000c1')),
           'auto-verified supplier is discovery-eligible' );
select is( (select progress_pct from v_supplier_overall
              where org_id = pg_temp.orgof('60000000-0000-0000-0000-0000000000c1')),
           100, 'all three sections verified -> progress 100%' );

-- guards: can't auto-verify a section that isn't submitted (identity is now verified)
select throws_ok(
  $$ select demo_verify_my_section('identity') $$,
  'P0001', null, 'auto-verify refuses a section that isn''t submitted_pending'
);

-- a buyer cannot call the supplier-only shim
select pg_temp.login('60000000-0000-0000-0000-0000000000b1');
select throws_ok(
  $$ select demo_verify_my_section('identity') $$,
  '42501', null, 'a non-supplier cannot auto-verify onboarding'
);

select * from finish();
rollback;
