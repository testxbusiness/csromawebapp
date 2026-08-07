-- Fase 2B: solo un account admin attivo può creare profili tramite RLS.
drop policy if exists profiles_insert_admin_only on public.profiles;

create policy profiles_insert_admin_only
  on public.profiles
  for insert
  to authenticated
  with check ((select private.has_account_role('admin')));

comment on policy profiles_insert_admin_only
  on public.profiles
  is 'Profile inserts require an active admin account role, never a JWT role claim.';
