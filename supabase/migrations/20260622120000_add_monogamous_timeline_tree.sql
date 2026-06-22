alter table public.couples
  add column if not exists parent_id uuid references public.couples(id) on delete cascade;

with ranked_couples as (
  select
    id,
    first_value(id) over (
      partition by created_by
      order by created_at asc, id asc
    ) as root_id,
    row_number() over (
      partition by created_by
      order by created_at asc, id asc
    ) as position
  from public.couples
  where created_by is not null
)
update public.couples as child
set parent_id = ranked.root_id
from ranked_couples as ranked
where child.id = ranked.id
  and ranked.position > 1;

update public.couples as child
set visibility = root.visibility
from public.couples as root
where child.parent_id = root.id;

do $$
begin
  if exists (
    select relationship.root_id
    from (
      select
        coalesce(c.parent_id, c.id) as root_id,
        cm.user_id,
        root.created_by
      from public.couple_members cm
      join public.couples c on c.id = cm.couple_id
      join public.couples root on root.id = coalesce(c.parent_id, c.id)
    ) as relationship
    where relationship.user_id is distinct from relationship.created_by
    group by relationship.root_id
    having count(distinct relationship.user_id) > 1
  ) then
    raise exception 'Migração interrompida: existe uma timeline com mais de uma pessoa vinculada.';
  end if;

  if exists (
    with effective_memberships as (
      select cm.user_id, coalesce(c.parent_id, c.id) as root_id
      from public.couple_members cm
      join public.couples c on c.id = cm.couple_id

      union

      select c.created_by as user_id, coalesce(c.parent_id, c.id) as root_id
      from public.couples c
      where c.created_by is not null
    )
    select effective_memberships.user_id
    from effective_memberships
    group by effective_memberships.user_id
    having count(distinct effective_memberships.root_id) > 1
  ) then
    raise exception 'Migração interrompida: existe um usuário vinculado a mais de um relacionamento.';
  end if;
end;
$$;

insert into public.couple_members (couple_id, user_id, role, created_at)
select
  root.id,
  cm.user_id,
  case when cm.user_id = root.created_by then 'owner' else 'partner' end,
  min(cm.created_at)
from public.couple_members cm
join public.couples c on c.id = cm.couple_id
join public.couples root on root.id = coalesce(c.parent_id, c.id)
group by root.id, root.created_by, cm.user_id
on conflict (couple_id, user_id) do update
set role = excluded.role;

insert into public.couple_members (couple_id, user_id, role)
select c.id, c.created_by, 'owner'
from public.couples c
where c.parent_id is null
  and c.created_by is not null
on conflict (couple_id, user_id) do update
set role = 'owner';

delete from public.couple_members cm
using public.couples c
where cm.couple_id = c.id
  and c.parent_id is not null;

alter table public.couple_members
  drop constraint if exists couple_members_role_check;

alter table public.couple_members
  add constraint couple_members_role_check check (role in ('owner', 'partner'));

alter table public.couples
  drop constraint if exists couples_parent_not_self_check;

alter table public.couples
  add constraint couples_parent_not_self_check check (parent_id is null or parent_id <> id);

create unique index if not exists couples_one_root_per_creator_idx
  on public.couples(created_by)
  where parent_id is null and created_by is not null;

create index if not exists couples_parent_id_idx on public.couples(parent_id);

create unique index if not exists couple_members_one_relationship_per_user_idx
  on public.couple_members(user_id);

create unique index if not exists couple_members_one_owner_idx
  on public.couple_members(couple_id)
  where role = 'owner';

create unique index if not exists couple_members_one_partner_idx
  on public.couple_members(couple_id)
  where role = 'partner';

create or replace function public.validate_couple_hierarchy()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_timeline public.couples%rowtype;
begin
  if tg_op = 'UPDATE' then
    if new.parent_id is distinct from old.parent_id then
      raise exception 'A hierarquia de uma timeline existente não pode ser alterada.';
    end if;

    if new.created_by is distinct from old.created_by then
      raise exception 'O proprietário de uma timeline não pode ser alterado.';
    end if;
  end if;

  if new.parent_id is not null then
    select *
    into parent_timeline
    from public.couples
    where id = new.parent_id;

    if not found then
      raise exception 'Timeline principal não encontrada.';
    end if;

    if parent_timeline.parent_id is not null then
      raise exception 'Uma timeline filha não pode possuir outras timelines.';
    end if;

    new.created_by := parent_timeline.created_by;
    new.visibility := parent_timeline.visibility;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_couple_hierarchy_trigger on public.couples;
create trigger validate_couple_hierarchy_trigger
before insert or update on public.couples
for each row execute function public.validate_couple_hierarchy();

create or replace function public.sync_child_timeline_visibility()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.parent_id is null and new.visibility is distinct from old.visibility then
    update public.couples
    set visibility = new.visibility
    where parent_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_child_timeline_visibility_trigger on public.couples;
create trigger sync_child_timeline_visibility_trigger
after update of visibility on public.couples
for each row execute function public.sync_child_timeline_visibility();

create or replace function public.validate_root_membership()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_timeline public.couples%rowtype;
begin
  select *
  into target_timeline
  from public.couples
  where id = new.couple_id;

  if not found or target_timeline.parent_id is not null then
    raise exception 'Os vínculos devem pertencer à timeline principal.';
  end if;

  if new.role = 'owner' and new.user_id is distinct from target_timeline.created_by then
    raise exception 'O proprietário do vínculo deve ser o criador da timeline principal.';
  end if;

  if new.role = 'partner' and new.user_id is not distinct from target_timeline.created_by then
    raise exception 'O proprietário não pode ser vinculado como parceiro.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_root_membership_trigger on public.couple_members;
