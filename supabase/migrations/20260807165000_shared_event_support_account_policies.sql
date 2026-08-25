-- Fase 2E, slice 4: normalize RSVP, attendance and recurring team schedule
-- policies around the private account/profile helpers.

drop policy if exists "Users can manage their own RSVP" on public.rsvp;
drop policy if exists "Coaches can view RSVP for their teams" on public.rsvp;

create policy rsvp_subject_all
  on public.rsvp
  for all
  to authenticated
  using (profile_id = (select private.current_profile_id()))
  with check (profile_id = (select private.current_profile_id()));

create policy rsvp_coach_select
  on public.rsvp
  for select
  to authenticated
  using (
    (select private.has_account_role('coach'))
    and exists (
      select 1
      from public.event_teams et
      where et.event_id = rsvp.event_id
        and (select private.is_coach_of_team(et.team_id))
    )
  );

drop policy if exists delete_own_attendance on public.event_attendances;
drop policy if exists insert_own_attendance on public.event_attendances;
drop policy if exists read_attendance_for_related_events on public.event_attendances;
drop policy if exists update_own_attendance on public.event_attendances;

create policy event_attendances_subject_delete
  on public.event_attendances
  for delete
  to authenticated
  using (profile_id = (select private.current_profile_id()));

create policy event_attendances_subject_insert
  on public.event_attendances
  for insert
  to authenticated
  with check (profile_id = (select private.current_profile_id()));

create policy event_attendances_subject_select
  on public.event_attendances
  for select
  to authenticated
  using (profile_id = (select private.current_profile_id()));

create policy event_attendances_subject_update
  on public.event_attendances
  for update
  to authenticated
  using (profile_id = (select private.current_profile_id()))
  with check (profile_id = (select private.current_profile_id()));

drop policy if exists "Athletes can view their team schedules" on public.team_training_schedules;
drop policy if exists "Coaches can view their team schedules" on public.team_training_schedules;

create policy team_training_schedules_athlete_select
  on public.team_training_schedules
  for select
  to authenticated
  using (
    (select private.is_athlete())
    and (select private.is_in_same_team(team_id))
  );

create policy team_training_schedules_coach_select
  on public.team_training_schedules
  for select
  to authenticated
  using (
    (select private.has_account_role('coach'))
    and (select private.is_coach_of_team(team_id))
  );
