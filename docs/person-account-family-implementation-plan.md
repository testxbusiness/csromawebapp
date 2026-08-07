# Piano di implementazione: persone, account opzionali e relazioni familiari

Stato del documento: implementazione incrementale in corso; Fase 2E avviata, migration applicate in locale e staging solo dopo verifica separata.

Branch di lavoro: `codex/person-account-family-model`.

Database:

- produzione: `qyiholnatsrvpoqoplje` (sola lettura durante analisi);
- staging: `kibtvkuiedoxgppnnxkf` (prima destinazione delle future migration);
- dump di riferimento: `backups/prod_db_20260806_164940_CEST_{schema,data,roles}.sql`.

### Stato implementazione verificato al 7 agosto 2026

- branch: `codex/person-account-family-model`;
- locale: migration del modello account/person e policy account-based applicate e
  verificate sul database Docker ripristinato dal backup; 48 account e 4 ruoli globali
  presenti;
- applicazione: resolver account-based e route admin migrate incrementalmente; nessun
  controllo admin residuo basato solo su `app_metadata` nel perimetro `/api/admin/**`;
- test: TypeScript, Jest, build Next.js, dry-run Supabase locale e suite E2E Playwright
  completati con esito positivo (6/6 test, Chromium e Firefox), usando uno `storageState`
  temporaneo non versionato;
- staging: il 7 agosto 2026 è stato effettuato un backup preventivo di schema, dati e ruoli
  in `/tmp/csroma_staging_before_rebaseline_*`. Il confronto con il dump di riferimento
  mostra uno schema equivalente a quello di prod, senza ancora `app_accounts`,
  `account_roles` o `profile_relationships`; non è stato quindi necessario ricreare lo
  schema. È stata riallineata soltanto la migration history: le tre versioni remote
  `20260729171754`, `20260729171859` e `20260729172054` sono state marcate `reverted`, e le
  quattro versioni baseline locali fino a `20260729170829` sono state marcate `applied`.
  Il successivo `supabase db push --linked --dry-run` elenca esclusivamente le migration
  del nuovo modello e le policy admin del 6–7 agosto. Nessun dato o oggetto applicativo è
  stato modificato da questa rebaseline; prod non è stata interrogata né modificata. In
  seguito è stata applicata sullo staging, come primo step separato, la migration
  `20260806180000_create_account_person_model.sql`; il dump di verifica conferma le tre
  nuove tabelle, i vincoli, gli indici, i trigger e RLS. Come secondo step è stata
  applicata `20260806180001_backfill_existing_accounts_and_roles.sql`: sul dataset
  sintetico di staging risultano 4 `app_accounts`, 2 `account_roles` (`admin` e `coach`)
  e nessuna relazione familiare preesistente. È stata poi applicata
  `20260806180002_decouple_profiles_from_auth.sql`: `profiles` non ha più il vincolo
  diretto verso `auth.users`, mantiene gli ID esistenti, e non risultano trigger attivi
  di sincronizzazione Auth→profiles; il mapping resta gestito da `app_accounts`. È stata
  poi applicata `20260806180003_account_authorization_helpers_and_rls.sql`: risultano
  presenti gli helper `private.*` per account, coach, atleta, relazioni e profilo corrente,
  oltre alle policy account-based sulle tre nuove tabelle. Le policy legacy su `profiles`
  basate su `app_metadata` restano intenzionalmente fino alla migration 5, che le
  sostituirà in modo coordinato. La migration 5 `20260806180004_account_context_and_personal_access_policies.sql`
  è stata applicata e verificata: le policy legacy di accesso personale a `profiles` sono
  state rimosse e sostituite da policy basate su `private.current_profile_id()` e
  `private.has_account_role('admin')`. Le policy `app_metadata` sulle altre tabelle
  restano previste fino alle successive migration admin. È stata quindi applicata la prima
  migration admin,
  `20260807084132_admin_staff_account_role_policies.sql`, verificando che l'accesso
  amministrativo a `predefined_installments` usi `private.has_account_role('admin')`.
  È stata poi applicata `20260807084314_admin_events_account_role_policy.sql` e verificata
  la policy `events_admin_all` con lo stesso helper account-based. Le altre migration
  admin restano non applicate. È stata inoltre applicata
  `20260807084449_admin_messages_account_role_policy.sql` e verificata la policy
  `messages_admin_all` tramite `private.has_account_role('admin')`. È stata infine
  applicata `20260807084644_admin_profiles_insert_account_role_policy.sql` e verificata
  `profiles_insert_admin_only` con lo stesso controllo account-based. È stata inoltre
  applicata `20260807084903_admin_membership_fees_account_role_policy.sql` e verificata
  `membership_fees_admin_all` tramite `private.has_account_role('admin')`. È stata poi
  applicata `20260807085155_admin_fee_installments_account_role_policy.sql` e verificata
  `fee_installments_admin_all` tramite lo stesso helper account-based. È stata inoltre
  applicata `20260807085332_admin_teams_account_role_policy.sql` e verificata la policy
  `teams_admin_all` tramite `private.has_account_role('admin')`. È stata poi applicata
  `20260807085513_admin_event_teams_account_role_policy.sql` e verificata
  `event_teams_admin_all` tramite `private.has_account_role('admin')`. È stata inoltre
  applicata `20260807085639_admin_document_recipients_account_role_policy.sql` e
  verificata `document_recipients_admin_all` tramite lo stesso helper account-based. È
  stata poi applicata `20260807085912_admin_message_recipients_account_role_policy.sql`
  e verificata `message_recipients_admin_all` tramite `private.has_account_role('admin')`.
  Infine è stata applicata `20260807090817_admin_team_training_schedules_account_role_policy.sql`
  e verificata la policy `Admins can manage all training schedules` tramite lo stesso
  helper. Il dry-run finale sullo staging conferma: `Remote database is up to date`.
  In locale e sullo staging è stata poi applicata `20260807134007_coach_team_assignment_policies.sql`:
  le policy coach di squadre, membri, assegnazioni, eventi squadra, orari, quote, rate,
  pagamenti e RSVP ora usano gli helper `private.*` e non i fallback
  `team_members.role`/`teams.coach_id`; il dry-run staging conferma che la history è
  aggiornata. Le route e i componenti coach principali sono stati aggiornati per usare
  `ownerProfileId`. La migration forward
  `20260807134729_coach_event_access_policies.sql` è stata applicata in locale e staging:
  le policy `events_coach_*` usano `private.current_profile_id()` e
  `private.is_coach_of_team()`. Restano da migrare nel perimetro coach le policy e route
  condivise di messaggi. La migration forward
  `20260807134952_coach_message_access_policies.sql` è stata applicata in locale e
  staging; le policy `messages_coach_*` e `message_recipients_coach_*` usano gli helper
  account-based e il dry-run staging è nuovamente `Remote database is up to date`.
- produzione: non interrogata né modificata durante questa implementazione.

## 1. Confini e criteri di successo

L'implementazione separa quattro concetti oggi sovrapposti:

1. `profiles`: persona/anagrafica, anche senza login;
2. `app_accounts`: mapping uno-a-uno opzionale tra account Auth e persona proprietaria;
3. `account_roles`: ruoli globali dell'account (`admin`, `coach`, `staff`);
4. `profile_relationships`: deleghe e relazioni verso altre persone, con permessi granulari.

Gli ID dei 48 profili esistenti non devono cambiare. Le tabelle sportive continuano a
referenziare `profiles.id`. Nessuna migration viene applicata direttamente in produzione:
ogni fase passa da locale, staging, test automatici, query di controllo e approvazione.

Non viene introdotto un nuovo provider di autenticazione e non viene riscritta
l'applicazione in blocco.

## 2. Fotografia verificata della produzione

Il dump post `20260729170829_prod_rls_hardening.sql` del 6 agosto 2026 mostra:

