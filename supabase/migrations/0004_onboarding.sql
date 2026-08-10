-- ============================================================================
-- SourceSutra — Phase 1: Onboarding & verification (bizlogic.md Part C.2)
-- Builds on 0001 (core) + 0002 (auth/section_guard) + 0003 (sourcing).
--
-- Turns the prototype's setTimeout fakes into a real verification pipeline (§B.6):
--   * documents (GST/PAN/MSME/CIN, MGT-7 ×3 FYs) + certifications carry their own
--     status: empty -> uploaded -> in_progress -> verified | needs_correction (§A.3)
--   * identity_checks store OTP/KYC RESULTS ONLY + a masked last-4 (privacy A.11.5)
--   * submit_section() enforces V3/V4/V5 and freezes the section into review
--   * review_section() is the reviewer/automation path: verify, or flag fields ->
--     remediation with per-doc reasons the supplier sees
--   * editing ANY verified section re-opens it for review (settled decision #2)
--   * the FULL badge vocabulary (settled decision #4) as one computation + two
--     label maps (supplier vs buyer)
--   * progress curve (settled decision #3) folded into v_supplier_overall
--   * a domain_events outbox (§B.4/B.9) — Phase 3 consumes it into notifications
--
-- Reviewer authz: verification is an ops/automation surface -> review_section is
-- service_role only (like lapse_expired_rfqs), never a client action.
-- ============================================================================

-- ---------- new status vocabularies ----------
create type doc_status    as enum ('empty', 'uploaded', 'in_progress', 'verified', 'needs_correction');
create type cert_kind     as enum ('regulatory', 'standard', 'audit');  -- drives the badge branch
create type audit_outcome as enum ('passed', 'passed_with_corrective', 'failed', 'pending');

-- ---------- documents: registration + financial docs, per-doc lifecycle (§A.3/§B.8) ----------
create table documents (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references orgs(id) on delete cascade,
  section_kind       section_kind not null,                 -- identity | financials | portfolio
  doc_type           text not null,                         -- 'GST','PAN','MSME','CIN','MGT7',...
  fy                 text,                                   -- financial year for MGT-7 (else null)
  status             doc_status not null default 'uploaded',
  storage_path       text,                                  -- presigned object key (§B.8); real file deferred
  remediation_reason text,                                  -- set when status = needs_correction
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
-- one doc per (org, type, FY): NULLs are distinct in a plain unique, so key on a
-- coalesced FY to also collapse duplicates of the single-instance docs.
create unique index documents_one_per_type on documents (org_id, doc_type, coalesce(fy, '-'));

-- ---------- certifications: per-record, with a computed badge (§A.8.1) ----------
create table certifications (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references orgs(id) on delete cascade,
  kind               cert_kind not null default 'standard',
  category           text not null,                         -- 'ISO','GOTS','Factory Licence','Buyer Audit'...
  name               text not null,
  issuer             text,
  number             text,
  scope              text,
  facility           text,
  issue_date         date,
  expiry_date        date,
  does_not_expire    boolean not null default false,
  field_status       doc_status not null default 'uploaded',
  audit_outcome      audit_outcome,                         -- only meaningful when kind = 'audit'
  storage_path       text,
  remediation_reason text,
  created_at         timestamptz not null default now()
);

-- ---------- identity checks: OTP/KYC RESULTS ONLY, masked (privacy rule A.11.5) ----------
create table identity_checks (
  org_id           uuid primary key references orgs(id) on delete cascade,
  email_verified   boolean not null default false,
  phone_verified   boolean not null default false,
  aadhaar_verified boolean not null default false,
  aadhaar_last4    char(4),                                 -- masked; the full number is NEVER stored
  updated_at       timestamptz not null default now()
);

-- ---------- domain events outbox (§B.4/B.9): audit trail + Phase-3 notification source ----------
create table domain_events (
  id         bigint generated always as identity primary key,
  type       text not null,
  org_id     uuid,                                          -- primary subject org
  ref_rfq_id uuid,
  ref_quote_id uuid,
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Append-only emit helper. SECURITY DEFINER so triggers can write regardless of the
-- acting role / RLS. Called by the state-machine triggers below (and in 0005).
create or replace function emit_event(
  p_type text, p_org uuid,
  p_rfq uuid default null, p_quote uuid default null, p_payload jsonb default '{}'::jsonb
) returns void language sql security definer set search_path = public as $$
  insert into domain_events (type, org_id, ref_rfq_id, ref_quote_id, payload)
  values (p_type, p_org, p_rfq, p_quote, coalesce(p_payload, '{}'::jsonb));
$$;

-- ============================================================================
-- Certification badge (§A.8.1) — ONE computation, TWO label maps.
-- Full vocabulary (settled decision #4): Verified/Certified · Self-declared/Claimed
-- · Registered (regulatory) · Expiring soon · Expired · Needs correction · and the
-- audit outcomes Passed / Passed with corrective actions / Failed / Pending.
-- ============================================================================
create or replace function cert_badge(c certifications) returns text
language sql immutable as $$
  select case
    when c.kind = 'audit' then
      case coalesce(c.audit_outcome, 'pending')
        when 'passed'                 then 'Passed'
        when 'passed_with_corrective' then 'Passed with corrective actions'
        when 'failed'                 then 'Failed'
        else                               'Pending'
      end
    when c.field_status = 'needs_correction'                                        then 'Needs correction'
    when (not c.does_not_expire) and c.expiry_date is not null
         and c.expiry_date < current_date                                           then 'Expired'
    when (not c.does_not_expire) and c.expiry_date is not null
         and (c.expiry_date - current_date) between 0 and 60                        then 'Expiring soon'
    when c.field_status = 'verified' and c.kind = 'regulatory'                      then 'Registered'
    when c.field_status = 'verified'                                                then 'Verified'
    else                                                                                'Self-declared'
  end;
$$;

-- Buyer-facing labels differ (Verified->Certified, Self-declared->Claimed); the rest
-- are shared. Keep one computation, map at the edge.
create or replace function cert_badge_buyer(p_supplier_badge text) returns text
language sql immutable as $$
  select case p_supplier_badge
    when 'Verified'      then 'Certified'
    when 'Self-declared' then 'Claimed'
    else p_supplier_badge
  end;
$$;

create view v_cert_badges with (security_invoker = on) as
  select c.id, c.org_id, c.kind, c.category, c.name, c.expiry_date,
         cert_badge(c)                    as badge_supplier,
         cert_badge_buyer(cert_badge(c))  as badge_buyer
  from certifications c;

-- ============================================================================
-- Overall status + progress (§A.4). Replaces 0001's view, ADDING progress_pct.
-- Progress curve (settled decision #3): not_started 0 · draft 0.4 ·
-- submitted_pending 0.7 · verified 1.0, weighted 40/40/20 (remediation = 0.4:
-- there's rework to do). overall_status logic is unchanged from 0001.
-- ============================================================================
create or replace view v_supplier_overall as
with agg as (
  select org_id,
    max(status) filter (where kind = 'identity')   as identity,
    max(status) filter (where kind = 'financials') as financials,
    max(status) filter (where kind = 'portfolio')  as portfolio,
    sum(weight * case status
                   when 'not_started'       then 0.0
                   when 'draft'             then 0.4
                   when 'submitted_pending' then 0.7
                   when 'remediation'       then 0.4
                   when 'verified'          then 1.0
                   else 0.0 end) as progress_pts
  from onboarding_sections
  group by org_id
)
select org_id,
  case
    when identity = 'not_started' and financials = 'not_started' and portfolio = 'not_started'
                                                                    then 'To be Started'
    when 'remediation' in (identity, financials, portfolio)         then 'Verification – Remediation Required'
    when identity = 'submitted_pending' or financials = 'submitted_pending'
                                                                    then 'Verification In Progress'
    when identity = 'verified' and financials = 'verified'
         and portfolio in ('submitted_pending', 'verified')         then 'Onboarding Completed'
    when identity = 'verified' and financials = 'verified'          then 'Verification Completed – Portfolio Required'
    else 'Draft'
  end as overall_status,
  round(progress_pts)::int as progress_pct
from agg;

-- ============================================================================
-- Supplier: record an OTP/KYC RESULT (the provider is called elsewhere; we persist
-- result-only + a masked last-4). Never stores a full Aadhaar/OTP value (A.11.5).
-- ============================================================================
create or replace function set_identity_check(p_channel text, p_verified boolean, p_last4 text default null)
returns identity_checks language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_kind org_kind; v_row identity_checks;
begin
  select m.org_id, o.kind into v_org, v_kind
    from memberships m join orgs o on o.id = m.org_id where m.user_id = auth.uid() limit 1;
  if v_org is null or v_kind <> 'supplier' then
    raise exception 'only a supplier may record identity checks' using errcode = '42501';
  end if;
  if p_channel not in ('email', 'phone', 'aadhaar') then
    raise exception 'channel must be email | phone | aadhaar' using errcode = 'P0001';
  end if;

  insert into identity_checks (org_id) values (v_org) on conflict (org_id) do nothing;
  update identity_checks set
    email_verified   = case when p_channel = 'email'   then p_verified else email_verified   end,
    phone_verified   = case when p_channel = 'phone'   then p_verified else phone_verified   end,
    aadhaar_verified = case when p_channel = 'aadhaar' then p_verified else aadhaar_verified end,
    -- store ONLY the last 4 for Aadhaar; drop everything else the caller may pass.
    aadhaar_last4    = case when p_channel = 'aadhaar' and p_verified
                            then right(regexp_replace(coalesce(p_last4, ''), '\D', '', 'g'), 4)
                            else aadhaar_last4 end,
    updated_at = now()
  where org_id = v_org returning * into v_row;
  return v_row;
end;
$$;

-- ============================================================================
-- Supplier: submit a section for review (§A.3). Enforces the §A.9 gates that are
-- expressible from stored content, transitions -> submitted_pending, and moves the
-- section's docs uploaded/needs_correction -> in_progress. The section-event trigger
-- emits SectionSubmitted. Financials-lock (V2) is enforced by section_guard (0002).
-- ============================================================================
create or replace function submit_section(p_kind section_kind)
returns onboarding_sections language plpgsql security definer set search_path = public as $$
declare
  v_org uuid; v_kind org_kind; v_sec onboarding_sections; v_chk identity_checks; n int;
begin
  select m.org_id, o.kind into v_org, v_kind
    from memberships m join orgs o on o.id = m.org_id where m.user_id = auth.uid() limit 1;
  if v_org is null or v_kind <> 'supplier' then
    raise exception 'only a supplier may submit onboarding' using errcode = '42501';
  end if;

  select * into v_sec from onboarding_sections where org_id = v_org and kind = p_kind for update;
  if not found then raise exception 'section % not found', p_kind using errcode = 'P0002'; end if;
  if v_sec.status not in ('not_started', 'draft', 'remediation') then
    raise exception 'section % is % (only a draft/remediation section can be submitted)', p_kind, v_sec.status
      using errcode = 'P0001';
  end if;

  if p_kind = 'identity' then
    select * into v_chk from identity_checks where org_id = v_org;                 -- V4
    if v_chk is null or not (v_chk.email_verified and v_chk.phone_verified and v_chk.aadhaar_verified) then
      raise exception 'identity: email, phone and Aadhaar must be OTP/KYC-verified first (V4)' using errcode = 'P0001';
    end if;
    select count(*) into n from documents                                          -- V3 (docs)
      where org_id = v_org and section_kind = 'identity' and doc_type in ('GST', 'PAN') and status <> 'empty';
    if n < 2 then
      raise exception 'identity: GST and PAN documents are required (V3)' using errcode = 'P0001';
    end if;

  elsif p_kind = 'financials' then
    select count(distinct fy) into n from documents                                -- V5
      where org_id = v_org and section_kind = 'financials' and doc_type = 'MGT7'
        and fy is not null and status <> 'empty';
    if n < 3 then
      raise exception 'financials: MGT-7 is required for each of the last 3 FYs (V5)' using errcode = 'P0001';
    end if;
  end if;

  update onboarding_sections set status = 'submitted_pending'
    where org_id = v_org and kind = p_kind returning * into v_sec;
  update documents set status = 'in_progress', updated_at = now()
    where org_id = v_org and section_kind = p_kind and status in ('uploaded', 'needs_correction');
  return v_sec;
end;
$$;

-- ============================================================================
-- Reviewer / automation (service_role): approve a section, or flag fields.
--   p_decision = 'verify'    -> section + its docs -> verified
--   p_decision = 'remediate' -> section -> remediation; each {doc_type,reason} in
--                               p_flags -> that doc needs_correction + reason
-- Uses the reviewer escape hatch so section_guard permits verified/remediation.
-- Section-event trigger emits SectionVerified / SectionRemediation (+ SupplierOnboarded).
-- ============================================================================
create or replace function review_section(
  p_org uuid, p_kind section_kind, p_decision text, p_flags jsonb default '[]'::jsonb
) returns onboarding_sections language plpgsql security definer set search_path = public as $$
declare v_sec onboarding_sections; f jsonb;
begin
  if p_decision not in ('verify', 'remediate') then
    raise exception 'decision must be verify | remediate' using errcode = 'P0001';
  end if;
  perform set_config('sourcesutra.reviewer', 'on', true);

  if p_decision = 'verify' then
    update documents set status = 'verified', remediation_reason = null, updated_at = now()
      where org_id = p_org and section_kind = p_kind and status <> 'empty';
    update onboarding_sections set status = 'verified'
      where org_id = p_org and kind = p_kind returning * into v_sec;
  else
    for f in select * from jsonb_array_elements(coalesce(p_flags, '[]'::jsonb)) loop
      update documents set status = 'needs_correction',
             remediation_reason = f->>'reason', updated_at = now()
        where org_id = p_org and section_kind = p_kind and doc_type = f->>'doc_type';
    end loop;
    update onboarding_sections set status = 'remediation'
      where org_id = p_org and kind = p_kind returning * into v_sec;
  end if;

  perform set_config('sourcesutra.reviewer', 'off', true);
  if not found then raise exception 'section %.% not found', p_org, p_kind using errcode = 'P0002'; end if;
  return v_sec;
end;
$$;

-- ============================================================================
-- Triggers
-- ============================================================================

-- Editing ANY content in a VERIFIED section re-opens it for review (decision #2).
-- Skipped while the reviewer escape hatch is on (that's the verify path setting
-- docs -> verified, which must NOT bounce the section back).
create or replace function trg_content_reopen()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_kind section_kind;
begin
  if coalesce(current_setting('sourcesutra.reviewer', true), '') = 'on' then
    return new;
  end if;
  -- certifications live under Portfolio; documents name their own section. Use a
  -- statement IF (not a CASE expr) so the unused branch's field ref isn't resolved
  -- against the wrong row type (certifications has no section_kind).
  if tg_table_name = 'certifications' then
    v_kind := 'portfolio';
  else
    v_kind := new.section_kind;
  end if;
  update onboarding_sections set status = 'submitted_pending'
    where org_id = new.org_id and kind = v_kind and status = 'verified';
  return new;
end;
$$;

create trigger doc_reopen  after insert or update on documents
  for each row execute function trg_content_reopen();
create trigger cert_reopen after insert or update on certifications
  for each row execute function trg_content_reopen();

-- Section state transitions -> domain events (SectionSubmitted/Verified/Remediation),
-- and SupplierOnboarded the moment the derived overall status reaches completion.
create or replace function trg_section_events()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_overall text;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;                                             -- no status change, nothing to emit
  end if;

  if new.status = 'submitted_pending' then
    perform emit_event('SectionSubmitted', new.org_id, null, null, jsonb_build_object('kind', new.kind));
  elsif new.status = 'remediation' then
    perform emit_event('SectionRemediation', new.org_id, null, null, jsonb_build_object('kind', new.kind));
  elsif new.status = 'verified' then
    perform emit_event('SectionVerified', new.org_id, null, null, jsonb_build_object('kind', new.kind));
  end if;

  -- SupplierOnboarded fires the first time the DERIVED overall status reaches
  -- completion — which can happen on a portfolio submit, not only a 'verified'
  -- transition. Dedupe against the outbox so it emits exactly once.
  select overall_status into v_overall from v_supplier_overall where org_id = new.org_id;
  if v_overall = 'Onboarding Completed'
     and not exists (select 1 from domain_events where type = 'SupplierOnboarded' and org_id = new.org_id) then
    perform emit_event('SupplierOnboarded', new.org_id);
  end if;
  return new;
end;
$$;

create trigger section_events after insert or update on onboarding_sections
  for each row execute function trg_section_events();

-- ============================================================================
-- RLS + grants (§A.10 / §B.8). Identity & financial docs stay owner/admin-only;
-- portfolio docs + all certifications are readable by any logged-in user
-- (settled decision #5: public profiles are logged-in-only, not anonymous).
-- ============================================================================
alter table documents       enable row level security;
alter table certifications  enable row level security;
alter table identity_checks enable row level security;
alter table domain_events   enable row level security;   -- internal: no policy => invisible to clients

create policy documents_read   on documents for select
  using (is_member(org_id) or section_kind = 'portfolio');
create policy documents_mutate on documents for all
  using (is_member(org_id)) with check (is_member(org_id));

create policy certifications_read   on certifications for select using (true);
create policy certifications_mutate on certifications for all
  using (is_member(org_id)) with check (is_member(org_id));

create policy identity_checks_read on identity_checks for select using (is_member(org_id));

grant select, insert, update, delete on documents      to authenticated;
grant select, insert, update, delete on certifications to authenticated;
grant select                         on identity_checks to authenticated;
grant select                         on v_cert_badges   to authenticated;

grant execute on function set_identity_check(text, boolean, text) to authenticated;
grant execute on function submit_section(section_kind)            to authenticated;
grant execute on function cert_badge(certifications)              to authenticated;
grant execute on function cert_badge_buyer(text)                  to authenticated;
-- verification is an ops/automation surface — never a client action.
grant execute on function review_section(uuid, section_kind, text, jsonb) to service_role;
