-- Fase 3 / Migration 10: audit immutabile del ciclo di vita persona/account.
-- Il primo slice prepara il modello DB; i flussi applicativi verranno migrati dopo.

begin;

create table if not exists public.account_lifecycle_audit (
  id uuid primary key default gen_random_uuid(),
  event_type text not null
    constraint account_lifecycle_audit_event_type_check
    check (event_type in (
      'profile_created',
      'account_provisioning_started',
      'account_created',
      'account_invited',
      'account_activated',
      'account_suspended',
      'account_reactivated',
      'account_disabled',
      'account_deleted',
      'account_role_granted',
      'account_role_revoked',
      'mapping_verified',
      'provisioning_failed',
      'repair_required'
    )),
  subject_profile_id uuid
    references public.profiles (id) on delete set null,
  subject_auth_user_id uuid,
  performed_by_auth_user_id uuid,
  performed_by_profile_id uuid
    references public.profiles (id) on delete set null,
  performed_by_email text,
  performed_by_first_name text,
  performed_by_last_name text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists account_lifecycle_audit_subject_idx
  on public.account_lifecycle_audit (subject_profile_id, created_at desc);

create index if not exists account_lifecycle_audit_actor_idx
  on public.account_lifecycle_audit (performed_by_auth_user_id, created_at desc);

create index if not exists account_lifecycle_audit_event_idx
  on public.account_lifecycle_audit (event_type, created_at desc);

create or replace function private.prevent_account_lifecycle_audit_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'account_lifecycle_audit is append-only';
end;
$$;

drop trigger if exists account_lifecycle_audit_immutable on public.account_lifecycle_audit;
create trigger account_lifecycle_audit_immutable
  before update or delete on public.account_lifecycle_audit
  for each row execute function private.prevent_account_lifecycle_audit_mutation();

alter table public.account_lifecycle_audit enable row level security;
revoke all on table public.account_lifecycle_audit from anon, authenticated;
grant all on table public.account_lifecycle_audit to service_role;

revoke all on function private.prevent_account_lifecycle_audit_mutation() from public, anon, authenticated;

comment on table public.account_lifecycle_audit is
  'Append-only audit del ciclo di vita di persone e account; non contiene FK distruttive verso Auth.';
comment on column public.account_lifecycle_audit.subject_auth_user_id is
  'Snapshot storico dell account soggetto, senza FK per non bloccare retention o revoca.';
comment on column public.account_lifecycle_audit.performed_by_auth_user_id is
  'Snapshot storico dell account che ha eseguito l operazione, senza FK distruttiva.';
comment on column public.account_lifecycle_audit.details is
  'Dettagli tecnici e snapshot contestuali dell operazione; non usato per autorizzazione.';

commit;
