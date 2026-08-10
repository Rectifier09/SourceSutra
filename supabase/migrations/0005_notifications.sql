-- ============================================================================
-- SourceSutra — Phase 3: Notifications & invitations (bizlogic.md Part C.4)
-- Builds on 0001–0004. Wires the marketplace's state transitions to the people
-- who need to know, WITHOUT touching the existing state-machine functions:
--
--   domain table change --(emit trigger)--> domain_events --(consumer)--> notifications
--
--   * emit triggers on quotes / rfqs / invitations append domain_events (§B.4)
--     (section events already emitted in 0004)
--   * one consumer fans every event out to the right recipient(s) (§B.7):
--     new application (buyer), award/not-selected (suppliers), remediation,
--     onboarding complete, invitation received, publish, foreclose, lapse, reopen
--   * channels = in-app + email (settled decision #11); WhatsApp deferred
--   * respond_invitation() + v_my_invitations (the supplier Invitations tab)
--   * schedule the lapse sweeper via pg_cron (guarded — falls back to an Edge fn)
-- ============================================================================

create type notification_channel as enum ('in_app', 'email');

create table notifications (
  id           bigint generated always as identity primary key,
  org_id       uuid not null references orgs(id) on delete cascade,   -- recipient org
  type         text not null,
  title        text not null,
  body         text,
  channel      notification_channel not null default 'in_app',
  ref_rfq_id   uuid references rfqs(id) on delete cascade,
  ref_quote_id uuid references quotes(id) on delete cascade,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index notifications_inbox on notifications (org_id, created_at desc);

-- Deliver one row per configured channel (in-app + email). SECURITY DEFINER so the
-- event consumer can write to any recipient's inbox regardless of RLS.
create or replace function notify(
  p_org uuid, p_type text, p_title text, p_body text default null,
  p_rfq uuid default null, p_quote uuid default null
) returns void language sql security definer set search_path = public as $$
  insert into notifications (org_id, type, title, body, channel, ref_rfq_id, ref_quote_id)
  select p_org, p_type, p_title, p_body, ch, p_rfq, p_quote
  from unnest(array['in_app', 'email']::notification_channel[]) as ch
  where p_org is not null;
$$;

-- ============================================================================
-- The consumer: one place that maps every domain event -> recipients (§B.7).
-- ============================================================================
create or replace function trg_notify_on_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_rfq rfqs; r record; v_kind text := coalesce(new.payload->>'kind', 'section');
begin
  if new.type = 'SectionSubmitted' then
    perform notify(new.org_id, new.type, 'Verification in progress',
                   'We''re reviewing your ' || v_kind || ' section.');
  elsif new.type = 'SectionVerified' then
    perform notify(new.org_id, new.type, 'Section verified',
                   initcap(v_kind) || ' is verified.');
  elsif new.type = 'SectionRemediation' then
    perform notify(new.org_id, new.type, 'Action needed',
                   'Your ' || v_kind || ' section needs corrections before it can be verified.');
  elsif new.type = 'SupplierOnboarded' then
    perform notify(new.org_id, new.type, 'Marketplace unlocked',
                   'You''re verified — you can now discover RFQs and submit quotes.');

  elsif new.type = 'RfqPublished' then
    select * into v_rfq from rfqs where id = new.ref_rfq_id;
    for r in
      select o.id as org_id from orgs o
       where o.kind = 'supplier' and supplier_is_verified(o.id)
         and (v_rfq.who_can_respond <> 'invite'
              or exists (select 1 from invitations i where i.rfq_id = v_rfq.id and i.supplier_org_id = o.id))
    loop
      perform notify(r.org_id, new.type, 'New RFQ: ' || v_rfq.title,
                     'A buyer published an RFQ you''re eligible to quote on.', v_rfq.id);
    end loop;

  elsif new.type = 'QuoteSubmitted' then
    perform notify((select buyer_org_id from rfqs where id = new.ref_rfq_id), new.type,
                   'New application', 'A supplier submitted a quote on your RFQ.',
                   new.ref_rfq_id, new.ref_quote_id);
  elsif new.type = 'QuoteAwarded' then
    perform notify(new.org_id, new.type, 'You won the RFQ',
                   'Your quote was awarded. The buyer will be in touch.', new.ref_rfq_id, new.ref_quote_id);
  elsif new.type = 'QuoteRejected' then
    perform notify(new.org_id, new.type, 'Not selected',
                   'Your quote was not selected for this RFQ.', new.ref_rfq_id, new.ref_quote_id);
  elsif new.type = 'QuoteClosed' then
    perform notify(new.org_id, new.type, 'RFQ closed',
                   'This RFQ was awarded to another supplier or closed.', new.ref_rfq_id, new.ref_quote_id);

  elsif new.type = 'RfqAwarded' then
    perform notify(new.org_id, new.type, 'RFQ awarded',
                   'You awarded this RFQ. It''s now closed to new quotes.', new.ref_rfq_id);
  elsif new.type = 'RfqForeclosed' then
    for r in select distinct supplier_org_id as org_id from quotes where rfq_id = new.ref_rfq_id loop
      perform notify(r.org_id, new.type, 'RFQ closed early',
                     'A buyer closed an RFQ you quoted on.', new.ref_rfq_id);
    end loop;
  elsif new.type = 'RfqLapsed' then
    perform notify(new.org_id, new.type, 'RFQ lapsed',
                   'Your RFQ''s bid window closed. You can reopen it with a new end date.', new.ref_rfq_id);
  elsif new.type = 'RfqReopened' then
    for r in select distinct supplier_org_id as org_id from quotes where rfq_id = new.ref_rfq_id loop
      perform notify(r.org_id, new.type, 'RFQ reopened',
                     'A buyer reopened an RFQ — you can still update or place a quote.', new.ref_rfq_id);
    end loop;

  elsif new.type = 'SupplierInvited' then
    perform notify(new.org_id, new.type, 'You''re invited to an RFQ',
                   'A buyer invited you to submit a quote.', new.ref_rfq_id);
  elsif new.type = 'InvitationResponded' then
    perform notify((select buyer_org_id from rfqs where id = new.ref_rfq_id), new.type,
                   'Invitation response', 'A supplier responded to your invitation.', new.ref_rfq_id);
  end if;
  return new;
end;
$$;

create trigger notify_on_event after insert on domain_events
  for each row execute function trg_notify_on_event();

-- ============================================================================
-- Emit triggers: translate state transitions into domain_events (§B.4).
-- (Existing 0001/0003 functions are untouched — the triggers observe their writes.)
-- ============================================================================
create or replace function trg_quote_events()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then return new; end if;
  if new.status = 'submitted' then
    perform emit_event('QuoteSubmitted', new.supplier_org_id, new.rfq_id, new.id);
  elsif new.status = 'awarded' then
    perform emit_event('QuoteAwarded', new.supplier_org_id, new.rfq_id, new.id);
  elsif new.status = 'not_selected' then
    perform emit_event('QuoteRejected', new.supplier_org_id, new.rfq_id, new.id);
  elsif new.status = 'closed' then
    perform emit_event('QuoteClosed', new.supplier_org_id, new.rfq_id, new.id);
  end if;
  return new;
end;
$$;
create trigger quote_events after insert or update on quotes
  for each row execute function trg_quote_events();

create or replace function trg_rfq_events()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is not distinct from old.status then return new; end if;
  if    new.status = 'active'     and old.status = 'draft'  then
    perform emit_event('RfqPublished', new.buyer_org_id, new.id);
  elsif new.status = 'active'     and old.status = 'lapsed' then
    perform emit_event('RfqReopened', new.buyer_org_id, new.id);
  elsif new.status = 'awarded'    then perform emit_event('RfqAwarded',    new.buyer_org_id, new.id);
  elsif new.status = 'foreclosed' then perform emit_event('RfqForeclosed', new.buyer_org_id, new.id);
  elsif new.status = 'lapsed'     then perform emit_event('RfqLapsed',     new.buyer_org_id, new.id);
  end if;
  return new;
end;
$$;
create trigger rfq_events after update on rfqs
  for each row execute function trg_rfq_events();

create or replace function trg_invitation_events()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform emit_event('SupplierInvited', new.supplier_org_id, new.rfq_id);
  return new;
end;
$$;
create trigger invitation_events after insert on invitations
  for each row execute function trg_invitation_events();

-- ============================================================================
-- Supplier: accept / decline an invitation (§A.8.6). Own org only.
-- ============================================================================
create or replace function respond_invitation(p_rfq_id uuid, p_accept boolean)
returns invitations language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_kind org_kind; v_inv invitations;
begin
  select m.org_id, o.kind into v_org, v_kind
    from memberships m join orgs o on o.id = m.org_id where m.user_id = auth.uid() limit 1;
  if v_org is null or v_kind <> 'supplier' then
    raise exception 'only a supplier may respond to an invitation' using errcode = '42501';
  end if;
  select * into v_inv from invitations where rfq_id = p_rfq_id and supplier_org_id = v_org;
  if not found then
    raise exception 'no invitation for this RFQ' using errcode = 'P0002';
  end if;
  update invitations set status = (case when p_accept then 'responded' else 'declined' end)::invitation_status
    where rfq_id = p_rfq_id and supplier_org_id = v_org returning * into v_inv;
  perform emit_event('InvitationResponded', v_org, p_rfq_id, null,
                     jsonb_build_object('accept', p_accept));
  return v_inv;
end;
$$;

-- The supplier's Invitations tab: RFQs they were invited to (any state).
create view v_my_invitations with (security_invoker = on) as
  select i.rfq_id, i.status as invitation_status, i.created_at,
         r.title, r.bid_end, r.status as rfq_status
  from invitations i
  join rfqs r on r.id = i.rfq_id
  where is_member(i.supplier_org_id);

-- ============================================================================
-- RLS + grants
-- ============================================================================
alter table notifications enable row level security;
create policy notifications_read   on notifications for select using (is_member(org_id));
create policy notifications_update on notifications for update
  using (is_member(org_id)) with check (is_member(org_id));   -- mark-as-read

grant select, update on notifications   to authenticated;
grant select         on v_my_invitations to authenticated;
grant execute on function respond_invitation(uuid, boolean) to authenticated;
-- notify() + the trigger functions are internal (SECURITY DEFINER, trigger-fired).

-- ============================================================================
-- Schedule the bid-window lapse sweeper (§A.5/§B.9). pg_cron may be unavailable
-- in a given environment; guard so a missing extension never fails the migration.
-- Fallback: run select lapse_expired_rfqs(); from a Supabase scheduled Edge Function.
-- ============================================================================
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('sourcesutra-lapse-rfqs', '*/15 * * * *', 'select public.lapse_expired_rfqs();');
  raise notice 'Phase 3: scheduled lapse sweeper via pg_cron (every 15 min).';
exception when others then
  raise notice 'Phase 3: pg_cron unavailable (%). Schedule lapse_expired_rfqs() via a Supabase scheduled Edge Function instead.', sqlerrm;
end;
$$;
