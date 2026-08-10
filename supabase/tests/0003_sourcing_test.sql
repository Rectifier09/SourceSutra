-- ============================================================================
-- pgTAP proof of Phase 2 — RFQ ↔ Quote ↔ Award (bizlogic.md Part C.3 + the
-- settled §C.6 sourcing model). Runs against 0001 + 0002 + 0003.
--
-- Proves the done-bar and the decisions:
--   publish → eligible suppliers see it → submit → triage → award (siblings flip);
--   eligibility = verified + invite only (certs/location advisory); manual
--   reversible triage; award from any non-terminal quote; all buyers view active
--   RFQs; foreclose/reopen/lapse; real match-count.
--
-- Users are created via the real signup trigger (one org/membership each), so the
-- '30000000-…' namespace never collides with seed.sql. The whole test rolls back.
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

create function pg_temp.orgof(uid uuid) returns uuid language sql stable as $$
  select org_id from memberships where user_id = uid limit 1;
$$;

-- Push a provisioned supplier to Onboarding Completed via the reviewer path.
create function pg_temp.make_verified(p_org uuid) returns void language plpgsql as $$
begin
  perform set_config('sourcesutra.reviewer', 'on', true);
  update onboarding_sections set status = 'verified'
    where org_id = p_org and kind in ('identity', 'financials');
  update onboarding_sections set status = 'submitted_pending'
    where org_id = p_org and kind = 'portfolio';
  perform set_config('sourcesutra.reviewer', 'off', true);
end;
$$;

-- ---------------------------------------------------------------- fixtures --
select pg_temp.signup('30000000-0000-0000-0000-0000000000b1', 'p2_buyer@test.in',
  '{"role":"buyer","full_name":"P2 Buyer","company":"P2 Buyer Co"}');
select pg_temp.signup('30000000-0000-0000-0000-0000000000b2', 'p2_buyer2@test.in',
  '{"role":"buyer","full_name":"P2 Buyer Two","company":"P2 Buyer Two"}');
select pg_temp.signup('30000000-0000-0000-0000-0000000000c1', 'p2_s1@test.in',
  '{"role":"supplier","full_name":"P2 Sup One","company":"P2 Supplier One"}');
select pg_temp.signup('30000000-0000-0000-0000-0000000000c2', 'p2_s2@test.in',
  '{"role":"supplier","full_name":"P2 Sup Two","company":"P2 Supplier Two"}');
select pg_temp.signup('30000000-0000-0000-0000-0000000000c3', 'p2_s3@test.in',
  '{"role":"supplier","full_name":"P2 Sup Three","company":"P2 Supplier Three"}');

-- verify s1 and s3 (s2 stays not-onboarded); give them a shared location + years.
select pg_temp.make_verified(pg_temp.orgof('30000000-0000-0000-0000-0000000000c1'));
select pg_temp.make_verified(pg_temp.orgof('30000000-0000-0000-0000-0000000000c3'));
update orgs set location = 'Testville P2'
  where id in (pg_temp.orgof('30000000-0000-0000-0000-0000000000c1'),
               pg_temp.orgof('30000000-0000-0000-0000-0000000000c2'),
               pg_temp.orgof('30000000-0000-0000-0000-0000000000c3'));
update supplier_profiles set years_in_business = 10 where org_id = pg_temp.orgof('30000000-0000-0000-0000-0000000000c1');
update supplier_profiles set years_in_business = 3  where org_id = pg_temp.orgof('30000000-0000-0000-0000-0000000000c3');

