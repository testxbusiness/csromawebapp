begin;

alter table public.season_profiles
  add column if not exists enrollment_application_delivered boolean not null default false;

comment on column public.season_profiles.enrollment_application_delivered is
  'Domanda di iscrizione consegnata per il solo atleta nella singola stagione; il rollover crea sempre nuove relazioni con il default false.';

commit;
