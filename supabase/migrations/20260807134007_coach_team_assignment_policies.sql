-- Fase 2C: l'accesso coach alle squadre deriva esclusivamente da
-- account_roles.coach + current_profile_id() -> team_coaches.

-- Teams: elimina il fallback team_members.role / teams.coach_id.
drop policy if exists "Coaches can view their teams" on public.teams;
create policy "Coaches can view their teams"
  on public.teams
  for select
  to authenticated
  using (
    (select private.has_account_role('coach'))
    and id in (select private.team_ids_for_coach())
  );

drop policy if exists teams_coach_select on public.teams;
create policy teams_coach_select
  on public.teams
  for select
  to authenticated
  using (
    (select private.has_account_role('coach'))
    and (select private.is_coach_of_team(id))
  );

drop policy if exists "Coaches can manage their teams" on public.teams;
create policy "Coaches can manage their teams"
  on public.teams
  for all
  to authenticated
  using ((select private.is_coach_of_team(id)))
  with check ((select private.is_coach_of_team(id)));

drop policy if exists "Coaches can delete their teams" on public.teams;

drop policy if exists "Coaches can update their teams" on public.teams;

-- Team members and assignments: every coach operation is team-assignment scoped.
drop policy if exists "Coaches can view team members in own teams" on public.team_members;
create policy "Coaches can view team members in own teams"
  on public.team_members
  for select
  to authenticated
  using ((select private.is_coach_of_team(team_id)));

drop policy if exists "Coaches can insert team members" on public.team_members;
create policy "Coaches can insert team members"
  on public.team_members
  for insert
  to authenticated
  with check ((select private.is_coach_of_team(team_id)));

drop policy if exists "Coaches can update team members" on public.team_members;
create policy "Coaches can update team members"
  on public.team_members
  for update
  to authenticated
  using ((select private.is_coach_of_team(team_id)))
  with check ((select private.is_coach_of_team(team_id)));

drop policy if exists "Coaches can delete team members" on public.team_members;
create policy "Coaches can delete team members"
  on public.team_members
  for delete
  to authenticated
  using ((select private.is_coach_of_team(team_id)));

drop policy if exists "Coaches can view coaches in their teams" on public.team_coaches;
create policy "Coaches can view coaches in their teams"
  on public.team_coaches
  for select
  to authenticated
  using ((select private.is_coach_of_team(team_id)));

-- Event/team association and standard schedules.
drop policy if exists "Coaches can view event teams" on public.event_teams;
create policy "Coaches can view event teams"
  on public.event_teams
  for select
  to authenticated
  using ((select private.is_coach_of_team(team_id)));

drop policy if exists event_teams_coach_select on public.event_teams;
create policy event_teams_coach_select
  on public.event_teams
  for select
  to authenticated
  using ((select private.is_coach_of_team(team_id)));

drop policy if exists event_teams_coach_insert on public.event_teams;
create policy event_teams_coach_insert
  on public.event_teams
  for insert
  to authenticated
  with check ((select private.is_coach_of_team(team_id)));

drop policy if exists event_teams_coach_update on public.event_teams;
create policy event_teams_coach_update
  on public.event_teams
  for update
  to authenticated
  using ((select private.is_coach_of_team(team_id)))
  with check ((select private.is_coach_of_team(team_id)));

drop policy if exists event_teams_coach_delete on public.event_teams;
create policy event_teams_coach_delete
  on public.event_teams
  for delete
  to authenticated
  using ((select private.is_coach_of_team(team_id)));

drop policy if exists "Coaches can manage their team event associations" on public.event_teams;
create policy "Coaches can manage their team event associations"
  on public.event_teams
  for all
  to authenticated
  using ((select private.is_coach_of_team(team_id)))
  with check ((select private.is_coach_of_team(team_id)));

drop policy if exists "Coaches can view their team schedules" on public.team_training_schedules;
create policy "Coaches can view their team schedules"
  on public.team_training_schedules
  for select
  to authenticated
  using ((select private.is_coach_of_team(team_id)));

-- Coach visibility of fees/installments/payments uses the owned person profile.
drop policy if exists "Coaches can view their team fees" on public.membership_fees;
drop policy if exists "Coaches view membership fees of own teams" on public.membership_fees;
drop policy if exists membership_fees_coach_select on public.membership_fees;
create policy membership_fees_coach_select
  on public.membership_fees
  for select
  to authenticated
  using ((select private.is_coach_of_team(team_id)));

drop policy if exists fee_installments_coach_select on public.fee_installments;
create policy fee_installments_coach_select
  on public.fee_installments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.membership_fees mf
      where mf.id = fee_installments.membership_fee_id
        and (select private.is_coach_of_team(mf.team_id))
    )
  );

drop policy if exists "Coaches can view their payments" on public.payments;
create policy "Coaches can view their payments"
  on public.payments
  for select
  to authenticated
  using (
    (select private.has_account_role('coach'))
    and coach_id = (select private.current_profile_id())
  );

drop policy if exists "Coaches can view RSVP for their teams" on public.rsvp;
create policy "Coaches can view RSVP for their teams"
  on public.rsvp
  for select
  to authenticated
  using (
    event_id in (
      select et.event_id
      from public.event_teams et
      where et.team_id in (select private.team_ids_for_coach())
    )
  );
