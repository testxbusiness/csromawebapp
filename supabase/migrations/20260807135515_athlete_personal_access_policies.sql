-- Fase 2D: l'accesso atleta deriva dalla persona proprietaria e dai dati sportivi,
-- mai da account_roles.athlete, profiles.role o claim JWT.

drop policy if exists "Users can view their team memberships" on public.team_members;
create policy "Users can view their team memberships"
  on public.team_members
  for select
  to authenticated
  using (profile_id = (select private.current_profile_id()));

drop policy if exists "Athlete can read own athlete_profile" on public.athlete_profiles;
create policy "Athlete can read own athlete_profile"
  on public.athlete_profiles
  for select
  to authenticated
  using (
    (select private.is_athlete())
    and profile_id = (select private.current_profile_id())
  );

drop policy if exists "Athletes can view coaches of their teams" on public.team_coaches;
create policy "Athletes can view coaches of their teams"
  on public.team_coaches
  for select
  to authenticated
  using (
    (select private.is_athlete())
    and (select private.is_in_same_team(team_id))
  );

drop policy if exists "Athletes can view event teams" on public.event_teams;
drop policy if exists event_teams_athlete_select on public.event_teams;
create policy event_teams_athlete_select
  on public.event_teams
  for select
  to authenticated
  using (
    (select private.is_athlete())
    and (select private.is_in_same_team(team_id))
  );

drop policy if exists "Athletes can view events for their teams" on public.events;
drop policy if exists events_athlete_select on public.events;
create policy events_athlete_select
  on public.events
  for select
  to authenticated
  using (
    (select private.is_athlete())
    and exists (
      select 1
      from public.event_teams et
      where et.event_id = events.id
        and (select private.is_in_same_team(et.team_id))
    )
  );

drop policy if exists "Athletes can view members of their teams" on public.team_members;
create policy "Athletes can view members of their teams"
  on public.team_members
  for select
  to authenticated
  using (
    (select private.is_athlete())
    and (select private.is_in_same_team(team_id))
  );

drop policy if exists "Athletes can view teammate profiles" on public.profiles;
create policy "Athletes can view teammate profiles"
  on public.profiles
  for select
  to authenticated
  using (
    (select private.is_athlete())
    and (select private.can_view_teammate_profile(id))
  );

drop policy if exists "Athletes can view their team schedules" on public.team_training_schedules;
create policy "Athletes can view their team schedules"
  on public.team_training_schedules
  for select
  to authenticated
  using (
    (select private.is_athlete())
    and (select private.is_in_same_team(team_id))
  );

drop policy if exists "Athletes can view their teams" on public.teams;
drop policy if exists teams_athlete_select on public.teams;
create policy teams_athlete_select
  on public.teams
  for select
  to authenticated
  using (
    (select private.is_athlete())
    and (select private.is_in_same_team(id))
  );

drop policy if exists fee_installments_athlete_select on public.fee_installments;
create policy fee_installments_athlete_select
  on public.fee_installments
  for select
  to authenticated
  using (
    profile_id = (select private.current_profile_id())
  );

drop policy if exists membership_fees_athlete_select on public.membership_fees;
create policy membership_fees_athlete_select
  on public.membership_fees
  for select
  to authenticated
  using (
    (select private.is_athlete())
    and (select private.is_in_same_team(team_id))
  );

drop policy if exists message_recipients_athlete_select on public.message_recipients;
create policy message_recipients_athlete_select
  on public.message_recipients
  for select
  to authenticated
  using (
    (select private.is_athlete())
    and (
      profile_id = (select private.current_profile_id())
      or (team_id is not null and (select private.is_in_same_team(team_id)))
    )
  );

drop policy if exists messages_athlete_select on public.messages;
create policy messages_athlete_select
  on public.messages
  for select
  to authenticated
  using (
    (select private.is_athlete())
    and exists (
      select 1
      from public.message_recipients mr
      where mr.message_id = messages.id
        and (
          mr.profile_id = (select private.current_profile_id())
          or (mr.team_id is not null and (select private.is_in_same_team(mr.team_id)))
        )
    )
  );

-- RSVP personale: il profilo è la persona proprietaria, non l'UUID Auth.
drop policy if exists "Users can manage their own RSVP" on public.rsvp;
create policy "Users can manage their own RSVP"
  on public.rsvp
  for all
  to authenticated
  using (profile_id = (select private.current_profile_id()))
  with check (profile_id = (select private.current_profile_id()));

drop policy if exists insert_own_attendance on public.event_attendances;
create policy insert_own_attendance
  on public.event_attendances
  for insert
  to authenticated
  with check (profile_id = (select private.current_profile_id()));

drop policy if exists update_own_attendance on public.event_attendances;
create policy update_own_attendance
  on public.event_attendances
  for update
  to authenticated
  using (profile_id = (select private.current_profile_id()))
  with check (profile_id = (select private.current_profile_id()));

drop policy if exists delete_own_attendance on public.event_attendances;
create policy delete_own_attendance
  on public.event_attendances
  for delete
  to authenticated
  using (profile_id = (select private.current_profile_id()));

drop policy if exists read_attendance_for_related_events on public.event_attendances;
create policy read_attendance_for_related_events
  on public.event_attendances
  for select
  to authenticated
  using (profile_id = (select private.current_profile_id()));
