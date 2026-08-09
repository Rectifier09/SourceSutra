-- ============================================================================
-- pgTAP proof of the award transaction + its invariants (bizlogic.md §A.7/§A.11)
-- Run with:  supabase test db
--
-- What this proves (the reasons Supabase/logic-in-Postgres was doubted):
--   * award is ATOMIC: winner -> awarded, siblings -> closed, RFQ -> awarded
--   * award is IDEMPOTENT (safe to retry) and ONE-SHOT (can't re-award)
--   * already-rejected quotes are preserved, not clobbered
--   * no new quote can land on an awarded RFQ
--   * authz + RLS are enforced by the DATABASE (a stranger can't award; a buyer
--     can't read a supplier's onboarding; a supplier can't read a rival's quote)
--   * a derived field (overall onboarding status) is computed correctly as a view
--
-- Fixtures use an 'aaaa/bbbb/cccc/dddd' UUID namespace so they never collide with
-- seed.sql (which is present in the DB when this runs). The whole test rolls back.
-- ============================================================================

create extension if not exists pgtap with schema extensions;

begin;
select plan(20);

-- Set auth context both ways so it works across Supabase auth.uid() versions.
create function pg_temp.login(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
end;
$$;

-- ---------------------------------------------------------------- fixtures --
insert into orgs (id, kind, name) values
  ('aaaa0000-0000-0000-0000-000000000001', 'buyer',    'Test Buyer'),
  ('bbbb0000-0000-0000-0000-000000000001', 'supplier', 'Supplier One'),
  ('bbbb0000-0000-0000-0000-000000000002', 'supplier', 'Supplier Two'),
  ('bbbb0000-0000-0000-0000-000000000003', 'supplier', 'Supplier Three'),
  ('bbbb0000-0000-0000-0000-000000000004', 'supplier', 'Supplier Four');

insert into memberships (org_id, user_id) values
  ('aaaa0000-0000-0000-0000-000000000001', 'aaaa0000-0000-0000-0000-0000000000a1'), -- buyer owner
  ('bbbb0000-0000-0000-0000-000000000002', 'bbbb0000-0000-0000-0000-0000000000a2'); -- Supplier Two user

-- Supplier One onboarding: identity+financials verified, portfolio submitted
--  => overall status "Onboarding Completed" (§A.4).
insert into onboarding_sections (org_id, kind, status, weight) values
  ('bbbb0000-0000-0000-0000-000000000001', 'identity',   'verified',          40),
  ('bbbb0000-0000-0000-0000-000000000001', 'financials', 'verified',          40),
  ('bbbb0000-0000-0000-0000-000000000001', 'portfolio',  'submitted_pending', 20);

-- One active RFQ with four competing quotes from four suppliers.
insert into rfqs (id, buyer_org_id, title, status, bid_start, bid_end, delivery_date) values
  ('cccc0000-0000-0000-0000-000000000001', 'aaaa0000-0000-0000-0000-000000000001',
   'Single-jersey T-shirts', 'active', '2026-08-01', '2026-08-20', '2026-10-15');

insert into quotes (id, rfq_id, supplier_org_id, status, unit_price) values
  ('dddd0000-0000-0000-0000-000000000001', 'cccc0000-0000-0000-0000-000000000001', 'bbbb0000-0000-0000-0000-000000000001', 'submitted', 152),
  ('dddd0000-0000-0000-0000-000000000002', 'cccc0000-0000-0000-0000-000000000001', 'bbbb0000-0000-0000-0000-000000000002', 'submitted', 148),
  ('dddd0000-0000-0000-0000-000000000003', 'cccc0000-0000-0000-0000-000000000001', 'bbbb0000-0000-0000-0000-000000000003', 'submitted', 160),
  ('dddd0000-0000-0000-0000-000000000004', 'cccc0000-0000-0000-0000-000000000001', 'bbbb0000-0000-0000-0000-000000000004', 'submitted', 155);

-- ----------------------------------------------------- 1. authz (§A.10) --
-- A stranger (no membership) cannot award.
select pg_temp.login('aaaa0000-0000-0000-0000-0000000000a2');
select throws_ok(
  $$ select award_quote('dddd0000-0000-0000-0000-000000000001') $$,
  '42501', null,
  'stranger cannot award (authz enforced in-DB)'
);

-- Act as the buyer owner for the remaining RPC calls.
select pg_temp.login('aaaa0000-0000-0000-0000-0000000000a1');

-- --------------------------------------- 2. reject leaves RFQ active (§A.6) --
select lives_ok(
  $$ select reject_quote('dddd0000-0000-0000-0000-000000000004', 'price too high') $$,
  'buyer can reject a quote'
);
select is( (select status from quotes where id = 'dddd0000-0000-0000-0000-000000000004'),
           'not_selected'::quote_status, 'rejected quote -> not_selected' );
select is( (select status from rfqs where id = 'cccc0000-0000-0000-0000-000000000001'),
           'active'::rfq_status, 'RFQ stays active after a reject' );

-- --------------------------------------------- 3. the award transaction --
select lives_ok(
  $$ select award_quote('dddd0000-0000-0000-0000-000000000001', 'key-1') $$,
  'buyer awards the winning quote'
);
select is( (select status from quotes where id = 'dddd0000-0000-0000-0000-000000000001'),
           'awarded'::quote_status, 'winning quote -> awarded' );
select is( (select status from quotes where id = 'dddd0000-0000-0000-0000-000000000002'),
           'closed'::quote_status, 'sibling q2 -> closed' );
select is( (select status from quotes where id = 'dddd0000-0000-0000-0000-000000000003'),
           'closed'::quote_status, 'sibling q3 -> closed' );
select is( (select status from quotes where id = 'dddd0000-0000-0000-0000-000000000004'),
           'not_selected'::quote_status, 'already-rejected q4 preserved (not clobbered)' );
select is( (select status from rfqs where id = 'cccc0000-0000-0000-0000-000000000001'),
           'awarded'::rfq_status, 'RFQ -> awarded' );
select is( (select awarded_quote_id from rfqs where id = 'cccc0000-0000-0000-0000-000000000001'),
           'dddd0000-0000-0000-0000-000000000001'::uuid, 'RFQ records the awarded quote' );
select is( (select count(*)::int from awards where rfq_id = 'cccc0000-0000-0000-0000-000000000001'),
           1, 'exactly one award row' );

-- --------------------------------------------- 4. idempotent replay (§A.7) --
select lives_ok(
  $$ select award_quote('dddd0000-0000-0000-0000-000000000001', 'key-1') $$,
  'awarding the same quote again is a no-op (idempotent)'
);
select is( (select count(*)::int from awards where rfq_id = 'cccc0000-0000-0000-0000-000000000001'),
           1, 'still exactly one award row after replay' );

-- --------------------------------------------- 5. one-shot (§A.11.1) --
select throws_ok(
  $$ select award_quote('dddd0000-0000-0000-0000-000000000002') $$,
  '23505', null,
  'cannot award a different quote once the RFQ is awarded'
);

-- --------------------------- 6. no new quote on an awarded RFQ (§A.11.7) --
select throws_ok(
  $$ insert into quotes (rfq_id, supplier_org_id, status)
     values ('cccc0000-0000-0000-0000-000000000001',
             'bbbb0000-0000-0000-0000-000000000003', 'submitted') $$,
  'P0001', null,
  'a submitted quote cannot be added to an awarded RFQ'
);

-- --------------------------- 7. derived field as a view (§A.4/§A.8) --
select is(
  (select overall_status from v_supplier_overall where org_id = 'bbbb0000-0000-0000-0000-000000000001'),
  'Onboarding Completed',
  'overall onboarding status is computed correctly from sections'
);

-- --------------------------- 8. RLS: reads are enforced by the DB (§A.10) --
-- Switch to a non-privileged role so RLS actually applies.
set local role authenticated;

-- Buyer owner CANNOT read Supplier One's onboarding sections.
select pg_temp.login('aaaa0000-0000-0000-0000-0000000000a1');
select is(
  (select count(*)::int from onboarding_sections
     where org_id = 'bbbb0000-0000-0000-0000-000000000001'),
  0, 'buyer cannot read a supplier''s onboarding (Identity/Financials hidden)'
);

-- Supplier Two CANNOT read Supplier One's competing quote, but CAN read its own.
select pg_temp.login('bbbb0000-0000-0000-0000-0000000000a2');
select is(
  (select count(*)::int from quotes where id = 'dddd0000-0000-0000-0000-000000000001'),
  0, 'a supplier cannot read a rival''s quote'
);
select is(
  (select count(*)::int from quotes where id = 'dddd0000-0000-0000-0000-000000000002'),
  1, 'a supplier can read its own quote'
);

reset role;

select * from finish();
rollback;
