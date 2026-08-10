-- Fase 4, slice 1: consolida le fonti autorevoli persona/atleta/squadra.
--
-- profiles: anagrafica e contatti.
-- athlete_profiles: tessera e certificato medico.
-- team_members: assegnazioni stagionali e numeri maglia.
--
-- Le colonne sportive duplicate su profiles restano temporaneamente per compatibilità.
-- Non vengono usate come fonte autorevole e non vengono eliminate in questa fase.

begin;

do $$
begin
  if exists (
    select 1
    from public.profiles p
    join public.athlete_profiles ap on ap.profile_id = p.id
    where p.membership_number is not null
      and ap.membership_number is not null
      and p.membership_number <> ap.membership_number
  ) then
    raise exception 'profile/athlete membership conflicts require manual review';
  end if;

  if exists (
    select 1
    from public.profiles p
    join public.athlete_profiles ap on ap.profile_id = p.id
    where p.medical_certificate_expiry is not null
      and ap.medical_certificate_expiry is not null
      and p.medical_certificate_expiry <> ap.medical_certificate_expiry
  ) then
    raise exception 'profile/athlete medical certificate conflicts require manual review';
  end if;

  if exists (
    select 1
    from public.profiles p
    where p.jersey_number is not null
      and not exists (select 1 from public.team_members tm where tm.profile_id = p.id)
  ) then
    raise exception 'profile jersey values without team membership require manual review';
  end if;
end;
$$;

-- Recupera esclusivamente valori presenti nella copia legacy e mancanti nella fonte
-- autorevole. Nel database verificato questi update non modificano alcuna riga.
update public.athlete_profiles ap
set membership_number = p.membership_number
from public.profiles p
where p.id = ap.profile_id
  and ap.membership_number is null
  and p.membership_number is not null;

update public.athlete_profiles ap
set medical_certificate_expiry = p.medical_certificate_expiry
from public.profiles p
where p.id = ap.profile_id
  and ap.medical_certificate_expiry is null
  and p.medical_certificate_expiry is not null;

comment on column public.profiles.membership_number is
  'Legacy compatibility only; authoritative value is athlete_profiles.membership_number.';
comment on column public.profiles.medical_certificate_expiry is
  'Legacy compatibility only; authoritative value is athlete_profiles.medical_certificate_expiry.';
comment on column public.profiles.jersey_number is
  'Legacy compatibility only; authoritative values are team_members.jersey_number per team.';

commit;
