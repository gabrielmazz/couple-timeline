create table if not exists public.couple_gifts (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  image_url text,
  link_url text,
  price_min numeric(10, 2),
  price_max numeric(10, 2),
  category text not null default 'Outro',
  priority text not null default 'medium',
  status text not null default 'wanted',
  is_surprise boolean not null default false,
  related_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint couple_gifts_title_check check (char_length(btrim(title)) between 2 and 120),
  constraint couple_gifts_price_min_check check (price_min is null or price_min >= 0),
  constraint couple_gifts_price_max_check check (price_max is null or price_max >= 0),
  constraint couple_gifts_price_range_check check (
    price_min is null or price_max is null or price_max >= price_min
  ),
  constraint couple_gifts_category_check check (category in (
    'Tecnologia', 'Roupas', 'Beleza', 'Casa', 'Decoração', 'Viagem',
    'Livros', 'Games', 'Comida', 'Experiência', 'Outro'
  )),
  constraint couple_gifts_priority_check check (priority in ('low', 'medium', 'high')),
  constraint couple_gifts_status_check check (status in ('wanted', 'purchased', 'received'))
);

create index if not exists couple_gifts_couple_created_at_idx
  on public.couple_gifts(couple_id, created_at desc);

create index if not exists couple_gifts_couple_created_by_idx
  on public.couple_gifts(couple_id, created_by);

drop trigger if exists set_couple_gifts_updated_at on public.couple_gifts;
create trigger set_couple_gifts_updated_at
before update on public.couple_gifts
for each row execute function public.set_updated_at();

alter table public.couple_gifts enable row level security;

drop policy if exists "Couple members can read gifts" on public.couple_gifts;
create policy "Couple members can read gifts"
on public.couple_gifts for select
to authenticated
using (public.is_couple_member(couple_id));

drop policy if exists "Couple members can create their own gifts" on public.couple_gifts;
create policy "Couple members can create their own gifts"
on public.couple_gifts for insert
to authenticated
with check (
  public.is_couple_member(couple_id)
  and created_by = (select auth.uid())
);

drop policy if exists "Gift owners can update their gifts" on public.couple_gifts;
create policy "Gift owners can update their gifts"
on public.couple_gifts for update
to authenticated
using (
  public.is_couple_member(couple_id)
  and created_by = (select auth.uid())
)
with check (
  public.is_couple_member(couple_id)
  and created_by = (select auth.uid())
);

drop policy if exists "Gift owners can delete their gifts" on public.couple_gifts;
create policy "Gift owners can delete their gifts"
on public.couple_gifts for delete
to authenticated
using (
  public.is_couple_member(couple_id)
  and created_by = (select auth.uid())
);

-- The actor is intentionally not stored. A partner can update only the status
-- through this function, so a surprise does not reveal who marked it.
create or replace function public.update_couple_gift_status(
  target_gift_id uuid,
  next_status text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_gift public.couple_gifts%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Você precisa estar autenticado para atualizar um presente.';
  end if;

  if next_status not in ('wanted', 'purchased', 'received') then
    raise exception 'Status de presente inválido.';
  end if;

  select *
  into target_gift
  from public.couple_gifts
  where id = target_gift_id;

  if not found or not public.is_couple_member(target_gift.couple_id) then
    raise exception 'Presente não encontrado ou sem permissão de acesso.';
  end if;

  if target_gift.created_by <> auth.uid() and next_status = 'wanted' then
    raise exception 'A pessoa vinculada só pode marcar o presente como comprado ou recebido.';
  end if;

  update public.couple_gifts
  set status = next_status
  where id = target_gift_id;

  return target_gift_id;
end;
$$;

revoke all on table public.couple_gifts from anon, authenticated;
grant select, insert, update, delete on table public.couple_gifts to authenticated;
grant select, insert, update, delete on table public.couple_gifts to service_role;

revoke execute on function public.update_couple_gift_status(uuid, text) from public;
grant execute on function public.update_couple_gift_status(uuid, text) to authenticated, service_role;
