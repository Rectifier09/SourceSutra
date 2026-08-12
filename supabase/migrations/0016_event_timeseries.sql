-- ============================================================================
-- SourceSutra — migration 0016: bucketed event history for the /admin
-- dashboard's time-series/persona-mix/heatmap charts.
--
-- Same safety shape as get_event_counts() (0015): aggregate-only (bucket/
-- type/kind/count), never org_id/ref_rfq_id/ref_quote_id/full payload, so
-- granting execute to `authenticated` can't leak any one org's activity —
-- the real access control stays the /admin route's email allow-list.
-- ============================================================================
create or replace function get_event_timeseries(p_granularity text)
returns table (bucket timestamptz, type text, kind text, count bigint)
language plpgsql security definer set search_path = public as $$
begin
  if p_granularity not in ('day', 'week', 'month', 'quarter', 'year') then
    raise exception 'get_event_timeseries: granularity % not allowed', p_granularity using errcode = '22023';
  end if;

  return query
    select date_trunc(p_granularity, de.created_at), de.type, de.payload->>'kind', count(*)
    from domain_events de
    group by 1, 2, 3
    order by 1;
end;
$$;

grant execute on function get_event_timeseries(text) to authenticated;
