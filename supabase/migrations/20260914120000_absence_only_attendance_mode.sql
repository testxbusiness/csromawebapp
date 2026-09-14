begin;

alter table public.events
  add column if not exists attendance_mode text;

update public.events
set attendance_mode = 'rsvp'
where attendance_mode is null;

alter table public.events
  alter column attendance_mode set default 'rsvp',
  alter column attendance_mode set not null;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.events'::regclass
      and conname = 'events_attendance_mode_check'
  ) then
    alter table public.events add constraint events_attendance_mode_check
      check (attendance_mode in ('rsvp', 'absence_only'));
  end if;
end $$;

-- Only configured future events are moved. Historical and unconfigured events
-- retain their existing RSVP semantics and every existing attendance row.
update public.events
set attendance_mode = 'absence_only'
where start_time > clock_timestamp()
  and requires_confirmation = true
  and event_kind in ('training', 'match');

alter table public.event_attendances
  add column if not exists pre_absence_status text,
  add column if not exists pre_absence_note text;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.event_attendances'::regclass
      and conname = 'event_attendances_pre_absence_status_check'
  ) then
    alter table public.event_attendances add constraint event_attendances_pre_absence_status_check
      check (pre_absence_status is null or pre_absence_status in ('going', 'maybe', 'declined'));
  end if;
end $$;

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
  if current_setting('request.jwt.claim.role', true) = 'service_role'
     or current_setting('private.early_absence_mutation', true) = 'true'
     or private.has_account_role('coach')
     or private.has_account_role('admin') then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  select * into v_event from public.events where id = v_event_id;
  if not found then raise exception 'attendance_event_not_found' using errcode = 'P0001'; end if;
  if v_event.attendance_mode = 'absence_only' then
    raise exception 'attendance_absence_only' using errcode = 'P0001';
  end if;
  if v_event.generated_from_schedule_id is not null and v_event.requires_confirmation = true then
    if tg_op = 'DELETE' or v_event.start_time <= v_now
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
        and earlier.attendance_mode = 'rsvp'
        and earlier.start_time > v_now
        and earlier.start_time < v_event.start_time
        and earlier.id <> v_event.id
    ) then raise exception 'attendance_event_not_next' using errcode = 'P0001'; end if;
  end if;
  if tg_op <> 'DELETE' and (new.responded_by_auth_user_id is distinct from auth.uid()
    or new.response_source is distinct from 'self') then
    raise exception 'attendance_actor_mismatch' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

create or replace function public.record_athlete_early_absence(
  p_event_ids uuid[], p_profile_id uuid, p_note text,
  p_actor_auth_user_id uuid, p_response_source text
)
returns void language plpgsql security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_event_id uuid;
  v_event public.events%rowtype;
  v_now timestamptz := clock_timestamp();
  v_count integer;
begin
  perform set_config('private.early_absence_mutation', 'true', true);
  if p_event_ids is null then raise exception 'early_absence_events_empty' using errcode = 'P0001'; end if;
  if p_note is not null and char_length(btrim(p_note)) > 1000 then raise exception 'early_absence_note_too_long' using errcode = 'P0001'; end if;
  if p_response_source not in ('self', 'parent') then raise exception 'early_absence_source_invalid' using errcode = '23514'; end if;
  select count(distinct id) into v_count from unnest(p_event_ids) as ids(id);
  if v_count = 0 or v_count > 100 then raise exception 'early_absence_event_limit' using errcode = 'P0001'; end if;
  for v_event_id in select distinct id from unnest(p_event_ids) as ids(id) loop
    select * into v_event from public.events where id = v_event_id for update;
    if not found then raise exception 'early_absence_event_not_found' using errcode = 'P0001'; end if;
    if v_event.requires_confirmation is distinct from true or v_event.start_time <= v_now
       or (v_event.confirmation_deadline is not null and v_event.confirmation_deadline <= v_now) then
      raise exception 'early_absence_event_closed' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.event_teams et join public.team_members tm on tm.team_id = et.team_id
      where et.event_id = v_event_id and tm.profile_id = p_profile_id) then
      raise exception 'early_absence_subject_not_member' using errcode = 'P0001';
    end if;
    if v_event.attendance_mode <> 'absence_only' and exists (
      select 1 from public.event_attendances ea where ea.event_id = v_event_id
        and ea.profile_id = p_profile_id and ea.is_early_absence is distinct from true
    ) then raise exception 'early_absence_response_exists' using errcode = 'P0001'; end if;
  end loop;
  for v_event_id in select distinct id from unnest(p_event_ids) as ids(id) loop
    insert into public.event_attendances (event_id, profile_id, status, note, is_early_absence,
      pre_absence_status, pre_absence_note, responded_by_auth_user_id, response_source, responded_at)
    values (v_event_id, p_profile_id, 'declined', nullif(btrim(p_note), ''), true,
      null, null, p_actor_auth_user_id, p_response_source, v_now)
    on conflict (event_id, profile_id) do update set
      pre_absence_status = case when public.event_attendances.is_early_absence then public.event_attendances.pre_absence_status else public.event_attendances.status end,
      pre_absence_note = case when public.event_attendances.is_early_absence then public.event_attendances.pre_absence_note else public.event_attendances.note end,
      status = 'declined', note = excluded.note, is_early_absence = true,
      responded_by_auth_user_id = excluded.responded_by_auth_user_id,
      response_source = excluded.response_source, responded_at = excluded.responded_at;
  end loop;
