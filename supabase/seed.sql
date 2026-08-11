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

  -- invite-only RFQ so the Invitations flow is demoable out of the box (Anitha is invited).
  insert into rfqs (id, buyer_org_id, title, status, bid_start, bid_end, delivery_date, who_can_respond, quantity, unit, contract_type)
  values ('f0000000-0000-0000-0000-000000000002', buyer, 'Merino base layer, invite pilot',
          'active', '2026-08-01', '2026-08-25', '2026-09-30', 'invite', 5000, 'pcs', 'Sample + bulk');
  insert into invitations (rfq_id, supplier_org_id)
    select 'f0000000-0000-0000-0000-000000000002', id from orgs where name = 'Tiruppur Threads';
end $$;

-- ============================================================================
-- Frontend-redesign seed (migration 0008 companion): the 12 prototype suppliers
-- from SourceSutraCustomer.dc.html (the SUPPLIERS[] array), enriched + verified so
-- the buyer Discover screen shows the real directory. s1 Anand Knitfab & s3
-- Ludhiana Woolworks already exist above (loginable, verified); the other 10 are
-- directory-only demo suppliers — no auth user needed, since "verified" derives
-- from onboarding_sections, not from a login. Tiruppur Threads stays the separate
-- un-onboarded walk-through account (not part of the prototype 12).
-- ============================================================================

-- ── 10 new supplier orgs (s1/s3 created via signup above) ────────────────────
insert into orgs (kind, name, location) values
  ('supplier','Bhilwara Processors','Bhilwara, Rajasthan'),
  ('supplier','Erode Textile Exports','Erode, Tamil Nadu'),
  ('supplier','Surat Silk Mills','Surat, Gujarat'),
  ('supplier','Panipat Home Textiles','Panipat, Haryana'),
  ('supplier','Tirupur Trims & Accessories','Tiruppur, Tamil Nadu'),
  ('supplier','Ludhiana Embroidery House','Ludhiana, Punjab'),
  ('supplier','Surat Screen Print Co.','Surat, Gujarat'),
  ('supplier','Erode Spinning Mills','Erode, Tamil Nadu'),
  ('supplier','Bhilwara Suiting Weavers','Bhilwara, Rajasthan'),
  ('supplier','Panipat Trims Co.','Panipat, Haryana');

-- ── profile shell + verified onboarding for the 10 new orgs ───────────────────
-- reviewer hatch on so sections can be written straight to 'verified' (section_guard
-- blocks client verifies otherwise); the "any edit re-opens" trigger is exempt too.
set session sourcesutra.reviewer = 'on';
do $$
declare r record;
begin
  for r in
    select id from orgs
    where kind = 'supplier' and name in (
      'Bhilwara Processors','Erode Textile Exports','Surat Silk Mills',
      'Panipat Home Textiles','Tirupur Trims & Accessories','Ludhiana Embroidery House',
      'Surat Screen Print Co.','Erode Spinning Mills','Bhilwara Suiting Weavers','Panipat Trims Co.')
  loop
    insert into supplier_profiles (org_id) values (r.id) on conflict (org_id) do nothing;
    insert into onboarding_sections (org_id, kind, status, weight) values
      (r.id,'identity','verified',40),
      (r.id,'financials','verified',40),
      (r.id,'portfolio','submitted_pending',20)
    on conflict (org_id, kind) do update set status = excluded.status;
  end loop;
end $$;
reset sourcesutra.reviewer;

