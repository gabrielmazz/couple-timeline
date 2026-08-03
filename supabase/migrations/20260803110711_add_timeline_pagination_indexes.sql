-- Supports the timeline's keyset pagination, which filters by timeline and
-- orders deterministically by event_date and id.
create index if not exists timeline_events_couple_event_date_id_idx
  on public.timeline_events(couple_id, event_date, id);

-- Keeps the authenticated membership lookup index-only for the common path.
create index if not exists couple_members_couple_user_role_idx
  on public.couple_members(couple_id, user_id) include (role);

-- Covers the existing foreign key and removes the database advisor warning.
create index if not exists timeline_events_created_by_idx
  on public.timeline_events(created_by);

-- Returns only the metadata needed to populate the year filter. The function
-- runs as the caller, so the table's RLS policies remain in force.
create or replace function public.list_timeline_years(target_couple_ids uuid[])
returns table(year integer)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct timeline_event.year
  from public.timeline_events timeline_event
  where timeline_event.couple_id = any(target_couple_ids)
  order by timeline_event.year;
$$;

revoke execute on function public.list_timeline_years(uuid[]) from public;
grant execute on function public.list_timeline_years(uuid[]) to anon, authenticated, service_role;
