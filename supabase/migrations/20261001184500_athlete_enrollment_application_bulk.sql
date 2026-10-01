begin;

-- The complete selection is locked and validated before the update. This keeps
-- the season-specific enrollment state atomic even when one requested athlete
-- is not an athlete in the requested season.
create or replace function public.set_athlete_enrollment_application_delivered_atomically(
  p_season_id uuid,
  p_athlete_ids uuid[],
  p_delivered boolean
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_matched_count integer;
begin
  if p_season_id is null or p_delivered is null then
    raise exception using errcode = '22023', message = 'Stagione e stato domanda sono obbligatori';
  end if;
  if coalesce(cardinality(p_athlete_ids), 0) = 0 then
    raise exception using errcode = '22023', message = 'Selezionare almeno un atleta';
  end if;
  if cardinality(p_athlete_ids) <> cardinality(array(select distinct unnest(p_athlete_ids))) then
    raise exception using errcode = '22023', message = 'Gli ID atleta devono essere univoci';
  end if;
  if not exists (select 1 from public.seasons where id = p_season_id) then
    raise exception using errcode = '22023', message = 'Stagione non trovata';
  end if;

  perform 1
    from public.season_profiles sp
    join public.athlete_profiles ap on ap.profile_id = sp.profile_id
   where sp.season_id = p_season_id
     and sp.profile_id = any(p_athlete_ids)
   for update of sp;
  get diagnostics v_matched_count = row_count;

  if v_matched_count <> cardinality(p_athlete_ids) then
    raise exception using errcode = '23514', message = 'La selezione contiene atleti non iscritti alla stagione selezionata';
  end if;

  update public.season_profiles
     set enrollment_application_delivered = p_delivered
   where season_id = p_season_id
     and profile_id = any(p_athlete_ids);

  return v_matched_count;
end;
$$;

revoke all on function public.set_athlete_enrollment_application_delivered_atomically(uuid, uuid[], boolean) from public, anon, authenticated;
grant execute on function public.set_athlete_enrollment_application_delivered_atomically(uuid, uuid[], boolean) to service_role;

commit;
