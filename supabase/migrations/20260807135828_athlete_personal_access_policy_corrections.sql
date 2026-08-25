-- Forward correction for environments that already applied the first Fase 2D migration.
drop policy if exists "Users can view their team memberships" on public.team_members;
create policy "Users can view their team memberships"
  on public.team_members
  for select
  to authenticated
  using (profile_id = (select private.current_profile_id()));

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