create trigger validate_root_membership_trigger
before insert or update on public.couple_members
for each row execute function public.validate_root_membership();

create or replace function public.get_root_couple_id(target_couple_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(c.parent_id, c.id)
  from public.couples c
  where c.id = target_couple_id;
$$;

create or replace function public.is_couple_member(target_couple_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.couple_members cm
    where cm.couple_id = public.get_root_couple_id(target_couple_id)
      and cm.user_id = auth.uid()
  );
$$;

create or replace function public.can_read_couple(target_couple_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.couples root
    where root.id = public.get_root_couple_id(target_couple_id)
      and (
        root.visibility = 'public'
        or root.created_by = auth.uid()
        or public.is_couple_member(root.id)
      )
  );
$$;

create or replace function public.is_couple_owner(target_couple_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.couple_members cm
    where cm.couple_id = public.get_root_couple_id(target_couple_id)
      and cm.user_id = auth.uid()
      and cm.role = 'owner'
  );
$$;

create or replace function public.can_edit_couple(target_couple_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.couple_members cm
    where cm.couple_id = public.get_root_couple_id(target_couple_id)
      and cm.user_id = auth.uid()
      and cm.role in ('owner', 'partner')
  );
$$;

create or replace function public.create_couple_timeline(
  timeline_name text,
  timeline_visibility text default 'private'
)
returns public.couples
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_root public.couples%rowtype;
  membership_role text;
  created_timeline public.couples%rowtype;
  normalized_name text := trim(timeline_name);
  generated_slug text;
begin
  if current_user_id is null then
    raise exception 'Você precisa estar autenticado para criar uma timeline.';
  end if;

  if char_length(normalized_name) < 2 then
    raise exception 'Informe um nome com pelo menos 2 caracteres.';
  end if;

  if coalesce(timeline_visibility, 'private') not in ('private', 'public') then
    raise exception 'Visibilidade inválida.';
  end if;

  select c.*
  into current_root
  from public.couple_members cm
  join public.couples c on c.id = cm.couple_id
  where cm.user_id = current_user_id
    and c.parent_id is null
  limit 1;

  generated_slug := 'timeline-' || substr(gen_random_uuid()::text, 1, 8);

  if current_root.id is null then
    insert into public.couples (name, slug, visibility, created_by)
    values (normalized_name, generated_slug, coalesce(timeline_visibility, 'private'), current_user_id)
    returning * into created_timeline;

    insert into public.couple_members (couple_id, user_id, role)
    values (created_timeline.id, current_user_id, 'owner');
  else
    select cm.role
    into membership_role
    from public.couple_members cm
    where cm.couple_id = current_root.id
      and cm.user_id = current_user_id;

    if membership_role <> 'owner' then
      raise exception 'Apenas o proprietário pode criar timelines vinculadas.';
    end if;

    insert into public.couples (name, slug, visibility, created_by, parent_id)
    values (
      normalized_name,
      generated_slug,
      current_root.visibility,
      current_root.created_by,
      current_root.id
    )
    returning * into created_timeline;
  end if;

  return created_timeline;
end;
$$;

create or replace function public.add_couple_member_by_email(
  target_couple_id uuid,
  member_email text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  root_id uuid;
  target_user_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Você precisa estar autenticado para adicionar uma pessoa.';
  end if;

  root_id := public.get_root_couple_id(target_couple_id);

  if root_id is null then
    raise exception 'Timeline principal não encontrada.';
  end if;

  if not public.is_couple_owner(root_id) then
    raise exception 'Apenas o proprietário pode vincular uma pessoa.';
  end if;

  if exists (
    select 1 from public.couple_members
    where couple_id = root_id and role = 'partner'
  ) then
    raise exception 'Este relacionamento já possui uma pessoa vinculada.';
  end if;

  select p.id
  into target_user_id
  from public.profiles p
  where lower(p.email) = lower(trim(member_email))
  limit 1;

  if target_user_id is null then
    raise exception 'Nenhuma conta foi encontrada com este e-mail. A pessoa precisa se cadastrar primeiro.';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'Você não pode vincular a própria conta.';
  end if;

  if exists (
    select 1 from public.couple_members where user_id = target_user_id
  ) then
    raise exception 'Esta pessoa já pertence a outro relacionamento.';
  end if;

  insert into public.couple_members (couple_id, user_id, role)
  values (root_id, target_user_id, 'partner');

  return target_user_id;
end;
$$;

revoke execute on function public.create_couple_timeline(text, text) from public;
grant execute on function public.create_couple_timeline(text, text) to authenticated;

revoke execute on function public.add_couple_member_by_email(uuid, text) from public;
grant execute on function public.add_couple_member_by_email(uuid, text) to authenticated;

drop policy if exists "Authenticated users can create couples" on public.couples;

drop policy if exists "Couples can be read by members or public visitors" on public.couples;
create policy "Couples can be read by members or public visitors"
on public.couples for select
using (public.can_read_couple(id));

drop policy if exists "Creators can add first member" on public.couple_members;
drop policy if exists "Owners can add memberships" on public.couple_members;
drop policy if exists "Owners can manage memberships" on public.couple_members;
drop policy if exists "Owners can remove memberships" on public.couple_members;

drop policy if exists "Members can read own memberships" on public.couple_members;
create policy "Members can read own memberships"
on public.couple_members for select
using (user_id = auth.uid() or public.is_couple_member(couple_id));
