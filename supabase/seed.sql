-- Local-only seed for eyeballing data in Studio after `supabase db reset`.
-- Loaded as the postgres superuser, so RLS is bypassed here. Tests do NOT use
-- this file — they build their own fixtures.
--
-- Since Phase 0 (0002_auth.sql), memberships.user_id has a real FK to auth.users
-- and a trigger provisions a full account on signup. So the buyer below is a REAL
-- auth user (canonical local-signup column set, same as tests/0002_auth_test.sql):
-- inserting it fires provision_account, which creates the buyer's profile, org,
-- owner membership, and buyer_accounts. We then hang the demo RFQ off that org.

-- ── Buyer: a real auth user; the trigger builds the Vardhman account ──────────
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  'b0000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated',
  'priya.menon@vardhmantextiles.in',
  '$2a$10$abcdefghijklmnopqrstuvwxyz012345678901234567890123456',
  '{"provider":"email","providers":["email"]}',
  '{"role":"buyer","full_name":"Priya Menon","company":"Vardhman Textiles",
    "phone":"+91 98150 00000","products_sourced":["Knitwear","Denim"],
    "consent_version":"v1"}',
  now(), now(), '', '', '', ''
);

-- give the trigger-created buyer org a location (the trigger sets name+kind only)
update orgs set location = 'Ludhiana, Punjab'
 where kind = 'buyer' and name = 'Vardhman Textiles';

-- ── Suppliers: curated orgs (browse-only; no auth users / memberships needed) ──
insert into orgs (id, kind, name, location) values
  ('50000000-0000-0000-0000-000000000001', 'supplier', 'Anand Knitfab',      'Tiruppur, Tamil Nadu'),
  ('50000000-0000-0000-0000-000000000002', 'supplier', 'Ludhiana Woolworks', 'Ludhiana, Punjab');

insert into supplier_profiles (org_id, mission) values
  ('50000000-0000-0000-0000-000000000001', 'Precision knit fabric, delivered on time, every time.'),
  ('50000000-0000-0000-0000-000000000002', 'Woven and knitwear CMT for winterwear, built for volume.');

-- Seeded "verified" sections need the reviewer path — the same escape hatch the
-- Phase-1 verification function uses (`set ... sourcesutra.reviewer='on'`) so the
-- section_guard lets a non-client set verified/remediation.
set session sourcesutra.reviewer = 'on';
insert into onboarding_sections (org_id, kind, status, weight) values
  ('50000000-0000-0000-0000-000000000001', 'identity',   'verified',          40),
  ('50000000-0000-0000-0000-000000000001', 'financials', 'verified',          40),
  ('50000000-0000-0000-0000-000000000001', 'portfolio',  'submitted_pending', 20);
reset sourcesutra.reviewer;

-- ── One live RFQ (buyer = Priya's provisioned org) with two competing quotes ──
insert into rfqs (id, buyer_org_id, title, status, bid_start, bid_end, delivery_date)
select 'f0000000-0000-0000-0000-000000000001', o.id,
       'Single-jersey T-shirts, basics line', 'active', '2026-08-01', '2026-08-20', '2026-10-15'
  from orgs o
 where o.kind = 'buyer' and o.name = 'Vardhman Textiles';

insert into quotes (id, rfq_id, supplier_org_id, status, unit_price) values
  ('90000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'submitted', 152),
  ('90000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', 'submitted', 148);