-- ── enrich all 12 profiles with the prototype data (by org name) ──────────────
-- s1 Anand Knitfab
update supplier_profiles set
  mission = 'Single-jersey knits at scale, delivered on schedule.', years_in_business = 12,
  company_type = 'Fabric supplier', tags = array['Knitted fabric','Greige fabric'],
  logo_bg = '#EDECF6', logo_fg = '#403A77',
  customization_capabilities = array['Fabric','Colour','GSM','Packaging'],
  production  = '{"factoryArea":"9,200 m²","employees":140,"monthlyCapacity":"95,000 kg","productionLines":10}'::jsonb,
  trade_terms = '{"moq":"1,000 kg","incoterms":"FOB Chennai","paymentTerms":"30% advance, 70% on shipment","leadTime":"15–20 days"}'::jsonb,
  catalogue = '[{"id":"c1","fileName":"single-jersey-lineup.jpg"},{"id":"c2","fileName":"greige-stock-sheet.pdf"}]'::jsonb,
  work_history = '[{"client":"Ramraj Cotton Mills","role":"Sub-Contractor","frequency":"Recurring","start":"2019","end":"present","desc":"Supply of single-jersey knit greige fabric, 24–32 count, approx. 8,000 kg/month."}]'::jsonb,
  products = '[{"name":"Single-jersey knit greige","category":"Fabric","material":"100% cotton, 24s count","priceRange":"₹280–₹340/kg"},{"name":"Rib-knit greige","category":"Fabric","material":"100% cotton, 30s count","priceRange":"₹310–₹360/kg"}]'::jsonb,
  facility_photos = '[{},{},{},{}]'::jsonb,
  contact = '{"name":"Suresh Anand","title":"Managing Partner","email":"suresh@anandknitfab.in","phone":"+91 98430 11234","languages":"English, Tamil","responseTime":"4–6 hours"}'::jsonb
where org_id = (select id from orgs where name = 'Anand Knitfab');

-- s2 Bhilwara Processors (lite)
update supplier_profiles set
  mission = 'Reactive and vat dyeing, precise shade matching, every batch.', years_in_business = 10,
  company_type = 'Dyeing & processing', tags = array['Dyeing & processing'],
  logo_bg = '#F2E4D8', logo_fg = '#B5654A',
  catalogue = '[{"id":"c3","fileName":"shade-card-2026.pdf"}]'::jsonb,
  work_history = '[{"client":"Malhotra Woollens","role":"Sub-Contractor","frequency":"Annual Maintenance Contract","start":"2016","end":"present","desc":"Reactive and vat dyeing of woven fabric for winterwear lines, 40,000m/month capacity."}]'::jsonb
where org_id = (select id from orgs where name = 'Bhilwara Processors');

-- s3 Ludhiana Woolworks
update supplier_profiles set
  mission = 'Woven and knitwear CMT for winterwear, built for volume.', years_in_business = 12,
  company_type = 'Garment CMT', tags = array['Woven fabric','Garment CMT'],
  logo_bg = '#E4EDE4', logo_fg = '#5B7A5B',
  customization_capabilities = array['Fabric','Colour','Fit','Labels','Hangtags','Hardware'],
  production  = '{"factoryArea":"15,000 m²","employees":260,"monthlyCapacity":"60,000 pieces","productionLines":18}'::jsonb,
  trade_terms = '{"moq":"2,000 pieces","incoterms":"FOB Mumbai, EXW","paymentTerms":"30% advance, 70% on shipment","leadTime":"25–30 days (peak: 35–40 days)"}'::jsonb,
  catalogue = '[{"id":"c4","fileName":"winterwear-line-sheet.pdf"},{"id":"c5","fileName":"cmt-sample-photos.jpg"}]'::jsonb,
  work_history = '[{"client":"Vardhman Textiles","role":"Sub-Contractor","frequency":"Recurring","start":"2014","end":"present","desc":"Woven fabric sourcing and finishing for shirting lines, approx. 60,000m/quarter."}]'::jsonb,
  products = '[{"name":"Wool-blend winter jacket","category":"Outerwear","material":"Wool-acrylic blend, 320 GSM","priceRange":"₹850–₹1,100/pc"},{"name":"Shirting fabric, cotton poplin","category":"Fabric","material":"100% cotton, 120 GSM","priceRange":"₹135–₹165/m"},{"name":"Knit thermal base layer","category":"Apparel","material":"Cotton-spandex, 220 GSM","priceRange":"₹210–₹260/pc"}]'::jsonb,
  facility_photos = '[{},{},{},{},{},{}]'::jsonb,
  contact = '{"name":"Harpreet Singh","title":"Operations Head","email":"harpreet@ludhianawoolworks.in","phone":"+91 98140 55621","languages":"English, Punjabi, Hindi","responseTime":"2–3 hours"}'::jsonb
where org_id = (select id from orgs where name = 'Ludhiana Woolworks');