end;
$$;

create or replace function public.revoke_athlete_early_absence(
  p_event_ids uuid[], p_profile_id uuid, p_actor_auth_user_id uuid, p_response_source text
)
returns void language plpgsql security definer
set search_path = pg_catalog, public, auth, private
as $$
declare v_event_id uuid; v_event public.events%rowtype; v_now timestamptz := clock_timestamp(); begin
  perform set_config('private.early_absence_mutation', 'true', true);
  if p_event_ids is null then raise exception 'early_absence_events_empty' using errcode = 'P0001'; end if;
  if p_response_source not in ('self', 'parent') then raise exception 'early_absence_source_invalid' using errcode = '23514'; end if;
  for v_event_id in select distinct id from unnest(p_event_ids) as ids(id) loop
    select * into v_event from public.events where id = v_event_id for update;
    if not found then raise exception 'early_absence_event_not_found' using errcode = 'P0001'; end if;
    if v_event.requires_confirmation is distinct from true or v_event.start_time <= v_now
      or (v_event.confirmation_deadline is not null and v_event.confirmation_deadline <= v_now) then raise exception 'early_absence_event_closed' using errcode = 'P0001'; end if;
    if not exists (select 1 from public.event_teams et join public.team_members tm on tm.team_id = et.team_id where et.event_id = v_event_id and tm.profile_id = p_profile_id) then raise exception 'early_absence_subject_not_member' using errcode = 'P0001'; end if;
    if not exists (select 1 from public.event_attendances ea where ea.event_id = v_event_id and ea.profile_id = p_profile_id and (
      ea.is_early_absence = true or (v_event.attendance_mode = 'absence_only' and ea.status = 'declined' and ea.response_source in ('self', 'parent'))
    )) then raise exception 'early_absence_not_found' using errcode = 'P0001'; end if;
  end loop;
  update public.event_attendances set status = pre_absence_status, note = pre_absence_note,
    is_early_absence = false, pre_absence_status = null, pre_absence_note = null
  where event_id = any(p_event_ids) and profile_id = p_profile_id and is_early_absence = true and pre_absence_status is not null;
  delete from public.event_attendances where event_id = any(p_event_ids) and profile_id = p_profile_id
    and ((is_early_absence = true and pre_absence_status is null) or (is_early_absence = false and status = 'declined' and response_source in ('self', 'parent')));
end;
$$;

comment on column public.events.attendance_mode is 'rsvp preserves the three-response flow; absence_only permits only reporting/revoking unavailability.';
comment on column public.event_attendances.pre_absence_status is 'Original RSVP retained when a future absence temporarily overrides it.';

commit;

begin;

create or replace function public.record_athlete_attendance(
  p_event_id uuid, p_profile_id uuid, p_status text, p_note text,
  p_actor_auth_user_id uuid, p_response_source text
)
returns void language plpgsql security definer
set search_path = pg_catalog, public, auth, private
as $$
declare v_event public.events%rowtype; v_now timestamptz := clock_timestamp(); begin
  if p_status not in ('going', 'maybe', 'declined') then raise exception 'attendance_status_invalid' using errcode = '23514'; end if;
  if p_response_source not in ('self', 'parent') then raise exception 'attendance_source_invalid' using errcode = '23514'; end if;
  select * into v_event from public.events where id = p_event_id for update;
  if not found then raise exception 'attendance_event_not_found' using errcode = 'P0001'; end if;
  if v_event.attendance_mode = 'absence_only' then raise exception 'attendance_absence_only' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.event_teams et join public.team_members tm on tm.team_id = et.team_id where et.event_id = p_event_id and tm.profile_id = p_profile_id) then raise exception 'attendance_subject_not_member' using errcode = 'P0001'; end if;
  if v_event.generated_from_schedule_id is not null and v_event.requires_confirmation = true then
    if v_event.start_time <= v_now or (v_event.confirmation_deadline is not null and v_event.confirmation_deadline <= v_now) then raise exception 'attendance_event_closed' using errcode = 'P0001'; end if;
    if exists (select 1 from public.events earlier join public.event_teams et on et.event_id = earlier.id join public.team_members tm on tm.team_id = et.team_id where tm.profile_id = p_profile_id and earlier.generated_from_schedule_id is not null and earlier.requires_confirmation = true and earlier.attendance_mode = 'rsvp' and earlier.start_time > v_now and earlier.start_time < v_event.start_time and earlier.id <> p_event_id) then raise exception 'attendance_event_not_next' using errcode = 'P0001'; end if;
  end if;
  insert into public.event_attendances (event_id, profile_id, status, note, is_early_absence, responded_by_auth_user_id, response_source, responded_at)
  values (p_event_id, p_profile_id, p_status, nullif(btrim(p_note), ''), false, p_actor_auth_user_id, p_response_source, v_now)
  on conflict (event_id, profile_id) do update set status = excluded.status, note = excluded.note, is_early_absence = false, responded_by_auth_user_id = excluded.responded_by_auth_user_id, response_source = excluded.response_source, responded_at = excluded.responded_at;
end;
$$;

commit;