-- RFQs (buyer P2 Buyer Co owns them). bid windows straddle "today".
insert into rfqs (id, buyer_org_id, title, status, bid_start, bid_end, delivery_date, who_can_respond) values
  ('31000000-0000-0000-0000-000000000001', pg_temp.orgof('30000000-0000-0000-0000-0000000000b1'), 'Main RFQ',   'draft',    '2026-08-05','2026-08-25','2026-10-20','open'),
  ('31000000-0000-0000-0000-000000000002', pg_temp.orgof('30000000-0000-0000-0000-0000000000b1'), 'No-date RFQ','draft',    '2026-08-05','2026-08-25', null,        'open'),
  ('31000000-0000-0000-0000-000000000003', pg_temp.orgof('30000000-0000-0000-0000-0000000000b1'), 'Invite RFQ', 'active',   '2026-08-05','2026-08-25','2026-10-20','invite'),
  ('31000000-0000-0000-0000-000000000004', pg_temp.orgof('30000000-0000-0000-0000-0000000000b1'), 'Foreclose',  'active',   '2026-08-05','2026-08-25','2026-10-20','open'),
  ('31000000-0000-0000-0000-000000000005', pg_temp.orgof('30000000-0000-0000-0000-0000000000b1'), 'Lapse RFQ',  'active',   '2026-06-01','2026-07-01','2026-09-01','open'),
  ('31000000-0000-0000-0000-000000000006', pg_temp.orgof('30000000-0000-0000-0000-0000000000b1'), 'Reopen RFQ', 'lapsed',   '2026-06-01','2026-07-01','2026-12-01','open'),
  ('31000000-0000-0000-0000-000000000007', pg_temp.orgof('30000000-0000-0000-0000-0000000000b1'), 'Visible RFQ','active',   '2026-08-05','2026-08-25','2026-10-20','open');

-- ============================================================ publish (§A.5) --
select pg_temp.login('30000000-0000-0000-0000-0000000000b1');
select lives_ok($$ select publish_rfq('31000000-0000-0000-0000-000000000001') $$, 'buyer publishes a draft RFQ');
select is((select status from rfqs where id = '31000000-0000-0000-0000-000000000001'),
          'active'::rfq_status, 'published RFQ -> active');

-- a supplier cannot publish
select pg_temp.login('30000000-0000-0000-0000-0000000000c1');
select throws_ok($$ select publish_rfq('31000000-0000-0000-0000-000000000002') $$, '42501', null,
  'a supplier cannot publish an RFQ');

-- cannot re-publish an active RFQ
select pg_temp.login('30000000-0000-0000-0000-0000000000b1');
select throws_ok($$ select publish_rfq('31000000-0000-0000-0000-000000000001') $$, 'P0001', null,
  'cannot publish an already-active RFQ');

-- cannot publish without a delivery date
select throws_ok($$ select publish_rfq('31000000-0000-0000-0000-000000000002') $$, 'P0001', null,
  'cannot publish without bid window + delivery date');

-- ============================================================ submit (§A.6) --
-- verified supplier submits on the active open RFQ
select pg_temp.login('30000000-0000-0000-0000-0000000000c1');
select lives_ok($$ select submit_quote('31000000-0000-0000-0000-000000000001', 152) $$, 'verified supplier submits a quote');
select is((select status from quotes
             where rfq_id = '31000000-0000-0000-0000-000000000001'
               and supplier_org_id = pg_temp.orgof('30000000-0000-0000-0000-0000000000c1')),
          'submitted'::quote_status, 'submitted quote -> submitted');

-- re-submit updates the same live quote (V12: one live quote per supplier+RFQ)
select lives_ok($$ select submit_quote('31000000-0000-0000-0000-000000000001', 149) $$, 're-submit is an upsert');
select is((select count(*)::int from quotes
             where rfq_id = '31000000-0000-0000-0000-000000000001'
               and supplier_org_id = pg_temp.orgof('30000000-0000-0000-0000-0000000000c1')),
          1, 'still exactly one quote after re-submit (V12)');

-- unverified supplier cannot submit (V11)
select pg_temp.login('30000000-0000-0000-0000-0000000000c2');
select throws_ok($$ select submit_quote('31000000-0000-0000-0000-000000000001', 140) $$, '42501', null,
  'an unverified supplier cannot submit (V11)');

