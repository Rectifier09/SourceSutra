-- ============================================================================
-- SourceSutra — core schema (Phase-0 slice) + the award transaction
--
-- Purpose: prove the "logic-in-Postgres" bet from bizlogic.md §B.0. It contains
-- just enough of the model to make the AWARD transaction (§A.7) real and to show
-- that its invariants (§A.11) and the permission matrix (§A.10) are enforced by
-- the DATABASE, not app code. The full data model (§B.2) extends this.
--
-- Design notes:
--   * gen_random_uuid() is core in PG13+ (no pgcrypto needed).
--   * memberships.user_id holds a Supabase auth user id (auth.uid()) but has NO
--     FK to auth.users yet, so this proof is self-contained. Add the FK in Phase 0.
--   * Mutations happen through SECURITY DEFINER functions that do their own authz
--     via auth.uid(); RLS then guards all direct reads.
-- ============================================================================

-- ---------- enums (status vocabularies, bizlogic.md §10) ----------
create type org_kind       as enum ('supplier', 'buyer');
create type section_kind   as enum ('identity', 'financials', 'portfolio');
create type section_status as enum ('not_started', 'draft', 'submitted_pending', 'verified', 'remediation');
create type rfq_status     as enum ('draft', 'active', 'awarded', 'foreclosed', 'lapsed');
create type quote_status   as enum ('draft', 'submitted', 'under_review', 'shortlisted', 'awarded', 'not_selected', 'closed');

-- ---------- orgs & membership (§A.2) ----------
create table orgs (
  id         uuid primary key default gen_random_uuid(),
  kind       org_kind not null,
  name       text not null,
  location   text,
  created_at timestamptz not null default now()
);

create table memberships (
  org_id  uuid not null references orgs(id) on delete cascade,
  user_id uuid not null,                       -- = auth.uid(); FK to auth.users added in Phase 0
  role    text not null default 'owner',
  primary key (org_id, user_id)
);

-- ---------- supplier onboarding (enough to derive overall status, §A.3/§A.4) ----------
create table supplier_profiles (
  org_id  uuid primary key references orgs(id) on delete cascade,
  mission text
);

create table onboarding_sections (
  org_id uuid not null references orgs(id) on delete cascade,
  kind   section_kind not null,
  status section_status not null default 'not_started',
  weight int not null,                          -- identity 40, financials 40, portfolio 20
  primary key (org_id, kind)
);

-- ---------- sourcing: RFQ, Quote, Award (§A.5/§A.6/§A.7) ----------
create table rfqs (
  id               uuid primary key default gen_random_uuid(),
  buyer_org_id     uuid not null references orgs(id),
  title            text not null,
  status           rfq_status not null default 'draft',
  bid_start        date,
  bid_end          date,
  delivery_date    date,
  awarded_quote_id uuid,                         -- FK added after quotes exists
  awarded_at       timestamptz,
  created_at       timestamptz not null default now(),
  constraint rfq_bid_window_valid   check (bid_start is null or bid_end is null or bid_start <= bid_end),      -- V6
  constraint rfq_delivery_after_bid check (delivery_date is null or bid_end is null or delivery_date > bid_end) -- V7
);

create table quotes (
  id              uuid primary key default gen_random_uuid(),
  rfq_id          uuid not null references rfqs(id) on delete cascade,
  supplier_org_id uuid not null references orgs(id),
  status          quote_status not null default 'draft',
  unit_price      numeric,
  currency        text default 'INR',
  reject_reason   text,
  created_at      timestamptz not null default now()
);

-- V12: at most ONE non-terminal (live) quote per (supplier, RFQ).
create unique index quotes_one_live_per_supplier_rfq
  on quotes (rfq_id, supplier_org_id)
  where status not in ('not_selected', 'closed');

-- A.11.1: at most ONE award per RFQ — enforced by the DB (rfq_id is the PK).
create table awards (
  rfq_id          uuid primary key references rfqs(id) on delete cascade,
  quote_id        uuid not null references quotes(id),
  awarded_by      uuid,
  idempotency_key text,
  awarded_at      timestamptz not null default now()
);

