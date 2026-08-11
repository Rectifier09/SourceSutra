-- ============================================================================
-- SourceSutra — migration 0012: OAuth signup provisioning (BP-2 · INT-4).
--
-- supabase.auth.signInWithOAuth() has no equivalent of signUp()'s `options.data`
-- — a Google identity only ever reaches provision_account() (0002) with
-- Google's own claims (full_name/name/email/avatar_url/...), never our app's
-- role/company/phone/products_sourced/consent_version. handle_new_user() still
-- fires unconditionally and provisions a *buyer* org from just those claims
-- (the safe default — coalesce(role, 'buyer') already does this, no change
-- needed there).
--
-- finish_oauth_signup() lets the app correct that default immediately after
-- the OAuth callback, once it knows what the user actually picked (buyer vs
-- supplier) and the extra fields OAuth couldn't carry. It's intentionally
-- time-boxed to org creation + 10 minutes so it can't be replayed against an
-- account that's already in real use.
-- ============================================================================

create or replace function finish_oauth_signup(
  p_role             org_kind,
  p_company          text,
  p_phone            text default null,
  p_products         text[] default '{}',
  p_consent_version  text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user         uuid := auth.uid();
  v_org          uuid;
  v_current_kind org_kind;
  v_created_at   timestamptz;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select o.id, o.kind, o.created_at into v_org, v_current_kind, v_created_at
    from memberships m join orgs o on o.id = m.org_id
    where m.user_id = v_user;

  if v_org is null then
    raise exception 'no org found for current user' using errcode = 'P0001';
  end if;

  if v_created_at < now() - interval '10 minutes' then
    raise exception 'finish_oauth_signup can only run shortly after signup' using errcode = 'P0001';
  end if;

  if v_current_kind <> p_role then
    if v_current_kind = 'supplier' then
      delete from onboarding_sections where org_id = v_org;
      delete from supplier_profiles where org_id = v_org;
    else
      delete from buyer_accounts where org_id = v_org;
    end if;

    update orgs set kind = p_role where id = v_org;
    update profiles set role = p_role where id = v_user;

    if p_role = 'supplier' then
      insert into supplier_profiles (org_id) values (v_org);
      insert into onboarding_sections (org_id, kind, status, weight) values
        (v_org, 'identity',   'not_started', 40),
        (v_org, 'financials', 'not_started', 40),
        (v_org, 'portfolio',  'not_started', 20);
    end if;
  end if;

  update orgs set name = coalesce(nullif(p_company, ''), name) where id = v_org;

  if p_role = 'buyer' then
    insert into buyer_accounts (org_id, products_sourced, phone, consent_version, consent_at)
    values (
      v_org, coalesce(p_products, '{}'), p_phone, p_consent_version,
      case when p_consent_version is not null then now() else null end
    )
    on conflict (org_id) do update set
      products_sourced = excluded.products_sourced,
      phone             = coalesce(excluded.phone, buyer_accounts.phone),
      consent_version   = coalesce(excluded.consent_version, buyer_accounts.consent_version),
      consent_at        = coalesce(buyer_accounts.consent_at, excluded.consent_at);
  end if;
end;
$$;

revoke all on function finish_oauth_signup(org_kind, text, text, text[], text) from public;
grant execute on function finish_oauth_signup(org_kind, text, text, text[], text) to authenticated;
