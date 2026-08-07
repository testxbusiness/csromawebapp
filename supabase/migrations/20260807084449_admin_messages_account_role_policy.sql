-- Fase 2B: la capacità admin dei messaggi deriva dal ruolo account attivo.
drop policy if exists messages_admin_all on public.messages;

create policy messages_admin_all
  on public.messages
  for all
  to authenticated
  using ((select private.has_account_role('admin')))
  with check ((select private.has_account_role('admin')));

comment on policy messages_admin_all
  on public.messages
  is 'Admin access is resolved from active account_roles, never from JWT role claims.';
