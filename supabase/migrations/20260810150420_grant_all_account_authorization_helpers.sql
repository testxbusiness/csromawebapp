-- Riallinea i grant degli helper privati usati dalle policy account-based.
-- Idempotente e sicura su ambienti che hanno già i permessi corretti.

begin;

grant usage on schema private to authenticated, service_role;
grant execute on function private.current_profile_id() to authenticated, service_role;
grant execute on function private.has_account_role(text) to authenticated, service_role;
grant execute on function private.has_active_relationship(uuid) to authenticated, service_role;
grant execute on function private.is_admin() to authenticated, service_role;
grant execute on function private.is_coach() to authenticated, service_role;
grant execute on function private.is_athlete() to authenticated, service_role;
grant execute on function private.is_coach_of_team(uuid) to authenticated, service_role;
grant execute on function private.is_in_same_team(uuid) to authenticated, service_role;
grant execute on function private.team_ids_for_coach() to authenticated, service_role;
grant execute on function private.coach_is_assigned_to_team(uuid) to authenticated, service_role;
grant execute on function private.coach_has_team_in_group(uuid) to authenticated, service_role;
grant execute on function private.can_view_athlete_profile(uuid) to authenticated, service_role;
grant execute on function private.can_view_teammate_profile(uuid) to authenticated, service_role;

commit;
