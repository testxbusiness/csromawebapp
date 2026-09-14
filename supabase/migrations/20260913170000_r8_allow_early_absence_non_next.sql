-- R8: early absence is allowed for any future eligible occurrence.
-- The R5 trigger must still protect direct attendance writes, but the
-- service-only R7 RPCs are already authorized and validate their own rules.
begin;

create or replace function private.guard_automatic_attendance_write()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_event public.events%rowtype;
  v_event_id uuid := coalesce(new.event_id, old.event_id);
  v_now timestamptz := clock_timestamp();
begin
  -- R7 RPCs set this transaction-local flag only after the API has
  -- authenticated and authorized the subject. Direct writes remain guarded.
  if current_setting('request.jwt.claim.role', true) = 'service_role'
     or current_setting('private.early_absence_mutation', true) = 'true'
     or private.has_account_role('coach')
     or private.has_account_role('admin') then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  select * into v_event from public.events where id = v_event_id;
  if not found then raise exception 'attendance_event_not_found' using errcode = 'P0001'; end if;
  if v_event.generated_from_schedule_id is not null and v_event.requires_confirmation = true then
    if tg_op = 'DELETE'
       or v_event.start_time <= v_now
       or (v_event.confirmation_deadline is not null and v_event.confirmation_deadline <= v_now) then
      raise exception 'attendance_event_closed' using errcode = 'P0001';
    end if;
    if exists (
      select 1 from public.events earlier
      join public.event_teams earlier_et on earlier_et.event_id = earlier.id
      join public.team_members member on member.team_id = earlier_et.team_id
      where member.profile_id = coalesce(new.profile_id, old.profile_id)
        and earlier.generated_from_schedule_id is not null
        and earlier.requires_confirmation = true
        and earlier.start_time > v_now
        and earlier.start_time < v_event.start_time
        and earlier.id <> v_event.id
    ) then raise exception 'attendance_event_not_next' using errcode = 'P0001'; end if;
  end if;
  if tg_op <> 'DELETE'
     and (new.responded_by_auth_user_id is distinct from auth.uid()
       or new.response_source is distinct from 'self') then
    raise exception 'attendance_actor_mismatch' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

drop trigger if exists event_attendances_r5_write_guard on public.event_attendances;
create trigger event_attendances_r5_write_guard
before insert or update or delete on public.event_attendances
for each row execute function private.guard_automatic_attendance_write();

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
  -- The function is executable only by service_role. This transaction-local
  -- flag lets the trigger distinguish it from a direct authenticated write.
  perform set_config('private.early_absence_mutation', 'true', true);

  if p_event_ids is null then raise exception 'early_absence_events_empty' using errcode = 'P0001'; end if;
  if p_note is not null and char_length(btrim(p_note)) > 1000 then raise exception 'early_absence_note_too_long' using errcode = 'P0001'; end if;
  if p_response_source not in ('self', 'parent') then raise exception 'early_absence_source_invalid' using errcode = '23514'; end if;

  select count(distinct id) into v_count from unnest(p_event_ids) as ids(id);
  if v_count = 0 or v_count > 100 then raise exception 'early_absence_event_limit' using errcode = 'P0001'; end if;

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
  perform set_config('private.early_absence_mutation', 'true', true);

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

commit;