| Oggetto | Stato corrente |
| --- | --- |
| `auth.users` | 48 record |
| `profiles` | 48 record |
| Mapping Auth/profilo | 48 corrispondenze per ID; 0 orfani in entrambe le direzioni |
| `profiles.role` | 2 admin, 2 coach, 44 athlete |
| `auth.users.raw_app_meta_data.role` | 2 admin, 2 coach, 44 athlete |
| `user_roles` | 0 record; PK sul solo `profile_id`, quindi al massimo un ruolo |
| `athlete_profiles` | 44 record |
| `coach_profiles` | 2 record |
| `team_members` | 67 record |
| `team_coaches` | 4 record |
| `fee_installments` | 120 record |
| `payments` | 17 record; sono costi generali/pagamenti coach, non rate atleta |
| `messages` / `message_recipients` | 2 / 3 record |
| `push_subscriptions` | 2 record |
| `documents` / `document_recipients` | 5 / 0 record |
| `event_attendances` / `rsvp` | 0 / 0 record |
| `system_logs` | 0 record |

Vincoli rilevanti:

- `profiles.id -> auth.users.id ON DELETE CASCADE`;
- `profiles.id` non ha default;
- `profiles.email` è `NOT NULL`, indicizzata ma non `UNIQUE`;
- `profiles.role` è `NOT NULL` con soli `admin`, `coach`, `athlete`;
- `profiles.must_change_password` e `profiles.is_active` mescolano stato persona e account;
- tutte le FK sportive principali puntano già a `profiles.id`;
- molte FK verso profili usano `ON DELETE CASCADE`, quindi la cancellazione fisica di una
  persona può eliminare storico sportivo e operativo;
- `v_profiles` e `championship_standings` sono già `security_invoker=true`;
- le nuove policy post-hardening usano `app_metadata`, non `user_metadata`.

La funzione `public.sync_auth_users_to_profiles()` esiste ancora, ma nel dump aggiornato
non risulta installato alcun trigger su `auth.users`. La migration dovrà comunque usare
`DROP TRIGGER IF EXISTS` per neutralizzare eventuale drift tra ambienti, senza assumere che
il trigger sia presente.

## 3. Assunzioni `profiles.id = auth.uid()` trovate

### 3.1 Funzioni e trigger SQL

Queste funzioni interpretano direttamente `auth.uid()` come ID persona, oppure scrivono
un UUID Auth in una FK verso `profiles`:

- `can_view_athlete_profile(uuid)`;
- `can_view_teammate_profile(uuid)`;
- `coach_has_team_in_group(uuid)`;
- `coach_is_assigned_to_team(uuid)`;
- `is_admin()`;
- `is_athlete()`;
- `is_coach()`;
- `is_coach_of_team(uuid)`;
- `is_in_same_team(uuid)`;
- `team_ids_for_coach()`;
- `messages_set_created_by()`;
- `prevent_non_admin_role_change()`;
- `sync_profile_role_to_app_metadata()`;
- `sync_auth_users_to_profiles()`;
- `sync_championship_match_event()`;
- `update_user_role_safe(uuid, text)` (accoppia profilo, ruolo e Auth per lo stesso UUID).

`messages_set_created_by()` e `sync_championship_match_event()` sono particolarmente
critiche: assegnano `auth.uid()` a colonne `created_by` che referenziano `profiles.id`.

### 3.2 Policy con uso diretto di `auth.uid()`

Tutte le policy seguenti devono essere riesaminate. Alcune controllano solo che esista un
utente autenticato; la maggior parte usa l'UUID Auth come profilo o coach.

- `activities`: `Authenticated users can view activities`;
- `athlete_profiles`: `Admin can read athlete_profiles`, `Athlete can read own athlete_profile`;
- `championship_club_teams`: `championship_club_teams_auth_select`;
- `championship_group_teams`: `championship_group_teams_auth_select`;
- `championship_groups`: `championship_groups_auth_select`;
- `championship_match_sets`: `championship_match_sets_auth_select`;
- `championship_matches`: `championship_matches_auth_select`;
- `championships`: `championships_auth_select`;
- `document_recipients`: `Admin only access to document_recipients`,
  `document_recipients_user_view`;
- `document_templates`: `Admins can insert document templates`,
  `Authenticated users can view document templates`;
- `documents`: `Admin only access to documents`, `Users can view their own documents`;
- `event_attendances`: `delete_own_attendance`, `insert_own_attendance`,
  `read_attendance_for_related_events`, `update_own_attendance`;
- `event_teams`: `Athletes can view event teams`, `Coaches can view event teams`,
  `event_teams_athlete_select`, `event_teams_coach_select`;
- `events`: `Athletes can view events for their teams`,
  `Coaches can manage their team events`, `Coaches can view their team events`,
  `Coaches manage events for their teams`, `events_athlete_select`,
  `events_coach_delete`, `events_coach_insert`, `events_coach_select`,
  `events_coach_update`;
- `fee_installments`: `Users can view their own fee installments`,
  `fee_installments_athlete_select`;
- `gyms`: `Authenticated users can view gyms`;
- `membership_fees`: `Coaches view membership fees of own teams`,
  `membership_fees_athlete_select`;
- `message_attachments`: `message_attachments_owner_all`;
- `message_recipients`: `Users can view their message recipients`,
  `message_recipients_athlete_select`, `message_recipients_coach_delete`,
  `message_recipients_coach_modify`, `message_recipients_coach_select`,
  `message_recipients_coach_update`, `message_recipients_user_update_read`;
- `messages`: `Coaches can manage messages for their teams`,
  `Coaches can view their messages`, `Users can send messages`,
  `Users can view messages sent to them`, `messages_athlete_select`,
  `messages_coach_delete`, `messages_coach_insert`, `messages_coach_select`,
  `messages_coach_update`;
- `payments`: `Coaches can view their payments`;
- `profiles`: `Users can view their own profile`, `profiles_select_message_senders`,
  `profiles_select_message_senders_coaches`, `profiles_select_self_or_admin`,
  `profiles_update_self_or_admin`;
- `push_subscriptions`: `Users can manage their own push subscriptions`,
  `push_subscriptions_admin_read`, `push_subscriptions_owner_all`;
- `rsvp`: `Coaches can view RSVP for their teams`,
  `Users can manage their own RSVP`;
- `team_coaches`: `Athletes can view coaches of their teams`;
- `team_members`: `Users can view their team memberships`;
- `team_training_schedules`: `Athletes can view their team schedules`,
  `Coaches can view their team schedules`;
- `teams`: `Athletes can view their teams`, `Coaches can view their teams`,
  `teams_athlete_select`;
- `user_roles`: `user_roles_self_or_admin_select`.

Le altre policy che chiamano `is_admin()`, `is_coach()`, `is_athlete()`,
`is_coach_of_team()`, `is_in_same_team()` o gli helper coach dipendono transitivamente
dalla stessa assunzione e saranno incluse nella riscrittura, anche se non contengono
letteralmente `auth.uid()`.

### 3.3 Codice applicativo con uso diretto dell'UUID Auth come persona

Core autenticazione e navigazione:

- `src/hooks/useAuth.ts`: carica `profiles.id = session.user.id`, cache compresa;
- `src/app/api/auth/login/route.ts`: prefetch profilo tramite UUID Auth;
- `src/app/api/auth/reset-password/route.ts`: aggiorna `profiles.id = user.id`;
- `src/components/shared/ResetPasswordForm.tsx`: risolve il profilo dall'account;
- `src/middleware.ts`: autorizza admin dal singolo `app_metadata.role`;
- `src/components/auth/ProtectedRoute.tsx`: autorizza dal singolo `profile.role`;
- `src/app/dashboard/page.tsx`: sceglie una sola dashboard da un solo ruolo;
- `src/components/navigation/RoleSidebar.tsx`: costruisce un solo menu da `profile.role`.

Route utente/atleta:

- `src/app/api/athlete/calendar/route.ts`;
- `src/app/api/athlete/dashboard/route.ts`;
- `src/app/api/athlete/events/attendance/route.ts`;
- `src/app/api/athlete/events/detail/route.ts`;
- `src/app/api/athlete/fees/route.ts`;
- `src/app/api/athlete/messages/route.ts`.

