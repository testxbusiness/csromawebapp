-- Keep authorization roles in server-controlled app_metadata.
-- Apply through the Supabase migration runner or psql in the target environment.

create or replace function public.prevent_non_admin_role_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not exists (
       select 1
       from public.profiles
       where id = auth.uid()
         and role = 'admin'
     ) then
    raise exception 'only an admin may change a profile role'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.sync_profile_role_to_app_metadata()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', new.role)
  where id = new.id;

  return new;
end;
$$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role
before update of role on public.profiles
for each row
execute function public.prevent_non_admin_role_change();

drop trigger if exists sync_profile_role_to_app_metadata on public.profiles;
create trigger sync_profile_role_to_app_metadata
after insert or update of role on public.profiles
for each row
execute function public.sync_profile_role_to_app_metadata();

-- Backfill existing users once during the migration.
update auth.users u
set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('role', p.role)
from public.profiles p
where p.id = u.id
  and p.role in ('admin', 'coach', 'athlete');

revoke all on function public.prevent_non_admin_role_change() from public;
revoke all on function public.sync_profile_role_to_app_metadata() from public;
