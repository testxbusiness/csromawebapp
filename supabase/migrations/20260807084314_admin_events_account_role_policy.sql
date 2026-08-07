-- Fase 2B: la capacità admin degli eventi deriva dal ruolo account attivo.
drop policy if exists events_admin_all on public.events;

create policy events_admin_all
  on public.events
  for all
  to authenticated
  using ((select private.has_account_role('admin')))
  with check ((select private.has_account_role('admin')));

comment on policy events_admin_all
  on public.events
  is 'Admin access is resolved from active account_roles, never from JWT role claims.';
