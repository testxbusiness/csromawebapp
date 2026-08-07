-- Fase 2B: la capacità admin sugli orari deriva dal ruolo account attivo.
drop policy if exists "Admins can manage all training schedules"
  on public.team_training_schedules;

create policy "Admins can manage all training schedules"
  on public.team_training_schedules
  for all
  to authenticated
  using ((select private.has_account_role('admin')))
  with check ((select private.has_account_role('admin')));

comment on policy "Admins can manage all training schedules"
  on public.team_training_schedules
  is 'Admin access is resolved from active account_roles, never from JWT role claims.';