Queste route filtrano o scrivono `profile_id = user.id`, quindi non possono operare per
un figlio e non distinguono soggetto da attore.

Route coach:

- `src/app/api/coach/calendar/route.ts`;
- `src/app/api/coach/events/detail/route.ts`;
- `src/app/api/coach/messages/route.ts`;
- `src/app/api/coach/payments/route.ts`.

Queste route filtrano `coach_id = user.id` o scrivono `created_by = user.id`.

Account e amministrazione:

- `src/app/api/admin/users/route.ts`: crea prima Auth, usa lo stesso UUID per il profilo,
  elimina profilo e Auth insieme, usa `profiles.is_active` come stato account e tratta
  `user_roles` come multi-ruolo nonostante la PK;
- `src/app/api/admin/users/import/route.ts`: ogni persona importata riceve sempre un invito;
- `src/app/api/admin/users/reset-password/route.ts`: assume ID profilo = ID Auth;
- `src/app/api/admin/athletes/route.ts` e `bulk/route.ts`;
- `src/app/api/admin/coaches/route.ts` e `bulk/route.ts`;
- `src/app/api/admin/events/route.ts`;
- `src/app/api/admin/messages/route.ts`;
- `src/app/api/admin/payments/route.ts`;
- `src/app/api/admin/membership-fees/route.ts`;
- `src/app/api/admin/document-templates/route.ts`;
- `src/app/api/admin/documents/generate/route.ts`.

Le restanti route admin verificano un singolo `app_metadata.role` e devono passare al
contesto account centralizzato:

- `admin/balance`, `admin/events/attendance`, `admin/incassi/*`,
  `admin/installments`, `admin/membership-fees/available`;
- `championships/standings`;
- `messages/attachments/upload`.

Notifiche:

- `src/app/api/notifications/subscribe/route.ts` salva `profile_id = user.id`;
- `src/app/api/notifications/unsubscribe/route.ts` filtra `profile_id = user.id`;
- `src/lib/utils/push.ts` e `src/lib/utils/notifications.ts` trattano la subscription
  come proprietà del profilo.

Componenti client con query dirette o ruolo singolo:

- `src/components/athlete/AthleteDashboard.tsx`;
- `src/components/athlete/ChampionshipsManager.tsx`;
- `src/components/coach/CoachDashboard.tsx`;
- `src/components/coach/ChampionshipsManager.tsx`;
- `src/components/coach/CoachMessagesManager.tsx`;
- `src/components/admin/ChampionshipsManager.tsx`;
- `src/components/shared/UserProfile.tsx`;
- `src/components/admin/AdminDashboard.tsx`;
- `src/components/admin/UserFormModal.tsx`;
- `src/components/admin/UsersManager.tsx`;
- `src/components/admin/AthletesManager.tsx`;
- `src/components/admin/CoachesManager.tsx`;
- `src/components/admin/BalanceDashboard.tsx`;
- `src/components/admin/DocumentsManager.tsx`;
- `src/components/admin/MessagesManager.tsx`;
- `src/components/admin/MembershipFeesManager.tsx`;
- `src/components/admin/PaymentsManager.tsx`;
- `src/components/admin/TeamsManager.tsx`;
- `src/components/admin/ImportManager.tsx`;
- `src/components/admin/BulkGenerateModal.tsx`;
- `src/components/admin/incassi/AthleteDetailDrawer.tsx`;
- `src/lib/utils/trainingScheduleEvents.ts`.

## 4. Modello target e decisioni architetturali

### 4.1 Tabelle principali

`profiles` resta la persona. In Fase 1:

- si rimuove solo la FK verso `auth.users`, preservando PK e ID;
- si aggiunge `DEFAULT gen_random_uuid()` a `id`;
- `email` diventa nullable e resta email di contatto, non chiave di login;
- `role` diventa nullable ma resta valorizzato sui 48 record per compatibilità;
- `must_change_password` resta temporaneamente, ma la fonte autorevole diventa
  `app_accounts.must_change_password`;
- `is_active` assume il significato di anagrafica archiviata/attiva, non account sospeso.

`app_accounts` segue lo schema richiesto, con questi dettagli:

- PK `auth_user_id` con `ON DELETE CASCADE`;
- `owner_profile_id UNIQUE NOT NULL` con `ON DELETE RESTRICT`;
- stato `invited|active|suspended|disabled`;
- indice su `(status)` e trigger `updated_at`;
- nessun `auth_user_id` duplicato anche in `profiles`.

`account_roles` ha PK composta `(auth_user_id, role)` e contiene solo
`admin|coach|staff`. `athlete` non viene backfillato come ruolo globale.

Il ruolo `coach` abilita l'area coach, ma non attribuisce accesso a nessuna squadra.
L'unica catena autorevole per autorizzare una squadra è:

```text
app_accounts.owner_profile_id
  -> team_coaches.coach_id
  -> team_coaches.team_id
```

Non sono ammessi fallback su `teams.coach_id`, `team_members.role='coach'`,
`profiles.role` o claim JWT. `is_athlete()` deriva esclusivamente dalla presenza della
persona in `athlete_profiles` o `team_members`, non da `account_roles`.

Decisione confermata: `team_coaches` è la fonte autorevole per l'accesso coach alle
squadre e per il ruolo dell'assegnazione. `teams.coach_id` resta temporaneamente un
campo legacy/compatibilità e non viene sincronizzato automaticamente, perché non può
rappresentare più coach o ruoli distinti senza perdita di informazione. Nel dato
attuale, `Amatoriale Mar-Gio` ha Daniele Politi come `head_coach` e Francesca Costantini
come `assistant_coach`; `Maschile` ha Daniele Politi come `head_coach`.

`profile_relationships` segue lo schema richiesto, con:

- `valid_until IS NULL OR valid_until >= valid_from`;
- indici su source, target, stato e validità;
- `verified_by` rinominato semanticamente `verified_by_auth_user_id` e
  `ON DELETE SET NULL`, mentre l'audit immutabile conserva uno snapshot dell'attore;
- nessuna cancellazione fisica dal flusso UI: `DELETE` applica `status='revoked'`;
- nessuna relazione self;
- un solo `is_primary_contact=true` attivo per target;
- un solo `is_billing_contact=true` attivo per target;
- più relazioni possono avere `can_receive_messages=true` o
  `is_emergency_contact=true`.

L'unicità dei contatti principali è protetta nel database, non solo nella UI. Una
relazione scaduta non autorizza mai; il flusso amministrativo chiude/revoca il precedente
contatto principale prima di assegnarne uno nuovo.

### 4.2 Helper di sicurezza

Gli helper che devono leggere tabelle protette vivono in uno schema non esposto,
proposto `private`, non in `public`:

- `private.current_profile_id()`;
- `private.has_account_role(role)`;
- `private.has_active_relationship(target_profile_id)`;
- un helper specifico per ogni permesso (`can_view_schedule`,
  `can_confirm_attendance`, `can_view_payments`, ecc.);
- helper coach/team basati sul profilo proprietario risolto dall'account.

Quando serve bypass RLS, la funzione è `SECURITY DEFINER`, ha riferimenti qualificati,
`search_path` fissato, `EXECUTE` revocato a `PUBLIC` e concesso solo ad
`authenticated`/`service_role`. Le firme pubbliche legacy (`is_admin()`, ecc.) restano
temporaneamente come wrapper `SECURITY INVOKER` per non rompere tutte le policy nello
stesso deploy.

I grant dello schema `private` sono espliciti:

- `REVOKE ALL ON SCHEMA private FROM PUBLIC`, `anon` e ruoli non necessari;
- `GRANT USAGE ON SCHEMA private TO authenticated, service_role`; nessun `USAGE` ad
  `anon`; eventuali ruoli ulteriori richiedono una migration esplicita;
- nessun grant diretto sulle eventuali tabelle private ad `anon` o `authenticated`;
- `REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC` prima dei grant;
- `GRANT EXECUTE` funzione per funzione, mai `ALL FUNCTIONS`;
- gli helper RLS strettamente necessari sono eseguibili da `authenticated`; funzioni di
  manutenzione o backfill sono eseguibili solo da `service_role`/owner database;
