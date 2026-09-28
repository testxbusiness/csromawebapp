-- R5: the API resolves R4, while this service-only mutation and trigger make
-- the final temporal decision inside PostgreSQL. Manual/legacy events remain
-- compatible because only generated RSVP occurrences are guarded.
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
  -- Coach/admin routes use the trusted service client and retain their
  -- existing management surface. Athlete/family Data API writes do not.
  if current_setting('request.jwt.claim.role', true) = 'service_role'
     or private.has_account_role('coach')
     or private.has_account_role('admin') then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  select * into v_event from public.events where id = v_event_id;
  if not found then
    raise exception 'attendance_event_not_found' using errcode = 'P0001';
  end if;

  if v_event.generated_from_schedule_id is not null
     and v_event.requires_confirmation = true then
    if tg_op = 'DELETE'
       or v_event.start_time <= v_now
       or (v_event.confirmation_deadline is not null and v_event.confirmation_deadline <= v_now) then
      raise exception 'attendance_event_closed' using errcode = 'P0001';
    end if;

    if exists (
      select 1
      from public.events earlier
      join public.event_teams earlier_et on earlier_et.event_id = earlier.id
      join public.team_members member on member.team_id = earlier_et.team_id
      where member.profile_id = coalesce(new.profile_id, old.profile_id)
        and earlier.generated_from_schedule_id is not null
        and earlier.requires_confirmation = true
        and earlier.start_time > v_now
        and earlier.start_time < v_event.start_time
        and earlier.id <> v_event.id
    ) then
      raise exception 'attendance_event_not_next' using errcode = 'P0001';
    end if;
  end if;

  if tg_op <> 'DELETE'
     and (new.responded_by_auth_user_id is distinct from auth.uid()
       or new.response_source is distinct from 'self') then
    raise exception 'attendance_actor_mismatch' using errcode = 'P0001';
  end if;

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

revoke all on function private.guard_automatic_attendance_write() from public, anon, authenticated;
grant execute on function private.guard_automatic_attendance_write() to service_role;

drop trigger if exists event_attendances_r5_write_guard on public.event_attendances;
create trigger event_attendances_r5_write_guard
before insert or update or delete on public.event_attendances
for each row execute function private.guard_automatic_attendance_write();

-- The route calls this function only through the service client after it has
-- authenticated the account and resolved the subject with R4. It is not a
-- public Data API endpoint: authenticated/anon are explicitly denied.
create or replace function public.record_athlete_attendance(
  p_event_id uuid,
  p_profile_id uuid,
  p_status text,
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
  v_event public.events%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if p_status not in ('going', 'maybe', 'declined') then
    raise exception 'attendance_status_invalid' using errcode = '23514';
  end if;
  if p_response_source not in ('self', 'parent') then
    raise exception 'attendance_source_invalid' using errcode = '23514';
  end if;

  select * into v_event from public.events where id = p_event_id for update;
  if not found then
    raise exception 'attendance_event_not_found' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.event_teams et
    join public.team_members tm on tm.team_id = et.team_id
    where et.event_id = p_event_id and tm.profile_id = p_profile_id
  ) then
    raise exception 'attendance_subject_not_member' using errcode = 'P0001';
  end if;

  if v_event.generated_from_schedule_id is not null
     and v_event.requires_confirmation = true then
    if v_event.start_time <= v_now
       or (v_event.confirmation_deadline is not null and v_event.confirmation_deadline <= v_now) then
      raise exception 'attendance_event_closed' using errcode = 'P0001';
    end if;
    if exists (
      select 1
      from public.events earlier
      join public.event_teams et on et.event_id = earlier.id
      join public.team_members tm on tm.team_id = et.team_id
      where tm.profile_id = p_profile_id
        and earlier.generated_from_schedule_id is not null
        and earlier.requires_confirmation = true
        and earlier.start_time > v_now
        and earlier.start_time < v_event.start_time
        and earlier.id <> p_event_id
    ) then
      raise exception 'attendance_event_not_next' using errcode = 'P0001';
    end if;
  end if;

  insert into public.event_attendances (
    event_id, profile_id, status, note,
    responded_by_auth_user_id, response_source, responded_at
  ) values (
    p_event_id, p_profile_id, p_status, nullif(btrim(p_note), ''),
    p_actor_auth_user_id, p_response_source, v_now
  )
  on conflict (event_id, profile_id) do update set
    status = excluded.status,
    note = excluded.note,
    responded_by_auth_user_id = excluded.responded_by_auth_user_id,
    response_source = excluded.response_source,
    responded_at = excluded.responded_at;
end;
$$;

revoke all on function public.record_athlete_attendance(uuid, uuid, text, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.record_athlete_attendance(uuid, uuid, text, text, uuid, text)
  to service_role;

-- Direct authenticated writes must not forge the actor identity. DELETE keeps
-- its existing subject ownership rule; the trigger supplies the time guard.
drop policy if exists event_attendances_subject_insert on public.event_attendances;
create policy event_attendances_subject_insert
  on public.event_attendances for insert to authenticated
  with check (
    profile_id = (select private.current_profile_id())
    and responded_by_auth_user_id = (select auth.uid())
    and response_source = 'self'
  );

drop policy if exists event_attendances_subject_update on public.event_attendances;
create policy event_attendances_subject_update
  on public.event_attendances for update to authenticated
  using (profile_id = (select private.current_profile_id()))
  with check (
    profile_id = (select private.current_profile_id())
    and responded_by_auth_user_id = (select auth.uid())
    and response_source = 'self'
  );

comment on function public.record_athlete_attendance(uuid, uuid, text, text, uuid, text) is
  'Service-only atomic athlete attendance mutation. API authentication and R4 subject authorization happen before invocation; temporal checks happen here at write time.';

commit;
