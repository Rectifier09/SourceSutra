-- ============================================================================
-- BP-1 demo seed — a LOGINABLE demo cast (email/password) for the deployed demo.
-- Loaded as the postgres superuser on `supabase db reset`; tests do NOT use it.
--
--   Password for EVERY demo account: "sourcesutra"
--
--   buyer     Priya Menon   · Vardhman Textiles    priya.menon@vardhmantextiles.in
--   supplier  Suresh Anand  · Anand Knitfab        suresh@anandknitfab.in      (VERIFIED)
--   supplier  Meena Kaur    · Ludhiana Woolworks   meena@ludhianawoolworks.in  (VERIFIED)
--   supplier  Anitha Rao    · Tiruppur Threads     anitha@tiruppurthreads.in   (UN-ONBOARDED — walk the onboarding flow)
--
-- Each signup fires the provisioning trigger (profile/org/membership/sections).
-- ============================================================================

-- Loginable signup: bcrypt password + confirmed email + an `email` identity row
-- (GoTrue's password grant needs all three). pg_temp = dropped with the session.
create function pg_temp.signup(uid uuid, email text, pw text, meta jsonb) returns void
language plpgsql as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', email,
    extensions.crypt(pw, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', meta, now(), now(), '', '', '', ''
  );
  insert into auth.identities (id, user_id, provider, provider_id, identity_data, created_at, updated_at)
  values (gen_random_uuid(), uid, 'email', uid::text,
          jsonb_build_object('sub', uid::text, 'email', email), now(), now());
end;
$$;

select pg_temp.signup('b0000000-0000-0000-0000-0000000000a1', 'priya.menon@vardhmantextiles.in', 'sourcesutra',
  '{"role":"buyer","full_name":"Priya Menon","company":"Vardhman Textiles","phone":"+91 98150 00000","products_sourced":["Knitwear","Denim"],"consent_version":"v1"}');
select pg_temp.signup('c0000000-0000-0000-0000-0000000000a1', 'suresh@anandknitfab.in', 'sourcesutra',
  '{"role":"supplier","full_name":"Suresh Anand","company":"Anand Knitfab"}');
select pg_temp.signup('c0000000-0000-0000-0000-0000000000a2', 'meena@ludhianawoolworks.in', 'sourcesutra',
  '{"role":"supplier","full_name":"Meena Kaur","company":"Ludhiana Woolworks"}');
select pg_temp.signup('c0000000-0000-0000-0000-0000000000a3', 'anitha@tiruppurthreads.in', 'sourcesutra',
  '{"role":"supplier","full_name":"Anitha Rao","company":"Tiruppur Threads"}');

-- ── org metadata ─────────────────────────────────────────────────────────────
update orgs set location = 'Ludhiana, Punjab'     where kind = 'buyer'    and name = 'Vardhman Textiles';
update orgs set location = 'Tiruppur, Tamil Nadu' where kind = 'supplier' and name = 'Anand Knitfab';
update orgs set location = 'Ludhiana, Punjab'     where kind = 'supplier' and name = 'Ludhiana Woolworks';
update orgs set location = 'Tiruppur, Tamil Nadu' where kind = 'supplier' and name = 'Tiruppur Threads';

update supplier_profiles set mission = 'Precision knit fabric, delivered on time, every time.', years_in_business = 12
  where org_id = (select id from orgs where name = 'Anand Knitfab');
update supplier_profiles set mission = 'Woven & knitwear CMT for winterwear, built for volume.', years_in_business = 8
  where org_id = (select id from orgs where name = 'Ludhiana Woolworks');
update supplier_profiles set mission = 'Sustainable cotton knits for growing brands.', years_in_business = 3
  where org_id = (select id from orgs where name = 'Tiruppur Threads');

-- ── Verify the two established suppliers via the reviewer escape hatch. Do the
--    doc/cert/identity inserts INSIDE the reviewer block so the "any edit re-opens"
--    trigger stays exempt (it skips while sourcesutra.reviewer='on'). ────────────
set session sourcesutra.reviewer = 'on';
do $$
declare a uuid := (select id from orgs where name = 'Anand Knitfab');
        b uuid := (select id from orgs where name = 'Ludhiana Woolworks');
begin
  insert into documents (org_id, section_kind, doc_type, fy, status) values
    (a,'identity','GST',null,'verified'),(a,'identity','PAN',null,'verified'),
    (a,'financials','MGT7','2023-24','verified'),(a,'financials','MGT7','2022-23','verified'),(a,'financials','MGT7','2021-22','verified'),
    (a,'portfolio','FacilityPhoto',null,'uploaded'),
    (b,'identity','GST',null,'verified'),(b,'identity','PAN',null,'verified'),
    (b,'financials','MGT7','2023-24','verified'),(b,'financials','MGT7','2022-23','verified'),(b,'financials','MGT7','2021-22','verified'),
    (b,'portfolio','FacilityPhoto',null,'uploaded');

  insert into identity_checks (org_id, email_verified, phone_verified, aadhaar_verified, aadhaar_last4) values
    (a, true, true, true, '1234'), (b, true, true, true, '5678');

  insert into certifications (org_id, kind, category, name, field_status, does_not_expire, expiry_date, audit_outcome) values
    (a,'standard','ISO','ISO 9001','verified',true, null,             null),
    (a,'standard','GOTS','GOTS','verified',false, current_date + 240, null),
    (a,'standard','OEKO-TEX','STeP','verified',false, current_date + 30, null),   -- "Expiring soon"
    (a,'audit','Buyer Audit','Brand X SMETA','verified',true, null,   'passed'),
    (b,'standard','ISO','ISO 9001','verified',true, null,             null),
    (b,'regulatory','Factory Licence','Factory Licence','verified',true, null, null);  -- "Registered"

  update onboarding_sections set status = 'verified'          where org_id in (a,b) and kind in ('identity','financials');
  update onboarding_sections set status = 'submitted_pending' where org_id in (a,b) and kind = 'portfolio';
end $$;
reset sourcesutra.reviewer;

-- ── Demo RFQs off the buyer org: one live (two competing quotes to award) + one draft ──
do $$
declare buyer uuid := (select id from orgs where kind = 'buyer' and name = 'Vardhman Textiles');
        a uuid := (select id from orgs where name = 'Anand Knitfab');
        b uuid := (select id from orgs where name = 'Ludhiana Woolworks');
begin
  insert into rfqs (id, buyer_org_id, title, status, bid_start, bid_end, delivery_date, who_can_respond, quantity, unit, contract_type)
  values ('f0000000-0000-0000-0000-000000000001', buyer, 'Single-jersey T-shirts, basics line',
          'active', '2026-08-01', '2026-08-20', '2026-10-15', 'open', 25000, 'pcs', 'CMT');

  insert into quotes (rfq_id, supplier_org_id, status, unit_price, submitted_at) values
    ('f0000000-0000-0000-0000-000000000001', a, 'submitted', 152, now()),
    ('f0000000-0000-0000-0000-000000000001', b, 'submitted', 148, now());

  insert into rfqs (buyer_org_id, title, status, who_can_respond)
  values (buyer, 'Fleece hoodies, winter capsule (draft)', 'draft', 'open');
end $$;
