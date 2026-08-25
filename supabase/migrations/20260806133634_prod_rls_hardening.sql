-- Production hardening migration prepared from the read-only 2026-07-29
-- production snapshot. Review and test against a staging database before use.
-- This file is intentionally not applied by this task.

begin;

-- Keep authorization roles in server-controlled app_metadata. Existing JWTs
-- may need a refresh after this migration is applied.
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

-- Backfill existing production users before policy predicates start reading
-- app_metadata. This changes only the server-controlled role claim.
update auth.users u
set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('role', p.role)
from public.profiles p
where p.id = u.id
  and p.role in ('admin', 'coach', 'athlete');

-- user_roles must be restricted to the current user or an administrator.
alter table public.user_roles enable row level security;
drop policy if exists user_roles_self_or_admin_select on public.user_roles;
create policy user_roles_self_or_admin_select
on public.user_roles
for select
to authenticated
using (profile_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists user_roles_admin_manage on public.user_roles;
create policy user_roles_admin_manage
on public.user_roles
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- Anonymous clients must not reach application tables through direct grants.
revoke all on all tables in schema public from anon;
revoke all on table
  public.championship_match_convocations,
  public.championship_match_convocation_members
from anon;

-- Remove unconditional administrative bypasses from sensitive relations.
drop policy if exists documents_admin_simple on public.documents;
drop policy if exists document_templates_admin_simple on public.document_templates;
drop policy if exists "Service role can manage all payments" on public.payments;

-- Preserve the existing authenticated read model while avoiding literal TRUE
-- predicates in policies.
alter policy "Authenticated users can view activities"
on public.activities
using ((select auth.uid()) is not null);

alter policy "Authenticated users can view gyms"
on public.gyms
using ((select auth.uid()) is not null);

alter policy "Authenticated users can view document templates"
on public.document_templates
using ((select auth.uid()) is not null);

alter policy championship_club_teams_auth_select
on public.championship_club_teams
using ((select auth.uid()) is not null);

alter policy championship_group_teams_auth_select
on public.championship_group_teams
using ((select auth.uid()) is not null);

alter policy championship_groups_auth_select
on public.championship_groups
using ((select auth.uid()) is not null);

alter policy championship_match_sets_auth_select
on public.championship_match_sets
using ((select auth.uid()) is not null);

alter policy championship_matches_auth_select
on public.championship_matches
using ((select auth.uid()) is not null);

alter policy championships_auth_select
on public.championships
using ((select auth.uid()) is not null);

-- Replace the user-editable JWT metadata object with server-controlled
-- app_metadata while preserving each existing ownership predicate.
do $$
declare
  p record;
  updated_qual text;
  updated_check text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (qual like '%user_metadata%' or with_check like '%user_metadata%')
  loop
    updated_qual := replace(p.qual, '''user_metadata''', '''app_metadata''');
    updated_check := replace(p.with_check, '''user_metadata''', '''app_metadata''');

    if p.qual is distinct from updated_qual then
      execute format(
        'alter policy %I on %I.%I using (%s)',
        p.policyname, p.schemaname, p.tablename, updated_qual
      );
    end if;

    if p.with_check is distinct from updated_check then
      execute format(
        'alter policy %I on %I.%I with check (%s)',
        p.policyname, p.schemaname, p.tablename, updated_check
      );
    end if;
  end loop;
end;
$$;

-- Fix mutable search paths on advisor-identified SECURITY DEFINER functions.
alter function public.check_gym_schedule_conflicts(
  uuid, integer, time, time, uuid
) set search_path = public;
alter function public.update_updated_at_column()
set search_path = public;
alter function public.refresh_championship_standings()
set search_path = public;

-- Trigger-only and server-admin functions are not public RPC endpoints.
revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;
revoke execute on function public.prevent_non_admin_role_change() from authenticated;
revoke execute on function public.sync_profile_role_to_app_metadata() from authenticated;
revoke execute on function public.messages_set_created_by() from authenticated;
revoke execute on function public.sync_auth_users_to_profiles() from authenticated;
revoke execute on function public.sync_championship_match_event() from authenticated;
revoke execute on function public.update_user_role_safe(uuid, text) from authenticated;

grant execute on function public.can_view_athlete_profile(uuid) to authenticated;
grant execute on function public.can_view_teammate_profile(uuid) to authenticated;
grant execute on function public.coach_has_team_in_group(uuid) to authenticated;
grant execute on function public.coach_is_assigned_to_team(uuid) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_athlete() to authenticated;
grant execute on function public.is_coach() to authenticated;
grant execute on function public.is_coach_of_team(uuid) to authenticated;
grant execute on function public.is_in_same_team(uuid) to authenticated;
grant execute on function public.team_ids_for_coach() to authenticated;
grant execute on function public.check_gym_schedule_conflicts(uuid, integer, time, time, uuid) to authenticated;

-- These views are not used directly by the application today. Make them obey
-- caller RLS and revoke direct Data API access.
alter view public.v_profiles set (security_invoker = true);
alter view public.championship_standings set (security_invoker = true);
revoke all on table public.v_profiles from anon, authenticated;
revoke all on table public.championship_standings from anon, authenticated;
revoke all on table public.championship_standings_mv from anon, authenticated;

-- Private Storage boundary for message attachments.
drop policy if exists "message attachments authenticated upload" on storage.objects;
create policy "message attachments authenticated upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'message-attachments'
  and (select auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'coach')
  and (storage.foldername(name))[1] in ('messages', 'draft')
  and (storage.foldername(name))[2] = ((select auth.uid())::text)
);

drop policy if exists "message attachments owner cleanup" on storage.objects;
create policy "message attachments owner cleanup"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'message-attachments'
  and (select auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'coach')
  and (storage.foldername(name))[1] in ('messages', 'draft')
  and (storage.foldername(name))[2] = ((select auth.uid())::text)
);

-- Private Storage boundary for generated PDFs.
drop policy if exists "documents admin upload generated" on storage.objects;
create policy "documents admin upload generated"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'documents'
  and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and (storage.foldername(name))[1] = 'generated'
);

drop policy if exists "documents admin read generated" on storage.objects;
create policy "documents admin read generated"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'documents'
  and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and (storage.foldername(name))[1] = 'generated'
);

drop policy if exists "documents admin update generated" on storage.objects;
create policy "documents admin update generated"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'documents'
  and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and (storage.foldername(name))[1] = 'generated'
)
with check (
  bucket_id = 'documents'
  and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and (storage.foldername(name))[1] = 'generated'
);

drop policy if exists "documents admin delete generated" on storage.objects;
create policy "documents admin delete generated"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'documents'
  and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and (storage.foldername(name))[1] = 'generated'
);

commit;