-- s4 Erode Textile Exports
update supplier_profiles set
  mission = 'Terry towels and bath linen, white-label, export-ready.', years_in_business = 14,
  company_type = 'Trading', tags = array['White-label article','Home textiles'],
  logo_bg = '#E3E9F2', logo_fg = '#2E5A8C',
  customization_capabilities = array['Fabric','Colour','Labels','Hangtags','Packaging','Embroidery'],
  production  = '{"factoryArea":"22,000 m²","employees":410,"monthlyCapacity":"38,000 pieces","productionLines":22}'::jsonb,
  trade_terms = '{"moq":"5,000 pieces","incoterms":"FOB Chennai, CIF","paymentTerms":"L/C at sight, or 40% advance / 60% on B/L","leadTime":"30–35 days (peak: 45 days)"}'::jsonb,
  catalogue = '[{"id":"c6","fileName":"terry-towel-lineup.jpg"},{"id":"c7","fileName":"bath-linen-catalogue.jpg"}]'::jsonb,
  work_history = '[{"client":"Welspun India","role":"Sub-Contractor","frequency":"Annual Maintenance Contract","start":"2012","end":"present","desc":"Terry towel weaving and finishing, private-label programs, ~4,00,000 pieces/year."},{"client":"Trident Group","role":"Sub-Contractor","frequency":"Recurring","start":"2018","end":"2023","desc":"Bath linen white-label article supply for retail export orders."}]'::jsonb,
  products = '[{"name":"Combed cotton terry towel","category":"Home Textiles","material":"Combed cotton, 500 GSM","priceRange":"₹145–₹190/pc"},{"name":"Bath linen set","category":"Home Textiles","material":"Cotton terry, 550 GSM","priceRange":"₹620–₹780/set"}]'::jsonb,
  facility_photos = '[{},{},{},{},{}]'::jsonb,
  contact = '{"name":"Kavitha Ramesh","title":"Export Manager","email":"kavitha@erodetextile.in","phone":"+91 98421 77654","languages":"English, Tamil","responseTime":"3–5 hours"}'::jsonb
where org_id = (select id from orgs where name = 'Erode Textile Exports');

-- s5 Surat Silk Mills (lite)
update supplier_profiles set
  mission = 'Art silk and synthetic sarees, direct from the loom.', years_in_business = 9,
  company_type = 'Fabric supplier', tags = array['Woven fabric'],
  logo_bg = '#F2E6EE', logo_fg = '#8C3E6E',
  catalogue = '[{"id":"c8","fileName":"saree-collection-q3.jpg"}]'::jsonb,
  work_history = '[{"client":"South India Shopping Mall","role":"Primary Contractor","frequency":"Recurring","start":"2017","end":"present","desc":"Art silk saree weaving and finishing for retail chains."}]'::jsonb
where org_id = (select id from orgs where name = 'Surat Silk Mills');

-- s6 Panipat Home Textiles
update supplier_profiles set
  mission = 'Bedspreads and furnishing fabric, recycled and virgin yarns.', years_in_business = 6,
  company_type = 'Fabric supplier', tags = array['Woven fabric','Home textiles'],
  logo_bg = '#EAE6DC', logo_fg = '#7A6A4E',
  customization_capabilities = array['Fabric','Colour','Pattern','Packaging'],
  production  = '{"factoryArea":"11,800 m²","employees":190,"monthlyCapacity":"50,000 m","productionLines":12}'::jsonb,
  trade_terms = '{"moq":"2,500 m","incoterms":"FOB Mundra","paymentTerms":"50% advance, 50% on shipment","leadTime":"20–25 days"}'::jsonb,
  catalogue = '[{"id":"c9","fileName":"furnishing-swatches.jpg"}]'::jsonb,
  work_history = '[{"client":"IKEA India sourcing office","role":"Sub-Contractor","frequency":"Annual Maintenance Contract","start":"2020","end":"present","desc":"Recycled-yarn bedspread and cushion cover weaving."}]'::jsonb,
  products = '[{"name":"Recycled-yarn bedspread","category":"Home Textiles","material":"Recycled cotton-poly blend, 280 GSM","priceRange":"₹320–₹410/pc"},{"name":"Furnishing fabric","category":"Home Textiles","material":"Cotton-poly blend, 240 GSM","priceRange":"₹95–₹130/m"}]'::jsonb,
  facility_photos = '[{},{},{}]'::jsonb,
  contact = '{"name":"Deepak Malhotra","title":"Sales Director","email":"deepak@panipathome.in","phone":"+91 98960 33218","languages":"English, Hindi","responseTime":"5–8 hours"}'::jsonb
