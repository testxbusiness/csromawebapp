-- Fase 3: provisioning account, primo slice.
-- La funzione atomizza esclusivamente il mapping Auth -> persona e il ruolo globale.

begin;

create or replace function public.provision_account_mapping(
  p_auth_user_id uuid,
  p_owner_profile_id uuid,
  p_role text
)
returns table (
  auth_user_id uuid,
  owner_profile_id uuid,
  status text,
  role text
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if p_auth_user_id is null or p_owner_profile_id is null then
    raise exception 'account mapping requires Auth user and profile'
      using errcode = '22023';
  end if;

  if p_role not in ('admin', 'coach', 'staff') then
    raise exception 'unsupported account role: %', p_role
      using errcode = '22023';
  end if;

  if not exists (select 1 from auth.users au where au.id = p_auth_user_id) then
    raise exception 'Auth user does not exist'
      using errcode = '23503';
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_owner_profile_id) then
    raise exception 'owner profile does not exist'
      using errcode = '23503';
  end if;

  if exists (select 1 from public.app_accounts aa where aa.auth_user_id = p_auth_user_id)
     or exists (select 1 from public.app_accounts aa where aa.owner_profile_id = p_owner_profile_id) then
    raise exception 'Auth user or owner profile is already mapped'
      using errcode = '23505';
  end if;

  insert into public.app_accounts (
    auth_user_id,
    owner_profile_id,
    status,
    must_change_password,
    invited_at
  ) values (
    p_auth_user_id,
    p_owner_profile_id,
    'invited',
    true,
    now()
  );

  insert into public.account_roles (auth_user_id, role)
  values (p_auth_user_id, p_role);

  return query
  select p_auth_user_id, p_owner_profile_id, 'invited'::text, p_role;
end;
$$;

revoke all on function public.provision_account_mapping(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.provision_account_mapping(uuid, uuid, text) to service_role;

comment on function public.provision_account_mapping(uuid, uuid, text) is
  'Atomically creates the account-to-person mapping and one global account role; service-role only.';

commit;
