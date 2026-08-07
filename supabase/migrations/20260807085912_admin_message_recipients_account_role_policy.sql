-- Fase 2B: la capacità admin sui destinatari messaggi deriva dal ruolo account attivo.
drop policy if exists message_recipients_admin_all on public.message_recipients;

create policy message_recipients_admin_all
  on public.message_recipients
  for all
  to authenticated
  using ((select private.has_account_role('admin')))
  with check ((select private.has_account_role('admin')));

comment on policy message_recipients_admin_all
  on public.message_recipients
  is 'Admin access is resolved from active account_roles, never from JWT role claims.';
