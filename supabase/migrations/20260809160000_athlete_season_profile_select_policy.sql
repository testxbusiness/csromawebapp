-- Fase 3A: l'atleta deve poter verificare la propria iscrizione stagionale.
-- La relazione resta non scrivibile dall'utente e non espone le iscrizioni altrui.

begin;

drop policy if exists season_profiles_athlete_self_select on public.season_profiles;
create policy season_profiles_athlete_self_select
  on public.season_profiles
  for select
  to authenticated
  using (
    (select private.has_account_role('athlete'))
    and profile_id = (select private.current_profile_id())
  );

commit;
