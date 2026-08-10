-- ============================================================================
-- SourceSutra — Phase 2: RFQ ↔ Quote ↔ Award (the marketplace core, bizlogic.md
-- Part C.3). Builds on 0001 (award transaction) + 0002 (auth/accounts).
--
-- Implements the settled Phase-2 sourcing model (bizlogic.md §C.6):
--   * publish_rfq / submit_quote / triage / foreclose / reopen / lapse
--   * eligibility = verified-status + invite-list ONLY (certs/coverage/contract/
--     location/experience are advisory — §A.8.2/§A.8.4)
--   * manual, reversible triage; award from ANY non-terminal quote (§A.6)
--   * all buyers may view active RFQs; suppliers gated by eligibility (§A.10, #9)
--   * mutations go through SECURITY DEFINER functions (no client self-award)
-- ============================================================================

-- ---------- new enums ----------
create type who_can_respond   as enum ('open', 'verified_only', 'invite');
create type invitation_status as enum ('invited', 'responded', 'declined');

-- ---------- supplier: one advisory attribute the match-count needs ----------
alter table supplier_profiles add column years_in_business int;

-- ---------- RFQ: the full publishable spec (structured where logic needs it) ----------
alter table rfqs
  add column who_can_respond     who_can_respond not null default 'open',
  add column preferred_location  text,
  add column min_years_experience int,
  add column contract_type       text,
  add column quantity            numeric,
  add column unit                text,
  add column required_certs      jsonb not null default '[]'::jsonb,   -- [{category,name,priority}] — advisory
  add column customization_needs text[] not null default '{}',         -- advisory
  add column pricing_approach    text,
  add column target_price        numeric,
  add column currency            text default 'INR',
  add column sample_required     boolean not null default false,
  add column sample_type         text,
  add column sample_count        int,
  add column sample_deadline     date,
  add column sample_ship_paid_by text,
  add column spec                jsonb not null default '{}'::jsonb,   -- catch-all for descriptive wizard fields
  add column published_at        timestamptz,
  add column close_reason        text;

-- ---------- Quote: the fields a real quote carries ----------
alter table quotes
  add column quantity_fulfil       numeric,
  add column moq                   numeric,
  add column price_basis           text,
  add column sample_price          numeric,
  add column sample_lead_time      text,
  add column bulk_lead_time        text,
  add column incoterm              text,
  add column payment_terms         text,
  add column quote_validity        date,
  add column notes                 text,
  add column certs_held            jsonb not null default '[]'::jsonb,
  add column customization_offered text[] not null default '{}',
  add column submitted_at          timestamptz;

-- ---------- Invitations (invite-only RFQs + supplier Invitations tab) ----------
create table invitations (
  rfq_id          uuid not null references rfqs(id) on delete cascade,
  supplier_org_id uuid not null references orgs(id) on delete cascade,
  status          invitation_status not null default 'invited',
  created_at      timestamptz not null default now(),
  primary key (rfq_id, supplier_org_id)
);

-- ============================================================================
-- Helpers (SECURITY DEFINER — read past RLS to evaluate eligibility)
-- ============================================================================

-- A supplier org is "verified" when its derived overall status is Onboarding Completed.
create or replace function supplier_is_verified(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from v_supplier_overall
     where org_id = p_org and overall_status = 'Onboarding Completed'
  );
$$;

-- Can the CURRENT caller see this RFQ? (drives the rfqs_read policy, §A.10 + #9)
--   owner            -> any state
--   any buyer        -> active RFQs (decision #9: market-visible to all buyers)
--   supplier         -> active RFQs IF verified AND (not invite-only OR invited)
create or replace function can_view_rfq(p_rfq_id uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  v_rfq  rfqs;
  v_org  uuid;
  v_kind org_kind;
begin
  select * into v_rfq from rfqs where id = p_rfq_id;
  if not found then return false; end if;

  -- owner sees their RFQ in any state
  if exists (select 1 from memberships m where m.org_id = v_rfq.buyer_org_id and m.user_id = auth.uid()) then
    return true;
  end if;
  if v_rfq.status <> 'active' then return false; end if;

  select m.org_id, o.kind into v_org, v_kind
    from memberships m join orgs o on o.id = m.org_id
   where m.user_id = auth.uid() limit 1;

  if v_kind = 'buyer' then
    return true;                                        -- #9: any buyer may view active RFQs
  elsif v_kind = 'supplier' then
    if not supplier_is_verified(v_org) then return false; end if;
    if v_rfq.who_can_respond = 'invite' then
      return exists (select 1 from invitations i where i.rfq_id = v_rfq.id and i.supplier_org_id = v_org);
    end if;
    return true;                                        -- open / verified_only
  end if;
  return false;
end;
$$;

-- ============================================================================
-- Buyer: create is a plain insert (RLS-gated); state transitions are functions.
-- ============================================================================

-- draft -> active. Requires ownership, a complete bid window + delivery date (V6/V7).
create or replace function publish_rfq(p_rfq_id uuid)
returns rfqs language plpgsql security definer set search_path = public as $$
declare v_rfq rfqs; v_actor uuid := auth.uid();
begin
  select * into v_rfq from rfqs where id = p_rfq_id for update;
  if not found then raise exception 'RFQ % not found', p_rfq_id using errcode = 'P0002'; end if;
  if not exists (select 1 from memberships m where m.org_id = v_rfq.buyer_org_id and m.user_id = v_actor) then
    raise exception 'not authorized to publish RFQ %', p_rfq_id using errcode = '42501';
  end if;
  if v_rfq.status <> 'draft' then
    raise exception 'RFQ % is % (only a draft can be published)', p_rfq_id, v_rfq.status using errcode = 'P0001';
  end if;
  if v_rfq.bid_start is null or v_rfq.bid_end is null or v_rfq.delivery_date is null then
    raise exception 'bid window (start/end) and delivery date are required to publish' using errcode = 'P0001';
  end if;
  update rfqs set status = 'active', published_at = now() where id = p_rfq_id returning * into v_rfq;
  return v_rfq;
end;
$$;

-- Close an active RFQ early. Live quotes -> closed (suppliers see "Closed").
create or replace function foreclose_rfq(p_rfq_id uuid, p_reason text default null)
returns rfqs language plpgsql security definer set search_path = public as $$
declare v_rfq rfqs; v_actor uuid := auth.uid();
begin
  select * into v_rfq from rfqs where id = p_rfq_id for update;
  if not found then raise exception 'RFQ % not found', p_rfq_id using errcode = 'P0002'; end if;
  if not exists (select 1 from memberships m where m.org_id = v_rfq.buyer_org_id and m.user_id = v_actor) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if v_rfq.status <> 'active' then
    raise exception 'RFQ % is % (only an active RFQ can be foreclosed)', p_rfq_id, v_rfq.status using errcode = 'P0001';
  end if;
  update quotes set status = 'closed'
    where rfq_id = p_rfq_id and status in ('submitted', 'under_review', 'shortlisted');
  update rfqs set status = 'foreclosed', close_reason = p_reason where id = p_rfq_id returning * into v_rfq;
  return v_rfq;
end;
$$;

-- Reopen a lapsed RFQ with a new future bid end (V14). Existing quotes are intact.
create or replace function reopen_rfq(p_rfq_id uuid, p_new_bid_end date)
returns rfqs language plpgsql security definer set search_path = public as $$
declare v_rfq rfqs; v_actor uuid := auth.uid();
begin
  select * into v_rfq from rfqs where id = p_rfq_id for update;
  if not found then raise exception 'RFQ % not found', p_rfq_id using errcode = 'P0002'; end if;
  if not exists (select 1 from memberships m where m.org_id = v_rfq.buyer_org_id and m.user_id = v_actor) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if v_rfq.status <> 'lapsed' then
    raise exception 'RFQ % is % (only a lapsed RFQ can be reopened)', p_rfq_id, v_rfq.status using errcode = 'P0001';
  end if;
  if p_new_bid_end <= current_date then
    raise exception 'new bid end must be in the future (V14)' using errcode = 'P0001';
  end if;
  if v_rfq.delivery_date is not null and p_new_bid_end >= v_rfq.delivery_date then
    raise exception 'new bid end must be before the delivery date (V7)' using errcode = 'P0001';
  end if;
  update rfqs set status = 'active', bid_end = p_new_bid_end where id = p_rfq_id returning * into v_rfq;
  return v_rfq;
end;
$$;

-- Maintenance job (scheduler / service_role): active RFQs past their bid_end -> lapsed.
-- Quotes are left intact so the buyer can reopen & extend. Schedule via pg_cron or an Edge fn.
create or replace function lapse_expired_rfqs()
returns integer language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update rfqs set status = 'lapsed' where status = 'active' and bid_end < current_date;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Invite a specific supplier to an RFQ (buyer, own RFQ).
create or replace function invite_supplier(p_rfq_id uuid, p_supplier_org uuid)
returns invitations language plpgsql security definer set search_path = public as $$
declare v_rfq rfqs; v_actor uuid := auth.uid(); v_inv invitations;
begin
  select * into v_rfq from rfqs where id = p_rfq_id;
  if not found then raise exception 'RFQ % not found', p_rfq_id using errcode = 'P0002'; end if;
  if not exists (select 1 from memberships m where m.org_id = v_rfq.buyer_org_id and m.user_id = v_actor) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if not exists (select 1 from orgs o where o.id = p_supplier_org and o.kind = 'supplier') then
    raise exception 'org % is not a supplier', p_supplier_org using errcode = 'P0001';
  end if;
  insert into invitations (rfq_id, supplier_org_id) values (p_rfq_id, p_supplier_org)
    on conflict (rfq_id, supplier_org_id) do nothing;
  select * into v_inv from invitations where rfq_id = p_rfq_id and supplier_org_id = p_supplier_org;
  return v_inv;
end;
$$;

-- ============================================================================
-- Supplier: submit / save a quote (§A.6, guards V11 + V12).
-- One function upserts the supplier's single live quote (V12) and sets status.
-- ============================================================================
create or replace function submit_quote(
  p_rfq_id          uuid,
  p_unit_price      numeric,
  p_currency        text    default 'INR',
  p_quantity_fulfil numeric default null,
  p_moq             numeric default null,
  p_bulk_lead_time  text    default null,
  p_incoterm        text    default null,
  p_payment_terms   text    default null,
  p_notes           text    default null,
  p_submit          boolean default true    -- false = save draft
) returns quotes language plpgsql security definer set search_path = public as $$
declare
  v_actor  uuid := auth.uid();
  v_org    uuid;
  v_kind   org_kind;
  v_rfq    rfqs;
  v_quote  quotes;
  v_target quote_status := case when p_submit then 'submitted' else 'draft' end;
begin
  select m.org_id, o.kind into v_org, v_kind
    from memberships m join orgs o on o.id = m.org_id
   where m.user_id = v_actor limit 1;
  if v_org is null or v_kind <> 'supplier' then
    raise exception 'only a supplier may quote' using errcode = '42501';
  end if;

  select * into v_rfq from rfqs where id = p_rfq_id;
  if not found then raise exception 'RFQ % not found', p_rfq_id using errcode = 'P0002'; end if;

  if p_submit then
    if v_rfq.status <> 'active' then                                     -- V11
      raise exception 'RFQ % is % (must be active to quote)', p_rfq_id, v_rfq.status using errcode = 'P0001';
    end if;
    if not supplier_is_verified(v_org) then                             -- V11
      raise exception 'supplier must be Onboarding Completed to quote' using errcode = '42501';
    end if;
    if v_rfq.who_can_respond = 'invite'
       and not exists (select 1 from invitations i where i.rfq_id = p_rfq_id and i.supplier_org_id = v_org) then
      raise exception 'not invited to this invite-only RFQ' using errcode = '42501';
    end if;
  end if;

  -- V12: reuse the existing live quote if any (re-submit updates, never duplicates).
  select * into v_quote from quotes
   where rfq_id = p_rfq_id and supplier_org_id = v_org and status not in ('not_selected', 'closed')
   order by created_at desc limit 1;

  if found then
    update quotes set
      unit_price = p_unit_price, currency = coalesce(p_currency, currency),
      quantity_fulfil = p_quantity_fulfil, moq = p_moq, bulk_lead_time = p_bulk_lead_time,
      incoterm = p_incoterm, payment_terms = p_payment_terms, notes = p_notes,
      status = v_target,
      submitted_at = case when p_submit then now() else submitted_at end
    where id = v_quote.id returning * into v_quote;
  else
    insert into quotes (
      rfq_id, supplier_org_id, status, unit_price, currency,
      quantity_fulfil, moq, bulk_lead_time, incoterm, payment_terms, notes, submitted_at
    ) values (
      p_rfq_id, v_org, v_target, p_unit_price, p_currency,
      p_quantity_fulfil, p_moq, p_bulk_lead_time, p_incoterm, p_payment_terms, p_notes,
      case when p_submit then now() else null end
    ) returning * into v_quote;
  end if;
  return v_quote;
end;
$$;

-- ============================================================================
-- Buyer: manual, reversible triage (§A.6). submitted <-> under_review <-> shortlisted.
-- Award (award_quote, 0001) works from ANY non-terminal quote — shortlist optional.
-- ============================================================================
create or replace function set_quote_triage(p_quote_id uuid, p_new_status quote_status)
returns quotes language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); v_quote quotes; v_rfq rfqs;
begin
  if p_new_status not in ('submitted', 'under_review', 'shortlisted') then
    raise exception 'triage target must be submitted / under_review / shortlisted' using errcode = 'P0001';
  end if;
  select * into v_quote from quotes where id = p_quote_id;
  if not found then raise exception 'quote % not found', p_quote_id using errcode = 'P0002'; end if;
  select * into v_rfq from rfqs where id = v_quote.rfq_id for update;
  if not exists (select 1 from memberships m where m.org_id = v_rfq.buyer_org_id and m.user_id = v_actor) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if v_rfq.status <> 'active' then
    raise exception 'RFQ % is % (triage only on active RFQs)', v_rfq.id, v_rfq.status using errcode = 'P0001';
  end if;
  if v_quote.status not in ('submitted', 'under_review', 'shortlisted') then
    raise exception 'quote % is % (not in a triageable state)', p_quote_id, v_quote.status using errcode = 'P0001';
  end if;
  update quotes set status = p_new_status where id = p_quote_id returning * into v_quote;
  return v_quote;
end;
$$;

-- ============================================================================
-- Discovery: real matching-supplier count (§A.8.4) — replaces the hardcoded 14.
-- ADVISORY: verified + optional location + optional min-experience only.
-- ============================================================================
create or replace function match_count(p_preferred_location text default null, p_min_years int default null)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int
    from orgs o
    join supplier_profiles sp on sp.org_id = o.id
   where o.kind = 'supplier'
     and supplier_is_verified(o.id)
     and (p_preferred_location is null or o.location ilike '%' || p_preferred_location || '%')
     and (p_min_years is null or coalesce(sp.years_in_business, 0) >= p_min_years);
$$;

-- ============================================================================
-- RLS + grants
-- ============================================================================

-- RFQ reads: replace 0001's loose (status='active') rule with proper scoping (#9).
drop policy rfqs_read on rfqs;
create policy rfqs_read on rfqs for select using (can_view_rfq(id));

-- Buyers create & edit their own RFQs while in draft; transitions go through functions.
create policy rfqs_insert on rfqs for insert to authenticated
  with check (is_member(buyer_org_id) and status = 'draft');
create policy rfqs_update on rfqs for update to authenticated
  using (is_member(buyer_org_id) and status = 'draft')
  with check (is_member(buyer_org_id) and status = 'draft');

-- Invitations: visible to the invited supplier and to the RFQ's buyer.
alter table invitations enable row level security;
create policy invitations_read on invitations for select using (
  is_member(supplier_org_id)
  or is_member((select r.buyer_org_id from rfqs r where r.id = rfq_id))
);

grant insert, update on rfqs        to authenticated;   -- select already granted in 0001
grant select         on invitations to authenticated;

grant execute on function publish_rfq(uuid)                                     to authenticated;
grant execute on function foreclose_rfq(uuid, text)                             to authenticated;
grant execute on function reopen_rfq(uuid, date)                                to authenticated;
grant execute on function invite_supplier(uuid, uuid)                           to authenticated;
grant execute on function submit_quote(uuid, numeric, text, numeric, numeric, text, text, text, text, boolean) to authenticated;
grant execute on function set_quote_triage(uuid, quote_status)                  to authenticated;
grant execute on function match_count(text, int)                                to authenticated;
grant execute on function supplier_is_verified(uuid)                            to authenticated;
grant execute on function can_view_rfq(uuid)                                    to authenticated;
-- lapse_expired_rfqs is a maintenance job — service_role only, never a buyer action.
grant execute on function lapse_expired_rfqs()                                  to service_role;
