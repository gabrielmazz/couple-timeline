create or replace function public.update_child_timeline(
  target_timeline_id uuid,
  timeline_name text
)
returns public.couples
language plpgsql
security definer
set search_path = public
as $$
declare
  target_timeline public.couples%rowtype;
  normalized_name text := trim(timeline_name);
begin
  if auth.uid() is null then
    raise exception 'Você precisa estar autenticado para editar uma timeline.';
  end if;

  if char_length(normalized_name) < 2 or char_length(normalized_name) > 120 then
    raise exception 'Informe um nome entre 2 e 120 caracteres.';
  end if;

  select *
  into target_timeline
  from public.couples
  where id = target_timeline_id;

  if not found or target_timeline.parent_id is null then
    raise exception 'Apenas timelines vinculadas podem ser editadas aqui.';
  end if;

  if not public.is_couple_owner(target_timeline.parent_id) then
    raise exception 'Apenas o proprietário pode editar timelines vinculadas.';
  end if;

  update public.couples
  set name = normalized_name
  where id = target_timeline_id
  returning * into target_timeline;

  return target_timeline;
end;
$$;

create or replace function public.delete_child_timeline(target_timeline_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_timeline public.couples%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Você precisa estar autenticado para excluir uma timeline.';
  end if;

  select *
  into target_timeline
  from public.couples
  where id = target_timeline_id;

  if not found or target_timeline.parent_id is null then
    raise exception 'Apenas timelines vinculadas podem ser excluídas aqui.';
  end if;

  if not public.is_couple_owner(target_timeline.parent_id) then
    raise exception 'Apenas o proprietário pode excluir timelines vinculadas.';
  end if;

  delete from public.couples where id = target_timeline_id;
end;
$$;

revoke execute on function public.update_child_timeline(uuid, text) from public;
grant execute on function public.update_child_timeline(uuid, text) to authenticated, service_role;

revoke execute on function public.delete_child_timeline(uuid) from public;
grant execute on function public.delete_child_timeline(uuid) to authenticated, service_role;
