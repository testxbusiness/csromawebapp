-- Fase 2B: la capacità admin sulle quote associative deriva dal ruolo account attivo.
drop policy if exists membership_fees_admin_all on public.membership_fees;

create policy membership_fees_admin_all
  on public.membership_fees
  for all
  to authenticated
  using ((select private.has_account_role('admin')))
  with check ((select private.has_account_role('admin')));

comment on policy membership_fees_admin_all
  on public.membership_fees
  is 'Admin access is resolved from active account_roles, never from JWT role claims.';
