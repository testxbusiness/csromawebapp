-- Fase 2E, slice 1: push subscriptions belong to the mapped person profile.
-- Auth UUID is used only to resolve the account, never as profile_id.

drop policy if exists "Users can manage their own push subscriptions" on public.push_subscriptions;
drop policy if exists push_subscriptions_owner_all on public.push_subscriptions;
drop policy if exists push_subscriptions_admin_read on public.push_subscriptions;

create policy push_subscriptions_owner_all
  on public.push_subscriptions
  for all
  to authenticated
  using (profile_id = (select private.current_profile_id()))
  with check (profile_id = (select private.current_profile_id()));

create policy push_subscriptions_admin_read
  on public.push_subscriptions
  for select
  to authenticated
  using ((select private.has_account_role('admin')));
