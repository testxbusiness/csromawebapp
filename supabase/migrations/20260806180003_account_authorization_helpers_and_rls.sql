-- Fase 1 / Migration 4: helper privati e policy iniziali per il modello account.
-- Le policy operative legacy restano invariate fino alle sottofasi 2A-2E.

begin;

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;

alter default privileges in schema private
  revoke all on tables from public, anon, authenticated;
alter default privileges in schema private
  revoke execute on functions from public, anon, authenticated;

create or replace function private.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public, auth, private
as $$
  select aa.owner_profile_id
  from public.app_accounts aa
  where aa.auth_user_id = (select auth.uid())
    and aa.status = 'active'
  limit 1
$$;

create or replace function private.has_account_role(p_role text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, private
as $$
  select exists (
    select 1
    from public.account_roles ar
    join public.app_accounts aa on aa.auth_user_id = ar.auth_user_id
    where ar.auth_user_id = (select auth.uid())
      and ar.role = p_role
      and aa.status = 'active'
  )
$$;

create or replace function private.has_active_relationship(p_target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, private
as $$
  select exists (
    select 1
    from public.profile_relationships pr
    where pr.source_profile_id = (select private.current_profile_id())
      and pr.target_profile_id = p_target_profile_id
      and pr.status = 'active'
      and pr.valid_from <= current_date
      and (pr.valid_until is null or pr.valid_until >= current_date)
  )
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, private
as $$
  select private.has_account_role('admin')
$$;

create or replace function private.is_coach()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, private
as $$
  select private.has_account_role('coach')
$$;

create or replace function private.is_athlete()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, private
as $$
  select exists (
    select 1
    from public.athlete_profiles ap
    where ap.profile_id = (select private.current_profile_id())
  )
  or exists (
    select 1
    from public.team_members tm
    where tm.profile_id = (select private.current_profile_id())
  )
$$;

create or replace function private.is_coach_of_team(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, private
as $$
  select exists (
    select 1
    from public.team_coaches tc
    where tc.team_id = p_team_id
      and tc.coach_id = (select private.current_profile_id())
  )
$$;

create or replace function private.is_in_same_team(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, private
as $$
  select exists (
    select 1
    from public.team_members tm
    where tm.team_id = p_team_id
      and tm.profile_id = (select private.current_profile_id())
  )
$$;

create or replace function private.team_ids_for_coach()
returns table(team_id uuid)
language sql
stable
security definer
set search_path = pg_catalog, public, auth, private
as $$
  select tc.team_id
  from public.team_coaches tc
  where tc.coach_id = (select private.current_profile_id())
    and (select private.is_coach())
$$;

create or replace function private.coach_is_assigned_to_team(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, private
as $$
  select private.is_coach_of_team(p_team_id)
$$;

create or replace function private.coach_has_team_in_group(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, private
as $$
  select exists (
    select 1
    from public.championship_group_teams cgt
    join public.championship_club_teams cct
      on cct.id = cgt.championship_club_team_id
    join public.teams t on t.id = cct.team_id
    where cgt.championship_group_id = p_group_id
      and private.is_coach_of_team(t.id)
  )
$$;

create or replace function private.can_view_athlete_profile(p_athlete_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, private
as $$
  select private.is_coach()
    and exists (
      select 1
      from public.team_members tm
      join public.team_coaches tc on tc.team_id = tm.team_id
      where tm.profile_id = p_athlete_profile_id
        and tc.coach_id = (select private.current_profile_id())
    )
$$;

create or replace function private.can_view_teammate_profile(p_teammate_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, private
as $$
  select private.is_athlete()
    and (
      exists (
        select 1
        from public.team_members tm1
        join public.team_members tm2 on tm2.team_id = tm1.team_id
        where tm1.profile_id = (select private.current_profile_id())
          and tm2.profile_id = p_teammate_profile_id
      )
      or exists (
        select 1
        from public.team_members tm
        join public.team_coaches tc on tc.team_id = tm.team_id
        where tm.profile_id = (select private.current_profile_id())
          and tc.coach_id = p_teammate_profile_id
      )
    )
$$;

revoke all on all functions in schema private from public, anon, authenticated;
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

-- Compatibilita: le firme pubbliche restano, ma delegano all'helper privato.
create or replace function public.is_admin()
returns boolean language sql stable security invoker
set search_path = pg_catalog, public, private, auth
as $$ select private.is_admin() $$;

create or replace function public.is_coach()
returns boolean language sql stable security invoker
set search_path = pg_catalog, public, private, auth
as $$ select private.is_coach() $$;

create or replace function public.is_athlete()
returns boolean language sql stable security invoker
set search_path = pg_catalog, public, private, auth
as $$ select private.is_athlete() $$;

create or replace function public.is_coach_of_team(team_uuid uuid)
returns boolean language sql stable security invoker
set search_path = pg_catalog, public, private, auth
as $$ select private.is_coach_of_team(team_uuid) $$;

create or replace function public.is_in_same_team(check_team_id uuid)
returns boolean language sql stable security invoker
set search_path = pg_catalog, public, private, auth
as $$ select private.is_in_same_team(check_team_id) $$;

create or replace function public.team_ids_for_coach()
returns table(team_id uuid) language sql stable security invoker
set search_path = pg_catalog, public, private, auth
as $$ select * from private.team_ids_for_coach() $$;

create or replace function public.coach_is_assigned_to_team(p_team_id uuid)
returns boolean language sql stable security invoker
set search_path = pg_catalog, public, private, auth
as $$ select private.coach_is_assigned_to_team(p_team_id) $$;

create or replace function public.coach_has_team_in_group(p_group_id uuid)
returns boolean language sql stable security invoker
set search_path = pg_catalog, public, private, auth
as $$ select private.coach_has_team_in_group(p_group_id) $$;

create or replace function public.can_view_athlete_profile(athlete_profile_id uuid)
returns boolean language sql stable security invoker
set search_path = pg_catalog, public, private, auth
as $$ select private.can_view_athlete_profile(athlete_profile_id) $$;

create or replace function public.can_view_teammate_profile(teammate_profile_id uuid)
returns boolean language sql stable security invoker
set search_path = pg_catalog, public, private, auth
as $$ select private.can_view_teammate_profile(teammate_profile_id) $$;

revoke all on function public.is_admin() from public, anon, authenticated;
revoke all on function public.is_coach() from public, anon, authenticated;
revoke all on function public.is_athlete() from public, anon, authenticated;
revoke all on function public.is_coach_of_team(uuid) from public, anon, authenticated;
revoke all on function public.is_in_same_team(uuid) from public, anon, authenticated;
revoke all on function public.team_ids_for_coach() from public, anon, authenticated;
revoke all on function public.coach_is_assigned_to_team(uuid) from public, anon, authenticated;
revoke all on function public.coach_has_team_in_group(uuid) from public, anon, authenticated;
revoke all on function public.can_view_athlete_profile(uuid) from public, anon, authenticated;
revoke all on function public.can_view_teammate_profile(uuid) from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.is_coach() to authenticated, service_role;
grant execute on function public.is_athlete() to authenticated, service_role;
grant execute on function public.is_coach_of_team(uuid) to authenticated, service_role;
grant execute on function public.is_in_same_team(uuid) to authenticated, service_role;
grant execute on function public.team_ids_for_coach() to authenticated, service_role;
grant execute on function public.coach_is_assigned_to_team(uuid) to authenticated, service_role;
grant execute on function public.coach_has_team_in_group(uuid) to authenticated, service_role;
grant execute on function public.can_view_athlete_profile(uuid) to authenticated, service_role;
grant execute on function public.can_view_teammate_profile(uuid) to authenticated, service_role;

-- I grant DML rendono raggiungibili le tabelle dal ruolo authenticated;
-- le policy sottostanti limitano ogni riga e ogni mutazione.
grant select, insert, update, delete on table public.app_accounts to authenticated;
grant select, insert, update, delete on table public.account_roles to authenticated;
grant select, insert, update, delete on table public.profile_relationships to authenticated;

drop policy if exists app_accounts_self_or_admin_select on public.app_accounts;
create policy app_accounts_self_or_admin_select
  on public.app_accounts for select to authenticated
  using (auth_user_id = (select auth.uid()) or (select private.has_account_role('admin')));

drop policy if exists app_accounts_admin_insert on public.app_accounts;
create policy app_accounts_admin_insert
  on public.app_accounts for insert to authenticated
  with check ((select private.has_account_role('admin')));

drop policy if exists app_accounts_admin_update on public.app_accounts;
create policy app_accounts_admin_update
  on public.app_accounts for update to authenticated
  using ((select private.has_account_role('admin')))
  with check ((select private.has_account_role('admin')));

drop policy if exists app_accounts_admin_delete on public.app_accounts;
create policy app_accounts_admin_delete
  on public.app_accounts for delete to authenticated
  using ((select private.has_account_role('admin')));

drop policy if exists account_roles_self_or_admin_select on public.account_roles;
create policy account_roles_self_or_admin_select
  on public.account_roles for select to authenticated
  using (auth_user_id = (select auth.uid()) or (select private.has_account_role('admin')));

drop policy if exists account_roles_admin_insert on public.account_roles;
create policy account_roles_admin_insert
  on public.account_roles for insert to authenticated
  with check ((select private.has_account_role('admin')));

drop policy if exists account_roles_admin_update on public.account_roles;
create policy account_roles_admin_update
  on public.account_roles for update to authenticated
  using ((select private.has_account_role('admin')))
  with check ((select private.has_account_role('admin')));

drop policy if exists account_roles_admin_delete on public.account_roles;
create policy account_roles_admin_delete
  on public.account_roles for delete to authenticated
  using ((select private.has_account_role('admin')));

drop policy if exists profile_relationships_self_or_admin_select on public.profile_relationships;
create policy profile_relationships_self_or_admin_select
  on public.profile_relationships for select to authenticated
  using (
    source_profile_id = (select private.current_profile_id())
    or target_profile_id = (select private.current_profile_id())
    or (select private.has_account_role('admin'))
  );

drop policy if exists profile_relationships_admin_insert on public.profile_relationships;
create policy profile_relationships_admin_insert
  on public.profile_relationships for insert to authenticated
  with check ((select private.has_account_role('admin')));

drop policy if exists profile_relationships_admin_update on public.profile_relationships;
create policy profile_relationships_admin_update
  on public.profile_relationships for update to authenticated
  using ((select private.has_account_role('admin')))
  with check ((select private.has_account_role('admin')));

drop policy if exists profile_relationships_admin_delete on public.profile_relationships;
create policy profile_relationships_admin_delete
  on public.profile_relationships for delete to authenticated
  using ((select private.has_account_role('admin')));

comment on schema private is
  'Non-exposed authorization helpers; access is granted function by function.';

commit;