where org_id = (select id from orgs where name = 'Panipat Home Textiles');

-- s7 Tirupur Trims & Accessories (lite)
update supplier_profiles set
  mission = 'Buttons, labels, and drawcords, sampled within 48 hours.', years_in_business = 11,
  company_type = 'Trims & accessories', tags = array['Trims & accessories'],
  logo_bg = '#EDECF6', logo_fg = '#403A77',
  catalogue = '[{"id":"c10","fileName":"trims-catalogue-2026.pdf"}]'::jsonb,
  work_history = '[{"client":"Anand Knitfab","role":"Sub-Contractor","frequency":"Recurring","start":"2015","end":"present","desc":"Buttons, woven labels, and drawcords for knitwear programs."}]'::jsonb
where org_id = (select id from orgs where name = 'Tirupur Trims & Accessories');

-- s8 Ludhiana Embroidery House
update supplier_profiles set
  mission = 'Schiffli and hand embroidery for knitwear and wovens alike.', years_in_business = 4,
  company_type = 'Garment CMT', tags = array['Embroidery','Garment CMT'],
  logo_bg = '#F5E8D6', logo_fg = '#A6702B',
  customization_capabilities = array['Embroidery','Labels','Pattern'],
  production  = '{"factoryArea":"4,600 m²","employees":65,"monthlyCapacity":"18,000 pieces","productionLines":8}'::jsonb,
  trade_terms = '{"moq":"500 pieces","incoterms":"EXW","paymentTerms":"50% advance, 50% on delivery","leadTime":"10–15 days"}'::jsonb,
  catalogue = '[{"id":"c11","fileName":"embroidery-motifs.jpg"}]'::jsonb,
  work_history = '[{"client":"Ludhiana Woolworks","role":"Sub-Contractor","frequency":"One-time","start":"2022","end":"2022","desc":"Schiffli embroidery for a winter capsule collection, 12,000 pieces."}]'::jsonb,
  products = '[{"name":"Schiffli embroidered panel","category":"Embellishment","material":"Polyester thread on cotton base","priceRange":"₹35–₹65/pc"},{"name":"Hand embroidery, zari work","category":"Embellishment","material":"Metallic zari thread","priceRange":"₹80–₹220/pc"}]'::jsonb,
  facility_photos = '[{},{}]'::jsonb,
  contact = '{"name":"Simran Kaur","title":"Founder","email":"simran@ludhianaembroidery.in","phone":"+91 98555 21099","languages":"English, Punjabi","responseTime":"6–8 hours"}'::jsonb
where org_id = (select id from orgs where name = 'Ludhiana Embroidery House');

-- s9 Surat Screen Print Co. (lite)
update supplier_profiles set
  mission = 'Screen and digital printing, small runs to bulk.', years_in_business = 7,
  company_type = 'Garment CMT', tags = array['screen printing','digital printing'],
  logo_bg = '#F2E6EE', logo_fg = '#8C3E6E',
  catalogue = '[{"id":"c12","fileName":"print-samples.jpg"}]'::jsonb,
  work_history = '[{"client":"Surat Silk Mills","role":"Sub-Contractor","frequency":"Recurring","start":"2019","end":"present","desc":"Screen printing on synthetic yardage for saree borders."}]'::jsonb
where org_id = (select id from orgs where name = 'Surat Screen Print Co.');

