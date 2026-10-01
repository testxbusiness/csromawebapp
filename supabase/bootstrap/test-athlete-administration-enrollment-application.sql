-- Local-only verification fixture for G13.1.
-- It proves a rollover never copies the source enrollment application flag and
-- rolls back all fixture data when complete.
begin;

do $$
declare
  v_source_season uuid := '11111111-1111-4111-8111-111111111111';
  v_target_season uuid := '22222222-2222-4222-8222-222222222222';
  v_profile uuid := '33333333-3333-4333-8333-333333333333';
  v_team_source uuid := '44444444-4444-4444-8444-444444444444';
  v_team_target uuid := '55555555-5555-4555-8555-555555555555';
  v_activity_source uuid := '66666666-6666-4666-8666-666666666666';
  v_activity_target uuid := '77777777-7777-4777-8777-777777777777';
  v_batch uuid := '88888888-8888-4888-8888-888888888888';
  v_actor uuid := '99999999-9999-4999-8999-999999999999';
begin
  insert into public.seasons (id, name, start_date, end_date, is_active) values
    (v_source_season, 'Fixture G13.1 source', '2030-09-01', '2031-06-30', false),
    (v_target_season, 'Fixture G13.1 target', '2031-09-01', '2032-06-30', false);
  insert into public.profiles (id, first_name, last_name, email) values
    (v_profile, 'Atleta', 'Fixture G13.1', 'fixture-g13-1@example.test');
  insert into public.athlete_profiles (profile_id) values (v_profile);
  insert into public.activities (id, season_id, name) values
    (v_activity_source, v_source_season, 'Attività fixture source'),
    (v_activity_target, v_target_season, 'Attività fixture target');
  insert into public.teams (id, activity_id, name, code) values
    (v_team_source, v_activity_source, 'Squadra fixture source', 'G131-S'),
    (v_team_target, v_activity_target, 'Squadra fixture target', 'G131-T');
  insert into public.team_members (profile_id, team_id, role) values
    (v_profile, v_team_source, 'athlete');
  insert into public.season_profiles (
    profile_id, season_id, profile_type, status, enrollment_application_delivered
  ) values (v_profile, v_source_season, 'athlete', 'active', true);

  perform public.rollover_profiles_batch(
    v_batch,
    v_source_season,
    v_target_season,
    v_actor,
    jsonb_build_array(jsonb_build_object(
      'profileId', v_profile,
      'included', true,
      'teams', jsonb_build_array(jsonb_build_object(
        'teamId', v_team_target,
        'role', 'athlete'
      ))
    ))
  );

  if not exists (
    select 1
    from public.season_profiles
    where profile_id = v_profile
      and season_id = v_target_season
      and enrollment_application_delivered = false
  ) then
    raise exception 'Il rollover deve creare la domanda target con il default false';
  end if;
end;
$$;

rollback;
