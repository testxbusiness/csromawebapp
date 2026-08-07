-- Fase 2C: gli eventi coach sono autorizzati dal profilo proprietario
-- e dalle assegnazioni presenti in team_coaches.

drop policy if exists "Coaches can manage their team events" on public.events;
drop policy if exists "Coaches can view their team events" on public.events;
drop policy if exists "Coaches manage events for their teams" on public.events;
drop policy if exists events_coach_delete on public.events;
drop policy if exists events_coach_insert on public.events;
drop policy if exists events_coach_select on public.events;
drop policy if exists events_coach_update on public.events;

create policy events_coach_delete
  on public.events
  for delete
  to authenticated
  using (
    (select private.has_account_role('coach'))
    and (
      created_by = (select private.current_profile_id())
      or exists (
        select 1
        from public.event_teams et
        where et.event_id = events.id
          and (select private.is_coach_of_team(et.team_id))
      )
    )
  );

create policy events_coach_insert
  on public.events
  for insert
  to authenticated
  with check (
    (select private.has_account_role('coach'))
    and created_by = (select private.current_profile_id())
  );

create policy events_coach_select
  on public.events
  for select
  to authenticated
  using (
    (select private.has_account_role('coach'))
    and (
      created_by = (select private.current_profile_id())
      or exists (
        select 1
        from public.event_teams et
        where et.event_id = events.id
          and (select private.is_coach_of_team(et.team_id))
      )
    )
  );

create policy events_coach_update
  on public.events
  for update
  to authenticated
  using (
    (select private.has_account_role('coach'))
    and (
      created_by = (select private.current_profile_id())
      or exists (
        select 1
        from public.event_teams et
        where et.event_id = events.id
          and (select private.is_coach_of_team(et.team_id))
      )
    )
  )
  with check (
    (select private.has_account_role('coach'))
    and created_by = (select private.current_profile_id())
  );
