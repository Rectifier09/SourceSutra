-- ============================================================================
-- pgTAP proof of Phase 3 — Notifications & invitations (bizlogic.md Part C.4).
-- Runs against 0001–0005.
--
-- Proves the done-bar (every meaningful transition reaches the right person) and
-- the invite-only audience rule:
--   * publish  -> eligible (verified) suppliers notified; unverified NOT notified
--   * quote submitted -> buyer ("new application")
--   * award -> winner ("You won"), losers ("closed"), buyer ("RFQ awarded")
--   * invitation received -> supplier; respond -> buyer; Invitations tab lists it
--   * invite-only publish notifies ONLY invitees
--   * foreclose -> quoting suppliers; lapse -> buyer; reopen -> quoting suppliers
--   * notifications RLS: you read only your org's inbox; you can mark it read
--
-- RPCs are exercised by setting the JWT sub and calling as the superuser (RLS is
-- bypassed for deterministic counting); RLS itself is checked explicitly in §G.
-- The '50000000-…' namespace never collides with seed.sql. The test rolls back.
-- ============================================================================

create extension if not exists pgtap with schema extensions;

begin;
select plan(20);

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

create function pg_temp.orgof(uid uuid) returns uuid language sql stable
security definer set search_path = public as $$
  select org_id from memberships where user_id = uid limit 1;
$$;

create function pg_temp.make_verified(p_org uuid) returns void language plpgsql as $$
begin
  perform set_config('sourcesutra.reviewer', 'on', true);
  update onboarding_sections set status = 'verified'          where p_org = org_id and kind in ('identity','financials');
  update onboarding_sections set status = 'submitted_pending' where p_org = org_id and kind = 'portfolio';
  perform set_config('sourcesutra.reviewer', 'off', true);
end;
$$;

-- inbox count for an org, by type, in-app channel only (one row per recipient/event)
create function pg_temp.inbox(p_org uuid, p_type text, p_rfq uuid default null) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from notifications
   where org_id = p_org and type = p_type and channel = 'in_app'
     and (p_rfq is null or ref_rfq_id = p_rfq);
$$;

-- ---------------------------------------------------------------- fixtures --
select pg_temp.signup('50000000-0000-0000-0000-0000000000b1', 'p3_b1@test.in',
  '{"role":"buyer","full_name":"P3 Buyer","company":"P3 Buyer Co"}');
select pg_temp.signup('50000000-0000-0000-0000-0000000000c1', 'p3_s1@test.in',
  '{"role":"supplier","full_name":"P3 Sup One","company":"P3 Supplier One"}');
select pg_temp.signup('50000000-0000-0000-0000-0000000000c2', 'p3_s2@test.in',
  '{"role":"supplier","full_name":"P3 Sup Two","company":"P3 Supplier Two"}');
select pg_temp.signup('50000000-0000-0000-0000-0000000000c3', 'p3_s3@test.in',
  '{"role":"supplier","full_name":"P3 Sup Three","company":"P3 Supplier Three"}');

select pg_temp.make_verified(pg_temp.orgof('50000000-0000-0000-0000-0000000000c1'));  -- S1 verified
select pg_temp.make_verified(pg_temp.orgof('50000000-0000-0000-0000-0000000000c2'));  -- S2 verified
-- S3 stays un-onboarded (must NOT be reached by publish fan-out)

insert into rfqs (id, buyer_org_id, title, status, bid_start, bid_end, delivery_date, who_can_respond) values
  ('51000000-0000-0000-0000-000000000001', pg_temp.orgof('50000000-0000-0000-0000-0000000000b1'), 'Open RFQ',    'draft',  '2026-08-05','2026-08-25','2026-10-20','open'),
  ('51000000-0000-0000-0000-000000000002', pg_temp.orgof('50000000-0000-0000-0000-0000000000b1'), 'Invite RFQ',  'draft',  '2026-08-05','2026-08-25','2026-10-20','invite'),
  ('51000000-0000-0000-0000-000000000003', pg_temp.orgof('50000000-0000-0000-0000-0000000000b1'), 'Foreclose',   'active', '2026-08-05','2026-08-25','2026-10-20','open'),
  ('51000000-0000-0000-0000-000000000004', pg_temp.orgof('50000000-0000-0000-0000-0000000000b1'), 'Lapse/Reopen','active', '2026-06-01','2026-07-01','2026-12-01','open');