-- s10 Erode Spinning Mills
update supplier_profiles set
  mission = 'Combed cotton yarn and greige fabric, consistent count.', years_in_business = 13,
  company_type = 'Fabric supplier', tags = array['Greige fabric','Knitted fabric'],
  logo_bg = '#E3E9F2', logo_fg = '#2E5A8C',
  customization_capabilities = array['Fabric','GSM'],
  production  = '{"factoryArea":"18,500 m²","employees":320,"monthlyCapacity":"2,200 tonnes","productionLines":14}'::jsonb,
  trade_terms = '{"moq":"10 tonnes","incoterms":"EXW, FOB Chennai","paymentTerms":"30% advance, 70% on delivery","leadTime":"18–22 days"}'::jsonb,
  catalogue = '[{"id":"c13","fileName":"yarn-count-sheet.pdf"}]'::jsonb,
  work_history = '[{"client":"Erode Textile Exports","role":"Sub-Contractor","frequency":"Recurring","start":"2013","end":"present","desc":"Combed cotton yarn and greige fabric supply, 24s–32s count."}]'::jsonb,
  products = '[{"name":"Combed cotton yarn, 30s","category":"Yarn","material":"100% combed cotton","priceRange":"₹255–₹295/kg"},{"name":"Greige knit fabric","category":"Fabric","material":"100% cotton, 28s count","priceRange":"₹270–₹310/kg"}]'::jsonb,
  facility_photos = '[{},{},{},{}]'::jsonb,
  contact = '{"name":"Muthu Kumar","title":"Plant Manager","email":"muthu@erodespinning.in","phone":"+91 94430 89211","languages":"English, Tamil","responseTime":"3–4 hours"}'::jsonb
where org_id = (select id from orgs where name = 'Erode Spinning Mills');

-- s11 Bhilwara Suiting Weavers (lite)
update supplier_profiles set
  mission = 'Wool-blend suiting fabric, mill-direct pricing.', years_in_business = 15,
  company_type = 'Fabric supplier', tags = array['Woven fabric'],
  logo_bg = '#F2E4D8', logo_fg = '#B5654A',
  catalogue = '[{"id":"c14","fileName":"suiting-swatch-book.jpg"}]'::jsonb,
  work_history = '[{"client":"Bhilwara Processors","role":"Sub-Contractor","frequency":"Annual Maintenance Contract","start":"2011","end":"present","desc":"Wool-blend suiting fabric weaving for formalwear brands."}]'::jsonb
where org_id = (select id from orgs where name = 'Bhilwara Suiting Weavers');

-- s12 Panipat Trims Co. (lite)
update supplier_profiles set
  mission = 'Zippers, interlinings, and hangtags, one window sourcing.', years_in_business = 10,
  company_type = 'Trims & accessories', tags = array['Trims & accessories','White-label article'],
  logo_bg = '#EAE6DC', logo_fg = '#7A6A4E',
  catalogue = '[{"id":"c15","fileName":"trims-lineup.jpg"}]'::jsonb,
  work_history = '[{"client":"Panipat Home Textiles","role":"Sub-Contractor","frequency":"Recurring","start":"2016","end":"present","desc":"Zippers, interlinings, and hangtags for home textile packaging."}]'::jsonb
where org_id = (select id from orgs where name = 'Panipat Trims Co.');

-- ── prototype certifications (reviewer hatch on so cert edits don't re-open the
--    already-verified onboarding sections). Refresh s1/s3 to the prototype set; the
--    other rich suppliers (s4/s6/s8/s10) get theirs; lite suppliers have none. Badge
--    (Verified/Registered/Expiring soon/Expired/Needs correction/Passed) is DERIVED
--    from dates + kind by cert_badge(), so field_status only carries verified vs
--    needs_correction — the engine decides the rest from the seeded dates. ─────────
set session sourcesutra.reviewer = 'on';
do $$
declare
  s1  uuid := (select id from orgs where name = 'Anand Knitfab');
  s3  uuid := (select id from orgs where name = 'Ludhiana Woolworks');
  s4  uuid := (select id from orgs where name = 'Erode Textile Exports');
  s6  uuid := (select id from orgs where name = 'Panipat Home Textiles');
  s8  uuid := (select id from orgs where name = 'Ludhiana Embroidery House');
  s10 uuid := (select id from orgs where name = 'Erode Spinning Mills');
