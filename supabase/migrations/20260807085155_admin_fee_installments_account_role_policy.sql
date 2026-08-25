-- Fase 2B: la capacità admin sulle rate deriva dal ruolo account attivo.
drop policy if exists fee_installments_admin_all on public.fee_installments;

create policy fee_installments_admin_all
  on public.fee_installments
  for all
  to authenticated
  using ((select private.has_account_role('admin')))
  with check ((select private.has_account_role('admin')));

comment on policy fee_installments_admin_all
  on public.fee_installments
  is 'Admin access is resolved from active account_roles, never from JWT role claims.';
