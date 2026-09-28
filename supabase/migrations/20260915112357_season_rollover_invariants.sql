begin;

-- Una sola stagione operativa può essere attiva in ogni momento. L'indice è
-- parziale per lasciare un numero arbitrario di stagioni archiviate. Il check
-- sull'espressione evita di duplicare l'indice già presente in alcuni DB con
-- un nome storico diverso (per esempio unique_active_season).
do $$
begin
  if not exists (
    select 1
    from pg_index i
    where i.indrelid = 'public.seasons'::regclass
      and i.indisunique
      and pg_get_expr(i.indpred, i.indrelid) = '(is_active = true)'
  ) then
    create unique index seasons_single_active_idx
      on public.seasons (is_active)
      where is_active = true;
  end if;
end;
$$;

comment on column public.seasons.is_active is
  'Stato operativo della stagione; archiviazione tramite UPDATE a false, mai hard delete.';

-- L'idempotenza delle iscrizioni è già garantita dalla PK
-- season_profiles(profile_id, season_id) e quella delle membership dalla
-- UNIQUE(profile_id, team_id) di team_members. Non vengono aggiunti vincoli
-- che possano alterare lo storico o la semantica delle relazioni esistenti.

commit;