- ogni funzione ha `search_path` fisso e usa nomi completamente qualificati;
- i default privileges sono revocati per impedire esposizioni future involontarie;
- test SQL automatici verificano `USAGE`, `EXECUTE`, assenza di accesso tabellare e
  impossibilità di chiamare funzioni non concesse.

`app_accounts` non usa `current_profile_id()` nella propria policy self, evitando
ricorsione: il self-check è direttamente `auth_user_id = auth.uid()`.

### 4.3 Autorizzazione applicativa

Si introduce un unico resolver server-side, indicativamente:

- `src/server/auth/require-account-context.ts`;
- `src/server/auth/require-global-role.ts`;
- `src/server/profiles/require-profile-permission.ts`.

Il contesto contiene `authUserId`, `ownerProfileId`, `accountStatus` e `roles[]`.
Ogni route chiama `supabase.auth.getUser()` e poi risolve il contesto dal database.
Nessuna route si autorizza esclusivamente dal ruolo ricevuto dal client o dal JWT.

Il percorso predefinito per dati applicativi è:

```text
client Supabase dell'utente autenticato + RLS
```

Il client admin è ammesso soltanto per Supabase Auth Admin, ciclo di vita account,
operazioni amministrative strettamente circoscritte o casi documentati in cui RLS non è
applicabile. Non viene usato genericamente dopo un controllo TypeScript per leggere o
scrivere dati di dominio. Vive in un solo modulo `server-only`, indicativamente
`src/server/supabase/admin-client.ts`; nessun barrel client lo riesporta e un test di
dipendenze impedisce import da Client Components o moduli frontend.

Il middleware resta responsabile di refresh sessione e presenza login, non di decisioni
di dominio: lo stato account e i ruoli vengono verificati dalle route/server layer e da
RLS. Questo evita di affidarsi a claim JWT non ancora aggiornati.

### 4.4 Dati profilo e granularità

RLS è row-level e non può nascondere singole colonne sensibili di `profiles`. Perciò una
relazione familiare non ottiene automaticamente `SELECT *` sul profilo del figlio.

- `/api/me/accessible-profiles` restituisce solo identità minima e permessi;
- calendario, pagamenti, documenti, stato medico e contatti hanno controlli separati;
- le route server-side usano per default il client dell'utente e RLS;
- le query client dirette verso dati sensibili vengono progressivamente spostate dietro
  route tipizzate solo quando il controllo non può essere espresso correttamente in RLS.

### 4.5 Actor e subject

Le colonne esistenti che puntano a `profiles` restano riferimenti a persone. Quando una
persona agisce per un'altra:

- `subject_profile_id` identifica il soggetto;
- `performed_by_auth_user_id` identifica l'account;
- dove utile, `performed_by_profile_id` conserva la persona proprietaria dell'account;
- audit e future firme gestite da un provider esterno salvano snapshot di relazione/tipo
  per restare storici dopo revoca.

Per audit e future evidenze esterne, l'UUID Auth storico non deve bloccare la cancellazione dell'account:
viene conservato come valore immutabile senza FK distruttiva, insieme a uno snapshot
dell'attore. Le colonne operative non storiche possono usare `ON DELETE SET NULL`.

### 4.6 Maggiore età e accesso familiare

La minore età è calcolata da `profiles.birth_date`. Un override amministrativo è ammesso
solo con motivazione obbligatoria, attore e timestamp; viene mantenuto in una struttura
auditabile, non in un flag client.

Un helper centralizzato, indicativamente `private.is_profile_minor(profile_id, at_date)`,
applica questa precedenza:

1. override amministrativo attivo e motivato;
2. calcolo dalla data di nascita;
3. dato mancante o incoerente: fail closed, nessun accesso parent automatico.

La relazione `parent` resta nello storico, ma dal giorno del diciottesimo compleanno non
concede più accesso operativo. L'accesso successivo richiede una relazione `delegate`
attiva e verificata con i permessi necessari. Letture, audit ed eventuali evidenze esterne
già registrate non vengono modificati retroattivamente.

### 4.7 Fonti autorevoli dei dati persona/atleta/squadra

Prima della Fase 4 viene completato un consolidamento esplicito:

- `profiles`: anagrafica e contatti (`first_name`, `last_name`, `birth_date`, email e
  telefono di contatto, avatar);
- `athlete_profiles`: numero tessera, stato e scadenza del certificato medico;
- `team_members`: dati specifici di squadra/stagione, incluso numero maglia.

Le colonne duplicate non vengono eliminate finché una migration di confronto non ha:

1. classificato valori uguali, null e conflitti;
2. prodotto un report dei conflitti senza sovrascrittura automatica;
3. backfillato solo valori mancanti dalla fonte scelta;
4. migrato tutte le letture/scritture alla fonte autorevole;
5. aggiunto test di non regressione e solo infine deprecato le copie legacy.

Per i genitori, `can_view_medical_status` espone soltanto stato e scadenza del
certificato; non concede accesso a note o dati sanitari dettagliati.

## 5. Piano delle migration

Ogni file viene creato con `supabase migration new`, mai nominato manualmente.

### Fase 1 — schema, backfill e compatibilità

Migration 1: `create_account_person_model`

- crea `app_accounts`, `account_roles`, `profile_relationships`;
- crea check, indici e trigger `updated_at`;
- abilita RLS immediatamente;
- revoca privilegi impliciti e concede solo quelli necessari;
- non modifica ancora policy operative esistenti.

Migration 2: `backfill_existing_accounts_and_roles`

- inserisce un `app_accounts` per ogni join `auth.users.id = profiles.id`;
- determina stato iniziale:
  - `disabled` se `profiles.is_active = false`;
  - `invited` se Auth è invitato ma non ha completato il primo accesso;
  - `active` altrimenti;
- copia `profiles.must_change_password`;
- inserisce in `account_roles` solo `admin` e `coach`, usando l'unione tra
  `profiles.role` e `user_roles`;
- usa `ON CONFLICT DO NOTHING/UPDATE` in modo idempotente;
- contiene assert che falliscono la migration se un account non ha esattamente un
  mapping o se un owner è duplicato.

Migration 3: `decouple_profiles_from_auth`

- elimina `profiles_id_fkey`;
- imposta default UUID;
- rende `email` e `role` nullable;
- mantiene valori e colonne legacy;
- esegue `DROP TRIGGER IF EXISTS sync_auth_users_to_profiles_trigger ON auth.users`;
- revoca l'esecuzione pubblica della funzione legacy e la marca con commento di
  deprecazione; la rimozione definitiva resta in Fase 6.

Migration 4: `account_authorization_helpers_and_rls`

- crea schema/helper privati;
- applica revoche, `USAGE` e `EXECUTE` puntuali definiti nella sezione 4.2, senza grant
  diretti alle tabelle private;
- riscrive `is_admin`, `is_coach`, `is_athlete`, helper team e visibilità profili;
- `is_coach` verifica l'abilitazione area, gli helper team seguono esclusivamente
  `owner_profile_id -> team_coaches`, e `is_athlete` legge solo dati sportivi;
- crea policy self/admin sulle tre nuove tabelle;
- impedisce agli utenti standard di mutare owner, ruoli, verifiche e permessi;
- verifica RLS di `user_roles`, mantenuta solo in lettura compatibile;
- aggiunge test automatici di grant/default privileges e `search_path`;
- non concede ancora accesso famiglia ai domini operativi.

Gate Fase 1: i 48 account esistenti devono continuare a operare; nessun profilo senza
account viene creato finché Fase 3 non è deployata.

### Fase 2 — migrazione incrementale delle autorizzazioni

Fase 2 non viene rilasciata in un unico deploy. Ogni sottofase ha una migration, un
deploy applicativo indipendente e un gate di merge. Le policy non ancora migrate restano
nel modello legacy finché arriva la loro sottofase; i 48 ID esistenti rendono possibile
questa convivenza controllata.

#### Fase 2A — account context, profilo personale e account status