-- cannot submit on a non-active RFQ
select pg_temp.login('30000000-0000-0000-0000-0000000000c1');
select throws_ok($$ select submit_quote('31000000-0000-0000-0000-000000000002', 140) $$, 'P0001', null,
  'cannot submit on a draft RFQ');

-- invite-only: a non-invited supplier is blocked; after invite, allowed
select throws_ok($$ select submit_quote('31000000-0000-0000-0000-000000000003', 155) $$, '42501', null,
  'not-invited supplier cannot submit on an invite-only RFQ');
select pg_temp.login('30000000-0000-0000-0000-0000000000b1');
select invite_supplier('31000000-0000-0000-0000-000000000003', pg_temp.orgof('30000000-0000-0000-0000-0000000000c1'));
select pg_temp.login('30000000-0000-0000-0000-0000000000c1');
select is((select status from submit_quote('31000000-0000-0000-0000-000000000003', 155)),
          'submitted'::quote_status, 'invited supplier can submit on an invite-only RFQ');

-- second supplier submits on Main (needed for the sibling-closed check)
select pg_temp.login('30000000-0000-0000-0000-0000000000c3');
select is((select status from submit_quote('31000000-0000-0000-0000-000000000001', 148)),
          'submitted'::quote_status, 'a second verified supplier also submits on Main');

-- ============================================== manual reversible triage (§A.6) --
select pg_temp.login('30000000-0000-0000-0000-0000000000b1');
select is((select status from set_quote_triage(
             (select id from quotes where rfq_id='31000000-0000-0000-0000-000000000001'
                and supplier_org_id=pg_temp.orgof('30000000-0000-0000-0000-0000000000c1')), 'under_review')),
          'under_review'::quote_status, 'buyer triages submitted -> under_review');
select is((select status from set_quote_triage(
             (select id from quotes where rfq_id='31000000-0000-0000-0000-000000000001'
                and supplier_org_id=pg_temp.orgof('30000000-0000-0000-0000-0000000000c1')), 'shortlisted')),
          'shortlisted'::quote_status, 'buyer triages under_review -> shortlisted');
select is((select status from set_quote_triage(
             (select id from quotes where rfq_id='31000000-0000-0000-0000-000000000001'
                and supplier_org_id=pg_temp.orgof('30000000-0000-0000-0000-0000000000c1')), 'under_review')),
          'under_review'::quote_status, 'triage is reversible (shortlisted -> under_review)');

-- a supplier cannot triage
select pg_temp.login('30000000-0000-0000-0000-0000000000c1');
select throws_ok($$ select set_quote_triage(
    (select id from quotes where rfq_id='31000000-0000-0000-0000-000000000001'
       and supplier_org_id=pg_temp.orgof('30000000-0000-0000-0000-0000000000c1')), 'shortlisted') $$,
  '42501', null, 'a supplier cannot triage quotes');

-- ============================================== award from ANY non-terminal (§A.6/§A.7) --
-- s1's quote is currently under_review (NOT shortlisted) — award must still work.
select pg_temp.login('30000000-0000-0000-0000-0000000000b1');
select award_quote((select id from quotes where rfq_id='31000000-0000-0000-0000-000000000001'
                      and supplier_org_id=pg_temp.orgof('30000000-0000-0000-0000-0000000000c1')));
select is((select status from quotes where rfq_id='31000000-0000-0000-0000-000000000001'
             and supplier_org_id=pg_temp.orgof('30000000-0000-0000-0000-0000000000c1')),
          'awarded'::quote_status, 'award works from under_review (shortlist not required)');
select is((select status from rfqs where id='31000000-0000-0000-0000-000000000001'),
          'awarded'::rfq_status, 'RFQ -> awarded');
select is((select status from quotes where rfq_id='31000000-0000-0000-0000-000000000001'
             and supplier_org_id=pg_temp.orgof('30000000-0000-0000-0000-0000000000c3')),
          'closed'::quote_status, 'the sibling quote -> closed');

