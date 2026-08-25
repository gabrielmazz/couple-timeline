create table public.couple_calendar_entries (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  title text not null,
  description text,
  event_date date not null,
  event_time time,
  location_name text,
  category text not null default 'other',
  reminder_days_before smallint not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint couple_calendar_entries_title_length_check
    check (char_length(trim(title)) between 2 and 120),
  constraint couple_calendar_entries_description_length_check
    check (description is null or char_length(description) <= 2000),
  constraint couple_calendar_entries_location_length_check
    check (location_name is null or char_length(location_name) <= 120),
  constraint couple_calendar_entries_category_check
    check (category in ('trip', 'reservation', 'appointment', 'special_date', 'other')),
  constraint couple_calendar_entries_reminder_days_check
    check (reminder_days_before between 0 and 30)
);

create index couple_calendar_entries_couple_date_id_idx
  on public.couple_calendar_entries(couple_id, event_date, id);

create trigger set_couple_calendar_entries_updated_at
before update on public.couple_calendar_entries
for each row execute function public.set_updated_at();

alter table public.couple_calendar_entries enable row level security;

revoke all on table public.couple_calendar_entries from anon, authenticated;
grant select, insert, update, delete on table public.couple_calendar_entries to authenticated;
grant select, insert, update, delete on table public.couple_calendar_entries to service_role;

create policy "Couple members can read calendar entries"
on public.couple_calendar_entries for select
to authenticated
using (public.can_edit_couple(couple_id));

create policy "Couple members can create calendar entries"
on public.couple_calendar_entries for insert
to authenticated
with check (public.can_edit_couple(couple_id) and created_by = auth.uid());

create policy "Couple members can update calendar entries"
on public.couple_calendar_entries for update
to authenticated
using (public.can_edit_couple(couple_id))
with check (public.can_edit_couple(couple_id));

create policy "Couple members can delete calendar entries"
on public.couple_calendar_entries for delete
to authenticated
using (public.can_edit_couple(couple_id));
