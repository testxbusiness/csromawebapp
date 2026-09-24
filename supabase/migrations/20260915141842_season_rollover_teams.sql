begin;

alter table public.teams
  add column if not exists is_active boolean not null default true;

create table if not exists public.season_rollover_team_maps (
  source_team_id uuid not null,
  source_season_id uuid not null references public.seasons(id) on delete restrict,
  target_team_id uuid not null,
  target_season_id uuid not null references public.seasons(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (source_team_id, target_season_id)
);

alter table public.season_rollover_team_maps enable row level security;
revoke all on table public.season_rollover_team_maps from anon, authenticated;

create or replace function public.rollover_teams_batch(
  p_source_season_id uuid,
  p_target_season_id uuid,
  p_teams jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  v_source_team_id uuid;
  v_target_team_id uuid;
  v_activity_id uuid;
  v_source_activity_id uuid;
  v_choice text;
  v_name text;
  v_code text;
  created_count integer := 0;
  linked_count integer := 0;
  skipped_count integer := 0;
begin
  if p_source_season_id = p_target_season_id then
    raise exception using errcode = '22023', message = 'Source e target devono essere stagioni diverse';
  end if;
  if not exists (select 1 from public.seasons where id = p_source_season_id) then
    raise exception using errcode = '22023', message = 'Stagione source non valida';
  end if;
  if not exists (select 1 from public.seasons where id = p_target_season_id and is_active = false) then
    raise exception using errcode = '22023', message = 'La stagione target deve essere una bozza inattiva';
  end if;
  perform 1 from public.seasons where id = p_target_season_id for update;

  for item in select value from jsonb_array_elements(coalesce(p_teams, '[]'::jsonb)) loop
    v_source_team_id := (item->>'sourceId')::uuid;
    v_choice := item->>'choice';

    select t.activity_id into v_source_activity_id
      from public.teams t
      join public.activities a on a.id = t.activity_id
     where t.id = v_source_team_id and a.season_id = p_source_season_id;
    if v_source_activity_id is null then
      raise exception using errcode = '22023', message = 'Squadra source non valida';
    end if;

    if v_choice = 'skip' then
      skipped_count := skipped_count + 1;
      continue;
    end if;

    if v_choice = 'link' then
      v_target_team_id := (item->>'targetId')::uuid;
      if not exists (
        select 1 from public.teams t
        join public.activities a on a.id = t.activity_id
        where t.id = v_target_team_id and a.season_id = p_target_season_id
      ) then
        raise exception using errcode = '22023', message = 'Squadra target non valida';
      end if;
      insert into public.season_rollover_team_maps
        (source_team_id, source_season_id, target_team_id, target_season_id)
      values (v_source_team_id, p_source_season_id, v_target_team_id, p_target_season_id)
      on conflict (source_team_id, target_season_id) do update set target_team_id = excluded.target_team_id;
      linked_count := linked_count + 1;
      continue;
    end if;

    if v_choice <> 'create' then
      raise exception using errcode = '22023', message = 'Scelta squadra non valida';
    end if;

    select m.target_team_id into v_target_team_id
      from public.season_rollover_team_maps m
     where m.source_team_id = v_source_team_id and m.target_season_id = p_target_season_id
     for update;
    if v_target_team_id is null then
      v_activity_id := (item->>'activityId')::uuid;
      v_name := nullif(trim(item->>'name'), '');
      v_code := nullif(trim(item->>'code'), '');
      if v_name is null or v_code is null then
        raise exception using errcode = '22023', message = 'Nome e codice squadra sono obbligatori';
      end if;
      if not exists (select 1 from public.activities where id = v_activity_id and season_id = p_target_season_id) then
        raise exception using errcode = '22023', message = 'Attività target non valida';
      end if;
      if exists (select 1 from public.teams where code = v_code) then
        raise exception using errcode = '23505', message = 'Codice squadra già utilizzato';
      end if;
      insert into public.teams (name, code, activity_id, is_active)
      values (v_name, v_code, v_activity_id, true)
      returning id into v_target_team_id;
      insert into public.season_rollover_team_maps
        (source_team_id, source_season_id, target_team_id, target_season_id)
      values (v_source_team_id, p_source_season_id, v_target_team_id, p_target_season_id);
      created_count := created_count + 1;
    else
      linked_count := linked_count + 1;
    end if;
  end loop;

  return jsonb_build_object('created', created_count, 'linked', linked_count, 'skipped', skipped_count);
end;
$$;

revoke all on function public.rollover_teams_batch(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.rollover_teams_batch(uuid, uuid, jsonb) to service_role;

commit;