Migration 5: `account_context_and_personal_access_policies`

- stabilizza `private.current_profile_id()` e il controllo status account;
- migra solo policy self di `app_accounts`, `account_roles` e `profiles`;
- introduce il resolver server `requireAccountContext` e migra login, reset password,
  `useAuth`, dashboard base e profilo personale;
- un account `suspended` o `disabled` non ottiene contesto, dati o mutazioni.

Test SQL: active/invited/suspended/disabled, owner univoco, self SELECT/UPDATE e diniego
cross-profile.

Test API: login legacy, profilo personale, reset password, 401/403 per status non
operativo e UUID manipolato.

Query di verifica: conteggi Auth/profili/mapping, mapping senza owner, account non active
che risolvono un profilo (atteso zero), policy self residue con confronto diretto
`profiles.id = auth.uid()`.

Gate di merge: login e profilo personale funzionano per tutti i 48 account; sospensione
blocca API e RLS immediatamente; nessuna route migrata scrive `user.id` in una FK profilo.

Rollback/roll-forward: rollback del codice al resolver legacy è possibile perché gli ID
restano invariati; le tabelle additive restano. Se la migration policy è già applicata,
si ripristinano soltanto le policy self precedenti con una migration forward correttiva.

#### Fase 2B — Admin e Staff

Migration 6: `admin_staff_account_role_policies`

- migra le policy e le route admin dal singolo claim a `account_roles`;
- `admin` conserva le operazioni globali esplicitamente elencate;
- `staff` non equivale ad admin e non riceve accesso globale implicito;
- ogni capacità staff è nominata e concessa solo alla policy/route necessaria; la prima
  capacità prevista è la verifica relazioni in Fase 4;
- centralizza il client Auth Admin nel modulo server-only e aggiunge il controllo
  statico che ne vieta import frontend.

Test SQL: matrice admin/staff/utente su profili, account e ruoli; grant dello schema
`private`; tentativi staff su funzioni admin non concesse.

Test API: tutte le route `/api/admin/**`, payload con ruolo falsificato, status
disabilitato e import account.

Query di verifica: policy admin ancora basate solo su JWT (atteso zero nel perimetro),
grant eccessivi, funzioni `private` eseguibili da `PUBLIC`, route admin ancora prive del
resolver centralizzato.

Gate di merge: l'admin esistente conserva tutte le funzioni; staff vede soltanto
capabilities allowlisted; il frontend non importa service role/admin client.

Rollback/roll-forward: il codice admin precedente può essere ripristinato mentre il
dual-write legacy è attivo; le policy vengono corrette con nuova migration, mai
modificando una migration già applicata.

#### Fase 2C — Coach e autorizzazioni squadra

Migration 7: `coach_team_assignment_policies`

- `account_roles.coach` abilita esclusivamente l'area coach;
- tutte le policy team usano soltanto `current_profile_id() -> team_coaches.coach_id`;
- elimina fallback autorizzativi su `teams.coach_id`, `team_members.role='coach'`,
  `profiles.role` e claim JWT;
- migra route coach, calendario, eventi, convocazioni, pagamenti coach e query UI.

Test SQL: coach con zero/una/più squadre, due coach sulla stessa squadra, coach che è
anche genitore/iscritto, tentativo di accesso a squadra non assegnata.

Test API: ogni route coach con team ID valido, alterato e rimosso durante la sessione.

Query di verifica: policy/funzioni contenenti `teams.coach_id = auth.uid()`,
`team_members.role='coach'` o `team_coaches.coach_id = auth.uid()` (atteso zero);
confronto squadre restituite dall'API con `team_coaches`.

Gate di merge: aggiungere/rimuovere `account_roles.coach` cambia l'area, mentre
aggiungere/rimuovere `team_coaches` cambia immediatamente le singole squadre accessibili.

Rollback/roll-forward: si mantiene `team_coaches` come fonte dati; eventuali regressioni
si correggono con policy forward. Nessun backfill autorizzativo usa le colonne fallback.

#### Fase 2D — Iscritti e accesso personale

Migration 8: `athlete_personal_access_policies`

- riscrive `is_athlete()` usando `athlete_profiles` o `team_members`;
- migra policy e route athlete per calendario, dashboard, presenze e quote personali;
- non crea `account_roles.athlete`;
- mantiene ancora fuori perimetro l'accesso parent, introdotto in Fase 4.

Test SQL: atleta con/senza `athlete_profiles`, iscrizione a più squadre, persona non
iscritta e compagno di squadra.

Test API: tutte le route `/api/athlete/**`, self e IDOR.

Query di verifica: record `account_roles.role='athlete'` (atteso zero), helper che
leggono `profiles.role='athlete'` e route athlete che usano `user.id` come profilo.

Gate di merge: i 44 atleti esistenti conservano accesso personale; una persona non
iscritta non ottiene l'area atleta; revoca iscrizione aggiorna subito l'accesso.

Rollback/roll-forward: le colonne legacy restano in dual-read fino a fine gate; eventuali
correzioni policy sono forward e non modificano dati sportivi.

Implementazione eseguita:

- `20260807135515_athlete_personal_access_policies.sql` applicata in locale e staging;
- `20260807135828_athlete_personal_access_policy_corrections.sql` applicata in locale e staging;
- le policy atleta usano `private.current_profile_id()` e `private.is_in_same_team()`;
- le API e i componenti atleta usano `ownerProfileId`/`profile.id`, mentre l'identità Auth
  resta confinata alla risoluzione dell'account;
- coperti accesso personale a profilo atleta, squadre, eventi, calendario, quote,
  messaggi, RSVP e presenze; l'accesso parent resta fuori perimetro;
- build Next.js, TypeScript ed E2E locale completati: 6 test su 6 passati;
- backup staging pre-migration: `/tmp/csroma_staging_before_athlete_phase2d_schema.sql`,
  `/tmp/csroma_staging_before_athlete_phase2d_data.sql`,
  `/tmp/csroma_staging_before_athlete_phase2d_roles.sql`;
- `supabase db push --linked --dry-run` staging: database aggiornato.

Correzione post-staging: `20260807142346_drop_legacy_profile_message_policies.sql` rimuove
le due policy legacy dei mittenti messaggi su `profiles`, che insieme alle nuove policy
account-based del dominio messaggi causavano ricorsione RLS infinita. La correzione è stata
applicata e verificata su staging; il dump successivo non contiene più quelle policy e il
dry-run è aggiornato. L'applicazione locale resta da eseguire quando il daemon Docker sarà
nuovamente disponibile.

La successiva verifica coach ha evidenziato un secondo gruppo di policy legacy su
`messages` e `message_recipients`; è stata quindi applicata anche
`20260807143216_drop_legacy_message_policies.sql`. Le policy storiche sono state rimosse,
il dump staging non le contiene più e il dry-run è aggiornato.

La correzione definitiva è contenuta in
`20260807143907_fix_message_recipient_coach_rls_recursion.sql`: usa
`private.is_message_owner()` come funzione `SECURITY DEFINER` per il solo controllo di
ownership, evitando il ciclo tra `messages` e `message_recipients`. Una verifica SQL
read-only con il JWT coach di staging ha confermato 3 destinatari e 5 messaggi accessibili.

Fase 2E, slice 1: la migration
`20260807160000_shared_push_subscription_account_policies.sql` sostituisce le policy
legacy di `push_subscriptions` con policy basate su `private.current_profile_id()` e
`private.has_account_role('admin')`. Le route subscribe, unsubscribe e test risolvono ora
`ownerProfileId` tramite il contesto account prima di leggere o scrivere le subscription.
La migration è stata applicata manualmente in locale dopo una verifica dei grant dello
schema `private` (il CLI locale si fermava su una migration coach già verificata); la
history locale è stata riallineata con `supabase migration repair`. La build Next.js è
passata. Dopo backup `/tmp/csroma_staging_before_2e_push_schema.sql`, dry-run e
applicazione, staging mostra esclusivamente le due policy account-based attese e il
successivo dry-run è aggiornato. Produzione non è stata modificata.

