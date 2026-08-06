-- Fase 2A / Migration 5: account context e accesso personale.
-- Le policy di dominio non-self restano legacy fino alle sottofasi successive.

begin;

-- current_profile_id() considera autorevole solo un account active. Queste policy
-- eliminano i fallback self diretti su auth.uid() per bloccare invited/suspended/disabled.

drop policy if exists app_accounts_self_or_admin_select on public.app_accounts;
create policy app_accounts_self_or_admin_select
  on public.app_accounts for select to authenticated
  using (
    (auth_user_id = (select auth.uid()) and status = 'active')
    or (select private.has_account_role('admin'))
  );

drop policy if exists account_roles_self_or_admin_select on public.account_roles;
create policy account_roles_self_or_admin_select
  on public.account_roles for select to authenticated
  using (
    (
      auth_user_id = (select auth.uid())
      and exists (
        select 1
        from public.app_accounts aa
        where aa.auth_user_id = (select auth.uid())
          and aa.status = 'active'
      )
    )
    or (select private.has_account_role('admin'))
  );

drop policy if exists "Users can view their own profile" on public.profiles;
drop policy if exists profiles_select_self_or_admin on public.profiles;
drop policy if exists profiles_update_self_or_admin on public.profiles;
drop policy if exists profiles_self_or_admin_select on public.profiles;
drop policy if exists profiles_self_or_admin_update on public.profiles;

create policy profiles_self_or_admin_select
  on public.profiles for select to authenticated
  using (
    id = (select private.current_profile_id())
    or (select private.has_account_role('admin'))
  );

create policy profiles_self_or_admin_update
  on public.profiles for update to authenticated
  using (
    id = (select private.current_profile_id())
    or (select private.has_account_role('admin'))
  )
  with check (
    id = (select private.current_profile_id())
    or (select private.has_account_role('admin'))
  );

commit;
