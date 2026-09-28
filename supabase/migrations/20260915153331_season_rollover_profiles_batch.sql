begin;

create table if not exists public.season_rollover_profile_batch_audit (
  id uuid primary key default gen_random_uuid(),
  batch_key uuid not null unique,
  source_season_id uuid not null references public.seasons(id) on delete restrict,
  target_season_id uuid not null references public.seasons(id) on delete restrict,
  performed_by_auth_user_id uuid,
  request_hash text not null,
  included_count integer not null default 0,
  excluded_count integer not null default 0,
  without_team_count integer not null default 0,
  team_member_count integer not null default 0,
  team_coach_count integer not null default 0,
  warning_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists season_rollover_profile_batch_audit_seasons_idx
  on public.season_rollover_profile_batch_audit (source_season_id, target_season_id, created_at desc);

alter table public.season_rollover_profile_batch_audit enable row level security;
revoke all on table public.season_rollover_profile_batch_audit from anon, authenticated;
grant all on table public.season_rollover_profile_batch_audit to service_role;

create or replace function private.prevent_season_rollover_profile_batch_audit_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'season rollover profile batch audit is append-only';
end;
$$;

drop trigger if exists season_rollover_profile_batch_audit_immutable
  on public.season_rollover_profile_batch_audit;
create trigger season_rollover_profile_batch_audit_immutable
  before update or delete on public.season_rollover_profile_batch_audit
  for each row execute function private.prevent_season_rollover_profile_batch_audit_mutation();
revoke all on function private.prevent_season_rollover_profile_batch_audit_mutation() from public, anon, authenticated;

create or replace function public.rollover_profiles_batch(
  p_batch_key uuid,
  p_source_season_id uuid,
  p_target_season_id uuid,
  p_performed_by_auth_user_id uuid,
  p_selections jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  item jsonb;
  team_item jsonb;
  v_profile_id uuid;
  v_team_id uuid;
  v_profile_type text;
  v_source_status text;
  v_role text;
  v_jersey_number integer;
  v_included boolean;
  v_batch_hash text;
  v_existing_hash text;
  v_source_has_membership boolean;
  v_included_count integer := 0;
  v_excluded_count integer := 0;
  v_without_team_count integer := 0;
  v_team_member_count integer := 0;
  v_team_coach_count integer := 0;
  v_warning_count integer := 0;
begin
  if p_batch_key is null then
    raise exception using errcode = '22023', message = 'Batch key obbligatoria';
  end if;
  if p_source_season_id is null or p_target_season_id is null or p_source_season_id = p_target_season_id then
    raise exception using errcode = '22023', message = 'Source e target devono essere stagioni diverse';
  end if;
  if jsonb_typeof(coalesce(p_selections, '[]'::jsonb)) <> 'array' then
    raise exception using errcode = '22023', message = 'Selezioni non valide';
  end if;

  v_batch_hash := md5(p_source_season_id::text || ':' || p_target_season_id::text || ':' || coalesce(p_selections, '[]'::jsonb)::text);

  select request_hash into v_existing_hash
    from public.season_rollover_profile_batch_audit
   where batch_key = p_batch_key
   for update;
  if v_existing_hash is not null then
    if v_existing_hash <> v_batch_hash then
      raise exception using errcode = '23505', message = 'Batch key già usata con selezioni diverse';
    end if;
    return (select jsonb_build_object(
      'batchKey', batch_key,
      'included', included_count,
      'excluded', excluded_count,
      'withoutTeam', without_team_count,
      'teamMembers', team_member_count,
      'teamCoaches', team_coach_count,
      'warnings', warning_count,
      'replayed', true
    ) from public.season_rollover_profile_batch_audit where batch_key = p_batch_key);
  end if;

  if not exists (select 1 from public.seasons where id = p_source_season_id) then
    raise exception using errcode = '22023', message = 'Stagione source non valida';
  end if;
  if not exists (select 1 from public.seasons where id = p_target_season_id and is_active = false) then
    raise exception using errcode = '22023', message = 'La stagione target deve essere una bozza inattiva';
  end if;
  perform 1 from public.seasons where id = p_target_season_id for update;

  -- Validate the complete request before making any write, so one invalid row
  -- rolls back the entire batch and cannot leave a partial rollover.
  if exists (
    select 1
      from jsonb_array_elements(coalesce(p_selections, '[]'::jsonb)) a
     where jsonb_typeof(a->'profileId') <> 'string'
        or jsonb_typeof(a->'included') <> 'boolean'
        or jsonb_typeof(coalesce(a->'teams', '[]'::jsonb)) <> 'array'
  ) then
    raise exception using errcode = '22023', message = 'Selezione profilo non valida';
  end if;
  if exists (
    select 1
      from jsonb_array_elements(coalesce(p_selections, '[]'::jsonb)) a
      join jsonb_array_elements(coalesce(a->'teams', '[]'::jsonb)) t on true
     where jsonb_typeof(t->'teamId') <> 'string'
        or jsonb_typeof(t->'role') <> 'string'
  ) then
    raise exception using errcode = '22023', message = 'Assegnazione squadra non valida';
  end if;

  if exists (
    select 1 from (
      select (a->>'profileId')::uuid as profile_id, count(*)
        from jsonb_array_elements(coalesce(p_selections, '[]'::jsonb)) a
       group by (a->>'profileId')::uuid having count(*) > 1
    ) duplicate_profiles
  ) then
    raise exception using errcode = '22023', message = 'Profilo duplicato nel batch';
  end if;

  for item in select value from jsonb_array_elements(coalesce(p_selections, '[]'::jsonb)) loop
    v_profile_id := (item->>'profileId')::uuid;
    v_included := (item->>'included')::boolean;

    select sp.profile_type, sp.status
      into v_profile_type, v_source_status
      from public.season_profiles sp
     where sp.profile_id = v_profile_id and sp.season_id = p_source_season_id;
    if v_profile_type is null then
      raise exception using errcode = '22023', message = 'Profilo non appartenente alla stagione source';
    end if;
    if v_profile_type not in ('athlete', 'coach', 'staff', 'admin') then
      raise exception using errcode = '22023', message = 'Tipo profilo source non compatibile';
    end if;

    if not v_included then
      v_excluded_count := v_excluded_count + 1;
      continue;
    end if;

    v_included_count := v_included_count + 1;
    if v_source_status <> 'active' then
      v_warning_count := v_warning_count + 1;
    end if;
    if jsonb_array_length(coalesce(item->'teams', '[]'::jsonb)) = 0 then
      v_without_team_count := v_without_team_count + 1;
      if v_profile_type = 'athlete' or v_profile_type = 'coach' then
        v_warning_count := v_warning_count + 1;
      end if;
    end if;
    if v_profile_type in ('staff', 'admin') and jsonb_array_length(coalesce(item->'teams', '[]'::jsonb)) > 0 then
      raise exception using errcode = '22023', message = 'Staff e admin non possono avere membership squadra';
    end if;
    if v_profile_type = 'athlete' then
      select exists (
        select 1 from public.team_members tm
        join public.teams t on t.id = tm.team_id
        join public.activities a on a.id = t.activity_id
        where tm.profile_id = v_profile_id and tm.role = 'athlete' and a.season_id = p_source_season_id
      ) into v_source_has_membership;
    elsif v_profile_type = 'coach' then
      select exists (
        select 1 from public.team_coaches tc
        join public.teams t on t.id = tc.team_id
        join public.activities a on a.id = t.activity_id
        where tc.coach_id = v_profile_id and a.season_id = p_source_season_id
      ) into v_source_has_membership;
    else
      v_source_has_membership := true;
    end if;
    if not v_source_has_membership and jsonb_array_length(coalesce(item->'teams', '[]'::jsonb)) > 0 then
      raise exception using errcode = '22023', message = 'Profilo senza appartenenza squadra source';
    end if;

    insert into public.season_profiles (profile_id, season_id, profile_type, status, source, metadata)
    values (
      v_profile_id, p_target_season_id, v_profile_type, v_source_status,
      'season_rollover', jsonb_build_object('source_season_id', p_source_season_id, 'batch_key', p_batch_key)
    )
    on conflict (profile_id, season_id) do update set
      profile_type = excluded.profile_type,
      status = excluded.status,
      source = excluded.source,
      metadata = excluded.metadata;

    for team_item in select value from jsonb_array_elements(coalesce(item->'teams', '[]'::jsonb)) loop
      v_team_id := (team_item->>'teamId')::uuid;
      v_role := nullif(trim(team_item->>'role'), '');
      v_jersey_number := case when team_item ? 'jerseyNumber' and team_item->>'jerseyNumber' <> '' then (team_item->>'jerseyNumber')::integer else null end;
      if v_role is null then
        raise exception using errcode = '22023', message = 'Ruolo squadra obbligatorio';
      end if;
      if not exists (
        select 1 from public.teams t
        join public.activities a on a.id = t.activity_id
        where t.id = v_team_id and a.season_id = p_target_season_id
      ) then
        raise exception using errcode = '22023', message = 'Squadra target non autorizzata';
      end if;
      if v_profile_type = 'athlete' and v_role <> 'athlete' then
        raise exception using errcode = '22023', message = 'Ruolo incompatibile con atleta';
      end if;
      if v_profile_type = 'coach' and v_role not in ('head_coach', 'assistant_coach') then
        raise exception using errcode = '22023', message = 'Ruolo incompatibile con collaboratore';
      end if;
      if v_profile_type = 'athlete' then
        insert into public.team_members (profile_id, team_id, role, jersey_number)
        values (v_profile_id, v_team_id, v_role, v_jersey_number)
        on conflict (profile_id, team_id) do update set role = excluded.role, jersey_number = excluded.jersey_number;
        v_team_member_count := v_team_member_count + 1;
      elsif v_profile_type = 'coach' then
        insert into public.team_coaches (coach_id, team_id, role, assigned_at)
        values (v_profile_id, v_team_id, v_role, now())
        on conflict (coach_id, team_id) do update set role = excluded.role;
        v_team_coach_count := v_team_coach_count + 1;
      end if;
    end loop;
  end loop;

  insert into public.season_rollover_profile_batch_audit (
    batch_key, source_season_id, target_season_id, performed_by_auth_user_id,
    request_hash, included_count, excluded_count, without_team_count,
    team_member_count, team_coach_count, warning_count
  ) values (
    p_batch_key, p_source_season_id, p_target_season_id, p_performed_by_auth_user_id,
    v_batch_hash, v_included_count, v_excluded_count, v_without_team_count,
    v_team_member_count, v_team_coach_count, v_warning_count
  );

  return jsonb_build_object(
    'batchKey', p_batch_key,
    'included', v_included_count,
    'excluded', v_excluded_count,
    'withoutTeam', v_without_team_count,
    'teamMembers', v_team_member_count,
    'teamCoaches', v_team_coach_count,
    'warnings', v_warning_count,
    'replayed', false
  );
end;
$$;

revoke all on function public.rollover_profiles_batch(uuid, uuid, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.rollover_profiles_batch(uuid, uuid, uuid, uuid, jsonb) to service_role;

commit;