-- ============================================================ foreclose --
select pg_temp.login('30000000-0000-0000-0000-0000000000c1');
select submit_quote('31000000-0000-0000-0000-000000000004', 200);   -- a live quote to be closed
select pg_temp.login('30000000-0000-0000-0000-0000000000c1');
select throws_ok($$ select foreclose_rfq('31000000-0000-0000-0000-000000000004') $$, '42501', null,
  'a supplier cannot foreclose an RFQ');
select pg_temp.login('30000000-0000-0000-0000-0000000000b1');
select foreclose_rfq('31000000-0000-0000-0000-000000000004', 'sourced elsewhere');
select is((select status from rfqs where id='31000000-0000-0000-0000-000000000004'),
          'foreclosed'::rfq_status, 'foreclosed RFQ -> foreclosed');
select is((select status from quotes where rfq_id='31000000-0000-0000-0000-000000000004'
             and supplier_org_id=pg_temp.orgof('30000000-0000-0000-0000-0000000000c1')),
          'closed'::quote_status, 'foreclose closes live quotes');

-- ============================================================ reopen (V14) --
select throws_ok($$ select reopen_rfq('31000000-0000-0000-0000-000000000006', '2026-01-01') $$, 'P0001', null,
  'reopen with a past bid end is rejected (V14)');
select lives_ok($$ select reopen_rfq('31000000-0000-0000-0000-000000000006', '2026-09-30') $$,
  'reopen a lapsed RFQ with a future bid end');
select is((select status from rfqs where id='31000000-0000-0000-0000-000000000006'),
          'active'::rfq_status, 'reopened RFQ -> active');

-- ============================================================ lapse job --
select lapse_expired_rfqs();
select is((select status from rfqs where id='31000000-0000-0000-0000-000000000005'),
          'lapsed'::rfq_status, 'lapse job flips an expired active RFQ -> lapsed');

-- ============================================================ match count (§A.8.4) --
select is(match_count('Testville P2'), 2, 'match count = verified suppliers in the location');
select is(match_count('Testville P2', 5), 1, 'match count applies advisory min-years filter');

-- ============================================== RLS visibility (#9 + eligibility) --
set local role authenticated;

-- owner sees their own draft
select pg_temp.login('30000000-0000-0000-0000-0000000000b1');
select is((select count(*)::int from rfqs where id='31000000-0000-0000-0000-000000000002'),
          1, 'owner sees their own draft RFQ');

-- another buyer canNOT see someone else's draft, but CAN see an active RFQ (#9)
select pg_temp.login('30000000-0000-0000-0000-0000000000b2');
select is((select count(*)::int from rfqs where id='31000000-0000-0000-0000-000000000002'),
          0, 'a buyer cannot see another buyer''s draft');
select is((select count(*)::int from rfqs where id='31000000-0000-0000-0000-000000000007'),
          1, 'any buyer can view an active RFQ (#9)');

-- a verified supplier sees the active open RFQ; an unverified one does not
select pg_temp.login('30000000-0000-0000-0000-0000000000c1');
select is((select count(*)::int from rfqs where id='31000000-0000-0000-0000-000000000007'),
          1, 'a verified supplier sees an active open RFQ');
select pg_temp.login('30000000-0000-0000-0000-0000000000c2');
select is((select count(*)::int from rfqs where id='31000000-0000-0000-0000-000000000007'),
          0, 'an unverified supplier cannot see active RFQs');

-- invite-only: hidden from a non-invitee supplier, visible to the invitee
select pg_temp.login('30000000-0000-0000-0000-0000000000c3');
select is((select count(*)::int from rfqs where id='31000000-0000-0000-0000-000000000003'),
          0, 'a non-invited supplier cannot see an invite-only RFQ');
select pg_temp.login('30000000-0000-0000-0000-0000000000c1');
select is((select count(*)::int from rfqs where id='31000000-0000-0000-0000-000000000003'),
          1, 'the invited supplier sees the invite-only RFQ');

reset role;

select * from finish();
rollback;
