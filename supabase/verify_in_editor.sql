-- ============================================================================
-- SourceSutra — one-shot verification for the Supabase SQL EDITOR (no Docker).
--
-- Paste the WHOLE file into the SQL Editor and Run. Unlike the pgTAP files, this
-- returns a single PASS/FAIL grid as its final (visible) result — the editor only
-- shows the last statement, and here the last statement is the results table.
--
-- Run it AFTER applying migrations 0001_core.sql + 0002_auth.sql.
-- Safe to re-run (it cleans its own fixtures first). It uses a dedicated
-- '11110000-…' uuid namespace and leaves a little scratch data behind — fine on a
-- throwaway project. It re-implements the core invariants from both pgTAP files:
--   award atomic/idempotent/one-shot, no-quote-on-awarded, reject-leaves-active,
--   signup provisioning, Financials-lock, no self-verify, derived overall status,
--   and the RLS authz predicate (is_member).
-- ============================================================================

drop table if exists verify_results;
create temp table verify_results (id serial primary key, check_name text, result text, detail text);

do $harness$
declare
  buyer_org uuid := '11110000-0000-0000-0000-000000000001';
  buyer_usr uuid := '11110000-0000-0000-0000-0000000000a1';
  sup_usr   uuid := '11110000-0000-0000-0000-0000000000a9';  -- provisioning-test supplier
  s1 uuid := '11110000-0000-0000-0000-0000000000b1';
  s2 uuid := '11110000-0000-0000-0000-0000000000b2';
  s3 uuid := '11110000-0000-0000-0000-0000000000b3';
  s2_usr uuid := '11110000-0000-0000-0000-0000000000c2';
  rfq  uuid := '11110000-0000-0000-0000-0000000000e1';
  rfq2 uuid := '11110000-0000-0000-0000-0000000000e2';
  q1 uuid := '11110000-0000-0000-0000-0000000000d1';
  q2 uuid := '11110000-0000-0000-0000-0000000000d2';
  q3 uuid := '11110000-0000-0000-0000-0000000000d3';
  q4 uuid := '11110000-0000-0000-0000-0000000000d4';
  prov_org uuid;
  n int;
