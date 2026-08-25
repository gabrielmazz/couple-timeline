alter table public.couple_gifts
  add column if not exists recipient_id uuid references auth.users(id) on delete cascade;

-- Existing entries were always intended for the person who created them.
update public.couple_gifts
set recipient_id = created_by
where recipient_id is null;

alter table public.couple_gifts
  alter column recipient_id set not null;

create index if not exists couple_gifts_couple_recipient_created_at_idx
  on public.couple_gifts(couple_id, recipient_id, created_at desc);

drop policy if exists "Couple members can create their own gifts" on public.couple_gifts;
create policy "Couple members can create gifts for either person"
on public.couple_gifts for insert
to authenticated
with check (
  public.is_couple_member(couple_id)
  and created_by = (select auth.uid())
  and exists (
    select 1
    from public.couple_members recipient_membership
    where recipient_membership.couple_id = public.couple_gifts.couple_id
      and recipient_membership.user_id = public.couple_gifts.recipient_id
  )
);
