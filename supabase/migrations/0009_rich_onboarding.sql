-- ============================================================================
-- SourceSutra — migration 0009: rich supplier onboarding (design-faithful).
-- ADDITIVE. Backs the full ScreenDashboard onboarding (Identity / Financials /
-- Portfolio) so every field, accordion, and dropdown in the design persists.
-- Portfolio is already largely covered by 0008 (mission, production, trade_terms,
-- customization_capabilities, products, work_history, catalogue, facility_photos,
-- tags); this migration adds the Identity + Financials depth + a few cert fields.
--
-- Privacy split (§A.10):
--   * Identity/profile detail (contact, designation, website, nature, established,
--     logo) lives on supplier_profiles — world-readable to authenticated users, as
--     the buyer-facing profile already shows contact/production/etc.
--   * DIRECTORS and FINANCIALS are sensitive → their own tables, OWNER-ONLY RLS.
-- ============================================================================

-- ---------- Identity detail on supplier_profiles (1:1, buyer-safe profile fields) ----------
alter table supplier_profiles
  add column contact_name       text,
  add column designation        text,
  add column email_language     text,
  add column phone              text,
  add column alt_contact        text,
  add column website            text,
  add column established_date   date,
  add column nature_of_business text,
  add column logo_path          text;

-- ---------- Company directors (dynamic list; identity — owner-only) ----------
create table supplier_directors (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references orgs(id) on delete cascade,
  name             text,
  contact          text,
  email            text,
  aadhaar_verified boolean not null default false,
  aadhaar_last4    char(4),
  created_at       timestamptz not null default now()
);

-- ---------- Financials detail (bank + addresses; sensitive — owner-only) ----------
create table supplier_financials (
  org_id           uuid primary key references orgs(id) on delete cascade,
  bank_country     text,
  bank_name        text,
  beneficiary_name text,
  routing_type     text,
  routing_code     text,
  account_number   text,                                  -- sensitive; owner-only RLS
  billing          jsonb not null default '{}'::jsonb,    -- {line1,line2,landmark,city,state,pincode}
  legal            jsonb not null default '{}'::jsonb,    -- {line1,line2,landmark,city,state,pincode,taxCode}
  updated_at       timestamptz not null default now()
);

-- ---------- Registration docs carry a number (GST/PAN/MSME/CIN) ----------
alter table documents add column doc_number text;

-- ---------- Certifications: remaining rich-form fields (0004/0008 cover the rest) ----------
alter table certifications
  add column last_audit_date date,
  add column next_audit_date date,
  add column evidence        jsonb not null default '[]'::jsonb;   -- [{fileName, path}]

-- ============================================================================
-- RLS + grants
-- ============================================================================
alter table supplier_directors  enable row level security;
alter table supplier_financials enable row level security;

-- Directors & financials are owner-only for BOTH read and write (never buyer-visible).
create policy directors_owner  on supplier_directors  for all
  using (is_member(org_id)) with check (is_member(org_id));
create policy financials_owner on supplier_financials for all
  using (is_member(org_id)) with check (is_member(org_id));

-- Editing directors/financials re-opens a verified section for review (decision #2),
-- mirroring the doc/cert reopen triggers (0004). Directors + financials belong to
-- Identity and Financials respectively.
create or replace function trg_detail_reopen()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_kind section_kind := tg_argv[0]::section_kind;
begin
  if coalesce(current_setting('sourcesutra.reviewer', true), '') = 'on' then
    return new;
  end if;
  update onboarding_sections set status = 'submitted_pending'
    where org_id = new.org_id and kind = v_kind and status = 'verified';
  return new;
end;
$$;

create trigger directors_reopen  after insert or update on supplier_directors
  for each row execute function trg_detail_reopen('identity');
create trigger financials_reopen after insert or update on supplier_financials
  for each row execute function trg_detail_reopen('financials');

grant select, insert, update, delete on supplier_directors  to authenticated;
grant select, insert, update, delete on supplier_financials to authenticated;
-- New supplier_profiles / certifications / documents columns inherit existing grants + policies.
