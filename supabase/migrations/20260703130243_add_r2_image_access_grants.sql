-- Explicit Data API grants for projects where new public schema objects are
-- not auto-exposed. RLS policies remain the authorization boundary.
grant usage on schema public to anon, authenticated, service_role;

grant select on table
  public.couples,
  public.timeline_events,
  public.timeline_photos
to anon;

grant select on table
  public.profiles,
  public.couples,
  public.couple_members,
  public.timeline_events,
  public.timeline_photos
to authenticated;

grant insert, update on table public.profiles to authenticated;
grant insert, update, delete on table public.timeline_events to authenticated;
grant insert, update, delete on table public.timeline_photos to authenticated;

grant select, insert, update, delete on table
  public.profiles,
  public.couples,
  public.couple_members,
  public.timeline_events,
  public.timeline_photos
to service_role;

revoke execute on function public.can_read_couple(uuid) from public;
revoke execute on function public.can_edit_couple(uuid) from public;
grant execute on function public.can_read_couple(uuid) to anon, authenticated, service_role;
grant execute on function public.can_edit_couple(uuid) to authenticated, service_role;
grant execute on function public.create_couple_timeline(text, text) to authenticated, service_role;
grant execute on function public.add_couple_member_by_email(uuid, text) to authenticated, service_role;
grant execute on function public.update_relationship_started_at(uuid, date) to authenticated, service_role;

create index if not exists timeline_photos_storage_path_idx
  on public.timeline_photos(storage_path);
