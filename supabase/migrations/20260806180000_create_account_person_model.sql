-- Fase 1 / Migration 1: schema additivo per persone, account opzionali e relazioni.
-- Non modifica profiles né policy operative esistenti.

create table if not exists public.app_accounts (
  auth_user_id uuid primary key
    references auth.users (id) on delete cascade,
  owner_profile_id uuid not null unique
    references public.profiles (id) on delete restrict,
  status text not null default 'invited'
    constraint app_accounts_status_check
    check (status in ('invited', 'active', 'suspended', 'disabled')),
  must_change_password boolean not null default false,
  invited_at timestamptz,
  activated_at timestamptz,
  suspended_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists app_accounts_status_idx
  on public.app_accounts (status);

drop trigger if exists app_accounts_updated_at on public.app_accounts;
create trigger app_accounts_updated_at
  before update on public.app_accounts
  for each row execute function public.update_updated_at_column();

create table if not exists public.account_roles (
  auth_user_id uuid not null
    references auth.users (id) on delete cascade,
  role text not null
    constraint account_roles_role_check
    check (role in ('admin', 'coach', 'staff')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (auth_user_id, role)
);

drop trigger if exists account_roles_updated_at on public.account_roles;
create trigger account_roles_updated_at
  before update on public.account_roles
  for each row execute function public.update_updated_at_column();

create table if not exists public.profile_relationships (
  id uuid primary key default gen_random_uuid(),
  source_profile_id uuid not null
    references public.profiles (id) on delete restrict,
  target_profile_id uuid not null
    references public.profiles (id) on delete restrict,
  relationship_type text not null
    constraint profile_relationships_type_check
    check (relationship_type in ('parent', 'guardian', 'caregiver', 'dependent', 'delegate')),
  status text not null default 'pending'
    constraint profile_relationships_status_check
    check (status in ('pending', 'active', 'revoked')),
  valid_from date not null default current_date,
  valid_until date,
  can_view_schedule boolean not null default false,
  can_confirm_attendance boolean not null default false,
  can_view_payments boolean not null default false,
  can_view_medical_status boolean not null default false,
  can_view_documents boolean not null default false,
  can_sign_documents boolean not null default false,
  can_receive_messages boolean not null default false,
  is_primary_contact boolean not null default false,
  is_billing_contact boolean not null default false,
  is_emergency_contact boolean not null default false,
  verified_by_auth_user_id uuid
    references auth.users (id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_relationships_not_self_check
    check (source_profile_id <> target_profile_id),
  constraint profile_relationships_validity_check
    check (valid_until is null or valid_until >= valid_from)
);

create index if not exists profile_relationships_source_idx
  on public.profile_relationships (source_profile_id);

create index if not exists profile_relationships_target_idx
  on public.profile_relationships (target_profile_id);

create index if not exists profile_relationships_status_idx
  on public.profile_relationships (status);

create index if not exists profile_relationships_validity_idx
  on public.profile_relationships (valid_from, valid_until);

create unique index if not exists profile_relationships_primary_contact_idx
  on public.profile_relationships (target_profile_id)
  where status = 'active' and is_primary_contact = true;

create unique index if not exists profile_relationships_billing_contact_idx
  on public.profile_relationships (target_profile_id)
  where status = 'active' and is_billing_contact = true;

drop trigger if exists profile_relationships_updated_at on public.profile_relationships;
create trigger profile_relationships_updated_at
  before update on public.profile_relationships
  for each row execute function public.update_updated_at_column();

alter table public.app_accounts enable row level security;
alter table public.account_roles enable row level security;
alter table public.profile_relationships enable row level security;

-- Le policy applicative arrivano nella migration 4. Fino ad allora le nuove tabelle
-- non sono leggibili/modificabili dal Data API, evitando accessi prematuri.
revoke all on table public.app_accounts from anon, authenticated;
revoke all on table public.account_roles from anon, authenticated;
revoke all on table public.profile_relationships from anon, authenticated;

grant all on table public.app_accounts to service_role;
grant all on table public.account_roles to service_role;
grant all on table public.profile_relationships to service_role;

comment on table public.app_accounts is
  'Mapping opzionale uno-a-uno tra un account Auth e la persona proprietaria.';
comment on table public.account_roles is
  'Ruoli globali dell account Auth; athlete resta un ruolo legacy/persona in Fase 1.';
comment on table public.profile_relationships is
  'Relazioni tra persone con permessi granulari e validita temporale.';