Fase 2E, slice 2: le migration
`20260807162000_shared_document_account_policies.sql` e
`20260807162100_shared_document_legacy_policy_cleanup.sql` aggiornano documents,
document recipients, document templates e le policy Storage dei PDF generati. Le FK
persona (`profile_id`, `target_user_id`, `created_by`) restano basate sul profilo
proprietario; `document_recipients.user_id` resta intenzionalmente un identificatore Auth
del destinatario. Il slice è applicato e verificato in locale; il passaggio staging resta
da eseguire dopo il commit. Dopo backup `/tmp/csroma_staging_before_2e_documents_schema.sql`,
dry-run e applicazione, staging espone solo le policy documentali account-based attese e
`supabase db push --linked --dry-run` conferma `Remote database is up to date`. Produzione
non è stata modificata.

Fase 2E, slice 3: la migration
`20260807164000_shared_financial_account_policies.sql` rimuove le policy duplicate legacy
da `payments`, `membership_fees` e `fee_installments`, mantenendo le policy coach/atleta
basate sugli helper privati e sostituendo i controlli admin con
`private.has_account_role('admin')`. I conteggi locali restano 17 pagamenti, 9 quote e
120 rate. Dopo backup `/tmp/csroma_staging_before_2e_financial_schema.sql`, dry-run e
applicazione, staging espone solo le policy account-based attese e il dry-run è aggiornato.
Produzione non è stata modificata.

#### Fase 2E — messaggi, notifiche, documenti e domini condivisi

Migration 9: `shared_domain_actor_and_access_policies`

- migra policy e route condivise di messaggi, allegati, notifiche, documenti, quote,
  pagamenti, eventi e tabelle di supporto;
- nelle FK persona scrive `ownerProfileId`, nelle colonne actor scrive `authUserId`;
- rimuove duplicazioni di policy solo nel dominio migrato;
- prepara, senza abilitarlo, il subject delegato della Fase 4.

Test SQL: matrice self/admin/coach per ciascun dominio, `USING` + `WITH CHECK`, allegati
storage e grant.

Test API: messaggi, notifications, documents, shared routes, BOLA/IDOR e status account.

Query di verifica: inventario completo della sezione 3.2, confronti diretti residui tra
UUID Auth e FK profilo, policy duplicate e funzioni pubbliche con grant eccessivi.

Gate di merge: nessuna occorrenza applicativa nel perimetro completo passa `user.id` a
`profile_id`, `coach_id` o `created_by -> profiles`; tutti i domini mantengono il
comportamento dei 48 account.

Rollback/roll-forward: deploy applicativo reversibile grazie ai campi legacy; policy e
grant vengono riparati con migration forward atomica per dominio.

### Fase 3 — persone e ciclo di vita account

Migration 10: `person_and_account_audit_support`

- separa semanticamente archiviazione persona e stato account;
- prepara audit delle operazioni account;
- nessuna cancellazione cascata del profilo dalla cancellazione Auth.

API nuove:

- `POST/GET /api/admin/profiles`;
- `GET/PATCH /api/admin/profiles/:id`;
- `POST /api/admin/profiles/:id/create-account`;
- `POST /api/admin/profiles/:id/invite-account`;
- `POST /api/admin/profiles/:id/suspend-account`;
- `POST /api/admin/profiles/:id/reactivate-account`;
- `DELETE /api/admin/profiles/:id/account`;
- eventuale `DELETE /account` self-service, con la stessa semantica di revoca logica.

Servizi server separati gestiscono persona e account. La creazione persona non invoca
Auth. Il flusso account:

1. blocca profili già collegati;
2. crea l'utente Auth server-side senza inviare ancora accesso, se la combinazione di
   Auth Admin API e mailer disponibile lo consente;
3. crea `app_accounts` e `account_roles` tramite un'operazione DB atomica e circoscritta;
4. rilegge e verifica mapping, owner, stato e ruoli;
5. genera il link di attivazione e lo invia solo dopo la verifica;
6. non usa password temporanee e non collega mai automaticamente un account esistente
   per sola uguaglianza email.

Prima dell'implementazione viene eseguito uno spike sul flusso supportato dalla versione
Supabase in uso: `createUser` senza notifica seguito da `generateLink` e invio tramite
mailer server. Se non è praticabile e si deve usare `inviteUserByEmail`, che invia subito,
il codice registra lo stato `provisioning`, verifica l'esito del mapping e testa
esplicitamente il caso "email inviata ma mapping fallito". In tale caso l'account viene
immediatamente disabilitato/bannato, l'errore è auditato e l'admin riceve un'azione di
riparazione; non si considera l'operazione riuscita.

Per il primo rilascio ogni cancellazione account ordinaria, incluso
`DELETE /api/admin/profiles/:id/account` e l'eventuale `DELETE /account`, è una revoca
logica:

- imposta `app_accounts.status='disabled'`;
- blocca immediatamente API, helper e RLS;
- applica un eventuale ban Auth come difesa aggiuntiva;
- non elimina `auth.users` e non elimina mai `profiles`;
- conserva mapping e audit per una possibile riattivazione controllata.

La cancellazione fisica Auth è un'operazione amministrativa separata, fuori dal flusso
normale e soggetta a retention, verifica dello storico e conferma esplicita.

UI:

- menu `Persone` e `Accessi`;
- lista e scheda persona con sezioni richieste;
- stato/azioni account;
- creazione minore senza obbligo di account o genitore;
- adattamento progressivo di `UsersManager`, `AthletesManager`, `CoachesManager` e
  relativi form/type, senza duplicare logica.

### Fase 4 — famiglie e profili accessibili

Migration 11: `consolidate_profile_athlete_team_sources`

- produce prima un report di confronto per numero tessera, certificato e numero maglia;
- blocca la migration automatica se trova conflitti non classificati;
- backfilla solo valori mancanti verso la fonte autorevole definita in 4.7;
- mantiene le colonne duplicate in sola compatibilità con TODO di rimozione;
- aggiunge query di verifica che dimostrano assenza di perdita dati.

Gate pre-Fase 4: tutte le letture/scritture usano `profiles` per anagrafica/contatti,
`athlete_profiles` per tessera/certificato e `team_members` per dati squadra/stagione.

Migration 12: `relationship_permissions_age_and_domain_helpers`

- completa policy `profile_relationships`;
- aggiunge helper per validità, status e singolo permesso;
- aggiunge override amministrativo della minore età con motivo, attore e timestamp;
- centralizza `is_profile_minor()` e disattiva l'accesso `parent` al compimento dei 18;
- richiede una relazione `delegate` attiva/verificata per l'accesso successivo;
- impone un solo contatto amministrativo e un solo contatto pagamenti attivi;
- aggiunge audit verifica/revoca/modifica;
- non concede una policy generica che esponga tutte le colonne di `profiles`.

API:

- `GET/POST /api/admin/profiles/:id/relationships`;
- `PATCH/DELETE /api/admin/relationships/:relationshipId`;
- `GET /api/me/accessible-profiles`;
- aggiornamento delle route di dominio per accettare un `subjectProfileId` e verificarlo
  server-side.

Frontend:

- provider account/profilo accessibile;
- selettore persistente "Stai operando per";
- persistenza solo UI (local storage o cookie non autorevole);
- reset automatico della selezione quando relazione scade, viene revocata o il soggetto
  compie 18 anni senza delega valida;
- aree personale, famiglia, coach, amministrazione non mutuamente esclusive.

Le relazioni familiari sono verificate inizialmente soltanto da Admin o Staff con la
capability esplicita. Un parent con `can_view_medical_status` vede esclusivamente stato e
scadenza del certificato.

### Fase 5 — domini collegati

Migration 13: `account_message_reads_and_push_subscriptions`

- crea `message_reads(message_id, auth_user_id, subject_profile_id, read_at)`;
- mantiene `message_recipients.is_read/read_at` in dual-read temporaneo;
- backfilla letture solo per destinatari diretti quando il mapping è univoco;
- non inventa letture individuali dai destinatari team legacy, perché il dato condiviso
  non identifica chi abbia letto;