begin
  -- ---------- cleanup prior run ----------
  delete from awards where rfq_id in (rfq, rfq2);
  delete from quotes where rfq_id in (rfq, rfq2);
  delete from rfqs where id in (rfq, rfq2);
  delete from onboarding_sections where org_id = s1;
  delete from supplier_profiles where org_id = s1;
  delete from memberships where org_id in (buyer_org, s2);
  delete from orgs where id in (buyer_org, s1, s2, s3);
  delete from orgs where name = 'V Prov Supplier';           -- prior provisioning run
  delete from auth.users where id in (buyer_usr, s2_usr, sup_usr);

  -- ---------- users (FK to auth.users) ----------
  insert into auth.users (instance_id,id,aud,role,email,encrypted_password,
      raw_app_meta_data,raw_user_meta_data,created_at,updated_at,
      confirmation_token,email_change,email_change_token_new,recovery_token)
  values
    ('00000000-0000-0000-0000-000000000000', buyer_usr,'authenticated','authenticated','v_buyer@test.in','$2a$10$abcdefghij0123456789012345678901234567890123456789012',
      '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','',''),
    ('00000000-0000-0000-0000-000000000000', s2_usr,'authenticated','authenticated','v_s2@test.in','$2a$10$abcdefghij0123456789012345678901234567890123456789012',
      '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','');

  -- ---------- fixtures (fixed ids; ignore any provisioning noise) ----------
  insert into orgs (id,kind,name) values
    (buyer_org,'buyer','V Buyer'),(s1,'supplier','V Supplier One'),
    (s2,'supplier','V Supplier Two'),(s3,'supplier','V Supplier Three');
  insert into memberships (org_id,user_id) values (buyer_org,buyer_usr),(s2,s2_usr);
  insert into supplier_profiles (org_id) values (s1);
  perform set_config('sourcesutra.reviewer','on', true);   -- reviewer path: seed 'verified' past section_guard
  insert into onboarding_sections (org_id,kind,status,weight) values
    (s1,'identity','verified',40),(s1,'financials','verified',40),(s1,'portfolio','submitted_pending',20);
  perform set_config('sourcesutra.reviewer','off', true);  -- back to client-mode for the self-verify check below
  insert into rfqs (id,buyer_org_id,title,status,bid_start,bid_end,delivery_date) values
    (rfq, buyer_org,'V RFQ 1','active','2026-08-01','2026-08-20','2026-10-15'),
    (rfq2,buyer_org,'V RFQ 2','active','2026-08-01','2026-08-20','2026-10-15');
  insert into quotes (id,rfq_id,supplier_org_id,status,unit_price) values
    (q1,rfq, s1,'submitted',152),(q2,rfq, s2,'submitted',148),(q3,rfq, s3,'submitted',160),
    (q4,rfq2,s3,'submitted',150);

  -- act as the buyer
  perform set_config('request.jwt.claim.sub', buyer_usr::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', buyer_usr)::text, true);

  -- 1. authz: a stranger cannot award (rfq still active)
  begin
    perform set_config('request.jwt.claim.sub', '11110000-0000-0000-0000-0000000000f0', true);
    perform set_config('request.jwt.claims', '{"sub":"11110000-0000-0000-0000-0000000000f0"}', true);
    perform award_quote(q1);
    insert into verify_results(check_name,result) values ('authz: stranger cannot award','FAIL');
  exception when others then
    insert into verify_results(check_name,result,detail) values ('authz: stranger cannot award',
      case when sqlstate='42501' then 'PASS' else 'FAIL' end, sqlstate);
  end;
  perform set_config('request.jwt.claim.sub', buyer_usr::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', buyer_usr)::text, true);

  -- 2. reject leaves the RFQ active (do on rfq2 before awarding it)
  begin
    perform reject_quote(q4, 'too high');
    insert into verify_results(check_name,result) values ('reject: quote -> not_selected',
      case when (select status from quotes where id=q4)='not_selected' then 'PASS' else 'FAIL' end);
    insert into verify_results(check_name,result) values ('reject: RFQ stays active',
      case when (select status from rfqs where id=rfq2)='active' then 'PASS' else 'FAIL' end);
  exception when others then
    insert into verify_results(check_name,result,detail) values ('reject','FAIL',sqlerrm);
  end;

  -- 3. the award transaction
  begin
    perform award_quote(q1,'vk1');
    insert into verify_results(check_name,result) values ('award: winner -> awarded',
      case when (select status from quotes where id=q1)='awarded' then 'PASS' else 'FAIL' end);
    insert into verify_results(check_name,result) values ('award: sibling q2 -> closed',
      case when (select status from quotes where id=q2)='closed' then 'PASS' else 'FAIL' end);
    insert into verify_results(check_name,result) values ('award: sibling q3 -> closed',
      case when (select status from quotes where id=q3)='closed' then 'PASS' else 'FAIL' end);
    insert into verify_results(check_name,result) values ('award: RFQ -> awarded',
      case when (select status from rfqs where id=rfq)='awarded' then 'PASS' else 'FAIL' end);
    insert into verify_results(check_name,result) values ('award: exactly one award row',
      case when (select count(*) from awards where rfq_id=rfq)=1 then 'PASS' else 'FAIL' end);
  exception when others then
    insert into verify_results(check_name,result,detail) values ('award','FAIL',sqlerrm);
  end;

  -- 4. idempotent replay
  begin
    perform award_quote(q1,'vk1');
    insert into verify_results(check_name,result) values ('award: idempotent replay (still 1 row)',
      case when (select count(*) from awards where rfq_id=rfq)=1 then 'PASS' else 'FAIL' end);
  exception when others then
    insert into verify_results(check_name,result,detail) values ('award: idempotent replay','FAIL',sqlerrm);
  end;

  -- 5. one-shot: cannot award a different quote once awarded
  begin
    perform award_quote(q2);
    insert into verify_results(check_name,result) values ('award: one-shot (re-award blocked)','FAIL');
  exception when others then
    insert into verify_results(check_name,result,detail) values ('award: one-shot (re-award blocked)',
      case when sqlstate='23505' then 'PASS' else 'FAIL' end, sqlstate);
  end;

  -- 6. no new quote on an awarded RFQ (trigger)
  begin
    insert into quotes(rfq_id,supplier_org_id,status) values (rfq,s3,'submitted');
    insert into verify_results(check_name,result) values ('no new quote on awarded RFQ','FAIL');
  exception when others then
    insert into verify_results(check_name,result,detail) values ('no new quote on awarded RFQ',
      case when sqlstate='P0001' then 'PASS' else 'FAIL' end, sqlstate);
  end;

  -- 7. signup provisioning (supplier)
  insert into auth.users (instance_id,id,aud,role,email,encrypted_password,
      raw_app_meta_data,raw_user_meta_data,created_at,updated_at,
      confirmation_token,email_change,email_change_token_new,recovery_token)
  values ('00000000-0000-0000-0000-000000000000', sup_usr,'authenticated','authenticated','v_prov@test.in','$2a$10$abcdefghij0123456789012345678901234567890123456789012',
      '{"provider":"email","providers":["email"]}',
      '{"role":"supplier","full_name":"Prov Supplier","company":"V Prov Supplier"}',now(),now(),'','','','');
  select m.org_id into prov_org from memberships m join orgs o on o.id=m.org_id
    where m.user_id = sup_usr and o.kind='supplier' limit 1;
  select count(*) into n from onboarding_sections where org_id = prov_org;
  insert into verify_results(check_name,result) values ('provisioning: supplier gets 3 onboarding sections',
    case when n=3 then 'PASS' else 'FAIL' end);
  insert into verify_results(check_name,result) values ('provisioning: supplier org + owner membership',
    case when exists (select 1 from memberships where org_id=prov_org and user_id=sup_usr and role='owner') then 'PASS' else 'FAIL' end);

  -- 8. Financials locked until Identity submitted (identity still not_started)
  begin
    update onboarding_sections set status='submitted_pending' where org_id=prov_org and kind='financials';
    insert into verify_results(check_name,result) values ('Financials locked until Identity submitted','FAIL');
  exception when others then
    insert into verify_results(check_name,result,detail) values ('Financials locked until Identity submitted',
      case when sqlstate='P0001' then 'PASS' else 'FAIL' end, sqlstate);
  end;

  -- 9. no self-verify (reviewer-only)
  begin
    update onboarding_sections set status='verified' where org_id=prov_org and kind='identity';
    insert into verify_results(check_name,result) values ('supplier cannot self-verify onboarding','FAIL');
  exception when others then
    insert into verify_results(check_name,result,detail) values ('supplier cannot self-verify onboarding',
      case when sqlstate='42501' then 'PASS' else 'FAIL' end, sqlstate);
  end;

  -- 10. owner CAN submit Identity for review
  begin
    update onboarding_sections set status='submitted_pending' where org_id=prov_org and kind='identity';
    insert into verify_results(check_name,result) values ('owner can submit Identity',
      case when (select status from onboarding_sections where org_id=prov_org and kind='identity')='submitted_pending' then 'PASS' else 'FAIL' end);
  exception when others then
    insert into verify_results(check_name,result,detail) values ('owner can submit Identity','FAIL',sqlerrm);
  end;

  -- 11. derived overall status view
  insert into verify_results(check_name,result) values ('derived: overall status = Onboarding Completed',
    case when (select overall_status from v_supplier_overall where org_id=s1)='Onboarding Completed' then 'PASS' else 'FAIL' end);

  -- 12. RLS authz predicate (basis of the read policies)
  perform set_config('request.jwt.claim.sub', buyer_usr::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', buyer_usr)::text, true);
  insert into verify_results(check_name,result) values ('authz: buyer is NOT a member of a supplier org',
    case when is_member(s1)=false then 'PASS' else 'FAIL' end);
  perform set_config('request.jwt.claim.sub', s2_usr::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', s2_usr)::text, true);
  insert into verify_results(check_name,result) values ('authz: supplier user IS a member of own org',
    case when is_member(s2)=true then 'PASS' else 'FAIL' end);
end;
$harness$;

-- final (visible) result set
select
  check_name as "check",
  result,
  coalesce(detail,'') as detail
from verify_results
order by id;
