-- Local-only seed for eyeballing data in Studio after `supabase db reset`.
-- Loaded as the postgres superuser, so RLS is bypassed here. Tests do NOT use
-- this file — they build their own fixtures.

insert into orgs (id, kind, name, location) values
  ('b0000000-0000-0000-0000-000000000001', 'buyer',    'Vardhman Textiles',  'Ludhiana, Punjab'),
  ('50000000-0000-0000-0000-000000000001', 'supplier', 'Anand Knitfab',      'Tiruppur, Tamil Nadu'),
  ('50000000-0000-0000-0000-000000000002', 'supplier', 'Ludhiana Woolworks', 'Ludhiana, Punjab');

insert into memberships (org_id, user_id) values
  ('b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-0000000000a1');

insert into supplier_profiles (org_id, mission) values
  ('50000000-0000-0000-0000-000000000001', 'Precision knit fabric, delivered on time, every time.'),
  ('50000000-0000-0000-0000-000000000002', 'Woven and knitwear CMT for winterwear, built for volume.');

insert into onboarding_sections (org_id, kind, status, weight) values
  ('50000000-0000-0000-0000-000000000001', 'identity',   'verified',          40),
  ('50000000-0000-0000-0000-000000000001', 'financials', 'verified',          40),
  ('50000000-0000-0000-0000-000000000001', 'portfolio',  'submitted_pending', 20);

-- One live RFQ with two competing quotes (mirrors the prototype's rfq1).
insert into rfqs (id, buyer_org_id, title, status, bid_start, bid_end, delivery_date) values
  ('f0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   'Single-jersey T-shirts, basics line', 'active', '2026-08-01', '2026-08-20', '2026-10-15');

insert into quotes (id, rfq_id, supplier_org_id, status, unit_price) values
  ('90000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'submitted', 152),
  ('90000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', 'submitted', 148);
