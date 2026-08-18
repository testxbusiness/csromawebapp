-- Fase 5 / Migration 13: letture per account/soggetto e push account-based.
-- Le colonne legacy restano in dual-read fino alla Fase 6.

begin;

create table if not exists public.message_reads (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null
    references public.messages (id) on delete cascade,
  auth_user_id uuid not null
    references auth.users (id) on delete cascade,
  subject_profile_id uuid not null
    references public.profiles (id) on delete restrict,
  read_at timestamptz not null default now(),
  constraint message_reads_message_account_subject_key
    unique (message_id, auth_user_id, subject_profile_id)
);

create index if not exists message_reads_auth_user_idx
  on public.message_reads (auth_user_id, read_at desc);

create index if not exists message_reads_subject_profile_idx
  on public.message_reads (subject_profile_id, read_at desc);

create index if not exists message_reads_message_idx
  on public.message_reads (message_id);

alter table public.message_reads enable row level security;

revoke all on table public.message_reads from anon, authenticated;
grant select, insert, update on table public.message_reads to authenticated;
grant all on table public.message_reads to service_role;

create or replace function private.can_access_message_for_subject(
  p_message_id uuid,
  p_subject_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, private
as $$
  select
    (
      p_subject_profile_id = (select private.current_profile_id())
      or (select private.can_receive_related_messages(p_subject_profile_id))
    )
    and exists (
      select 1
      from public.message_recipients mr
      where mr.message_id = p_message_id
        and (
          mr.profile_id = p_subject_profile_id
          or (
            mr.team_id is not null
            and exists (
              select 1
              from public.team_members tm
              where tm.team_id = mr.team_id
                and tm.profile_id = p_subject_profile_id
            )
          )
        )
    )
$$;

revoke all on function private.can_access_message_for_subject(uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.can_access_message_for_subject(uuid, uuid)
  to authenticated, service_role;

drop policy if exists message_reads_select_own_or_delegated on public.message_reads;
create policy message_reads_select_own_or_delegated
  on public.message_reads
  for select
  to authenticated
  using (
    auth_user_id = (select auth.uid())
    and (select private.can_access_message_for_subject(message_id, subject_profile_id))
  );

drop policy if exists message_reads_insert_own_or_delegated on public.message_reads;
create policy message_reads_insert_own_or_delegated
  on public.message_reads
  for insert
  to authenticated
  with check (
    auth_user_id = (select auth.uid())
    and (select private.can_access_message_for_subject(message_id, subject_profile_id))
  );

drop policy if exists message_reads_update_own_or_delegated on public.message_reads;
create policy message_reads_update_own_or_delegated
  on public.message_reads
  for update
  to authenticated
  using (
    auth_user_id = (select auth.uid())
    and (select private.can_access_message_for_subject(message_id, subject_profile_id))
  )
  with check (
    auth_user_id = (select auth.uid())
    and (select private.can_access_message_for_subject(message_id, subject_profile_id))
  );

alter table public.push_subscriptions
  add column if not exists auth_user_id uuid
    references auth.users (id) on delete cascade;

update public.push_subscriptions ps
set auth_user_id = aa.auth_user_id
from public.app_accounts aa
where aa.owner_profile_id = ps.profile_id
  and ps.auth_user_id is null;

do $$
begin
  if exists (
    select 1
    from public.push_subscriptions
    where auth_user_id is null
  ) then
    raise exception 'Migration 13: push subscription senza mapping app_accounts';
  end if;
end
$$;

create index if not exists push_subscriptions_auth_user_idx
  on public.push_subscriptions (auth_user_id);

create unique index if not exists push_subscriptions_auth_user_endpoint_key
  on public.push_subscriptions (auth_user_id, endpoint);

-- I due indici legacy hanno la stessa semantica; ne conserviamo uno fino alla Fase 6.
drop index if exists public.uq_push_subscriptions_profile_endpoint;

drop policy if exists push_subscriptions_owner_all on public.push_subscriptions;
drop policy if exists push_subscriptions_admin_read on public.push_subscriptions;

create policy push_subscriptions_owner_all
  on public.push_subscriptions
  for all
  to authenticated
  using (
    auth_user_id = (select auth.uid())
    and profile_id = (select private.current_profile_id())
  )
  with check (
    auth_user_id = (select auth.uid())
    and profile_id = (select private.current_profile_id())
  );

create policy push_subscriptions_admin_read
  on public.push_subscriptions
  for select
  to authenticated
  using ((select private.has_account_role('admin')));

comment on table public.message_reads is
  'Letture per account autenticato e soggetto operativo; sostituisce progressivamente message_recipients.is_read.';
comment on column public.push_subscriptions.auth_user_id is
  'Account Auth proprietario della subscription; profile_id resta compatibile fino alla Fase 6.';

commit;