-- =====================================================================================
-- A. Publish (open) fans out to VERIFIED suppliers only (§B.7, §A.8.6).
-- =====================================================================================
select pg_temp.login('50000000-0000-0000-0000-0000000000b1');
select publish_rfq('51000000-0000-0000-0000-000000000001');

select is( pg_temp.inbox(pg_temp.orgof('50000000-0000-0000-0000-0000000000c1'), 'RfqPublished', '51000000-0000-0000-0000-000000000001'),
           1, 'publish notifies verified supplier S1' );
select is( pg_temp.inbox(pg_temp.orgof('50000000-0000-0000-0000-0000000000c2'), 'RfqPublished', '51000000-0000-0000-0000-000000000001'),
           1, 'publish notifies verified supplier S2' );
select is( pg_temp.inbox(pg_temp.orgof('50000000-0000-0000-0000-0000000000c3'), 'RfqPublished', '51000000-0000-0000-0000-000000000001'),
           0, 'publish does NOT notify un-onboarded supplier S3' );

-- =====================================================================================
-- B. Quote submitted -> buyer ("new application").
-- =====================================================================================
select pg_temp.login('50000000-0000-0000-0000-0000000000c1');
select submit_quote('51000000-0000-0000-0000-000000000001', 100);
select pg_temp.login('50000000-0000-0000-0000-0000000000c2');
select submit_quote('51000000-0000-0000-0000-000000000001', 98);

select is( pg_temp.inbox(pg_temp.orgof('50000000-0000-0000-0000-0000000000b1'), 'QuoteSubmitted', '51000000-0000-0000-0000-000000000001'),
           2, 'buyer notified of each new application' );

-- =====================================================================================
-- C. Award -> winner, loser, buyer.
-- =====================================================================================
select pg_temp.login('50000000-0000-0000-0000-0000000000b1');
select award_quote((select id from quotes
                      where rfq_id = '51000000-0000-0000-0000-000000000001'
                        and supplier_org_id = pg_temp.orgof('50000000-0000-0000-0000-0000000000c1')));

select is( pg_temp.inbox(pg_temp.orgof('50000000-0000-0000-0000-0000000000c1'), 'QuoteAwarded', '51000000-0000-0000-0000-000000000001'),
           1, 'winner S1 notified "You won"' );
select is( pg_temp.inbox(pg_temp.orgof('50000000-0000-0000-0000-0000000000c2'), 'QuoteClosed', '51000000-0000-0000-0000-000000000001'),
           1, 'loser S2 notified their quote closed' );
select is( pg_temp.inbox(pg_temp.orgof('50000000-0000-0000-0000-0000000000b1'), 'RfqAwarded', '51000000-0000-0000-0000-000000000001'),
           1, 'buyer notified the RFQ is awarded' );

-- =====================================================================================
-- D. Invitations: received -> supplier; invite-only publish reaches ONLY invitees;
--    respond -> buyer; Invitations tab lists it; non-invitee cannot respond.
-- =====================================================================================
select pg_temp.login('50000000-0000-0000-0000-0000000000b1');
select invite_supplier('51000000-0000-0000-0000-000000000002', pg_temp.orgof('50000000-0000-0000-0000-0000000000c2'));
select publish_rfq('51000000-0000-0000-0000-000000000002');

select is( pg_temp.inbox(pg_temp.orgof('50000000-0000-0000-0000-0000000000c2'), 'SupplierInvited', '51000000-0000-0000-0000-000000000002'),
           1, 'invited supplier S2 gets an invitation notification' );
select is( pg_temp.inbox(pg_temp.orgof('50000000-0000-0000-0000-0000000000c2'), 'RfqPublished', '51000000-0000-0000-0000-000000000002'),
           1, 'invite-only publish notifies the invitee' );
select is( pg_temp.inbox(pg_temp.orgof('50000000-0000-0000-0000-0000000000c1'), 'RfqPublished', '51000000-0000-0000-0000-000000000002'),
           0, 'invite-only publish does NOT notify a non-invitee' );

