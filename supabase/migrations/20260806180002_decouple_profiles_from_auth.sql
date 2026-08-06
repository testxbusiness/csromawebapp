-- Fase 1 / Migration 3: disaccoppia l'anagrafica dall'account Auth.
-- Gli ID e i valori legacy restano invariati per compatibilità applicativa.

begin;

alter table public.profiles
  drop constraint if exists profiles_id_fkey;

alter table public.profiles
  alter column id set default gen_random_uuid(),
  alter column email drop not null,
  alter column role drop not null;

-- Neutralizza il drift tra ambienti: nel dump aggiornato il trigger non esiste,
-- ma non deve essere ricreato da un ambiente più vecchio.
drop trigger if exists sync_auth_users_to_profiles_trigger on auth.users;

-- La funzione resta temporaneamente per compatibilità/rollback, ma non è più
-- invocabile dagli utenti via PUBLIC, anon o authenticated.
revoke execute on function public.sync_auth_users_to_profiles() from public, anon, authenticated;

comment on function public.sync_auth_users_to_profiles() is
  'DEPRECATED: legacy Auth-to-profile synchronization retained only for controlled rollback; no trigger is installed.';

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_id_fkey'
  ) then
    raise exception 'decouple failed: profiles_id_fkey still exists';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name in ('email', 'role')
      and is_nullable = 'NO'
  ) then
    raise exception 'decouple failed: profiles email or role is still NOT NULL';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'id'
      and column_default like '%gen_random_uuid%'
  ) then
    raise exception 'decouple failed: profiles.id has no gen_random_uuid default';
  end if;
end;
$$;

commit;