- aggiunge `push_subscriptions.auth_user_id` nullable, backfill dai 2 record attuali,
  dual-write, nuova unique `(auth_user_id, endpoint)` e rimozione futura di `profile_id`;
- fan-out notifiche a tutti gli account autorizzati con `can_receive_messages=true`.

Migration 14: `attendance_rsvp_and_payment_actors`

- `event_attendances`: `responded_by_auth_user_id`, `response_source`, `responded_at`;
- `rsvp`: stessi campi per compatibilità, anche se oggi non usata dal codice;
- `fee_installments`: soggetto resta `profile_id`; aggiunge attore del pagamento quando
  effettivamente registrato;
- `payments`: conserva `coach_id`/costo generale e aggiunge solo actor audit dove serve;
- non usa `payment_subject_profile_id` su `payments` finché non viene chiarita la
  semantica, perché le quote atleta vivono in `fee_installments`.

Migration 15: `document_access_and_activity_audit`

- aggiunge letture/visualizzazioni documenti per account quando necessarie;
- evolve `system_logs` in audit actor/subject/azione/timestamp;
- preserva letture e audit dopo revoca relazione o revoca logica account;
- applica `can_view_documents` in modo separato dagli altri permessi;
- non implementa firme con valore legale, `document_signatures` o una firma applicativa
  proprietaria: la firma resta fuori da questo refactoring finché non viene scelto e
  progettato un provider dedicato.

### Fase 6 — rimozione legacy

Solo dopo almeno un ciclo completo in staging e monitoraggio produzione:

- elimina `sync_auth_users_to_profiles()`;
- elimina sync `profiles.role -> app_metadata`;
- rimuove letture/scritture da `user_roles` e poi la tabella;
- rimuove `profiles.role` e `profiles.must_change_password`;
- rimuove `push_subscriptions.profile_id` e campi lettura messaggi legacy;
- elimina wrapper SQL e fallback marcati con TODO di fase;
- aggiorna tipi, fixture e documentazione.

## 6. Strategia di backfill e verifiche

Il backfill viene eseguito in transazione e preceduto da query che bloccano casi
inattesi. Query minime dopo Fase 1:

```sql
select count(*) from auth.users;
select count(*) from public.profiles;
select count(*) from public.app_accounts;

select count(*) as auth_without_mapping
from auth.users au
left join public.app_accounts aa on aa.auth_user_id = au.id
where aa.auth_user_id is null;

select count(*) as mapping_without_owner
from public.app_accounts aa
left join public.profiles p on p.id = aa.owner_profile_id
where p.id is null;

select owner_profile_id, count(*)
from public.app_accounts
group by owner_profile_id
having count(*) <> 1;

select count(*) as changed_profile_ids
from public.profiles p
left join auth.users au on au.id = p.id
where p.created_at < :migration_started_at
  and au.id is null;
```

Per la fotografia corrente i risultati attesi sono 48 account, 48 profili, 48 mapping,
zero orfani e zero duplicati owner.

Il backfill ruoli atteso è 2 admin + 2 coach. I 44 atleti non generano
`account_roles('athlete')`.

## 7. Rollback

Le migration restano forward-only; ogni fase fornisce uno script di rollback manuale e
precondizioni esplicite.

Fase 1 è reversibile finché non esistono profili senza Auth:

1. verificare che ogni `profiles.id` esista ancora in `auth.users`;
2. verificare email non nulle e role legacy valido;
3. ripristinare NOT NULL/default/vincolo Auth;
4. ripristinare helper legacy;
5. eliminare nuove policy e tabelle in ordine relationships, roles, accounts.

Dopo Fase 3 il ripristino della FK `profiles -> auth.users` non è più reversibile senza
perdere anagrafiche o creare account fittizi. Da quel punto il rollback corretto è un
roll-forward: si mantiene lo schema additivo e si disabilitano le nuove UI/API.

Rollback applicativo:

- Fase 1 è compatibile con il codice vecchio perché i 48 ID e i campi legacy restano;
- Fasi 2A-2E mantengono dual-write dei ruoli legacy e possono essere riportate indietro
  indipendentemente nel codice; le policy già migrate ricevono correzioni roll-forward;
- Fase 3 non cancella dati persona durante rollback;
- Fase 4 revoca/oscura le relazioni senza cancellarle;
- Fase 5 mantiene colonne legacy fino alla Fase 6.

Prima di ogni applicazione staging/produzione viene creato un dump schema+dati+ruoli e
registrato il checksum. Nessun rollback usa delete cascata su persone o storico.

## 8. Rischi principali e mitigazioni

| Rischio | Mitigazione |
| --- | --- |
| Policy residue con `auth.uid() = profile_id` | inventario automatico `rg` sul dump e test SQL che fallisce se resta il pattern |
| JWT valido dopo sospensione/revoca | `app_accounts.status` verificato in ogni helper/RLS/API; ban Auth solo difesa aggiuntiva |
| Invito inviato prima del mapping | preferire create + mapping + verify + link; fallback immediato testato, disable/ban e riparazione auditata |
| Email contatto uguale per più familiari | `profiles.email` nullable/non autorevole; login email gestita da Auth |
| Parent vede colonne sensibili del figlio | niente `SELECT *` parent su `profiles`; endpoint/permessi per dominio |
| Parent conserva accesso dopo i 18 anni | helper minore centralizzato; parent storico ma non operativo; nuova delega verificata |
| Ruolo singolo in UI/middleware | context con `roles[]` e aree multiple; legacy dual-write temporaneo |
| Ruolo coach interpretato come accesso globale | ruolo abilita solo area; team sempre risolti tramite `owner_profile_id -> team_coaches` |
| Service role usata come bypass generico | user client + RLS di default; admin client server-only, allowlist e test import/grant |
| Cancellazione persona elimina storico | nessuna delete persona dal flusso account; revisione futura delle FK cascade |
| Campi atleta duplicati divergono | fonti autorevoli definite, report conflitti e consolidamento senza overwrite |
| Due genitori condividono stato lettura | `message_reads` per account e soggetto |
| Backfill letture team ambiguo | nessuna lettura individuale inventata; mantenimento flag legacy |
| `payments` confuso con quote atleta | quote/subject su `fee_installments`; `payments` resta contabilità costi/coach |
| Trigger Auth diverso tra ambienti | `DROP TRIGGER IF EXISTS`, dump e confronto staging prima della migration |
| Helper `SECURITY DEFINER` esposto | schema privato, search_path fisso, revoke PUBLIC, test grants/advisors |
| Relazione revocata ma cache UI attiva | recheck server a ogni richiesta; selector non autorizzativo |
| Indici mancanti nelle policy | indici source/target/status/date/role; `EXPLAIN` e performance advisor |

## 9. Ordine esatto dei commit/PR

Il piano raccomanda PR separate per Fase 1, ciascuna Fase 2A-2E, Fase 3, Fase 4,
Fase 5 e Fase 6. Ordine dei commit:

1. `docs: plan optional accounts and family profiles`;
2. `docs: incorporate approved authorization and lifecycle decisions`;
3. `test(db): add account model baseline and invariant checks`;
4. `feat(db): create account person and relationship tables`;
5. `feat(db): backfill existing accounts and global roles`;
6. `feat(db): decouple profiles from auth users`;
7. `feat(db): add private helpers explicit grants and initial rls`;
8. `test(db): cover account mapping grants and rollback preconditions`;
9. `feat(db): migrate personal account context policies`;
10. `refactor(auth): resolve owner profile and account status`;
11. `test(auth): gate phase 2a personal access and account status`;
12. `feat(db): migrate admin and staff role policies`;
13. `refactor(admin): use account roles and scoped server-only admin client`;
14. `test(admin): gate phase 2b admin staff routes and grants`;
15. `feat(db): migrate coach team assignment policies`;
16. `refactor(coach): authorize teams only through team coaches`;
17. `test(coach): gate phase 2c team isolation`;
18. `feat(db): migrate athlete personal access policies`;
19. `refactor(athlete): derive athlete access from sports records`;
20. `test(athlete): gate phase 2d personal athlete access`;
21. `feat(db): migrate shared domain actor and access policies`;
22. `refactor(domains): migrate messages notifications documents and shared routes`;
23. `test(domains): gate phase 2e shared access and idor protection`;
24. `feat(db): add person account lifecycle audit support`;
25. `feat(admin): add profile-only crud and robust invite lifecycle`;
26. `feat(admin-ui): add people access states and person detail`;
27. `test(admin): cover logical revoke mapping verification and invite failure`;
28. `feat(db): consolidate profile athlete and team member sources`;
29. `feat(db): add age-aware relationship permissions`;
30. `feat(family): add relationship APIs accessible profiles and selector`;
31. `test(family): cover age boundary contacts delegates and permission isolation`;
32. `feat(messages): add per-account reads and account push subscriptions`;
33. `feat(attendance): add actor subject fields to attendance rsvp and fees`;
34. `feat(documents): add document access and immutable actor audit`;
35. `test(domains): cover delegated actions reads and audit history`;
36. `refactor(legacy): remove profile role user_roles and compatibility fields`;
37. `test(e2e): validate full migration and legacy removal`.

## 10. Test da aggiungere

### SQL/integration database

- assert schema, FK, indici, RLS e grants;
- backfill eseguito due volte senza duplicati;
- revoca logica account mantiene Auth, mapping e profilo;
- cancellazione fisica Auth separata non elimina profilo;
- delete profilo collegato è rifiutata;
- status non active rende `current_profile_id()` nullo;
- policy self/admin/coach/relationship con JWT simulati;
- coach abilitato senza team non vede alcuna squadra;
- atleta deriva da `athlete_profiles`/`team_members`, mai da ruolo account;
- UPDATE sempre con `USING` e `WITH CHECK`;
- relazione pending/revoked/expired non autorizza;
- relazione parent smette di autorizzare esattamente a 18 anni e delegate continua;
- un solo contatto principale amministrativo e pagamenti per target;
- ogni permesso nega il dominio corrispondente;
- `authenticated` non può leggere tabelle private e può eseguire solo helper concessi;
- advisors security/performance senza nuovi errori critici;
- query automatica che cerca policy/funzioni residue con confronti diretti
  `profile_id = auth.uid()` o `coach_id = auth.uid()`.

### Unit test Jest

- Zod persone/account/relazioni;
- mapping stato Auth -> `app_accounts.status`;
- costruzione `AccessibleProfile` e matrice permessi;
- scelta area per ruoli multipli;
- compensazione create/invite account;
- mapping verificato prima dell'invio link e gestione fallback invito già inviato;
- calcolo minore, compleanno, override motivato e fail-closed senza `birth_date`;
- selector che scarta un profilo non più accessibile;
- source `self|parent|coach|admin|system` per attendance;
- fan-out notifiche senza duplicati account/device.

### Integration route

- persona atleta e coach senza account;
- account aggiunto in un secondo momento;
- suspend/reactivate/revoca logica account senza perdere profilo o Auth;
- cancellazione fisica Auth disponibile solo nell'azione amministrativa separata;
- admin non derivato da payload/JWT client;
- `profileId` manipolato restituisce 403;
- coach limitato ai team autorizzati;
- relazioni create/modificate/revocate solo da admin/staff autorizzato;
- parent maggiorenne negato e delegate verificato autorizzato;
- genitore vede solo stato/scadenza certificato, non dettagli sanitari;
- due parent hanno `message_reads` distinti.

### E2E Playwright

Tutti gli scenari obbligatori della specifica:

- account/persona: 8 scenari;
- famiglia: 12 scenari;
- sicurezza: 10 scenari;
- confine temporale prima/durante/dopo il diciottesimo compleanno;
- navigazione multi-area e persistenza selector;
- compatibilità login dei 48 account backfillati.

I test E2E usano fixture sintetiche nel Supabase locale/staging, mai il dump dati di
produzione.

## 11. File da creare o modificare

Nuovi moduli principali previsti:

- `src/server/auth/require-account-context.ts`;
- `src/server/auth/require-global-role.ts`;
- `src/server/supabase/admin-client.ts` (`server-only`, unico punto Auth Admin);
- `src/server/profiles/require-profile-permission.ts`;
- `src/server/admin/profiles.ts`;
- `src/server/admin/accounts.ts`;
- `src/server/admin/relationships.ts`;
- `src/lib/validation/profiles.ts`;
- `src/lib/validation/accounts.ts`;
- `src/lib/validation/relationships.ts`;
- test di confine import che vieta `admin-client` da moduli client;
- script/report di consolidamento `profiles`/`athlete_profiles`/`team_members`;
- route `/api/admin/profiles/**`, `/api/admin/relationships/**`,
  `/api/me/accessible-profiles`;
- componenti persone/account/relazioni e `ProfileSwitcher`;
- migration e test SQL descritti nella sezione 5.

File esistenti prioritari:

- auth/navigation: `src/middleware.ts`, `src/hooks/useAuth.ts`,
  `src/app/dashboard/page.tsx`, `src/components/navigation/RoleSidebar.tsx`,
  `src/components/auth/ProtectedRoute.tsx`;
- account admin: `src/app/api/admin/users/**`, `src/lib/validation/users.ts`,
  `src/components/admin/UsersManager.tsx`, `UserFormModal.tsx`, `userTypes.ts`;
- persone sportive: route/componenti athletes/coaches e relativi type;
- domini: tutte le route athlete/coach, messages, notifications, documents,
  membership fees, attendance e pagamenti elencate nella sezione 3;
- test/config: Jest, Playwright, script SQL RLS esistenti.

## 12. Decisioni funzionali confermate e perimetro rinviato

Default approvati e vincolanti:

1. minore calcolato da `birth_date`, con override amministrativo motivato e auditato;
2. un solo contatto principale amministrativo per soggetto;
3. un solo contatto principale pagamenti per soggetto;
4. più contatti ammessi per messaggi ed emergenze;
5. account creato tramite invito/link, senza password temporanee;
6. relazione familiare verificata inizialmente solo da Admin o Staff autorizzato;
7. accesso `parent` sospeso al compimento dei 18 anni; accesso successivo solo con
   relazione `delegate` attiva e verificata;
8. il parent può vedere soltanto stato e scadenza del certificato medico, non dettagli
   sanitari;
9. firma con valore legale esclusa dal refactoring finché non viene scelto il provider.
10. `team_coaches` è la fonte autorevole per accesso e ruolo coach; `teams.coach_id`
    resta un campo legacy non usato dalle route e policy coach migrate nella Fase 2C.

Restano rinviati senza bloccare la Fase 1:

- capability Staff ulteriori rispetto a quelle esplicitamente allowlisted;
- retention e procedura della cancellazione fisica Auth separata;
- provider pagamenti e semantica futura di `paid_by_auth_user_id`;
- provider di firma legale e relativo modello probatorio;
- merge persone duplicate, che non usa mai la sola uguaglianza email.

## 13. Gate operativo per iniziare Fase 1

Prima di scrivere/applicare la prima migration:

1. verificare changelog e documentazione Supabase correnti;
2. creare dump aggiornato di staging e confrontarlo con produzione;
3. verificare migration history locale/staging/produzione;
4. ripristinare il dump produzione in un ambiente isolato o clonare lo schema per prova;
5. eseguire baseline test dei 48 account;
6. creare le migration con CLI;
7. applicare solo locale, poi staging;
8. eseguire test, query di controllo e advisors;
9. produrre report di fase con file, migration, risultati, problemi e stato merge;
10. richiedere approvazione esplicita prima di qualsiasi applicazione in produzione.

Riferimenti Supabase verificati durante la pianificazione:

- Auth Admin invite: <https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail>
- Auth Admin update/ban: <https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid>
- Auth Admin delete: <https://supabase.com/docs/reference/javascript/auth-admin-deleteuser>
- Sign out e limiti revoca JWT: <https://supabase.com/docs/reference/javascript/auth-signout>
