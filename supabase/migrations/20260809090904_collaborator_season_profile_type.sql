-- Fase 3: classificazione stagionale dei collaboratori.
-- Non sostituisce account_roles e non viene usata per autorizzare l'accesso.

begin;

alter table public.season_profiles
  add column if not exists profile_type text
    constraint season_profiles_profile_type_check
    check (profile_type in ('athlete', 'coach', 'staff', 'admin'));

create index if not exists season_profiles_type_idx
  on public.season_profiles (season_id, profile_type, profile_id);

update public.season_profiles sp
set profile_type = case p.role
  when 'athlete' then 'athlete'
  when 'coach' then 'coach'
  when 'admin' then 'admin'
  else sp.profile_type
end
from public.profiles p
where p.id = sp.profile_id
  and sp.profile_type is null;

comment on column public.season_profiles.profile_type is
  'Classificazione operativa nella stagione; non è una fonte di autorizzazione account.';

commit;
