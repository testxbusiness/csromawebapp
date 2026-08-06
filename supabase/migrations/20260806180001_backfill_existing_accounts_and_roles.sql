-- Fase 1 / Migration 2: backfill idempotente degli account e dei ruoli legacy.
-- Eseguire dopo create_account_person_model e solo su ambienti non-prod approvati.

begin;

insert into public.app_accounts (
  auth_user_id,
  owner_profile_id,
  status,
  must_change_password,
  invited_at,
  activated_at,
  disabled_at,
  created_at,
  updated_at
)
select
  au.id,
  p.id,
  case
    when p.is_active = false then 'disabled'
    when au.invited_at is not null and au.last_sign_in_at is null then 'invited'
    else 'active'
  end,
  coalesce(p.must_change_password, false),
  au.invited_at,
  au.last_sign_in_at,
  case when p.is_active = false then coalesce(p.updated_at, now()) end,
  coalesce(p.created_at, now()),
  now()
from auth.users au
join public.profiles p on p.id = au.id
on conflict (auth_user_id) do update
set status = excluded.status,
    must_change_password = excluded.must_change_password,
    invited_at = excluded.invited_at,
    activated_at = excluded.activated_at,
    disabled_at = excluded.disabled_at,
    updated_at = now();

with legacy_roles as (
  select p.id as profile_id, p.role::text as role
  from public.profiles p
  where p.role in ('admin', 'coach')
  union
  select ur.profile_id, ur.role::text
  from public.user_roles ur
  where ur.role in ('admin', 'coach')
)
insert into public.account_roles (auth_user_id, role, created_at, updated_at)
select aa.auth_user_id, lr.role, now(), now()
from legacy_roles lr
join public.app_accounts aa on aa.owner_profile_id = lr.profile_id
on conflict (auth_user_id, role) do update
set updated_at = now();

do $$
begin
  if exists (
    select 1
    from auth.users au
    left join public.app_accounts aa on aa.auth_user_id = au.id
    where aa.auth_user_id is null
  ) then
    raise exception 'backfill failed: Auth user without app account mapping';
  end if;

  if exists (
    select 1
    from public.app_accounts aa
    left join public.profiles p on p.id = aa.owner_profile_id
    where p.id is null
  ) then
    raise exception 'backfill failed: app account without profile owner';
  end if;

  if exists (
    select owner_profile_id
    from public.app_accounts
    group by owner_profile_id
    having count(*) <> 1
  ) then
    raise exception 'backfill failed: profile owner mapping is not one-to-one';
  end if;

  if exists (
    select 1
    from public.account_roles
    where role = 'athlete'
  ) then
    raise exception 'backfill failed: athlete must not be a global account role';
  end if;
end;
$$;

commit;
