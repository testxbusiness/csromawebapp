-- Test RLS locale read-only + tentativi di modifica in transazione.
-- Eseguire solo sul DB locale; tutte le modifiche vengono annullate con ROLLBACK.
-- Il ruolo postgres viene usato esclusivamente per simulare i ruoli Data API.

\set ON_ERROR_STOP off
\pset pager off
\pset format aligned

\echo '=== ANON: le tabelle applicative non devono essere leggibili ==='
begin;
set local role anon;
select 'anon_profiles' as check_name, count(*) as visible_rows from public.profiles;
rollback;
begin;
set local role anon;
select 'anon_documents' as check_name, count(*) as visible_rows from public.documents;
rollback;
begin;
set local role anon;
select 'anon_payments' as check_name, count(*) as visible_rows from public.payments;
rollback;

\echo '=== ATLETA: proprio profilo/squadra, nessun pagamento ==='
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"4562c612-68d8-4bd2-b40a-fbe72b48c10a","app_metadata":{"role":"athlete"}}', true);
select 'athlete_own_profile' as check_name, count(*) as visible_rows from public.profiles where id = '4562c612-68d8-4bd2-b40a-fbe72b48c10a';
select 'athlete_team_members' as check_name, count(*) as visible_rows from public.team_members;
select 'athlete_payments' as check_name, count(*) as visible_rows from public.payments;
select 'athlete_user_roles' as check_name, count(*) as visible_rows from public.user_roles;
-- Deve restituire 0 righe: un atleta non può modificare il profilo di un altro utente.
update public.profiles set first_name = first_name where id = 'ead3c978-c178-4b38-a541-9ecedc6fa9f1';
rollback;

\echo '=== COACH: solo squadre assegnate, nessun pagamento ==='
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"e2ee7e93-d957-4ddd-9a1c-867b64d4b4d4","app_metadata":{"role":"coach"}}', true);
select 'coach_profiles' as check_name, count(*) as visible_rows from public.profiles;
select 'coach_team_members' as check_name, count(*) as visible_rows from public.team_members;
select 'coach_events' as check_name, count(*) as visible_rows from public.events;
select 'coach_payments' as check_name, count(*) as visible_rows from public.payments;
-- Deve restituire 0 righe: il coach non può modificare un profilo utente.
update public.profiles set first_name = first_name where id = 'ead3c978-c178-4b38-a541-9ecedc6fa9f1';
rollback;

\echo '=== ADMIN: accesso amministrativo completo ==='
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"ead3c978-c178-4b38-a541-9ecedc6fa9f1","app_metadata":{"role":"admin"}}', true);
select 'admin_profiles' as check_name, count(*) as visible_rows from public.profiles;
select 'admin_documents' as check_name, count(*) as visible_rows from public.documents;
select 'admin_payments' as check_name, count(*) as visible_rows from public.payments;
-- Deve restituire 1 riga; la transazione viene comunque annullata.
update public.profiles set first_name = first_name where id = 'ead3c978-c178-4b38-a541-9ecedc6fa9f1';
rollback;

reset role;
