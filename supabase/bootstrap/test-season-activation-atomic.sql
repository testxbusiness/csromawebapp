-- Local-only verification fixture for 20260928092236_season_activation_atomic.sql.
-- It never commits fixture data.
begin;

do $$
declare
  v_source uuid := '11111111-1111-4111-8111-111111111111';
  v_target uuid := '22222222-2222-4222-8222-222222222222';
  v_later_target uuid := '33333333-3333-4333-8333-333333333333';
  v_key uuid := '44444444-4444-4444-8444-444444444444';
  v_actor uuid := '55555555-5555-4555-8555-555555555555';
  v_result jsonb;
begin
  update public.seasons set is_active = false where is_active;

  insert into public.seasons (id, name, start_date, end_date, is_active) values
    (v_source, 'Fixture source', '2025-09-01', '2026-06-30', true),
    (v_target, 'Fixture target', '2026-09-01', '2027-06-30', false),
    (v_later_target, 'Fixture target non successivo', '2026-06-30', '2027-05-31', false);

  v_result := public.activate_season_atomically(v_key, v_source, v_target, v_actor);
  if (v_result->>'replayed')::boolean then
    raise exception 'La prima attivazione non può essere un replay';
  end if;
  if exists (select 1 from public.seasons where id = v_source and is_active)
     or not exists (select 1 from public.seasons where id = v_target and is_active)
     or (select count(*) from public.seasons where is_active) <> 1 then
    raise exception 'Lo stato attivo dopo l''attivazione non è valido';
  end if;
  if (select count(*) from public.season_activation_audit where activation_key = v_key) <> 1 then
    raise exception 'Audit di attivazione assente o duplicato';
  end if;

  v_result := public.activate_season_atomically(v_key, v_source, v_target, v_actor);
  if not (v_result->>'replayed')::boolean then
    raise exception 'Il retry con la stessa chiave deve essere idempotente';
  end if;

  begin
    perform public.activate_season_atomically(v_key, v_source, v_later_target, v_actor);
    raise exception 'Una chiave riusata per stagioni diverse deve fallire';
  exception when unique_violation then
    null;
  end;

  begin
    perform public.activate_season_atomically('66666666-6666-4666-8666-666666666666', v_source, v_later_target, v_actor);
    raise exception 'Una source inattiva deve fallire';
  exception when check_violation then
    null;
  end;

  update public.seasons set is_active = false where id = v_target;
  update public.seasons set is_active = true where id = v_source;
  begin
    perform public.activate_season_atomically('77777777-7777-4777-8777-777777777777', v_source, v_later_target, v_actor);
    raise exception 'Una target non successiva alla source deve fallire';
  exception when check_violation then
    null;
  end;
end;
$$;

rollback;
