-- ============================================================================
-- SourceSutra — migration 0011: email delivery (BP-2 · INT-3).
--
-- notify() (0005) already fans every event into a channel='email' row alongside
-- the in-app one; nothing has ever consumed those rows. This migration adds the
-- missing piece the Edge Function (supabase/functions/send-notification-emails)
-- needs: a sent_at marker to find unsent rows, and a way to resolve an org to
-- its members' email addresses without exposing auth.users over PostgREST.
-- ============================================================================

alter table notifications add column sent_at timestamptz;

-- Fast lookup for the sender's "give me what's unsent" query.
create index notifications_unsent_email on notifications (created_at)
  where channel = 'email' and sent_at is null;

-- SECURITY DEFINER so the (service_role-only) email sender can resolve an org's
-- member emails via a normal RPC call, without needing direct PostgREST access
-- to the auth schema (which Supabase doesn't expose over the REST API at all).
create or replace function get_org_member_emails(p_org uuid)
returns table (email text)
language sql stable security definer set search_path = public as $$
  select u.email
  from memberships m
  join auth.users u on u.id = m.user_id
  where m.org_id = p_org and u.email is not null;
$$;

-- Only the email-sending Edge Function (running with the service_role key) may
-- call this — it returns real email addresses, so it must never be reachable
-- by an ordinary authenticated user.
revoke all on function get_org_member_emails(uuid) from public, authenticated;
grant execute on function get_org_member_emails(uuid) to service_role;
