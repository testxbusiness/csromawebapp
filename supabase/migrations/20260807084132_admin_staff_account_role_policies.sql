-- Fase 2B: l'accesso admin non dipende più da un claim JWT legacy.
drop policy if exists "Admins can manage predefined installments"
  on public.predefined_installments;

create policy "Admins can manage predefined installments"
  on public.predefined_installments
  for all
  to authenticated
  using ((select private.has_account_role('admin')))
  with check ((select private.has_account_role('admin')));

comment on policy "Admins can manage predefined installments"
  on public.predefined_installments
  is 'Admin access is resolved from active account_roles, never from JWT role claims.';
