-- Fase 2B: la capacità admin sui destinatari documenti deriva dal ruolo account attivo.
drop policy if exists document_recipients_admin_all on public.document_recipients;

create policy document_recipients_admin_all
  on public.document_recipients
  for all
  to authenticated
  using ((select private.has_account_role('admin')))
  with check ((select private.has_account_role('admin')));

comment on policy document_recipients_admin_all
  on public.document_recipients
  is 'Admin access is resolved from active account_roles, never from JWT role claims.';