alter table rfqs add constraint rfqs_awarded_quote_fk
  foreign key (awarded_quote_id) references quotes(id);

-- ---------- derived field as a VIEW (§A.4, §A.8) ----------
-- Overall onboarding status computed from the three sections; never stored.
create view v_supplier_overall as
with s as (
  select org_id,
         max(status) filter (where kind = 'identity')   as identity,
         max(status) filter (where kind = 'financials') as financials,
         max(status) filter (where kind = 'portfolio')  as portfolio
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
  end as overall_status
from s;

-- ============================================================================
-- Authz helper (§A.10)
-- ============================================================================
-- SECURITY DEFINER so it can read memberships even while RLS is on for callers.
create or replace function is_member(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships m
    where m.org_id = p_org and m.user_id = auth.uid()
  );
$$;

-- ============================================================================
-- THE AWARD TRANSACTION (§A.7) — the whole point of this proof
-- ============================================================================
-- Single atomic op: locks the RFQ aggregate, checks guards, then flips the
-- winning quote -> awarded, every live sibling -> closed, the RFQ -> awarded.
-- Idempotent (safe to retry / double-click) and one-shot (§A.11.1/.2).
create or replace function award_quote(p_quote_id uuid, p_idempotency_key text default null)
returns awards
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_quote quotes;
  v_rfq   rfqs;
  v_award awards;
begin
  select * into v_quote from quotes where id = p_quote_id;
  if not found then
    raise exception 'quote % not found', p_quote_id using errcode = 'P0002';
  end if;

  -- Lock the RFQ aggregate so concurrent awards / retries serialize here.
  select * into v_rfq from rfqs where id = v_quote.rfq_id for update;

  -- Authz (§A.10 / V13): caller must belong to the RFQ's buyer org.
  if v_actor is null or not exists (
       select 1 from memberships m where m.org_id = v_rfq.buyer_org_id and m.user_id = v_actor
     ) then
    raise exception 'not authorized to award RFQ %', v_rfq.id using errcode = '42501';
  end if;

  -- Idempotency + one-shot (§A.7): a repeat of the SAME award is a no-op;
  -- awarding a different quote after an award is rejected.
  select * into v_award from awards where rfq_id = v_rfq.id;
  if found then
    if v_award.quote_id = p_quote_id
       and (p_idempotency_key is null
            or v_award.idempotency_key is not distinct from p_idempotency_key) then
      return v_award;                                   -- idempotent replay
    end if;
    raise exception 'RFQ % already awarded to quote %', v_rfq.id, v_award.quote_id
      using errcode = '23505';
  end if;

  -- Preconditions (§A.7 guards).
  if v_rfq.status <> 'active' then
    raise exception 'RFQ % is % (must be active to award)', v_rfq.id, v_rfq.status
      using errcode = 'P0001';
  end if;
  if v_quote.status in ('awarded', 'not_selected', 'closed', 'draft') then
    raise exception 'quote % is % (not awardable)', v_quote.id, v_quote.status
      using errcode = 'P0001';
  end if;

  -- Effects (atomic). Losing siblings -> closed; already-rejected quotes stay
  -- not_selected (§A.11.2).
  update quotes set status = 'closed'
    where rfq_id = v_rfq.id and id <> p_quote_id and status <> 'not_selected';
  update quotes set status = 'awarded' where id = p_quote_id;
  update rfqs   set status = 'awarded', awarded_quote_id = p_quote_id, awarded_at = now()
    where id = v_rfq.id;

  insert into awards (rfq_id, quote_id, awarded_by, idempotency_key)
    values (v_rfq.id, p_quote_id, v_actor, p_idempotency_key)
    returning * into v_award;

  return v_award;
end;
$$;

-- Reject a single quote; the RFQ stays active (§A.6).
create or replace function reject_quote(p_quote_id uuid, p_reason text default null)
returns quotes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_quote quotes;
  v_rfq   rfqs;
begin
  select * into v_quote from quotes where id = p_quote_id;
  if not found then
    raise exception 'quote % not found', p_quote_id using errcode = 'P0002';
  end if;
  select * into v_rfq from rfqs where id = v_quote.rfq_id for update;
  if v_actor is null or not exists (
       select 1 from memberships m where m.org_id = v_rfq.buyer_org_id and m.user_id = v_actor
     ) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if v_quote.status in ('awarded', 'not_selected', 'closed') then
    raise exception 'quote % is terminal (%)', v_quote.id, v_quote.status using errcode = 'P0001';
  end if;
  update quotes set status = 'not_selected', reject_reason = p_reason
    where id = p_quote_id returning * into v_quote;
  return v_quote;
end;
$$;

-- Trigger: no live quote may exist on an RFQ that isn't active (§A.11.7).
create or replace function trg_quote_guard()
returns trigger
language plpgsql
as $$
declare
  v_status rfq_status;
begin
  select status into v_status from rfqs where id = new.rfq_id;
  if new.status in ('submitted', 'under_review', 'shortlisted')
     and v_status <> 'active' then
    raise exception 'cannot place/keep a quote on RFQ that is % (must be active)', v_status
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger quote_guard
  before insert or update on quotes
  for each row execute function trg_quote_guard();

-- ============================================================================
-- Row-Level Security (§A.10) — the permission matrix, enforced by the DB.
-- Only the SELECT policies needed for this proof; write paths go through the
-- SECURITY DEFINER functions above. Full write policies land in Phase 0.
-- ============================================================================
alter table orgs                enable row level security;
alter table memberships         enable row level security;
alter table supplier_profiles   enable row level security;
alter table onboarding_sections enable row level security;
alter table rfqs                enable row level security;
alter table quotes              enable row level security;
alter table awards              enable row level security;

-- Org names & buyer-facing supplier profiles are public to any authenticated user.
create policy orgs_read     on orgs              for select using (true);
create policy profiles_read on supplier_profiles for select using (true);

-- THE key rule: Identity/Financials/Portfolio onboarding is visible ONLY to the
-- owning org. Buyers can NEVER read another org's onboarding sections (§A.10).
create policy onboarding_owner_only on onboarding_sections
  for select using (is_member(org_id));

-- Suppliers see active RFQs; a buyer sees their own RFQs in any state.
create policy rfqs_read on rfqs
  for select using (status = 'active' or is_member(buyer_org_id));

-- A quote is visible to the supplier who owns it OR the buyer of its RFQ.
-- Competitors can NEVER see each other's quotes (§A.10).
create policy quotes_read on quotes
  for select using (
    is_member(supplier_org_id)
    or is_member((select r.buyer_org_id from rfqs r where r.id = rfq_id))
  );

-- Award record visible to the RFQ's buyer.
create policy awards_read on awards
  for select using (
    is_member((select r.buyer_org_id from rfqs r where r.id = rfq_id))
  );

-- ---------- grants (authenticated users may call the RPCs) ----------
grant execute on function award_quote(uuid, text)  to authenticated;
grant execute on function reject_quote(uuid, text)  to authenticated;
grant execute on function is_member(uuid)           to authenticated;

-- ---------- table grants for the app's logged-in role ----------
-- RLS (above) decides WHICH rows are visible/writable; these grants permit table
-- access at all. Without them the app hits "permission denied for table ...".
-- Writes are further gated by the policies (some added in 0002) + section_guard.
grant select, update on orgs                to authenticated;  -- rename/location; update policy in 0002
grant select         on memberships         to authenticated;
grant select, update on supplier_profiles   to authenticated;
grant select, update on onboarding_sections to authenticated;
grant select         on rfqs                to authenticated;
grant select         on quotes              to authenticated;
grant select         on awards              to authenticated;
