create table if not exists public.future_moments (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  title text not null,
  description text,
  category text not null default 'Sonho',
  status text not null default 'planned',
  target_date date,
  location_name text,
  completed_at timestamptz,
  completed_event_id uuid references public.timeline_events(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint future_moments_title_length_check
    check (char_length(trim(title)) between 2 and 120),
  constraint future_moments_description_length_check
    check (description is null or char_length(description) <= 5000),
  constraint future_moments_location_length_check
    check (location_name is null or char_length(location_name) <= 120),
  constraint future_moments_category_check
    check (category in ('Viagem', 'Lugar', 'Restaurante', 'Filme ou série', 'Meta', 'Sonho', 'Outro')),
  constraint future_moments_status_check
    check (status in ('planned', 'in_progress', 'completed'))
);

create index if not exists future_moments_couple_status_date_idx
  on public.future_moments(couple_id, status, target_date, id);

drop trigger if exists set_future_moments_updated_at on public.future_moments;
create trigger set_future_moments_updated_at
before update on public.future_moments
for each row execute function public.set_updated_at();

alter table public.future_moments enable row level security;

revoke all on table public.future_moments from anon, authenticated;
grant select, insert, update, delete on table public.future_moments to authenticated;

drop policy if exists "Couple members can read future moments" on public.future_moments;
create policy "Couple members can read future moments"
on public.future_moments for select
to authenticated
using (public.can_edit_couple(couple_id));

drop policy if exists "Couple members can create future moments" on public.future_moments;
create policy "Couple members can create future moments"
on public.future_moments for insert
to authenticated
with check (public.can_edit_couple(couple_id) and created_by = auth.uid());

drop policy if exists "Couple members can update future moments" on public.future_moments;
create policy "Couple members can update future moments"
on public.future_moments for update
to authenticated
using (public.can_edit_couple(couple_id))
with check (public.can_edit_couple(couple_id));

drop policy if exists "Couple members can delete future moments" on public.future_moments;
create policy "Couple members can delete future moments"
on public.future_moments for delete
to authenticated
using (public.can_edit_couple(couple_id));

create or replace function public.complete_future_moment(target_moment_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  future_moment public.future_moments%rowtype;
  created_event_id uuid;
  event_date_value date;
  event_category text;
begin
  select *
  into future_moment
  from public.future_moments
  where id = target_moment_id;

  if not found or not public.can_edit_couple(future_moment.couple_id) then
    raise exception 'Momento futuro não encontrado ou sem permissão de edição.';
  end if;

  if future_moment.completed_event_id is not null then
    return future_moment.completed_event_id;
  end if;

  event_date_value := coalesce(future_moment.target_date, current_date);
  event_category := case when future_moment.category = 'Viagem' then 'Viagem' else 'Outro' end;

  insert into public.timeline_events (
    couple_id,
    event_date,
    year,
    title,
    description,
    location_name,
    category,
    created_by
  )
  values (
    future_moment.couple_id,
    event_date_value,
    extract(year from event_date_value)::integer,
    future_moment.title,
    future_moment.description,
    future_moment.location_name,
    event_category,
    auth.uid()
  )
  returning id into created_event_id;

  update public.future_moments
  set status = 'completed',
      completed_at = now(),
      completed_event_id = created_event_id
  where id = target_moment_id;

  return created_event_id;
end;
$$;

revoke execute on function public.complete_future_moment(uuid) from public;
grant execute on function public.complete_future_moment(uuid) to authenticated;

grant select, insert, update, delete on table public.future_moments to service_role;
