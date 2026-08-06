-- Verifiche post-applicazione della Migration 1.
-- Eseguire sul database locale o staging, mai su produzione senza approvazione.

select to_regclass('public.app_accounts') as app_accounts;
select to_regclass('public.account_roles') as account_roles;
select to_regclass('public.profile_relationships') as profile_relationships;

select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('app_accounts', 'account_roles', 'profile_relationships')
order by c.relname;

select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in (
  'public.app_accounts'::regclass,
  'public.account_roles'::regclass,
  'public.profile_relationships'::regclass
)
order by conrelid::regclass::text, conname;

select count(*) as production_rows_must_remain_zero
from public.app_accounts;
