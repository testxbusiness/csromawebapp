begin;

alter table public.gyms add column if not exists city text;
alter table public.gyms add column if not exists capacity integer;
alter table public.gyms add column if not exists is_active boolean not null default true;
alter table public.activities add column if not exists is_active boolean not null default true;

create table if not exists public.season_rollover_structure_maps (
  source_kind text not null check (source_kind in ('gym', 'activity')),
  source_id uuid not null,
  source_season_id uuid not null references public.seasons(id) on delete restrict,
  target_id uuid not null,
  target_season_id uuid not null references public.seasons(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (source_kind, source_id, target_season_id),
  unique (source_kind, target_id, target_season_id)
);

alter table public.season_rollover_structure_maps enable row level security;
revoke all on public.season_rollover_structure_maps from anon, authenticated;

create or replace function public.rollover_structures_batch(
  p_source_season_id uuid,
  p_target_season_id uuid,
  p_gyms jsonb,
  p_activities jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  v_source_id uuid;
  v_target_id uuid;
  choice text;
  copied_gyms integer := 0;
  linked_gyms integer := 0;
  skipped_gyms integer := 0;
  copied_activities integer := 0;
  linked_activities integer := 0;
  skipped_activities integer := 0;
  source_exists boolean;
begin
  if p_source_season_id = p_target_season_id then
    raise exception using errcode = '22023', message = 'Source e target devono essere stagioni diverse';
  end if;
  if not exists (select 1 from seasons where id = p_source_season_id) then
    raise exception using errcode = '22023', message = 'Stagione source non valida';
  end if;
  if not exists (select 1 from seasons where id = p_target_season_id and is_active = false) then
    raise exception using errcode = '22023', message = 'La stagione target deve essere una bozza inattiva';
  end if;
  perform 1 from seasons where id = p_target_season_id for update;

  for item in select value from jsonb_array_elements(coalesce(p_gyms, '[]'::jsonb)) loop
    v_source_id := (item->>'sourceId')::uuid;
    choice := item->>'choice';
    select exists (select 1 from gyms where id = v_source_id and season_id = p_source_season_id) into source_exists;
    if not source_exists then raise exception using errcode = '22023', message = 'Palestra source non valida'; end if;
    if choice = 'skip' then skipped_gyms := skipped_gyms + 1; continue; end if;
    if choice = 'link' then
      v_target_id := (item->>'targetId')::uuid;
      if not exists (select 1 from gyms where id = v_target_id and season_id = p_target_season_id) then
        raise exception using errcode = '22023', message = 'Palestra target non valida';
      end if;
      insert into season_rollover_structure_maps values ('gym', v_source_id, p_source_season_id, v_target_id, p_target_season_id)
        on conflict (source_kind, source_id, target_season_id) do update set target_id = excluded.target_id;
      linked_gyms := linked_gyms + 1; continue;
    end if;
    if choice <> 'copy' then raise exception using errcode = '22023', message = 'Scelta palestra non valida'; end if;
    select s.target_id into v_target_id from season_rollover_structure_maps s where s.source_kind = 'gym' and s.source_id = v_source_id and s.target_season_id = p_target_season_id for update;
    if v_target_id is null then
      insert into gyms (name, address, contact_info, city, capacity, is_active, season_id)
        select g.name, g.address, g.contact_info, g.city, g.capacity, g.is_active, p_target_season_id from gyms g where g.id = v_source_id
        returning id into v_target_id;
    end if;
    insert into season_rollover_structure_maps values ('gym', v_source_id, p_source_season_id, v_target_id, p_target_season_id)
      on conflict do nothing;
    copied_gyms := copied_gyms + 1;
  end loop;

  for item in select value from jsonb_array_elements(coalesce(p_activities, '[]'::jsonb)) loop
    v_source_id := (item->>'sourceId')::uuid; choice := item->>'choice';
    select exists (select 1 from activities where id = v_source_id and season_id = p_source_season_id) into source_exists;
    if not source_exists then raise exception using errcode = '22023', message = 'Attività source non valida'; end if;
    if choice = 'skip' then skipped_activities := skipped_activities + 1; continue; end if;
    if choice = 'link' then
      v_target_id := (item->>'targetId')::uuid;
      if not exists (select 1 from activities where id = v_target_id and season_id = p_target_season_id) then raise exception using errcode = '22023', message = 'Attività target non valida'; end if;
      insert into season_rollover_structure_maps values ('activity', v_source_id, p_source_season_id, v_target_id, p_target_season_id)
        on conflict (source_kind, source_id, target_season_id) do update set target_id = excluded.target_id;
      linked_activities := linked_activities + 1; continue;
    end if;
    if choice <> 'copy' then raise exception using errcode = '22023', message = 'Scelta attività non valida'; end if;
    select s.target_id into v_target_id from season_rollover_structure_maps s where s.source_kind = 'activity' and s.source_id = v_source_id and s.target_season_id = p_target_season_id for update;
    if v_target_id is null then
      insert into activities (name, description, is_active, season_id)
        select a.name, a.description, a.is_active, p_target_season_id from activities a where a.id = v_source_id
        returning id into v_target_id;
    end if;
    insert into season_rollover_structure_maps values ('activity', v_source_id, p_source_season_id, v_target_id, p_target_season_id)
      on conflict do nothing;
    copied_activities := copied_activities + 1;
  end loop;
  return jsonb_build_object('copiedGyms', copied_gyms, 'linkedGyms', linked_gyms, 'skippedGyms', skipped_gyms,
    'copiedActivities', copied_activities, 'linkedActivities', linked_activities, 'skippedActivities', skipped_activities);
end;
$$;

revoke all on function public.rollover_structures_batch(uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.rollover_structures_batch(uuid, uuid, jsonb, jsonb) to service_role;

commit;
