create table public.timeline_event_comments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.timeline_events(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  parent_comment_id uuid references public.timeline_event_comments(id) on delete set null,
  author_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint timeline_event_comments_content_check
    check (char_length(btrim(content)) between 1 and 1000),
  constraint timeline_event_comments_parent_check
    check (parent_comment_id is null or parent_comment_id <> id)
);

create table public.timeline_event_comment_reactions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.timeline_event_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  constraint timeline_event_comment_reactions_emoji_check
    check (emoji in ('❤️', '😍', '😂', '🥹', '👏', '🔥')),
  unique (comment_id, user_id, emoji)
);

create index timeline_event_comments_event_created_at_idx
  on public.timeline_event_comments(event_id, created_at, id);

create index timeline_event_comments_parent_idx
  on public.timeline_event_comments(parent_comment_id);

create index timeline_event_comment_reactions_comment_idx
  on public.timeline_event_comment_reactions(comment_id, emoji);

create or replace function public.validate_timeline_event_comment()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  event_couple_id uuid;
  parent_event_id uuid;
  parent_couple_id uuid;
begin
  select te.couple_id
  into event_couple_id
  from public.timeline_events te
  where te.id = new.event_id;

  if event_couple_id is null or event_couple_id <> new.couple_id then
    raise exception 'O comentário precisa pertencer ao casal do evento.';
  end if;

  if new.parent_comment_id is not null then
    select parent.event_id, parent.couple_id
    into parent_event_id, parent_couple_id
    from public.timeline_event_comments parent
    where parent.id = new.parent_comment_id;

    if parent_event_id is null
      or parent_event_id <> new.event_id
      or parent_couple_id <> new.couple_id then
      raise exception 'A resposta precisa pertencer ao mesmo evento.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_timeline_event_comment_trigger on public.timeline_event_comments;
create trigger validate_timeline_event_comment_trigger
before insert or update on public.timeline_event_comments
for each row execute function public.validate_timeline_event_comment();

drop trigger if exists set_timeline_event_comments_updated_at on public.timeline_event_comments;
create trigger set_timeline_event_comments_updated_at
before update on public.timeline_event_comments
for each row execute function public.set_updated_at();

alter table public.timeline_event_comments enable row level security;
alter table public.timeline_event_comment_reactions enable row level security;

revoke all on table public.timeline_event_comments from anon, authenticated;
revoke all on table public.timeline_event_comment_reactions from anon, authenticated;
grant select, insert, update, delete on table public.timeline_event_comments to authenticated;
grant select, insert, delete on table public.timeline_event_comment_reactions to authenticated;
grant all on table public.timeline_event_comments to service_role;
grant all on table public.timeline_event_comment_reactions to service_role;

create policy "Couple members can read event comments"
on public.timeline_event_comments for select
to authenticated
using (public.can_edit_couple(couple_id));

create policy "Couple members can create event comments"
on public.timeline_event_comments for insert
to authenticated
with check (
  public.can_edit_couple(couple_id)
  and author_id = (select auth.uid())
);

create policy "Authors can update event comments"
on public.timeline_event_comments for update
to authenticated
using (
  public.can_edit_couple(couple_id)
  and author_id = (select auth.uid())
)
with check (
  public.can_edit_couple(couple_id)
  and author_id = (select auth.uid())
);

create policy "Authors can delete event comments"
on public.timeline_event_comments for delete
to authenticated
using (
  public.can_edit_couple(couple_id)
  and author_id = (select auth.uid())
);

create policy "Couple members can read comment reactions"
on public.timeline_event_comment_reactions for select
to authenticated
using (
  exists (
    select 1
    from public.timeline_event_comments comment_row
    where comment_row.id = comment_id
      and public.can_edit_couple(comment_row.couple_id)
  )
);

create policy "Couple members can add their comment reactions"
on public.timeline_event_comment_reactions for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.timeline_event_comments comment_row
    where comment_row.id = comment_id
      and public.can_edit_couple(comment_row.couple_id)
  )
);

create policy "Users can remove their comment reactions"
on public.timeline_event_comment_reactions for delete
to authenticated
using (user_id = (select auth.uid()));

create or replace function public.toggle_timeline_event_comment_reaction(
  target_comment_id uuid,
  reaction_emoji text
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  comment_couple_id uuid;
  existing_reaction_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Você precisa estar autenticado para reagir a um comentário.';
  end if;

  if reaction_emoji not in ('❤️', '😍', '😂', '🥹', '👏', '🔥') then
    raise exception 'Reação inválida.';
  end if;

  select comment_row.couple_id
  into comment_couple_id
  from public.timeline_event_comments comment_row
  where comment_row.id = target_comment_id;

  if comment_couple_id is null or not public.can_edit_couple(comment_couple_id) then
    raise exception 'Comentário não encontrado ou sem permissão de acesso.';
  end if;

  select reaction.id
  into existing_reaction_id
  from public.timeline_event_comment_reactions reaction
  where reaction.comment_id = target_comment_id
    and reaction.user_id = auth.uid()
    and reaction.emoji = reaction_emoji;

  if existing_reaction_id is not null then
    delete from public.timeline_event_comment_reactions
    where id = existing_reaction_id;
    return false;
  end if;

  insert into public.timeline_event_comment_reactions (comment_id, user_id, emoji)
  values (target_comment_id, auth.uid(), reaction_emoji);

  return true;
end;
$$;

revoke execute on function public.toggle_timeline_event_comment_reaction(uuid, text) from public;
grant execute on function public.toggle_timeline_event_comment_reaction(uuid, text) to authenticated;