select pg_temp.login('50000000-0000-0000-0000-0000000000c2');
select respond_invitation('51000000-0000-0000-0000-000000000002', true);
select is( (select status from invitations
              where rfq_id = '51000000-0000-0000-0000-000000000002'
                and supplier_org_id = pg_temp.orgof('50000000-0000-0000-0000-0000000000c2')),
           'responded'::invitation_status, 'accepting an invitation sets status = responded' );
select is( pg_temp.inbox(pg_temp.orgof('50000000-0000-0000-0000-0000000000b1'), 'InvitationResponded', '51000000-0000-0000-0000-000000000002'),
           1, 'buyer notified the supplier responded' );

set local role authenticated;
select pg_temp.login('50000000-0000-0000-0000-0000000000c2');
select is( (select count(*)::int from v_my_invitations where rfq_id = '51000000-0000-0000-0000-000000000002'),
           1, 'the invitation appears on the supplier''s Invitations tab' );
reset role;

select pg_temp.login('50000000-0000-0000-0000-0000000000c1');    -- S1 was never invited
select throws_ok(
  $$ select respond_invitation('51000000-0000-0000-0000-000000000002', true) $$,
  'P0002', null, 'a non-invited supplier cannot respond to the invitation'
);

-- =====================================================================================
-- E. Foreclose -> suppliers who quoted.
-- =====================================================================================
select pg_temp.login('50000000-0000-0000-0000-0000000000c1');
select submit_quote('51000000-0000-0000-0000-000000000003', 50);
select pg_temp.login('50000000-0000-0000-0000-0000000000b1');
select foreclose_rfq('51000000-0000-0000-0000-000000000003', 'sourced offline');
select is( pg_temp.inbox(pg_temp.orgof('50000000-0000-0000-0000-0000000000c1'), 'RfqForeclosed', '51000000-0000-0000-0000-000000000003'),
           1, 'foreclose notifies the supplier who quoted' );

-- =====================================================================================
-- F. Lapse -> buyer; Reopen -> suppliers who quoted.
-- =====================================================================================
-- give the lapse RFQ a live quote (direct insert; its bid window is already past)
insert into quotes (rfq_id, supplier_org_id, status, unit_price)
  values ('51000000-0000-0000-0000-000000000004', pg_temp.orgof('50000000-0000-0000-0000-0000000000c1'), 'submitted', 77);

select lapse_expired_rfqs();     -- service job: active + past bid_end -> lapsed
select is( pg_temp.inbox(pg_temp.orgof('50000000-0000-0000-0000-0000000000b1'), 'RfqLapsed', '51000000-0000-0000-0000-000000000004'),
           1, 'lapse notifies the RFQ owner' );

select pg_temp.login('50000000-0000-0000-0000-0000000000b1');
select reopen_rfq('51000000-0000-0000-0000-000000000004', '2026-11-01');
select is( pg_temp.inbox(pg_temp.orgof('50000000-0000-0000-0000-0000000000c1'), 'RfqReopened', '51000000-0000-0000-0000-000000000004'),
           1, 'reopen notifies the supplier who quoted' );

-- =====================================================================================
-- G. Notifications RLS: read only your org's inbox; mark it read.
-- =====================================================================================
set local role authenticated;
select pg_temp.login('50000000-0000-0000-0000-0000000000c3');    -- a stranger to the buyer's inbox
select is( (select count(*)::int from notifications
              where org_id = pg_temp.orgof('50000000-0000-0000-0000-0000000000b1')),
           0, 'a stranger cannot read another org''s notifications' );

select pg_temp.login('50000000-0000-0000-0000-0000000000b1');
select ok( (select count(*)::int from notifications
              where org_id = pg_temp.orgof('50000000-0000-0000-0000-0000000000b1')) > 0,
           'an owner can read their own inbox' );

with upd as (
  update notifications set read_at = now()
    where org_id = pg_temp.orgof('50000000-0000-0000-0000-0000000000b1') and read_at is null
    returning 1
)
select ok( (select count(*)::int from upd) > 0, 'an owner can mark their notifications read' );
reset role;

select * from finish();
rollback;
