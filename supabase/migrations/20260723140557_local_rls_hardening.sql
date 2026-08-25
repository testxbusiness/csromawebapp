-- Local-only hardening pass based on the read-only production advisor export.
-- Apply and verify this migration locally before considering any staging/prod work.

begin;

-- user_roles was the only public table without RLS in the local schema.
alter table public.user_roles enable row level security;

drop policy if exists user_roles_self_or_admin_select on public.user_roles;
create policy user_roles_self_or_admin_select
on public.user_roles
for select
to authenticated
using (profile_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists user_roles_admin_manage on public.user_roles;
create policy user_roles_admin_manage
on public.user_roles
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- Anonymous clients must not reach application tables through direct grants.
revoke all on all tables in schema public from anon;
-- These two relations are owned by the local Supabase administrative role and
-- therefore need an explicit revoke in addition to the schema-wide command.
revoke all on table
  public.championship_match_convocations,
  public.championship_match_convocation_members
from anon;

-- These policies were unconditional and defeated the intended ownership/role model.
drop policy if exists documents_admin_simple on public.documents;
drop policy if exists document_templates_admin_simple on public.document_templates;
drop policy if exists "Service role can manage all payments" on public.payments;

-- Keep templates readable by signed-in users, but make the authentication
-- requirement explicit instead of using a literal TRUE predicate.
alter policy "Authenticated users can view document templates"
on public.document_templates
using ((select auth.uid()) is not null);

-- Preserve the existing policy predicates while moving the JWT claim from the
-- user-editable user_metadata object to server-controlled app_metadata.
do $$
declare
  p record;
  updated_qual text;
  updated_check text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (qual like '%user_metadata%' or with_check like '%user_metadata%')
  loop
    updated_qual := replace(p.qual, '''user_metadata''', '''app_metadata''');
    updated_check := replace(p.with_check, '''user_metadata''', '''app_metadata''');

    if p.qual is distinct from updated_qual then
      execute format(
        'alter policy %I on %I.%I using (%s)',
        p.policyname, p.schemaname, p.tablename, updated_qual
      );
    end if;

    if p.with_check is distinct from updated_check then
      execute format(
        'alter policy %I on %I.%I with check (%s)',
        p.policyname, p.schemaname, p.tablename, updated_check
      );
    end if;
  end loop;
end;
$$;

-- Fix mutable search paths on the advisor-identified functions.
alter function public.check_gym_schedule_conflicts(
  uuid, integer, time, time, uuid
) set search_path = public;
alter function public.update_updated_at_column()
set search_path = public;
alter function public.refresh_championship_standings()
set search_path = public;

-- SECURITY DEFINER functions are not public RPC endpoints by default.
-- Keep authenticated execution only for functions used by RLS or the client.
revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;

-- Trigger-only and server-admin functions are not client RPCs.
revoke execute on function public.handle_cancelled_championship_match() from authenticated;
revoke execute on function public.messages_set_created_by() from authenticated;
revoke execute on function public.prevent_non_admin_role_change() from authenticated;
revoke execute on function public.sync_auth_users_to_profiles() from authenticated;
revoke execute on function public.sync_championship_match_event() from authenticated;
revoke execute on function public.sync_profile_role_to_app_metadata() from authenticated;
revoke execute on function public.update_user_role_safe(uuid, text) from authenticated;

grant execute on function public.can_view_athlete_profile(uuid) to authenticated;
grant execute on function public.can_view_teammate_profile(uuid) to authenticated;
grant execute on function public.coach_has_team_in_group(uuid) to authenticated;
grant execute on function public.coach_is_assigned_to_team(uuid) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_athlete() to authenticated;
grant execute on function public.is_coach() to authenticated;
grant execute on function public.is_coach_of_team(uuid) to authenticated;
grant execute on function public.is_in_same_team(uuid) to authenticated;
grant execute on function public.team_ids_for_coach() to authenticated;
grant execute on function public.check_gym_schedule_conflicts(uuid, integer, time, time, uuid) to authenticated;

-- The views are not used directly by the application today. Make them obey
-- the caller's RLS policies if they are queried locally.
alter view public.v_profiles set (security_invoker = true);
alter view public.championship_standings set (security_invoker = true);
revoke all on table public.v_profiles from anon, authenticated;
revoke all on table public.championship_standings from anon, authenticated;

-- The materialized view has no RLS support. Keep it inaccessible to anonymous
-- clients until its reads are moved behind a scoped server API.
revoke all on table public.championship_standings_mv from anon;

commit;
