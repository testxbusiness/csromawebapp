begin;

-- R7 keeps early absences in event_attendances. These RPCs are service-only:
-- the API authenticates and resolves the subject, while PostgreSQL repeats all
-- event checks and performs the whole bulk operation in one transaction.
create or replace function public.record_athlete_early_absence(
  p_event_ids uuid[],
  p_profile_id uuid,
  p_note text,
  p_actor_auth_user_id uuid,
  p_response_source text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_event_id uuid;
  v_event public.events%rowtype;
  v_now timestamptz := clock_timestamp();
  v_count integer;
begin
  if p_event_ids is null then raise exception 'early_absence_events_empty' using errcode = 'P0001'; end if;
  if p_note is not null and char_length(btrim(p_note)) > 1000 then raise exception 'early_absence_note_too_long' using errcode = 'P0001'; end if;
  if p_response_source not in ('self', 'parent') then raise exception 'early_absence_source_invalid' using errcode = '23514'; end if;

  select count(distinct id) into v_count from unnest(p_event_ids) as ids(id);
  if v_count = 0 or v_count > 100 then raise exception 'early_absence_event_limit' using errcode = 'P0001'; end if;

  -- Validate every row while holding event locks, before changing any row.
  for v_event_id in select distinct id from unnest(p_event_ids) as ids(id) loop
    select * into v_event from public.events where id = v_event_id for update;
    if not found then raise exception 'early_absence_event_not_found' using errcode = 'P0001'; end if;
    if v_event.generated_from_schedule_id is null or v_event.requires_confirmation is distinct from true
       or v_event.start_time <= v_now
       or (v_event.confirmation_deadline is not null and v_event.confirmation_deadline <= v_now) then
      raise exception 'early_absence_event_closed' using errcode = 'P0001';
    end if;
    if not exists (
      select 1 from public.event_teams et join public.team_members tm on tm.team_id = et.team_id
      where et.event_id = v_event_id and tm.profile_id = p_profile_id
    ) then raise exception 'early_absence_subject_not_member' using errcode = 'P0001'; end if;
    if exists (
      select 1 from public.event_attendances ea
      where ea.event_id = v_event_id and ea.profile_id = p_profile_id and ea.is_early_absence is distinct from true
    ) then raise exception 'early_absence_response_exists' using errcode = 'P0001'; end if;
  end loop;

  for v_event_id in select distinct id from unnest(p_event_ids) as ids(id) loop
    insert into public.event_attendances (
      event_id, profile_id, status, note, is_early_absence,
      responded_by_auth_user_id, response_source, responded_at
    ) values (
      v_event_id, p_profile_id, 'declined', nullif(btrim(p_note), ''), true,
      p_actor_auth_user_id, p_response_source, v_now
    )
    on conflict (event_id, profile_id) do update set
      status = 'declined', note = excluded.note, is_early_absence = true,
      responded_by_auth_user_id = excluded.responded_by_auth_user_id,
      response_source = excluded.response_source, responded_at = excluded.responded_at;
  end loop;
end;
$$;

create or replace function public.revoke_athlete_early_absence(
  p_event_ids uuid[],
  p_profile_id uuid,
  p_actor_auth_user_id uuid,
  p_response_source text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_event_id uuid;
  v_event public.events%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if p_event_ids is null then raise exception 'early_absence_events_empty' using errcode = 'P0001'; end if;
  if p_response_source not in ('self', 'parent') then raise exception 'early_absence_source_invalid' using errcode = '23514'; end if;

  for v_event_id in select distinct id from unnest(p_event_ids) as ids(id) loop
    select * into v_event from public.events where id = v_event_id for update;
    if not found then raise exception 'early_absence_event_not_found' using errcode = 'P0001'; end if;
    if v_event.generated_from_schedule_id is null or v_event.requires_confirmation is distinct from true
       or v_event.start_time <= v_now
       or (v_event.confirmation_deadline is not null and v_event.confirmation_deadline <= v_now) then
      raise exception 'early_absence_event_closed' using errcode = 'P0001';
    end if;
    if not exists (
      select 1 from public.event_teams et join public.team_members tm on tm.team_id = et.team_id
      where et.event_id = v_event_id and tm.profile_id = p_profile_id
    ) then raise exception 'early_absence_subject_not_member' using errcode = 'P0001'; end if;
    if not exists (
      select 1 from public.event_attendances ea
      where ea.event_id = v_event_id and ea.profile_id = p_profile_id and ea.is_early_absence = true
    ) then raise exception 'early_absence_not_found' using errcode = 'P0001'; end if;
  end loop;

  for v_event_id in select distinct id from unnest(p_event_ids) as ids(id) loop
    delete from public.event_attendances
    where event_id = v_event_id and profile_id = p_profile_id and is_early_absence = true;
  end loop;
end;
$$;

revoke all on function public.record_athlete_early_absence(uuid[], uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function public.revoke_athlete_early_absence(uuid[], uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.record_athlete_early_absence(uuid[], uuid, text, uuid, text) to service_role;
grant execute on function public.revoke_athlete_early_absence(uuid[], uuid, uuid, text) to service_role;

-- Direct Data API writes may still support ordinary self RSVP on open events,
-- but can never create or turn a row into an early absence.
drop policy if exists event_attendances_subject_insert on public.event_attendances;
create policy event_attendances_subject_insert
  on public.event_attendances for insert to authenticated
  with check (
    profile_id = (select private.current_profile_id())
    and responded_by_auth_user_id = (select auth.uid())
    and response_source = 'self'
    and is_early_absence = false
  );

drop policy if exists event_attendances_subject_update on public.event_attendances;
create policy event_attendances_subject_update
  on public.event_attendances for update to authenticated
  using (profile_id = (select private.current_profile_id()))
  with check (
    profile_id = (select private.current_profile_id())
    and responded_by_auth_user_id = (select auth.uid())
    and response_source = 'self'
    and is_early_absence = false
  );

comment on function public.record_athlete_early_absence(uuid[], uuid, text, uuid, text) is
  'Service-only atomic bulk early-absence mutation; API and PostgreSQL both verify subject, membership, future event, RSVP configuration and deadline.';
comment on function public.revoke_athlete_early_absence(uuid[], uuid, uuid, text) is
  'Service-only atomic early-absence revocation; deletes only rows still marked is_early_absence.';

commit;
