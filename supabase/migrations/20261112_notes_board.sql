-- Execute no SQL Editor do Supabase antes de usar o novo quadro de anotações.
begin;

alter table public.notes add column if not exists position bigint;

-- Preserva a ordem anterior das anotações existentes.
with ranked as (
  select id, row_number() over (
    partition by company_id order by updated_at desc, created_at desc, id
  ) - 1 as position
  from public.notes
)
update public.notes as note
set position = ranked.position
from ranked
where note.id = ranked.id and note.position is null;

alter table public.notes alter column position set default 0;
alter table public.notes alter column position set not null;

create or replace function public.reorder_notes(p_company_id uuid, p_note_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_company_id is null or p_note_ids is null then
    raise exception 'Informe a empresa e as anotações.';
  end if;

  if cardinality(p_note_ids) <> (
    select count(distinct note.id)
    from public.notes as note
    where note.company_id = p_company_id
      and note.deleted_at is null
      and note.id = any(p_note_ids)
  ) then
    raise exception 'A ordem contém anotações inválidas. Atualize a página.';
  end if;

  update public.notes as note
  set position = ordered.ordinality - 1
  from unnest(p_note_ids) with ordinality as ordered(id, ordinality)
  where note.id = ordered.id and note.company_id = p_company_id
    and note.deleted_at is null;
end;
$$;

commit;
