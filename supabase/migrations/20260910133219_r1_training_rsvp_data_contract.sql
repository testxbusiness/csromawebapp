begin;

-- R1 is additive. Existing rows remain valid; legacy events stay unclassified.
alter table public.teams
  add column if not exists training_rsvp_enabled boolean;
update public.teams set training_rsvp_enabled = false where training_rsvp_enabled is null;
alter table public.teams
  alter column training_rsvp_enabled set default false,
  alter column training_rsvp_enabled set not null;

alter table public.team_training_schedules
  add column if not exists is_active boolean;
update public.team_training_schedules set is_active = true where is_active is null;
alter table public.team_training_schedules
  alter column is_active set default true,
  alter column is_active set not null;

alter table public.events
  add column if not exists generated_from_schedule_id uuid,
  add column if not exists generated_occurrence_date date,
  add column if not exists generated_schedule_exception boolean;
update public.events set generated_schedule_exception = false where generated_schedule_exception is null;
alter table public.events
  alter column generated_schedule_exception set default false,
  alter column generated_schedule_exception set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.events'::regclass and conname = 'events_generated_from_schedule_id_fkey') then
    alter table public.events add constraint events_generated_from_schedule_id_fkey
      foreign key (generated_from_schedule_id) references public.team_training_schedules(id) on delete set null;
  end if;
end;
$$;

alter table public.event_attendances add column if not exists is_early_absence boolean;
update public.event_attendances set is_early_absence = false where is_early_absence is null;
alter table public.event_attendances
  alter column is_early_absence set default false,
  alter column is_early_absence set not null;

create index if not exists team_training_schedules_team_active_idx
  on public.team_training_schedules (team_id, is_active, day_of_week, start_time);
create unique index if not exists events_generated_schedule_occurrence_uidx
  on public.events (generated_from_schedule_id, generated_occurrence_date)
  where generated_from_schedule_id is not null and generated_occurrence_date is not null;
create index if not exists events_generated_schedule_start_idx
  on public.events (generated_from_schedule_id, start_time)
  where generated_from_schedule_id is not null;
create index if not exists event_attendances_early_absence_idx
  on public.event_attendances (profile_id, event_id)
  where is_early_absence = true;

comment on column public.teams.training_rsvp_enabled is 'Abilita la conferma presenza per le nuove occorrenze automatiche; default disattivato.';
comment on column public.team_training_schedules.is_active is 'Disattivazione logica dell''orario; non cancellare orari referenziati.';
comment on column public.events.generated_from_schedule_id is 'Origine stabile dell''occorrenza automatica; NULL per eventi legacy o manuali non classificati. ON DELETE SET NULL preserva lo storico.';
comment on column public.events.generated_occurrence_date is 'Data locale Europe/Rome; insieme a generated_from_schedule_id identifica una sola occorrenza.';
comment on column public.events.generated_schedule_exception is 'True quando un''occorrenza generata è stata modificata manualmente.';
comment on column public.event_attendances.is_early_absence is 'Assenza anticipata esplicita; non modifica response_source e resta compatibile con status=declined.';
commit;
