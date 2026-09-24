begin;

-- This lookup only reads RLS-protected tables. It does not need elevated
-- privileges: callers must be constrained by the policies on schedules/teams.
alter function public.check_gym_schedule_conflicts(
  uuid, integer, time, time, uuid
) security invoker;
alter function public.check_gym_schedule_conflicts(
  uuid, integer, time, time, uuid
) set search_path = public;
revoke all on function public.check_gym_schedule_conflicts(uuid, integer, time, time, uuid) from public, anon;
grant execute on function public.check_gym_schedule_conflicts(uuid, integer, time, time, uuid) to authenticated, service_role;

-- This is a trigger implementation, not an application RPC. Trigger execution
-- is independent from Data API execute grants, so authenticated users do not
-- need direct access to it.
revoke all on function public.refresh_championship_standings() from public, anon, authenticated;
grant execute on function public.refresh_championship_standings() to service_role;

commit;
