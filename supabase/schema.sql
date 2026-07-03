create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.couples (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  visibility text not null default 'private' check (visibility in ('public', 'private')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.couple_members (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('owner', 'partner', 'viewer')),
  created_at timestamptz not null default now(),
  unique (couple_id, user_id)
);

alter table public.couple_members
  alter column role set default 'viewer';

alter table public.couple_members
  drop constraint if exists couple_members_role_check;

alter table public.couple_members
  add constraint couple_members_role_check check (role in ('owner', 'partner', 'viewer'));

create table if not exists public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  event_date date not null,
  year integer not null,
  title text not null,
  subtitle text,
  description text,
  location_name text,
  event_time text,
  category text,
  tags text[] not null default '{}',
  music_url text,
  cover_photo_path text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.timeline_events
  add column if not exists subtitle text,
  add column if not exists location_name text,
  add column if not exists event_time text,
  add column if not exists category text,
  add column if not exists tags text[] not null default '{}';

alter table public.timeline_events
  drop constraint if exists timeline_events_category_check;

alter table public.timeline_events
  add constraint timeline_events_category_check check (category in (
    'Primeiro encontro', 'Primeiro beijo', 'Início do namoro', 'Pedido de namoro',
    'Noivado', 'Pedido de casamento', 'Viagem', 'Fim de semana', 'Passeio', 'Praia',
    'Aventura', 'Lua de mel', 'Aniversário', 'Aniversário de namoro',
    'Aniversário de casamento', 'Pedido', 'Casamento', 'Jantar', 'Almoço', 'Café',
    'Piquenique', 'Cinema', 'Teatro', 'Show', 'Festival', 'Festa', 'Natal', 'Ano Novo',
    'Dia dos Namorados', 'Presente', 'Surpresa', 'Conquista', 'Formatura', 'Novo emprego',
    'Casa nova', 'Mudança', 'Adoção de pet', 'Família', 'Amigos',
    'Sessão de fotos', 'Reconciliação', 'Dia comum especial', 'Outro'
  ));

create table if not exists public.timeline_photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.timeline_events(id) on delete cascade,
  storage_path text not null,
  position integer default 0,
  caption text,
  created_at timestamptz not null default now()
);

create index if not exists couples_created_by_idx on public.couples(created_by);
create index if not exists couples_visibility_idx on public.couples(visibility);
create index if not exists couple_members_user_id_idx on public.couple_members(user_id);
create index if not exists couple_members_couple_id_idx on public.couple_members(couple_id);
create index if not exists timeline_events_couple_year_idx on public.timeline_events(couple_id, year);
create index if not exists timeline_events_couple_date_idx on public.timeline_events(couple_id, event_date);
create index if not exists timeline_photos_event_position_idx on public.timeline_photos(event_id, position);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_timeline_events_updated_at on public.timeline_events;
create trigger set_timeline_events_updated_at
before update on public.timeline_events
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'name', ''),
    new.email
  )
  on conflict (id) do update
    set name = coalesce(excluded.name, public.profiles.name),
        email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

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
    where cm.couple_id = target_couple_id
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
    from public.couples c
    where c.id = target_couple_id
      and (c.visibility = 'public' or c.created_by = auth.uid() or public.is_couple_member(target_couple_id))
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
    where cm.couple_id = target_couple_id
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
    where cm.couple_id = target_couple_id
      and cm.user_id = auth.uid()
      and cm.role in ('owner', 'partner')
  );
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
  target_user_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Você precisa estar autenticado para adicionar uma pessoa.';
  end if;

  if not public.is_couple_owner(target_couple_id) then
    raise exception 'Apenas o dono da timeline pode adicionar pessoas.';
  end if;

  select p.id
  into target_user_id
  from public.profiles p
  where lower(p.email) = lower(trim(member_email))
  limit 1;

  if target_user_id is null then
    raise exception 'Nenhuma conta foi encontrada com este e-mail. A pessoa precisa se cadastrar primeiro.';
  end if;

  insert into public.couple_members (couple_id, user_id, role)
  values (target_couple_id, target_user_id, 'viewer')
  on conflict (couple_id, user_id) do update
    set role = public.couple_members.role;

  return target_user_id;
end;
$$;

revoke execute on function public.add_couple_member_by_email(uuid, text) from public;
grant execute on function public.add_couple_member_by_email(uuid, text) to authenticated;

alter table public.profiles enable row level security;
alter table public.couples enable row level security;
alter table public.couple_members enable row level security;
alter table public.timeline_events enable row level security;
alter table public.timeline_photos enable row level security;

drop policy if exists "Profiles are readable by owner" on public.profiles;
create policy "Profiles are readable by owner"
on public.profiles for select
using (id = auth.uid());

drop policy if exists "Profiles are writable by owner" on public.profiles;
create policy "Profiles are writable by owner"
on public.profiles for insert
with check (id = auth.uid());

drop policy if exists "Profiles are updatable by owner" on public.profiles;
create policy "Profiles are updatable by owner"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "Couples can be read by members or public visitors" on public.couples;
create policy "Couples can be read by members or public visitors"
on public.couples for select
using (visibility = 'public' or created_by = auth.uid() or public.is_couple_member(id));

