-- Fase 2E, slice 3: remove duplicate financial policies that still rely on
-- legacy role/profile assumptions. Financial values and rows are unchanged.

drop policy if exists "Admins can manage all payments" on public.payments;
drop policy if exists "Admins can manage membership fees" on public.membership_fees;
drop policy if exists "Admins can manage fee installments" on public.fee_installments;
drop policy if exists "Users can view their own fee installments" on public.fee_installments;
drop policy if exists membership_fees_admin_all on public.membership_fees;
drop policy if exists fee_installments_admin_all on public.fee_installments;

create policy payments_admin_all
  on public.payments
  for all
  to authenticated
  using ((select private.has_account_role('admin')))
  with check ((select private.has_account_role('admin')));

create policy membership_fees_admin_all
  on public.membership_fees
  for all
  to authenticated
  using ((select private.has_account_role('admin')))
  with check ((select private.has_account_role('admin')));

create policy fee_installments_admin_all
  on public.fee_installments
  for all
  to authenticated
  using ((select private.has_account_role('admin')))
  with check ((select private.has_account_role('admin')));
