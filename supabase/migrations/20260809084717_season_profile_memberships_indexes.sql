-- Fase 3 / Migration 10B correction: evita un indice duplicato.

begin;

drop index if exists public.season_profiles_external_id_idx;

commit;