begin
  -- refresh the two loginable suppliers' certs to the prototype set
  delete from certifications where org_id in (s1, s3);

  insert into certifications
    (org_id, kind, category, name, issuer, number, scope, issue_date, expiry_date,
     does_not_expire, field_status, audit_outcome, audit_buyer, audit_type, audit_date,
     verification_url, remediation_reason)
  values
  -- s1 Anand Knitfab
  (s1,'standard','Quality Management','ISO 9001','SGS','SGS-QMS-2023-6612','Knitting and greige fabric processing, main unit, Tiruppur.','2023-03-01','2026-02-28',false,'verified',null,null,null,null,null,null),
  (s1,'standard','Recycled Materials','RCS','Control Union','RCS-CU-2025-3391','Recycled cotton blending line, Unit 1.','2025-09-10','2026-09-10',false,'verified',null,null,null,null,null,null),
  -- s3 Ludhiana Woolworks
  (s3,'standard','Quality Management','ISO 9001','Bureau Veritas','BV-QMS-2024-9021','Woven fabric sourcing, cutting, and CMT sewing operations, Ludhiana unit.','2024-04-01','2027-03-31',false,'verified',null,null,null,null,'https://www.bureauveritas.com/certificate-lookup',null),
  (s3,'standard','Social Compliance','WRAP','WRAP Inc.','WRAP-2025-4471','Main production facility, worker welfare and social compliance.','2025-06-15','2026-09-30',false,'verified',null,null,null,null,null,null),
  (s3,'regulatory','Indian Regulatory & Legal Compliance','Factory Licence','Punjab Directorate of Factories','PB-FL-2013-2287','Statutory factory operating licence.','2013-05-01',null,true,'verified',null,null,null,null,null,null),
  (s3,'audit','Buyer / Brand Audits','Quality audit',null,null,null,null,null,false,'verified','passed','Vardhman Textiles','Quality audit','2026-03-12',null,null),
  -- s4 Erode Textile Exports
  (s4,'standard','Sustainable & Organic Textiles','OEKO-TEX Standard 100','OEKO-TEX','OTX-2025-11284','Finished terry towel and bath linen products, all lines.','2025-01-20','2026-01-20',false,'needs_correction',null,null,null,null,null,'Uploaded certificate lists a different legal entity name than the one on file — needs a reissued copy or a name-change letter from OEKO-TEX.'),
  (s4,'standard','Social Compliance','SMETA / SEDEX','SEDEX','SMETA-2024-8834','Ethical trade audit covering labour standards, health & safety, and environment.','2024-11-01','2026-10-31',false,'verified',null,null,null,null,null,null),
  (s4,'standard','Environmental Management','ISO 14001','TÜV SÜD','TUV-EMS-2023-5502','Effluent treatment and environmental management, Erode facility.','2023-08-01','2026-07-31',false,'verified',null,null,null,null,null,null),
  -- s6 Panipat Home Textiles
  (s6,'standard','Recycled Materials','GRS','Control Union','GRS-CU-2025-7712','Recycled-yarn bedspread and cushion cover line, Unit 1.','2025-05-01','2026-04-30',false,'verified',null,null,null,null,null,null),
  (s6,'standard','Responsible Materials','FSC','Control Union','FSC-CU-2024-2290','Packaging cartons and hangtags sourced from FSC-certified paper.','2024-07-01','2027-06-30',false,'verified',null,null,null,null,null,null),
  -- s8 Ludhiana Embroidery House
  (s8,'standard','Quality Management','ISO 9001','Bureau Veritas','BV-QMS-2022-4410','Embroidery unit quality management, Ludhiana.','2022-01-01','2025-12-31',false,'verified',null,null,null,null,null,null),
  -- s10 Erode Spinning Mills
  (s10,'standard','Sustainable & Organic Textiles','OCS','Control Union','OCS-CU-2025-9012','Organic cotton yarn spinning line, Unit 3.','2025-02-01','2026-08-25',false,'verified',null,null,null,null,null,null),
  (s10,'standard','Quality Management','ISO 9001','SGS','SGS-QMS-2024-3387','Yarn spinning and greige fabric quality management.','2024-06-01','2027-05-31',false,'verified',null,null,null,null,null,null);
end $$;
reset sourcesutra.reviewer;
