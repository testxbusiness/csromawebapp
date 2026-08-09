-- Fase 3 / Migration 10B: collegamento persona-stagione.
-- L'anagrafica resta unica; la partecipazione a una stagione è una relazione separata.

begin;

create table if not exists public.season_profiles (
  profile_id uuid not null
    references public.profiles (id) on delete cascade,
  season_id uuid not null
    references public.seasons (id) on delete restrict,
  status text not null default 'active'
    constraint season_profiles_status_check
    check (status in ('active', 'inactive', 'withdrawn', 'archived')),
  external_id text,
  source text,
  metadata jsonb not null default '{}'::jsonb
    constraint season_profiles_metadata_object_check
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, season_id)
);

create index if not exists season_profiles_season_status_idx
  on public.season_profiles (season_id, status, profile_id);

create index if not exists season_profiles_external_id_idx
  on public.season_profiles (season_id, external_id)
  where external_id is not null;

create unique index if not exists season_profiles_external_id_unique_idx
  on public.season_profiles (season_id, external_id)
  where external_id is not null;

drop trigger if exists season_profiles_set_updated_at on public.season_profiles;
create trigger season_profiles_set_updated_at
  before update on public.season_profiles
  for each row execute function public.update_updated_at_column();

alter table public.season_profiles enable row level security;

revoke all on table public.season_profiles from anon, authenticated;
grant select, insert, update, delete on table public.season_profiles to authenticated;
grant all on table public.season_profiles to service_role;

drop policy if exists season_profiles_admin_all on public.season_profiles;
create policy season_profiles_admin_all
  on public.season_profiles
  for all
  to authenticated
  using ((select private.has_account_role('admin')))
  with check ((select private.has_account_role('admin')));

comment on table public.season_profiles is
  'Relazione stagionale della persona; non duplica profiles tra stagioni.';
comment on column public.season_profiles.external_id is
  'Identificativo stabile del file o gestionale sorgente, non una email.';
comment on column public.season_profiles.metadata is
  'Metadati di import o integrazione, non usati per autorizzazione.';

-- Backfill conservativo: il database locale ha una sola stagione attiva e 48 profili.
-- Non si duplicano profiles; si crea una sola relazione per la stagione corrente.
insert into public.season_profiles (profile_id, season_id, source)
select p.id, s.id, 'backfill_local_current_season'
from public.profiles p
cross join (
  select id
  from public.seasons
  where is_active = true
  order by start_date desc
  limit 1
) s
on conflict (profile_id, season_id) do nothing;

commit;
