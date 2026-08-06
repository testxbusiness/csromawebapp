# Piano di implementazione: persone, account opzionali e relazioni familiari

Stato del documento: pianificazione, nessuna migration applicata.

Branch di lavoro: `codex/person-account-family-model`.

Database:

- produzione: `qyiholnatsrvpoqoplje` (sola lettura durante analisi);
- staging: `kibtvkuiedoxgppnnxkf` (prima destinazione delle future migration);
- dump di riferimento: `backups/prod_db_20260806_164940_CEST_{schema,data,roles}.sql`.

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

`profile_relationships` segue lo schema richiesto, con:

- `valid_until IS NULL OR valid_until >= valid_from`;
- indici su source, target, stato e validità;
- `verified_by` rinominato semanticamente `verified_by_auth_user_id` e
  `ON DELETE SET NULL`, mentre l'audit immutabile conserva uno snapshot dell'attore;
- nessuna cancellazione fisica dal flusso UI: `DELETE` applica `status='revoked'`;
- nessuna relazione self;
- nessuna unicità sul "contatto principale" finché non viene deciso se due genitori
  possano essere co-principali.

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

Il middleware resta responsabile di refresh sessione e presenza login, non di decisioni
di dominio: lo stato account e i ruoli vengono verificati dalle route/server layer e da
RLS. Questo evita di affidarsi a claim JWT non ancora aggiornati.

### 4.4 Dati profilo e granularità

RLS è row-level e non può nascondere singole colonne sensibili di `profiles`. Perciò una
relazione familiare non ottiene automaticamente `SELECT *` sul profilo del figlio.

- `/api/me/accessible-profiles` restituisce solo identità minima e permessi;
- calendario, pagamenti, documenti, stato medico e contatti hanno controlli separati;
- le route server-side usano il client admin solo dopo `require-profile-permission`;
- le query client dirette verso dati sensibili vengono progressivamente spostate dietro
  route tipizzate.

### 4.5 Actor e subject

Le colonne esistenti che puntano a `profiles` restano riferimenti a persone. Quando una
persona agisce per un'altra:

- `subject_profile_id` identifica il soggetto;
- `performed_by_auth_user_id` identifica l'account;
- dove utile, `performed_by_profile_id` conserva la persona proprietaria dell'account;
- firma e audit salvano snapshot di relazione/tipo per restare storici dopo revoca.

Per audit e firme, l'UUID Auth storico non deve bloccare la cancellazione dell'account:
viene conservato come valore immutabile senza FK distruttiva, insieme a uno snapshot
dell'attore. Le colonne operative non storiche possono usare `ON DELETE SET NULL`.

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
- riscrive `is_admin`, `is_coach`, `is_athlete`, helper team e visibilità profili;
- crea policy self/admin sulle tre nuove tabelle;
- impedisce agli utenti standard di mutare owner, ruoli, verifiche e permessi;
- verifica RLS di `user_roles`, mantenuta solo in lettura compatibile;
- non concede ancora accesso famiglia ai domini operativi.

Gate Fase 1: i 48 account esistenti devono continuare a operare; nessun profilo senza
account viene creato finché Fase 3 non è deployata.

### Fase 2 — risoluzione account e riscrittura autorizzazioni

Migration 5: `replace_auth_uid_profile_policies`

- sostituisce tutte le policy elencate nella sezione 3.2;
- usa `current_profile_id()` per self/coach e `account_roles` per ruoli globali;
- aggiunge sempre `USING` e `WITH CHECK` alle policy UPDATE;
- rimuove policy duplicate/sovrapposte emerse dal dump;
- non introduce ancora permessi parent su dati specifici.

Codice:

- introduce il resolver account centralizzato;
- migra middleware, login, reset password, dashboard e navigazione;
- migra tutte le route admin, athlete, coach, notifications e attachments;
- per compatibilità, continua a sincronizzare `profiles.role` e
  `app_metadata.role` per gli account legacy fino alla Fase 6;
- scrive nelle FK profilo `ownerProfileId`, non `authUserId`;
- aggiunge test automatici di status account e BOLA/IDOR.

Gate Fase 2: nessuna occorrenza applicativa può passare `user.id` a `profile_id`,
`coach_id` o a una FK `created_by -> profiles`.

### Fase 3 — persone e ciclo di vita account

Migration 6: `person_and_account_audit_support`

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
- `DELETE /api/admin/profiles/:id/account`.

Servizi server separati gestiscono persona e account. La creazione persona non invoca
Auth. Il flusso account:

1. blocca profili già collegati;
2. crea/invita Auth lato server;
3. inserisce `app_accounts`;
4. assegna `account_roles`;
5. se 3/4 falliscono, elimina l'utente Auth appena creato e registra la compensazione;
6. non collega mai automaticamente un account esistente solo per uguaglianza email.

La cancellazione account imposta prima `disabled`, applica ban/revoca refresh token come
difesa aggiuntiva e poi elimina/soft-delete Auth secondo la decisione di retention. Le
policy basate su `app_accounts.status` bloccano subito anche un JWT già emesso.

UI:

- menu `Persone` e `Accessi`;
- lista e scheda persona con sezioni richieste;
- stato/azioni account;
- creazione minore senza obbligo di account o genitore;
- adattamento progressivo di `UsersManager`, `AthletesManager`, `CoachesManager` e
  relativi form/type, senza duplicare logica.

### Fase 4 — famiglie e profili accessibili

Migration 7: `relationship_permissions_and_domain_helpers`

- completa policy `profile_relationships`;
- aggiunge helper per validità, status e singolo permesso;
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
- reset automatico della selezione quando relazione scade/revoca;
- aree personale, famiglia, coach, amministrazione non mutuamente esclusive.

### Fase 5 — domini collegati

Migration 8: `account_message_reads_and_push_subscriptions`

- crea `message_reads(message_id, auth_user_id, subject_profile_id, read_at)`;
- mantiene `message_recipients.is_read/read_at` in dual-read temporaneo;
- backfilla letture solo per destinatari diretti quando il mapping è univoco;
- non inventa letture individuali dai destinatari team legacy, perché il dato condiviso
  non identifica chi abbia letto;
- aggiunge `push_subscriptions.auth_user_id` nullable, backfill dai 2 record attuali,
  dual-write, nuova unique `(auth_user_id, endpoint)` e rimozione futura di `profile_id`;
- fan-out notifiche a tutti gli account autorizzati con `can_receive_messages=true`.

Migration 9: `attendance_rsvp_and_payment_actors`

- `event_attendances`: `responded_by_auth_user_id`, `response_source`, `responded_at`;
- `rsvp`: stessi campi per compatibilità, anche se oggi non usata dal codice;
- `fee_installments`: soggetto resta `profile_id`; aggiunge attore del pagamento quando
  effettivamente registrato;
- `payments`: conserva `coach_id`/costo generale e aggiunge solo actor audit dove serve;
- non usa `payment_subject_profile_id` su `payments` finché non viene chiarita la
  semantica, perché le quote atleta vivono in `fee_installments`.

Migration 10: `document_signatures_and_activity_audit`

- crea `document_signatures` con account firmatario, profilo firmato, relationship,
  versione, timestamp e snapshot del tipo relazione;
- aggiunge letture/visualizzazioni per account se necessarie;
- evolve `system_logs` in audit actor/subject/azione/timestamp;
- preserva firme e audit dopo revoca relazione e cancellazione account;
- applica `can_view_documents` e `can_sign_documents` separatamente.

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
- Fase 2 mantiene dual-write dei ruoli legacy;
- Fase 3 non cancella dati persona durante rollback;
- Fase 4 revoca/oscura le relazioni senza cancellarle;
- Fase 5 mantiene colonne legacy fino alla Fase 6.

Prima di ogni applicazione staging/produzione viene creato un dump schema+dati+ruoli e
registrato il checksum. Nessun rollback usa delete cascata su persone o storico.

## 8. Rischi principali e mitigazioni

| Rischio | Mitigazione |
| --- | --- |
| Policy residue con `auth.uid() = profile_id` | inventario automatico `rg` sul dump e test SQL che fallisce se resta il pattern |
| JWT valido dopo sospensione/delete | `app_accounts.status` verificato in ogni helper/RLS/API; ban Auth solo difesa aggiuntiva |
| Creazione Auth riuscita e mapping fallito | compensazione server-side e audit; nessun retry cieco |
| Email contatto uguale per più familiari | `profiles.email` nullable/non autorevole; login email gestita da Auth |
| Parent vede colonne sensibili del figlio | niente `SELECT *` parent su `profiles`; endpoint/permessi per dominio |
| Ruolo singolo in UI/middleware | context con `roles[]` e aree multiple; legacy dual-write temporaneo |
| Cancellazione persona elimina storico | nessuna delete persona dal flusso account; revisione futura delle FK cascade |
| Due genitori condividono stato lettura | `message_reads` per account e soggetto |
| Backfill letture team ambiguo | nessuna lettura individuale inventata; mantenimento flag legacy |
| `payments` confuso con quote atleta | quote/subject su `fee_installments`; `payments` resta contabilità costi/coach |
| Trigger Auth diverso tra ambienti | `DROP TRIGGER IF EXISTS`, dump e confronto staging prima della migration |
| Helper `SECURITY DEFINER` esposto | schema privato, search_path fisso, revoke PUBLIC, test grants/advisors |
| Relazione revocata ma cache UI attiva | recheck server a ogni richiesta; selector non autorizzativo |
| Indici mancanti nelle policy | indici source/target/status/date/role; `EXPLAIN` e performance advisor |

## 9. Ordine esatto dei commit/PR

Il piano raccomanda una PR per fase. Ordine dei commit:

