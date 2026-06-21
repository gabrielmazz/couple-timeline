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
  description text,
  music_url text,
  cover_photo_path text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
