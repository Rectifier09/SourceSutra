-- ============================================================================
-- pgTAP proof of Phase 1 — Onboarding & verification (bizlogic.md Part C.2).
-- Runs against 0001 + 0002 + 0003 + 0004.
--
-- Proves the done-bar and the settled decisions:
--   * the FULL badge vocabulary (#4): Verified/Certified, Self-declared/Claimed,
--     Registered, Expiring soon, Expired, Needs correction, + audit outcomes
--   * progress curve (#3) folded into v_supplier_overall
--   * submit_section enforces V3 (docs) / V4 (OTP) / V5 (MGT-7 ×3) and freezes review
--   * review_section: reviewer path verify / remediate-with-reasons
--   * remediation -> resubmit -> verified round trip
--   * editing a verified section RE-OPENS it (#2)
--   * OTP/KYC stores result-only + masked last-4 (A.11.5)
--   * SectionVerified / SupplierOnboarded domain events
--   * RLS: buyers never read Identity docs / identity_checks; portfolio + certs
--     readable by any logged-in user (#5)
--
-- Users are created via the real signup trigger; the '40000000-…' namespace never
-- collides with seed.sql or the other suites. The whole test rolls back.
-- ============================================================================

create extension if not exists pgtap with schema extensions;

begin;
select plan(37);

-- ---------------------------------------------------------------- helpers --
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

-- SECURITY DEFINER: this helper must resolve ANY org even when the test is acting
-- as a role (e.g. a buyer) whose RLS would otherwise hide other orgs' memberships.
create function pg_temp.orgof(uid uuid) returns uuid language sql stable
security definer set search_path = public as $$
  select org_id from memberships where user_id = uid limit 1;
$$;

-- ---------------------------------------------------------------- fixtures --
select pg_temp.signup('40000000-0000-0000-0000-0000000000c1', 'p1_s1@test.in',
  '{"role":"supplier","full_name":"P1 Sup One","company":"P1 Supplier One"}');
select pg_temp.signup('40000000-0000-0000-0000-0000000000c2', 'p1_s2@test.in',
  '{"role":"supplier","full_name":"P1 Sup Two","company":"P1 Supplier Two"}');
select pg_temp.signup('40000000-0000-0000-0000-0000000000c3', 'p1_s3@test.in',
  '{"role":"supplier","full_name":"P1 Sup Three","company":"P1 Supplier Three"}');
select pg_temp.signup('40000000-0000-0000-0000-0000000000b1', 'p1_b1@test.in',
  '{"role":"buyer","full_name":"P1 Buyer","company":"P1 Buyer Co"}');

-- =====================================================================================
-- 1. Badge vocabulary (§A.8.1, decision #4) — insert certs for S1, check both maps.
--    Run as the default superuser role so RLS is out of the way for pure-logic checks.
-- =====================================================================================
insert into certifications (id, org_id, kind, category, name, field_status, does_not_expire, expiry_date, audit_outcome) values
  ('4c000000-0000-0000-0000-0000000000a1', pg_temp.orgof('40000000-0000-0000-0000-0000000000c1'), 'standard',   'ISO',             'ISO 9001',       'verified',         true,  null,                          null),
  ('4c000000-0000-0000-0000-0000000000a2', pg_temp.orgof('40000000-0000-0000-0000-0000000000c1'), 'standard',   'GOTS',            'GOTS',           'uploaded',         true,  null,                          null),
  ('4c000000-0000-0000-0000-0000000000a3', pg_temp.orgof('40000000-0000-0000-0000-0000000000c1'), 'regulatory', 'Factory Licence', 'Factory Licence','verified',         true,  null,                          null),
  ('4c000000-0000-0000-0000-0000000000a4', pg_temp.orgof('40000000-0000-0000-0000-0000000000c1'), 'standard',   'ISO',             'ISO 14001',      'verified',         false, current_date - 1,              null),
  ('4c000000-0000-0000-0000-0000000000a5', pg_temp.orgof('40000000-0000-0000-0000-0000000000c1'), 'standard',   'SA8000',          'SA8000',         'verified',         false, current_date + 30,             null),
  ('4c000000-0000-0000-0000-0000000000a6', pg_temp.orgof('40000000-0000-0000-0000-0000000000c1'), 'standard',   'GRS',             'GRS',            'needs_correction', true,  null,                          null),
  ('4c000000-0000-0000-0000-0000000000a7', pg_temp.orgof('40000000-0000-0000-0000-0000000000c1'), 'audit',      'Buyer Audit',     'Brand X Audit',  'verified',         true,  null,                          'passed'),
  ('4c000000-0000-0000-0000-0000000000a8', pg_temp.orgof('40000000-0000-0000-0000-0000000000c1'), 'audit',      'Buyer Audit',     'Brand Y Audit',  'verified',         true,  null,                          'passed_with_corrective'),
  ('4c000000-0000-0000-0000-0000000000a9', pg_temp.orgof('40000000-0000-0000-0000-0000000000c1'), 'audit',      'Buyer Audit',     'Brand Z Audit',  'verified',         true,  null,                          'failed'),
  ('4c000000-0000-0000-0000-0000000000aa', pg_temp.orgof('40000000-0000-0000-0000-0000000000c1'), 'audit',      'Buyer Audit',     'Brand W Audit',  'verified',         true,  null,                          null);

select is( (select badge_supplier from v_cert_badges where id = '4c000000-0000-0000-0000-0000000000a1'),
           'Verified', 'standard verified cert -> supplier badge "Verified"' );
select is( (select badge_buyer    from v_cert_badges where id = '4c000000-0000-0000-0000-0000000000a1'),
           'Certified', 'standard verified cert -> buyer badge "Certified"' );
select is( (select badge_supplier from v_cert_badges where id = '4c000000-0000-0000-0000-0000000000a2'),
           'Self-declared', 'unverified cert -> "Self-declared"' );
select is( (select badge_buyer    from v_cert_badges where id = '4c000000-0000-0000-0000-0000000000a2'),
           'Claimed', 'unverified cert -> buyer badge "Claimed"' );
select is( (select badge_supplier from v_cert_badges where id = '4c000000-0000-0000-0000-0000000000a3'),
           'Registered', 'regulatory verified cert -> "Registered"' );
select is( (select badge_supplier from v_cert_badges where id = '4c000000-0000-0000-0000-0000000000a4'),
           'Expired', 'past-expiry cert -> "Expired"' );
select is( (select badge_supplier from v_cert_badges where id = '4c000000-0000-0000-0000-0000000000a5'),
           'Expiring soon', 'expiry within 60 days -> "Expiring soon"' );
select is( (select badge_supplier from v_cert_badges where id = '4c000000-0000-0000-0000-0000000000a6'),
           'Needs correction', 'needs_correction cert -> "Needs correction"' );
select is( (select badge_supplier from v_cert_badges where id = '4c000000-0000-0000-0000-0000000000a7'),
           'Passed', 'audit outcome passed -> "Passed"' );
select is( (select badge_supplier from v_cert_badges where id = '4c000000-0000-0000-0000-0000000000a8'),
           'Passed with corrective actions', 'audit outcome -> "Passed with corrective actions"' );
select is( (select badge_supplier from v_cert_badges where id = '4c000000-0000-0000-0000-0000000000a9'),
           'Failed', 'audit outcome failed -> "Failed"' );
select is( (select badge_supplier from v_cert_badges where id = '4c000000-0000-0000-0000-0000000000aa'),
           'Pending', 'audit with no outcome -> "Pending"' );

-- =====================================================================================
-- 2. Progress curve (#3) + overall status (§A.4), driven on S2.
-- =====================================================================================
select is( (select progress_pct from v_supplier_overall where org_id = pg_temp.orgof('40000000-0000-0000-0000-0000000000c2')),
           0, 'fresh supplier progress = 0' );

update onboarding_sections set status = 'draft'
  where org_id = pg_temp.orgof('40000000-0000-0000-0000-0000000000c2') and kind = 'identity';
select is( (select progress_pct from v_supplier_overall where org_id = pg_temp.orgof('40000000-0000-0000-0000-0000000000c2')),
           16, 'identity draft -> 0.4 * 40 = 16' );

select review_section(pg_temp.orgof('40000000-0000-0000-0000-0000000000c2'), 'identity',   'verify');
select review_section(pg_temp.orgof('40000000-0000-0000-0000-0000000000c2'), 'financials', 'verify');
select is( (select progress_pct from v_supplier_overall where org_id = pg_temp.orgof('40000000-0000-0000-0000-0000000000c2')),
           80, 'identity + financials verified -> 80' );

update onboarding_sections set status = 'submitted_pending'
  where org_id = pg_temp.orgof('40000000-0000-0000-0000-0000000000c2') and kind = 'portfolio';
select is( (select progress_pct from v_supplier_overall where org_id = pg_temp.orgof('40000000-0000-0000-0000-0000000000c2')),
           94, 'portfolio submitted -> 80 + 0.7*20 = 94' );
select is( (select overall_status from v_supplier_overall where org_id = pg_temp.orgof('40000000-0000-0000-0000-0000000000c2')),
           'Onboarding Completed', 'id+fin verified & portfolio submitted -> Onboarding Completed' );

-- =====================================================================================
-- 3. submit_section: V4 (OTP), V3 (docs), masked Aadhaar (A.11.5) — on S3.
-- =====================================================================================
select pg_temp.login('40000000-0000-0000-0000-0000000000c3');    -- act as S3 (auth.uid resolves)

select throws_ok(
  $$ select submit_section('identity') $$,
  'P0001', null, 'identity submit blocked before OTP/KYC (V4)'
);

select set_identity_check('email',   true);
select set_identity_check('phone',   true);
select set_identity_check('aadhaar', true, '9999-8888-1234');

select throws_ok(
  $$ select submit_section('identity') $$,
  'P0001', null, 'identity submit blocked without GST/PAN docs (V3)'
);

-- upload the required identity docs (superuser insert; RLS covered separately in §7)
insert into documents (org_id, section_kind, doc_type, status) values
  (pg_temp.orgof('40000000-0000-0000-0000-0000000000c3'), 'identity', 'GST', 'uploaded'),
  (pg_temp.orgof('40000000-0000-0000-0000-0000000000c3'), 'identity', 'PAN', 'uploaded');

select submit_section('identity');
select is( (select status from onboarding_sections
              where org_id = pg_temp.orgof('40000000-0000-0000-0000-0000000000c3') and kind = 'identity'),
           'submitted_pending'::section_status, 'identity submits once OTP + docs present' );
select is( (select count(*)::int from documents
              where org_id = pg_temp.orgof('40000000-0000-0000-0000-0000000000c3')
                and section_kind = 'identity' and status = 'in_progress'),
           2, 'submitted docs move uploaded -> in_progress' );
select is( (select aadhaar_last4 from identity_checks
              where org_id = pg_temp.orgof('40000000-0000-0000-0000-0000000000c3')),
           '1234'::bpchar, 'Aadhaar stored as masked last-4 only (A.11.5)' );

-- =====================================================================================
-- 4. Financials: V5 (MGT-7 ×3 FYs). Identity is already submitted, so V2 lock is open.
-- =====================================================================================
select throws_ok(
  $$ select submit_section('financials') $$,
  'P0001', null, 'financials submit blocked without 3 MGT-7 FYs (V5)'
);

insert into documents (org_id, section_kind, doc_type, fy, status) values
  (pg_temp.orgof('40000000-0000-0000-0000-0000000000c3'), 'financials', 'MGT7', '2023-24', 'uploaded'),
  (pg_temp.orgof('40000000-0000-0000-0000-0000000000c3'), 'financials', 'MGT7', '2022-23', 'uploaded'),
  (pg_temp.orgof('40000000-0000-0000-0000-0000000000c3'), 'financials', 'MGT7', '2021-22', 'uploaded');
select submit_section('financials');
select is( (select status from onboarding_sections
              where org_id = pg_temp.orgof('40000000-0000-0000-0000-0000000000c3') and kind = 'financials'),
           'submitted_pending'::section_status, 'financials submits with all 3 MGT-7 FYs' );

-- =====================================================================================
-- 5. Remediation -> resubmit -> verified round trip (§B.6), on S3 identity.
-- =====================================================================================
select review_section(
  pg_temp.orgof('40000000-0000-0000-0000-0000000000c3'), 'identity', 'remediate',
  '[{"doc_type":"GST","reason":"scan is blurry"}]'::jsonb
);
select is( (select status from onboarding_sections
              where org_id = pg_temp.orgof('40000000-0000-0000-0000-0000000000c3') and kind = 'identity'),
           'remediation'::section_status, 'reviewer flags identity -> remediation' );
select is( (select status || '|' || coalesce(remediation_reason,'') from documents
              where org_id = pg_temp.orgof('40000000-0000-0000-0000-0000000000c3')
                and section_kind = 'identity' and doc_type = 'GST'),
           'needs_correction|scan is blurry', 'flagged GST doc carries needs_correction + reason' );
select is( (select overall_status from v_supplier_overall
              where org_id = pg_temp.orgof('40000000-0000-0000-0000-0000000000c3')),
           'Verification – Remediation Required', 'a flagged section drives the actionable overall status' );

select submit_section('identity');                              -- supplier fixes & resubmits
select is( (select status from onboarding_sections
              where org_id = pg_temp.orgof('40000000-0000-0000-0000-0000000000c3') and kind = 'identity'),
           'submitted_pending'::section_status, 'remediation -> resubmit -> submitted_pending' );

select review_section(pg_temp.orgof('40000000-0000-0000-0000-0000000000c3'), 'identity', 'verify');
select is( (select status from onboarding_sections
              where org_id = pg_temp.orgof('40000000-0000-0000-0000-0000000000c3') and kind = 'identity'),
           'verified'::section_status, 'reviewer approves -> identity verified' );
select is( (select status || '|' || coalesce(remediation_reason,'-') from documents
              where org_id = pg_temp.orgof('40000000-0000-0000-0000-0000000000c3')
                and section_kind = 'identity' and doc_type = 'GST'),
           'verified|-', 'approved GST doc -> verified, remediation reason cleared' );

-- =====================================================================================
-- 6. Editing a VERIFIED section re-opens it (#2). S3 identity is now verified.
--    Act as the owner (authenticated + RLS) to prove the client edit path.
-- =====================================================================================
set local role authenticated;
select pg_temp.login('40000000-0000-0000-0000-0000000000c3');
update documents set storage_path = 's3/identity/gst-v2.pdf', updated_at = now()
  where org_id = pg_temp.orgof('40000000-0000-0000-0000-0000000000c3')
    and section_kind = 'identity' and doc_type = 'GST';
reset role;
select is( (select status from onboarding_sections
              where org_id = pg_temp.orgof('40000000-0000-0000-0000-0000000000c3') and kind = 'identity'),
           'submitted_pending'::section_status, 'editing a verified section re-opens it for review' );

-- =====================================================================================
-- 7. Domain events (§B.4): S2 reached completion -> exactly one SupplierOnboarded,
--    and two SectionVerified (identity + financials).
-- =====================================================================================
select is( (select count(*)::int from domain_events
              where type = 'SupplierOnboarded' and org_id = pg_temp.orgof('40000000-0000-0000-0000-0000000000c2')),
           1, 'SupplierOnboarded emitted exactly once at completion' );
select is( (select count(*)::int from domain_events
              where type = 'SectionVerified' and org_id = pg_temp.orgof('40000000-0000-0000-0000-0000000000c2')),
           2, 'SectionVerified emitted for identity + financials' );

-- =====================================================================================
-- 8. RLS / permission matrix (§A.10, decision #5).
-- =====================================================================================
-- give S1 a public portfolio doc for the buyer-can-read check
insert into documents (org_id, section_kind, doc_type, status) values
  (pg_temp.orgof('40000000-0000-0000-0000-0000000000c1'), 'portfolio', 'FacilityPhoto', 'uploaded');

set local role authenticated;
select pg_temp.login('40000000-0000-0000-0000-0000000000b1');   -- act as the buyer

select is( (select count(*)::int from documents
              where org_id = pg_temp.orgof('40000000-0000-0000-0000-0000000000c3') and section_kind = 'identity'),
           0, 'buyer can NEVER read a supplier''s Identity documents' );
select is( (select count(*)::int from documents
              where org_id = pg_temp.orgof('40000000-0000-0000-0000-0000000000c1') and section_kind = 'portfolio'),
           1, 'buyer CAN read a supplier''s portfolio documents (public profile)' );
select is( (select count(*)::int from identity_checks
              where org_id = pg_temp.orgof('40000000-0000-0000-0000-0000000000c3')),
           0, 'buyer can NEVER read a supplier''s identity_checks' );
select ok( (select count(*)::int from certifications
              where org_id = pg_temp.orgof('40000000-0000-0000-0000-0000000000c1')) > 0,
           'any logged-in user can read certifications (badges are public)' );

reset role;

select * from finish();
rollback;
