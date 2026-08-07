-- Fase 2B: la capacità admin sugli eventi-squadra deriva dal ruolo account attivo.
drop policy if exists event_teams_admin_all on public.event_teams;

create policy event_teams_admin_all
  on public.event_teams
  for all
  to authenticated
  using ((select private.has_account_role('admin')))
  with check ((select private.has_account_role('admin')));

comment on policy event_teams_admin_all
  on public.event_teams
  is 'Admin access is resolved from active account_roles, never from JWT role claims.';
