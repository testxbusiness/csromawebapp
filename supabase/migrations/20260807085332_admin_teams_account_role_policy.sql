-- Fase 2B: la capacità admin sulle squadre deriva dal ruolo account attivo.
drop policy if exists teams_admin_all on public.teams;

create policy teams_admin_all
  on public.teams
  for all
  to authenticated
  using ((select private.has_account_role('admin')))
  with check ((select private.has_account_role('admin')));

comment on policy teams_admin_all
  on public.teams
  is 'Admin access is resolved from active account_roles, never from JWT role claims.';