1. `docs: plan optional accounts and family profiles`;
2. `test(db): add account model baseline and invariant checks`;
3. `feat(db): create account person and relationship tables`;
4. `feat(db): backfill accounts roles and decouple profiles`;
5. `feat(db): add private authorization helpers and initial rls`;
6. `test(db): cover account mapping grants and rollback preconditions`;
7. `refactor(auth): resolve account context and multiple global roles`;
8. `refactor(api): replace auth user ids in admin and shared routes`;
9. `refactor(api): replace auth user ids in athlete coach and notification routes`;
10. `test(auth): cover suspended disabled and legacy account compatibility`;
11. `feat(admin): add profile-only CRUD and account lifecycle services`;
12. `feat(admin-ui): add people access states and person detail`;
13. `test(admin): cover profile without account and account compensation`;
14. `feat(family): add relationship APIs and permission helpers`;
15. `feat(family-ui): add accessible profiles and persistent selector`;
16. `test(family): cover multi-parent multi-child and permission isolation`;
17. `feat(messages): add per-account reads and account push subscriptions`;
18. `feat(attendance): add actor subject fields to attendance rsvp and fees`;
19. `feat(documents): add signatures and immutable actor audit`;
20. `test(domains): cover delegated actions reads signatures and audit history`;
21. `refactor(legacy): remove profile role user_roles and compatibility fields`;
22. `test(e2e): validate full migration and legacy removal`.

## 10. Test da aggiungere

### SQL/integration database

- assert schema, FK, indici, RLS e grants;
- backfill eseguito due volte senza duplicati;
- delete Auth non elimina profilo;
- delete profilo collegato è rifiutata;
- status non active rende `current_profile_id()` nullo;
- policy self/admin/coach/relationship con JWT simulati;
- UPDATE sempre con `USING` e `WITH CHECK`;
- relazione pending/revoked/expired non autorizza;
- ogni permesso nega il dominio corrispondente;
- advisors security/performance senza nuovi errori critici;
- query automatica che cerca policy/funzioni residue con confronti diretti
  `profile_id = auth.uid()` o `coach_id = auth.uid()`.

### Unit test Jest

- Zod persone/account/relazioni;
- mapping stato Auth -> `app_accounts.status`;
- costruzione `AccessibleProfile` e matrice permessi;
- scelta area per ruoli multipli;
- compensazione create/invite account;
- selector che scarta un profilo non più accessibile;
- source `self|parent|coach|admin|system` per attendance;
- fan-out notifiche senza duplicati account/device.

### Integration route

- persona atleta e coach senza account;
- account aggiunto in un secondo momento;
- suspend/reactivate/delete account senza perdere profilo;
- admin non derivato da payload/JWT client;
- `profileId` manipolato restituisce 403;
- coach limitato ai team autorizzati;
- relazioni create/modificate/revocate solo da admin/staff autorizzato;
- firma mantiene snapshot dopo revoca;
- due parent hanno `message_reads` distinti.

### E2E Playwright

Tutti gli scenari obbligatori della specifica:

- account/persona: 8 scenari;
- famiglia: 12 scenari;
- sicurezza: 10 scenari;
- navigazione multi-area e persistenza selector;
- compatibilità login dei 48 account backfillati.

I test E2E usano fixture sintetiche nel Supabase locale/staging, mai il dump dati di
produzione.

## 11. File da creare o modificare

Nuovi moduli principali previsti:

- `src/server/auth/require-account-context.ts`;
- `src/server/auth/require-global-role.ts`;
- `src/server/profiles/require-profile-permission.ts`;
- `src/server/admin/profiles.ts`;
- `src/server/admin/accounts.ts`;
- `src/server/admin/relationships.ts`;
- `src/lib/validation/profiles.ts`;
- `src/lib/validation/accounts.ts`;
- `src/lib/validation/relationships.ts`;
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

## 12. Decisioni ancora da confermare

Le seguenti decisioni non bloccano Fase 1, ma devono essere chiuse prima della fase
indicata:

1. **Minore** (prima di Fase 3): calcolo dinamico sotto 18 anni da `birth_date` oppure
   flag amministrativo esplicito. Raccomandazione: data di nascita + override motivato.
2. **Staff** (prima di Fase 4): quali operazioni può compiere oltre a gestire relazioni.
   Default sicuro: nessun accesso globale implicito.
3. **Contatto principale** (prima di Fase 4): uno solo o più co-principali per figlio.
4. **Creazione account** (prima di Fase 3): invito soltanto oppure anche password
   temporanea consegnata fuori banda. Raccomandazione: invito; niente password admin.
5. **Delete account** (prima di Fase 3): soft delete Auth o hard delete dopo retention.
   Raccomandazione: disable immediato + soft delete, hard delete differito.
6. **Verifica relazione** (prima di Fase 4): solo operatore interno o flusso di consenso
   anche del genitore.
7. **Firma documentale** (prima di Fase 5): valore legale richiesto, versione documento,
   evidenze IP/user-agent e retention.
8. **Pagamenti** (prima di Fase 5): integrazione futura con provider e significato esatto
   di `paid_by_auth_user_id`; oggi non esiste un pagamento atleta separato dalla rata.
9. **Dati medici** (prima di Fase 4): quali campi oltre alla scadenza certificato sono
   visibili a parent/coach e con quale base autorizzativa.
10. **Merge persone duplicate** (futuro): non viene incluso ora; un account esistente non
    viene collegato automaticamente per email.

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
