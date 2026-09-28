begin;

create table if not exists public.season_activation_audit (
  id uuid primary key default gen_random_uuid(),
  activation_key uuid not null unique,
  source_season_id uuid not null references public.seasons(id) on delete restrict,
  target_season_id uuid not null references public.seasons(id) on delete restrict,
  performed_by_auth_user_id uuid,
  created_at timestamptz not null default now(),
  check (source_season_id <> target_season_id)
);

alter table public.season_activation_audit enable row level security;
revoke all on table public.season_activation_audit from public, anon, authenticated;
grant all on table public.season_activation_audit to service_role;

create or replace function private.prevent_season_activation_audit_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'season activation audit is append-only';
end;
$$;

drop trigger if exists season_activation_audit_immutable
  on public.season_activation_audit;
create trigger season_activation_audit_immutable
  before update or delete on public.season_activation_audit
  for each row execute function private.prevent_season_activation_audit_mutation();
revoke all on function private.prevent_season_activation_audit_mutation() from public, anon, authenticated;

create or replace function public.activate_season_atomically(
  p_activation_key uuid,
  p_source_season_id uuid,
  p_target_season_id uuid,
  p_performed_by_auth_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_source public.seasons%rowtype;
  v_target public.seasons%rowtype;
  v_existing public.season_activation_audit%rowtype;
  v_activated_at timestamptz := now();
begin
  if p_activation_key is null then
    raise exception using errcode = '22023', message = 'Chiave di attivazione obbligatoria';
  end if;
  if p_source_season_id is null or p_target_season_id is null or p_source_season_id = p_target_season_id then
    raise exception using errcode = '22023', message = 'Source e target devono essere stagioni diverse';
  end if;

  select * into v_existing
    from public.season_activation_audit
   where activation_key = p_activation_key
   for update;
  if found then
    if v_existing.source_season_id <> p_source_season_id or v_existing.target_season_id <> p_target_season_id then
      raise exception using errcode = '23505', message = 'Chiave di attivazione già usata per stagioni diverse';
    end if;
    return jsonb_build_object(
      'activationKey', v_existing.activation_key,
      'sourceSeasonId', v_existing.source_season_id,
      'targetSeasonId', v_existing.target_season_id,
      'activatedAt', v_existing.created_at,
      'replayed', true
    );
  end if;

  -- Lock in a stable order so overlapping activation attempts cannot deadlock.
  perform 1
    from public.seasons
   where id in (p_source_season_id, p_target_season_id)
   order by id
   for update;

  -- A concurrent request with the same key can have committed while this
  -- request waited for the season locks. Re-read the audit so its retry stays
  -- idempotent instead of failing on the now-inactive source.
  select * into v_existing
    from public.season_activation_audit
   where activation_key = p_activation_key
   for update;
  if found then
    if v_existing.source_season_id <> p_source_season_id or v_existing.target_season_id <> p_target_season_id then
      raise exception using errcode = '23505', message = 'Chiave di attivazione già usata per stagioni diverse';
    end if;
    return jsonb_build_object(
      'activationKey', v_existing.activation_key,
      'sourceSeasonId', v_existing.source_season_id,
      'targetSeasonId', v_existing.target_season_id,
      'activatedAt', v_existing.created_at,
      'replayed', true
    );
  end if;

  select * into v_source from public.seasons where id = p_source_season_id;
  if not found then
    raise exception using errcode = '22023', message = 'Stagione source non valida';
  end if;
  select * into v_target from public.seasons where id = p_target_season_id;
  if not found then
    raise exception using errcode = '22023', message = 'Stagione target non valida';
  end if;

  if not v_source.is_active then
    raise exception using errcode = '23514', message = 'La stagione source deve essere attiva';
  end if;
  if coalesce(v_target.is_active, false) then
    raise exception using errcode = '23514', message = 'La stagione target deve essere inattiva';
  end if;
  if v_target.start_date <= v_source.end_date then
    raise exception using errcode = '23514', message = 'La stagione target deve iniziare dopo la fine della source';
  end if;

  -- The unique partial index permits only one active season. These writes are
  -- in one transaction, so clients see either the old active season or the new one.
  update public.seasons set is_active = false where id = v_source.id;
  update public.seasons set is_active = true where id = v_target.id;

  insert into public.season_activation_audit (
    activation_key,
    source_season_id,
    target_season_id,
    performed_by_auth_user_id,
    created_at
  ) values (
    p_activation_key,
    v_source.id,
    v_target.id,
    p_performed_by_auth_user_id,
    v_activated_at
  );

  return jsonb_build_object(
    'activationKey', p_activation_key,
    'sourceSeasonId', v_source.id,
    'targetSeasonId', v_target.id,
    'activatedAt', v_activated_at,
    'replayed', false
  );
end;
$$;

revoke all on function public.activate_season_atomically(uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.activate_season_atomically(uuid, uuid, uuid, uuid) to service_role;

commit;
