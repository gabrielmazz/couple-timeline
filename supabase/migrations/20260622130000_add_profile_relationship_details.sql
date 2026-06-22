alter table public.profiles
  add column if not exists birth_date date,
  add column if not exists bio text;

alter table public.couples
  add column if not exists relationship_started_at date;

alter table public.profiles
  drop constraint if exists profiles_bio_length_check;

alter table public.profiles
  add constraint profiles_bio_length_check check (bio is null or char_length(bio) <= 500);

create or replace function public.validate_profile_details()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.birth_date is not null and new.birth_date > current_date then
    raise exception 'A data de nascimento não pode estar no futuro.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_profile_details_trigger on public.profiles;
create trigger validate_profile_details_trigger
before insert or update on public.profiles
for each row execute function public.validate_profile_details();

create or replace function public.are_relationship_partners(
  first_user_id uuid,
  second_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.couple_members first_member
    join public.couple_members second_member
      on second_member.couple_id = first_member.couple_id
    where first_member.user_id = first_user_id
      and second_member.user_id = second_user_id
      and first_member.user_id <> second_member.user_id
  );
$$;

revoke execute on function public.are_relationship_partners(uuid, uuid) from public;
grant execute on function public.are_relationship_partners(uuid, uuid) to authenticated;

drop policy if exists "Profiles are readable by owner" on public.profiles;
drop policy if exists "Profiles are readable by owner or linked partner" on public.profiles;
create policy "Profiles are readable by owner or linked partner"
on public.profiles for select
using (
  id = auth.uid()
  or public.are_relationship_partners(auth.uid(), id)
);

create or replace function public.update_relationship_started_at(
  target_couple_id uuid,
  relationship_start_date date
)
returns date
language plpgsql
security definer
set search_path = public
as $$
declare
  root_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Você precisa estar autenticado para atualizar o relacionamento.';
  end if;

  root_id := public.get_root_couple_id(target_couple_id);

  if root_id is null or not public.can_edit_couple(root_id) then
    raise exception 'Você não tem permissão para atualizar este relacionamento.';
  end if;

  if relationship_start_date is not null and relationship_start_date > current_date then
    raise exception 'A data do relacionamento não pode estar no futuro.';
  end if;

  update public.couples
  set relationship_started_at = relationship_start_date
  where id = root_id;

  return relationship_start_date;
end;
$$;

revoke execute on function public.update_relationship_started_at(uuid, date) from public;
grant execute on function public.update_relationship_started_at(uuid, date) to authenticated;