drop policy if exists "Authenticated users can create couples" on public.couples;
create policy "Authenticated users can create couples"
on public.couples for insert
with check (auth.uid() = created_by);

drop policy if exists "Couple owners can update couples" on public.couples;
create policy "Couple owners can update couples"
on public.couples for update
using (created_by = auth.uid())
with check (created_by = auth.uid());

drop policy if exists "Couple owners can delete couples" on public.couples;
create policy "Couple owners can delete couples"
on public.couples for delete
using (created_by = auth.uid());

drop policy if exists "Members can read own memberships" on public.couple_members;
create policy "Members can read own memberships"
on public.couple_members for select
using (user_id = auth.uid() or public.is_couple_member(couple_id));

drop policy if exists "Creators can add first member" on public.couple_members;
create policy "Creators can add first member"
on public.couple_members for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.couples c
    where c.id = couple_id
      and c.created_by = auth.uid()
  )
);

drop policy if exists "Owners can add memberships" on public.couple_members;
create policy "Owners can add memberships"
on public.couple_members for insert
with check (public.is_couple_owner(couple_id));

drop policy if exists "Owners can manage memberships" on public.couple_members;
create policy "Owners can manage memberships"
on public.couple_members for update
using (public.is_couple_owner(couple_id))
with check (public.is_couple_owner(couple_id));

drop policy if exists "Owners can remove memberships" on public.couple_members;
create policy "Owners can remove memberships"
on public.couple_members for delete
using (public.is_couple_owner(couple_id));

drop policy if exists "Events can be read by members or public visitors" on public.timeline_events;
create policy "Events can be read by members or public visitors"
on public.timeline_events for select
using (public.can_read_couple(couple_id));

drop policy if exists "Members can create events" on public.timeline_events;
create policy "Members can create events"
on public.timeline_events for insert
with check (public.can_edit_couple(couple_id) and created_by = auth.uid());

drop policy if exists "Members can update events" on public.timeline_events;
create policy "Members can update events"
on public.timeline_events for update
using (public.can_edit_couple(couple_id))
with check (public.can_edit_couple(couple_id));

drop policy if exists "Members can delete events" on public.timeline_events;
create policy "Members can delete events"
on public.timeline_events for delete
using (public.can_edit_couple(couple_id));

drop policy if exists "Photos can be read by members or public visitors" on public.timeline_photos;
create policy "Photos can be read by members or public visitors"
on public.timeline_photos for select
using (
  exists (
    select 1
    from public.timeline_events te
    where te.id = event_id
      and public.can_read_couple(te.couple_id)
  )
);

drop policy if exists "Members can create photos" on public.timeline_photos;
create policy "Members can create photos"
on public.timeline_photos for insert
with check (
  exists (
    select 1
    from public.timeline_events te
    where te.id = event_id
      and public.can_edit_couple(te.couple_id)
  )
);

drop policy if exists "Members can update photos" on public.timeline_photos;
create policy "Members can update photos"
on public.timeline_photos for update
using (
  exists (
    select 1
    from public.timeline_events te
    where te.id = event_id
      and public.can_edit_couple(te.couple_id)
  )
)
with check (
  exists (
    select 1
    from public.timeline_events te
    where te.id = event_id
      and public.can_edit_couple(te.couple_id)
  )
);

drop policy if exists "Members can delete photos" on public.timeline_photos;
create policy "Members can delete photos"
on public.timeline_photos for delete
using (
  exists (
    select 1
    from public.timeline_events te
    where te.id = event_id
      and public.can_edit_couple(te.couple_id)
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'timeline-photos',
  'timeline-photos',
  false,
  5242880,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Timeline photos can be read by couple access" on storage.objects;
create policy "Timeline photos can be read by couple access"
on storage.objects for select
using (
  bucket_id = 'timeline-photos'
  and (storage.foldername(name))[1] = 'couples'
  and public.can_read_couple(((storage.foldername(name))[2])::uuid)
);

drop policy if exists "Timeline members can upload photos" on storage.objects;
create policy "Timeline members can upload photos"
on storage.objects for insert
with check (
  bucket_id = 'timeline-photos'
  and (storage.foldername(name))[1] = 'couples'
  and public.can_edit_couple(((storage.foldername(name))[2])::uuid)
);

drop policy if exists "Timeline members can update photos" on storage.objects;
create policy "Timeline members can update photos"
on storage.objects for update
using (
  bucket_id = 'timeline-photos'
  and (storage.foldername(name))[1] = 'couples'
  and public.can_edit_couple(((storage.foldername(name))[2])::uuid)
)
with check (
  bucket_id = 'timeline-photos'
  and (storage.foldername(name))[1] = 'couples'
  and public.can_edit_couple(((storage.foldername(name))[2])::uuid)
);

drop policy if exists "Timeline members can delete photos" on storage.objects;
create policy "Timeline members can delete photos"
on storage.objects for delete
using (
  bucket_id = 'timeline-photos'
  and (storage.foldername(name))[1] = 'couples'
  and public.can_edit_couple(((storage.foldername(name))[2])::uuid)
);

-- Monogamous relationship tree: one root timeline and direct child timelines.
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

-- Personal profile details and relationship metadata shared by linked users.
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
