-- Fase 3A, step 3: riconcilia gli account atleta già mappati.
--
-- Il mapping app_accounts.auth_user_id -> owner_profile_id è la prova primaria.
-- L'inserimento è limitato a persone con athlete_profiles e almeno una relazione
-- season_profiles attiva. Non si usa l'email e non si ricreano utenti o profili.

begin;

insert into public.account_roles (auth_user_id, role, created_at, updated_at)
select distinct
  aa.auth_user_id,
  'athlete',
  now(),
  now()
from public.app_accounts aa
join public.profiles p
  on p.id = aa.owner_profile_id
join public.athlete_profiles ap
  on ap.profile_id = p.id
where exists (
  select 1
  from public.season_profiles sp
  where sp.profile_id = p.id
    and sp.status = 'active'
)
on conflict (auth_user_id, role) do nothing;

do $$
begin
  if exists (
    select 1
    from public.account_roles ar
    join public.app_accounts aa on aa.auth_user_id = ar.auth_user_id
    where ar.role = 'athlete'
      and not exists (
        select 1
        from public.athlete_profiles ap
        join public.season_profiles sp on sp.profile_id = ap.profile_id
        where ap.profile_id = aa.owner_profile_id
          and sp.status = 'active'
      )
  ) then
    raise exception 'athlete role reconciliation produced an invalid owner mapping';
  end if;
end;
$$;

comment on table public.account_roles is
  'Ruoli globali dell account Auth: admin, coach, staff o athlete. Il ruolo atleta non sostituisce iscrizione stagionale e profilo sportivo.';

commit;
