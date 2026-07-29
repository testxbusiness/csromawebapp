# Piano d'azione per la messa in sicurezza e il miglioramento di CSRoma WebApp

## Obiettivo

Portare l'applicazione a uno stato sicuro, verificabile e manutenibile, eliminando prima i rischi che possono causare accesso non autorizzato o perdita di dati e poi il debito tecnico che oggi rende gli errori difficili da rilevare.

Il piano è basato sull'audit eseguito il 22 luglio 2026 sul repository `testxbusiness/csromawebapp` e sull'istanza Supabase locale `supabase_db_csromawebapp`.

## Stato avanzamento

| Task | Stato | Nota |
|---|---|---|
| P0.1 Separare client Supabase autenticato e client amministrativo | **Completato** | `createClient()` usa ora sempre la anon key; i moduli server sono marcati `server-only`. |
| P0.2 Rendere il ruolo non modificabile dall'utente | **Completato** | Le route server usano `app_metadata`; applicata migrazione locale, sincronizzati 46 utenti e verificato il blocco del cambio ruolo non autorizzato. |
| P0.3 Correggere RLS e privilegi database | **Completato in locale** | Applicato solo in locale `supabase/migrations/20260723140557_local_rls_hardening.sql`: RLS su `user_roles`, rimozione grant anon, rimozione policy sempre vere sensibili, sostituzione delle 41 policy `user_metadata`, search path fisso, RPC non necessari non pubblici e viste non usate in modalità invoker. Test manuali anonimo/admin/atleta/coach superati; corretto anche l’endpoint locale CORS usato dalla dashboard coach. Nessuna modifica eseguita su prod. |
| P1.1 Eliminare password temporanee hardcoded | **Pending** | Creazione/import usano inviti Supabase senza password temporanee; il reset admin autorizza lato server e avvia il recovery link dal browser. Aggiunta la pagina pubblica `/forgot-password` e corretta la nota UI dell’import. Restano test E2E del flusso invito/reset e verifica degli utenti storici, da riprendere in seguito. |
| P1.2 Validare payload API con Zod | **Completato** | Tutte le route API che ricevono JSON usano ora schemi Zod strict o discriminated union. Le route senza body JSON restano coperte da autenticazione/autorizzazione; la validazione dei query parameter è un miglioramento separato. |
| P1.3 Mettere in sicurezza gli upload | **Completato** | Aggiunti limiti, allowlist MIME, controllo ownership del messaggio, cleanup degli upload parziali e cleanup automatico dei draft vecchi non referenziati, policy Storage locali per admin/coach e controllo magic-bytes per PDF, immagini, Office legacy/OOXML e file di testo. Risolto il crash-loop Storage causato dalla collation locale. Test manuali superati con allegato PDF e immagine, invio messaggio e download da parte del destinatario; verifica locale: 0 draft orfani. |
| P1.4 Sanitizzare anteprime HTML | **Completato** | Sanitizzazione allowlist applicata a client, API server-side e salvataggi di template/documenti; test XSS, PDF/logo, build e flusso admin manuale passati. |
| P1.5 Aggiornare dipendenze vulnerabili | **Stand-by** | Aggiornati Next.js a 15.5.21 e Playwright a 1.62.0; applicati gli aggiornamenti transitive disponibili. Audit produzione aggiornato al 27 luglio 2026: 5 vulnerabilità (1 moderate, 4 high), senza fix automatico. La decisione su `xlsx` resta sospesa per preservare l'import dei calendari e dei risultati dei campionati; `postcss` e `sharp` restano dipendenze del toolchain Next.js. |
| P1.6 Correggere configurazione build | **Completato** | Riattivati i controlli TypeScript ed ESLint in `next.config.js`. Corretti gli errori di tipizzazione nelle varianti campionati admin/coach/atleta, relazioni Supabase annidate, dashboard, messaggi, pagamenti, squadre, profilo utente, export XLSX e notifiche. Eliminata la dipendenza della build dal download dei Google Fonts usando font di sistema/fallback locali. Verificato con `npx tsc --noEmit`, `npm run lint`, `npm run build` e `git diff --check`: tutti passano. |
| P1.7 Correggere client PostgreSQL legacy | **Completato** | Rimosso `src/lib/database/client.ts`: non era importato e conteneva credenziali PostgreSQL hardcoded. L'accesso applicativo resta centralizzato nei client Supabase. |
| P2.1 Correggere gli hook React | **Completato** | Corretti gli hook nei componenti amministrativi, nei dashboard atleta/coach, nei tre `ChampionshipsManager`, in `SimpleCalendar` e `CoachCalendarManager`. Client Supabase e callback di caricamento sono stabili, le dipendenze degli effetti sono esplicite e il lint non segnala più warning sugli hook. |
| P2.2 Ridurre componenti monolitici | **Completato** | Estratti i tipi, mapping e helper comuni dei campionati in `src/components/championship/types.ts`, il catalogo in `useChampionshipCatalog.ts`, il caricamento girone in `useChampionshipGroupDetails.ts`, i formatter/parser in `formatters.ts`, le definizioni colonne Excel in `importDefinitions.ts`, la risoluzione/creazione delle squadre importate in `useImportedClubTeam.ts`, la persistenza import in `championshipImportPersistence.ts`, le mutazioni delle gare in `useChampionshipMatchMutations.ts`, i modali risultato/info gara in `ChampionshipMatchModals.tsx`, i modal import calendario/risultati in `ChampionshipImportModals.tsx`, il modal convocazioni in `ChampionshipConvocationModal.tsx`, il modal creazione girone in `ChampionshipGroupModal.tsx`, il modal gestione squadre girone in `ChampionshipGroupTeamsModal.tsx` e la cancellazione calendario in `useChampionshipCalendarDeletion.ts`. Rimosso il vecchio JSX duplicato; test manuali admin, coach e atleta completati con esito positivo. |
| P2.3 Uniformare errori, loading ed empty state | **In corso** | Creati i componenti condivisi `LoadingState`, `EmptyState` ed `ErrorState` in `src/components/ui/FeedbackState.tsx`; applicati a calendario e quote atleta, pagamenti coach, messaggi admin, eventi admin e calendario coach. Restano le altre sezioni applicative da uniformare. |
| P2.4 Correggere Jest e creare test base | **Da iniziare** |  |
| P2.5 Creare test E2E per i ruoli | **Da iniziare** |  |
| P2.6 Aggiungere controlli CI | **Da iniziare** |  |

## Stato iniziale verificato

- La build Next.js termina, ma `next.config.js` ignora gli errori TypeScript e ESLint.
- `npx tsc --noEmit` fallisce su `src/components/admin/PaymentsManager.backup.tsx`.
- `npm test` non trova test automatici.
- Il lint termina con numerosi warning relativi a dipendenze mancanti di `useEffect`/`useMemo`.
- Il client server Supabase usa la Service Role Key come client predefinito.
- Le autorizzazioni applicative leggono spesso `user_metadata.role`.
- Il database locale contiene policy RLS permissive e privilegi pubblici da restringere.
- `npm audit --omit=dev` rileva 7 vulnerabilità high e 2 moderate nella catena di dipendenze.

## Regole operative

1. Ogni fase deve produrre una modifica piccola e revisionabile.
2. Nessuna modifica alle policy RLS va applicata senza prima esportare lo stato attuale e predisporre una query/test di verifica.
3. La Service Role Key non deve mai essere usata in codice client o in query applicative ordinarie.
4. Prima di rimuovere dati o file, verificare che siano backup/dead code e che non siano importati.
5. Ogni correzione di autorizzazione deve avere almeno un test positivo e uno negativo.
6. Le credenziali reali restano fuori dal repository e dai log.

## Priorità P0 — contenimento dei rischi di sicurezza

### P0.1 Separare il client Supabase autenticato dal client amministrativo

**Implementazione completata il 23 luglio 2026**

- `src/lib/supabase/server.ts`: `createClient()` usa ora sempre `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `src/lib/supabase/server.ts` e `src/lib/supabase/admin.ts`: aggiunto `import 'server-only'`.
- Verifica `npm run build`: superata.
- Verifica bundle client: `SUPABASE_SERVICE_ROLE_KEY` non presente in `.next/static`.
- `npx tsc --noEmit`: la verifica estesa evidenzia ulteriori errori preesistenti in query relazionali, modelli TypeScript, `pg`, export XLSX e cookie SSR; sono tracciati nel task P1.6.

**Problema**

`src/lib/supabase/server.ts` costruisce `createClient()` usando:

```ts
process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Di conseguenza tutte le query che usano il client server possono bypassare RLS. Un singolo controllo API incompleto diventa sufficiente per leggere o modificare dati di altri utenti.

**Fix**

- Fare in modo che `createClient()` usi sempre `NEXT_PUBLIC_SUPABASE_ANON_KEY` con i cookie della sessione.
- Lasciare la Service Role Key esclusivamente in `createAdminClient()`.
- Spostare il client amministrativo in un modulo esplicitamente server-only, ad esempio `src/lib/supabase/admin.ts`.
- Aggiungere `import 'server-only'` ai moduli che importano la Service Role Key.
- Cercare e rimuovere eventuali import di moduli admin da file `.tsx` client.
- Verificare che ogni uso del client admin sia motivato da un'operazione privilegiata.

**Criteri di accettazione**

- Nessun modulo client contiene `createAdminClient` o `SUPABASE_SERVICE_ROLE_KEY`.
- Una query ordinaria con il client server è soggetta alle policy RLS.
- Le API amministrative continuano a funzionare solo dopo un controllo esplicito dell'utente e del ruolo.
- La Service Role Key non compare mai nel bundle client.

### P0.2 Rendere il ruolo non modificabile dall'utente

**Problema**

Molte route verificano il ruolo tramite `user.user_metadata.role`. I metadata dell'utente sono modificabili dal client e non sono una fonte affidabile per autorizzare operazioni amministrative.

**Fix**

- Stabilire una sola fonte autorevole per il ruolo: preferibilmente `app_metadata.role` aggiornato solo da codice server privilegiato, oppure una funzione SQL/RLS basata su `profiles`.
- Non usare più `user_metadata.role` nei controlli di autorizzazione.
- Creare helper server-side tipizzati:

  - `requireUser()`
  - `requireRole('admin')`
  - `requireAnyRole(['coach', 'admin'])`

- Usare gli helper in tutte le route `/api/admin`, `/api/coach` e `/api/athlete`.
- Allineare middleware, API, RLS e UI alla stessa fonte del ruolo.
- Verificare cosa fa `update_user_role_safe` e fare in modo che aggiorni il campo autorevole senza creare loop o inconsistenze.

**Criteri di accettazione**

- Modificare `user_metadata` non cambia i permessi dell'utente.
- Un atleta non può invocare endpoint admin, anche manipolando la richiesta.
- Un coach può accedere solo alle proprie squadre e funzioni.
- Un admin può eseguire le operazioni amministrative previste.
- Esistono test automatici per tutti e tre i casi.

**Implementazione completata il 23 luglio 2026**

- Le route API non usano più `user_metadata.role`.
- Il middleware e `useAuth` leggono `app_metadata.role`.
- Le route `/api/admin/incassi/*`, precedentemente prive di controllo ruolo, verificano autenticazione e ruolo admin.
- I nuovi utenti ricevono il ruolo in `app_metadata`.
- `sql/06_role_hardening.sql` sincronizza i ruoli esistenti e impedisce a un non-admin di modificare `profiles.role`.
- Verifica database: 46/46 utenti con ruolo coerente tra `profiles` e `auth.users.raw_app_meta_data`.
- Verifica transazionale: tentativo di cambio ruolo da atleta rifiutato.
- Verifica codice: nessuna occorrenza di `user_metadata.role` residua.
- Nota: i test automatici dedicati ai ruoli sono ancora da creare nel task P2.4/P2.5.

### P0.3 Correggere RLS e privilegi del database

**Problema**

Nel database locale e nell'istanza di produzione sono state rilevate policy permissive con `using=true`/`with_check=true`, tra cui accessi su `documents`, `document_templates` e `payments`. In produzione `user_roles` ha RLS disabilitato, risultano grant diretti molto ampi a `anon`, numerose policy usano `user_metadata` e due viste sono `SECURITY DEFINER`. L'estrazione read-only è documentata in `PROD_RLS_AUDIT_2026-07-23.md`.

**Fix**

- Salvare uno snapshot delle policy e dei grant attuali prima di intervenire.
- Abilitare RLS su `user_roles` e `system_logs`.
- Revocare i grant di `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE` e `REFERENCES` da `anon` sulle tabelle applicative.
- Revocare anche i grant diretti non necessari da `authenticated`; l'accesso deve essere deciso dalle policy RLS.
- Eliminare le policy amministrative permissive come `documents_admin_simple`, `document_templates_admin_simple` e policy equivalenti.
- Ricreare policy esplicite basate su `is_admin()`, `is_coach()`, `is_athlete()` e sull'appartenenza a squadra.
- Limitare i documenti ai destinatari effettivi e i pagamenti agli admin o al coach proprietario.
- Limitare `user_roles` alla lettura necessaria e alle sole modifiche amministrative.
- Limitare `system_logs` alla scrittura server-side e alla lettura admin.
- Verificare le funzioni `SECURITY DEFINER`, in particolare `check_gym_schedule_conflicts`, impostando un `search_path` esplicito.
- Confrontare lo snapshot di produzione con lo schema locale prima di preparare una migrazione; non applicare modifiche a prod senza autorizzazione esplicita separata.

**Criteri di accettazione**

- Una richiesta REST anonima non può leggere né modificare dati applicativi.
- Un atleta vede solo dati propri o della propria squadra.
- Un coach vede solo dati delle squadre assegnate.
- Un admin vede e modifica i dati amministrativi previsti.
- Ogni tabella pubblica ha RLS abilitato, salvo eccezioni documentate.
- Sono presenti test SQL o API per lettura anonima, lettura autenticata e tentativi di modifica non autorizzati.

**Implementazione locale iniziale completata il 23 luglio 2026**

- Creata `supabase/migrations/20260723140557_local_rls_hardening.sql` usando il CLI Supabase.
- Applicata esclusivamente al container `supabase_db_csromawebapp`.
- Verificato `user_roles.relrowsecurity = true`.
- Verificato che le policy non contengano più riferimenti a `user_metadata`.
- Rimossi i grant diretti di `anon` sulle tabelle dello schema `public`.
- Rimossi i bypass `USING true/WITH CHECK true` da `documents`, `document_templates` e `payments`.
- Revocata l'esecuzione anonima delle funzioni `SECURITY DEFINER`; mantenuta solo per le funzioni necessarie alle policy o al controllo conflitti.
- Impostato `search_path = public` sulle funzioni segnalate.
- Test read-only: anon riceve `permission denied` su `documents` e `user_roles`; un autenticato senza `auth.uid()` vede zero righe di `user_roles`; nessuna policy sempre vera residua sulle tre tabelle sensibili.
- Il warning ambientale PostgreSQL sulla versione della collation (`153.120` vs `153.121`) è stato risolto localmente aggiornando la collation di `template1` e `postgres`; non sono state eseguite modifiche su produzione.

**Test per ruolo eseguiti il 24 luglio 2026**

- Aggiunto `sql/07_local_rls_role_tests.sql`, eseguibile sul solo container locale e con `ROLLBACK` su ogni scenario.
- `anon`: `profiles`, `documents` e `payments` risultano non leggibili (`permission denied`).
- `athlete` `4562c612-68d8-4bd2-b40a-fbe72b48c10a`: 1 profilo proprio, 1 membership visibile, 0 pagamenti, 0 ruoli; modifica del profilo admin non autorizzata (`UPDATE 0`).
- `coach` `e2ee7e93-d957-4ddd-9a1c-867b64d4b4d4`: 23 profili, 20 membership e 70 eventi visibili sulle squadre assegnate, 0 pagamenti; modifica del profilo admin non autorizzata (`UPDATE 0`).
- `admin` `ead3c978-c178-4b38-a541-9ecedc6fa9f1`: 47 profili, 4 documenti e 9 pagamenti visibili; modifica amministrativa verificata (`UPDATE 1`) e annullata.
- Tutte le 37 tabelle pubbliche locali risultano con RLS abilitato.
- Restano da aggiungere test automatici via REST/PostgREST e casi negativi più granulari per ogni tabella/azione prima di preparare una migrazione per staging o produzione.

**Test REST/PostgREST locali eseguiti il 24 luglio 2026**

- Aggiunto `scripts/test-local-rls-rest.mjs`, che genera token ES256 temporanei usando esclusivamente la chiave JWT del container Auth locale.
- `anon` su `GET /rest/v1/profiles` riceve `HTTP 401` con `permission denied`; non riceve `200` né righe.
- L'atleta riceve `HTTP 200` sul proprio perimetro, vede il proprio profilo e non vede l'admin non correlato; `payments` e `user_roles` restituiscono zero righe.
- Il coach riceve `HTTP 200` sul perimetro delle squadre assegnate; non vede l'admin non correlato; `payments` restituisce zero righe.
- L'admin riceve `HTTP 200` sui profili, documenti e pagamenti amministrativi.
- Nessuna operazione `INSERT`, `UPDATE` o `DELETE` è stata eseguita dallo script REST.
- La query profili può includere mittenti autorizzati di messaggi oltre al profilo/squadra: è un effetto delle policy `profiles_select_message_senders`; va mantenuto solo se il frontend necessita di mostrare quei mittenti, altrimenti va ristretto il numero di colonne esposte o separato da una vista/API minimale.
- Restano test REST negativi granulari per tutte le tabelle mutabili, soprattutto tentativi di `INSERT`, `UPDATE` e `DELETE` con identità non autorizzate, da eseguire contro record di fixture dedicati e con ripristino controllato.

## Priorità P1 — identità, input e file

### P1.1 Eliminare le password temporanee hardcoded

**Problema**

La password `csroma2025!` è usata per creazione, import e reset utenti. È condivisa, prevedibile e presente nel codice sorgente.

**Fix**

- Eliminare la costante e tutte le occorrenze della password dal codice.
- Usare `inviteUserByEmail` oppure una password casuale generata server-side.
- Se è indispensabile una password temporanea, generarne una diversa per ogni utente e non restituirla nei log o nelle risposte API.
- Inviare un link di impostazione password con scadenza.
- Applicare la policy minima Supabase e una validazione server-side più robusta.
- Far rispettare realmente la scadenza di `temp_password_expires_at`.
- Dopo reset password, invalidare le sessioni esistenti dell'utente quando previsto dal flusso.

**Criteri di accettazione**

- Nessuna password condivisa nel repository.
- Un reset produce un token o una password temporanea univoca.
- Una password temporanea scaduta non permette l'accesso operativo.
- Il cambio password è verificato server-side, non solo tramite metadata client.

**Implementazione parziale completata il 23 luglio 2026**

- Creazione e import utenti usano `inviteUserByEmail` con redirect a `/auth/callback`.
- Il reset admin usa `resetPasswordForEmail` e non imposta più una password nota.
- Aggiunta la pagina client `src/app/auth/callback/page.tsx`, che gestisce sia lo scambio PKCE sia i token restituiti nel fragment dal flusso locale Supabase.
- I flag di cambio password sono stati spostati da `user_metadata` a `app_metadata`/profilo.
- Rimosso l'endpoint non utilizzato che permetteva all'utente di modificare direttamente `must_change_password`.
- Rimosso il file backup che conteneva la vecchia password hardcoded.
- Test locale invito con Mailpit superato: email ricevuta, callback locale presente e nessuna password storica nel contenuto.
- Allow-list redirect configurata nello stack Supabase ufficiale e verificata nel container Auth.
- Cache `.next` ricostruita dopo la sostituzione della callback e build pulita verificata.
- Corretto il reset admin: il server non avvia più `resetPasswordForEmail`; restituisce l'email dopo l'autorizzazione e il browser invia il link, conservando il verifier PKCE necessario alla callback.
- Corretta la callback PKCE: `createBrowserClient()` effettua già lo scambio automatico del parametro `code`; rimosso il secondo scambio che invalidava il link monouso.
- Reso il recovery admin indipendente dal logout dell'amministratore: l'invio usa un client Supabase isolato con flusso implicito e la callback consuma i token dal fragment senza inviarli al server.
- Corretta la callback fragment: rimossa la lettura preventiva della sessione che poteva competere con il rilevamento automatico del browser e lasciare la pagina su “Verifica del link in corso”.
- Corretto il redirect post-callback: `/auth/callback` non viene più salvato come destinazione del cambio password e non può più essere usato come destinazione finale senza token.

### Evoluzione prevista: separare recupero e cambio password

**Problema**

Il link “Hai dimenticato la password?” nella pagina di login punta direttamente a `/reset-password`. Questa pagina è progettata per impostare una nuova password quando esiste già una sessione Auth valida, non per raccogliere l'email e avviare il recupero.

**Implementazione prevista**

- Creare la pagina pubblica `/forgot-password` con campo email e stato di invio.
- Chiamare `resetPasswordForEmail(email, { redirectTo: '/auth/callback' })` dal browser.
- Aggiornare il link della login da `/reset-password` a `/forgot-password`.
- Mantenere `/auth/callback` come validazione del link ricevuto.
- Mantenere `/reset-password` esclusivamente per il cambio password dopo callback o per il cambio obbligatorio al primo accesso.
- Usare una risposta neutra, ad esempio “Se l'indirizzo è registrato riceverai un'email”, per non rivelare l'esistenza degli account.

**Criteri di accettazione**

- Un utente non autenticato può richiedere il recupero dalla login.
- La richiesta non espone se l'email esiste o meno.
- Il link ricevuto porta a `/auth/callback` e poi a `/reset-password` con una sessione valida.
- Un accesso diretto a `/reset-password` senza sessione non consente di cambiare password.

**Implementazione completata il 23 luglio 2026**

- Aggiunta `src/app/forgot-password/page.tsx` con richiesta email via Supabase PKCE.
- Aggiornato il link della pagina login verso `/forgot-password`.
- Aggiunta `/forgot-password` alle rotte pubbliche del middleware.
- Risposta neutra per non rivelare se l'email è associata a un account.
- Il redirect della callback usa `recovery=1`, così il middleware non manda alla dashboard un utente che sta eseguendo un recupero password senza `must_change_password`.
- Restano il test end-to-end del reset admin e la gestione degli utenti storici già creati con la password storica.

### P1.2 Validare tutti i payload API con Zod

**Problema**

Numerose route usano `request.json()` e cast come `Record<string, any>` senza validazione runtime. Il tipo TypeScript non protegge dati provenienti dalla rete.

**Fix**

- Creare schemi Zod per login, utenti, import, eventi, pagamenti, messaggi, notifiche e presenze.
- Validare UUID, email, ruoli, importi, date, status, array e limiti di paginazione.
- Rifiutare ruoli fuori da `admin | coach | athlete`.
- Limitare dimensione e cardinalità degli array per evitare payload eccessivi.

**Implementazione iniziale completata il 23 luglio 2026**

- Aggiunto `src/lib/validation/auth.ts` con schemi strict per login, reset password e reset admin.
- Le route rifiutano JSON malformato, campi inattesi, email non valide, UUID non validi e password fuori limite.
- Build verificata con successo.
- Le route CRUD, import e payload bulk sono ora coperte da schemi specifici.
- Aggiunti schemi strict per creazione/modifica utenti, aggiornamento ruoli e import fino a 500 record, con limiti su ruoli, date, UUID, testo e squadre.
- Aggiunti schemi strict per pagamenti: importi, tipo, frequenza, stato, date e riferimenti UUID; anche gli aggiornamenti e la cancellazione validano l'ID.
- Aggiunti schemi strict per messaggi, allegati, destinatari e sottoscrizioni/notifiche push, con limiti su contenuti, file, URL e cardinalità.
- Aggiunti schemi per RSVP atleta e query admin delle presenze evento, con UUID, stati ammessi e limiti sulla nota.
- Aggiunti schemi strict per creazione/modifica eventi, con date ISO, tipo evento, ricorrenze, riferimenti UUID e limite squadre.
- Aggiunti schemi per operazioni massive atleti/coach e registrazione incassi, con limiti su ID, ruoli, numeri maglia, date e cardinalità; coperta anche la route legacy `/api/admin/coaches`.
- Aggiunti schemi strict per quote associative e tutte le azioni sulle rate, con limiti su importi, date, stati, UUID e cardinalità.
- Gli endpoint mutanti principali restituiscono errori uniformi senza dettagli interni del database.
- Restano come miglioramenti di qualità la sostituzione progressiva degli `any` con tipi derivati dagli schemi e la validazione esplicita dei query parameter.
- Corretto il payload eventi: `requires_confirmation` e `confirmation_deadline` erano inviati dal form ma mancavano dallo schema Zod strict; la route usava inoltre una variabile `body` non più disponibile. Creazione e modifica eventi ora validano e persistono correttamente i flag RSVP.

**Criteri di accettazione**

- Ogni endpoint mutante rifiuta payload malformati con HTTP 400.
- Gli errori non espongono SQL, stack trace o messaggi interni Supabase.
- Gli endpoint non accettano ID arbitrari senza verifica di ownership/autorizzazione.

### P1.3 Mettere in sicurezza gli upload

**Problema**

`src/app/api/messages/attachments/upload/route.ts` legge file senza limite di dimensione, numero, MIME type o ownership del `message_id`.

**Fix**

- Imporre un limite per file e per richiesta.
- Limitare il numero di file caricabili in una singola richiesta.
- Validare MIME type ed estensione tramite allowlist.
- Non fidarsi di `file.type` dichiarato dal browser; verificare il contenuto quando necessario.
- Verificare che il messaggio appartenga all'utente o alla squadra autorizzata.
- Generare sempre path server-side e non accettare path dal client.
- Eliminare file caricati se la successiva creazione dei metadati fallisce.
- Aggiungere una procedura di pulizia per i file `draft` orfani.
- Servire gli allegati con signed URL a scadenza breve.

**Criteri di accettazione**

- File troppo grandi, troppi file o MIME non ammessi vengono rifiutati.
- Un coach non può caricare allegati nel messaggio di un altro coach.
- Un atleta non può caricare allegati tramite l'endpoint.
- Non rimangono file storage senza record applicativo associato.

**Implementazione completata il 23 luglio 2026**

- Massimo 5 file per richiesta, 10 MB per file e 25 MB complessivi.
- Allowlist MIME per PDF, documenti, fogli di calcolo, testo e immagini sicure; SVG e tipi eseguibili esclusi.
- Un `message_id` esistente è verificato contro `messages.created_by`, salvo admin.
- Gli oggetti già caricati vengono rimossi se un upload successivo fallisce.
- Aggiunta verifica magic-bytes per PDF, immagini, Office legacy/OOXML e testo.
- Aggiunta pulizia automatica dei draft vecchi non referenziati e verifica locale con 0 draft orfani.
- Applicate policy Storage locali per admin/coach con ownership del path.
- Applicate anche policy Storage locali per admin sul bucket privato `documents`, limitate al prefisso `generated/`, per upload/download/aggiornamento/cancellazione dei PDF.
- Test manuali superati con allegato PDF e immagine, invio del messaggio e download dal destinatario.
- Restano solo test automatizzati di abuso/regressione e, se desiderato, un job periodico indipendente dal caricamento per la pulizia dei draft.

### P1.4 Sanitizzare le anteprime HTML

**Problema**

`PreviewModal.tsx` usa `dangerouslySetInnerHTML` direttamente.

**Fix**

- Sanitizzare l'HTML con una policy allowlist.
- Rimuovere script, event handler inline, iframe, URL javascript e attributi pericolosi.
- Sanitizzare anche lato server prima di salvare o inviare template/documenti.
- Aggiungere un test con payload XSS noto.

**Criteri di accettazione**

- Un contenuto HTML malevolo viene visualizzato come testo o HTML innocuo.
- Nessun `script` o event handler viene eseguito nell'anteprima.

**Avanzamento verificato il 23 luglio 2026**

- `sanitizeHtml` ora applica l'allowlist anche quando viene eseguita senza DOM, rimuovendo tag, attributi evento, `style` e URL non sicuri.
- `TemplateModal` sanitizza `content` e `content_html` prima di creare o aggiornare un template.
- `BulkGenerateModal` sanitizza `generated_content_html` prima del salvataggio dei documenti generati.
- Aggiunti test Jest per script, event handler, URL `javascript:` e contenuti sicuri; test passati.
- Build Next.js passata.
- Rimane da introdurre un endpoint server dedicato per i contenuti HTML oppure una validazione server-side equivalente a livello di persistenza, oltre ai test E2E XSS.

**Implementazione server-side completata il 25 luglio 2026**

- Aggiunto `POST/PATCH /api/admin/document-templates` con autenticazione admin, schemi Zod strict e `created_by` determinato dal server.
- Aggiunto `POST /api/admin/documents/generate` con autenticazione admin, validazione dei destinatari e sanitizzazione HTML server-side.
- `TemplateModal` e `BulkGenerateModal` usano ora gli endpoint server; non eseguono più `INSERT/UPDATE` diretti dal browser su queste tabelle.
- La sanitizzazione viene rieseguita server-side anche se un client manipolato invia HTML pericoloso.
- Test Jest XSS passati, `git diff --check` passato e build Next.js passata.
- Corretto il payload dei documenti individuali generati da una squadra: `target_user_id` e `target_team_id` non vengono più inviati insieme, rispettando il vincolo DB sui destinatari.
- Gli errori di generazione vengono ora mostrati tramite toast senza lasciare una `Runtime Error` non gestita.
- Eliminati i warning `html2canvas` causati da immagini prive di `src` valido e disabilitato il logging non necessario; aggiunto test dedicato.
- Test manuale completato: template con payload XSS salvato, documento e PDF generati, script non eseguito e logo `/images/logo_CSRoma.png` verificato nel PDF.

## Priorità P1 — dipendenze e configurazione

### P1.5 Aggiornare le dipendenze vulnerabili

**Problema**

`npm audit --omit=dev` ha rilevato 7 vulnerabilità high e 2 moderate. Le versioni dirette principali sono:

- `next@15.5.9`
- `@playwright/test@1.55.0`
- `xlsx@0.18.5`

**Fix**

- Aggiornare Next.js almeno alla versione corretta indicata dall'audit, mantenendo compatibilità con React e Supabase.
- Aggiornare Playwright a una versione corretta.
- Valutare la sostituzione di `xlsx`, per cui l'audit non indica una correzione disponibile.
- Se `xlsx` resta necessario, isolare l'import, limitare i file accettati e trattare ogni workbook come input non attendibile.
- Eseguire `npm audit`, `npm test`, `npm run lint` e `npm run build` dopo ogni aggiornamento.
- Bloccare le versioni compatibili nel lockfile e documentare eventuali eccezioni.

**Criteri di accettazione**

- Nessuna vulnerabilità high nelle dipendenze di produzione, oppure ogni eccezione è documentata e mitigata.
- Build e test passano dopo l'aggiornamento.

**Avanzamento verificato il 27 luglio 2026**

- Aggiornati `next` a `15.5.21` e `@playwright/test` a `1.62.0`.
- Eseguito `npm audit fix --omit=dev` per aggiornare transitive compatibili (`jws`, `bn.js`, `ws` e pacchetti correlati).
- Ripristinate le dipendenze dev complete e verificata la build: passata.
- Audit attuale `npm audit --omit=dev`: 0 critical, 1 moderate e 4 high (5 vulnerabilità totali).
- Le residue sono `xlsx@0.18.5` senza fix disponibile, `postcss`/`sharp` richieste dalla versione Next corrente e `nextstepjs` correlata; saranno valutate nella sostituzione/upgrade dedicata.
- L'audit completo include anche dev/test: dopo `npm audit fix` le vulnerabilità con fix automatico, inclusa la critical su `tar`, risultano aggiornate; restano vulnerabilità del toolchain ESLint/Jest, oltre a `postcss`, `sharp` e `xlsx` senza fix automatico. Non è stato usato `npm audit fix --force`, perché propone cambi breaking non giustificati.

### P1.6 Correggere la configurazione di build

**Problema**

`next.config.js` ignora errori ESLint e TypeScript, quindi una build verde non garantisce un'applicazione corretta.

**Fix**

- Rimuovere `eslint.ignoreDuringBuilds`.
- Rimuovere `typescript.ignoreBuildErrors`.
- Correggere prima gli errori sintattici del file backup incluso nel progetto.
- Spostare o eliminare i file `.backup.tsx` e `.old` non utilizzati.
- Rendere `npm run build` un controllo obbligatorio in CI.

**Criteri di accettazione**

- `npx tsc --noEmit` termina con codice 0.
- `npm run lint` termina senza errori e con warning documentati o risolti.
- `npm run build` fallisce se viene introdotto un errore TypeScript o ESLint bloccante.

### P1.7 Correggere il client PostgreSQL legacy

**Problema**

`src/lib/database/client.ts` usa credenziali hardcoded, porta `5432` invece della porta locale `54322` e importa `pg` senza dichiararlo in `package.json`. Attualmente non risulta importato, quindi è codice morto ma pericoloso e fuorviante.

**Fix**

- Se non serve, eliminarlo dopo aver verificato che non sia usato da script esterni.
- Se serve, spostare la configurazione su `DATABASE_URL` e aggiungere `pg` esplicitamente alle dipendenze.
- Garantire che sia importabile solo da codice server.
- Non aprire pool PostgreSQL a livello di modulo in ambienti serverless senza una strategia di pooling documentata.

**Criteri di accettazione**

- Nessuna credenziale nel sorgente.
- Il progetto ha un solo pattern ufficiale per l'accesso al database.
- Il client PostgreSQL non viene incluso nel bundle browser.

## Priorità P2 — qualità del codice e manutenibilità

### P2.1 Correggere gli hook React

**Problema**

Il lint segnala numerosi `useEffect` e `useMemo` con dipendenze mancanti. Le funzioni possono chiudere su valori vecchi e produrre dati obsoleti o richieste duplicate.

**Fix**

- Rendere stabili le funzioni con `useCallback` quando necessario.
- Inserire le dipendenze corrette.
- Separare bootstrap iniziale, caricamento dati e reazioni ai cambiamenti.
- Eliminare gli `eslint-disable` non motivati.
- Aggiungere test per aggiornamento stagione, squadra, filtro e selezione utente.

**Criteri di accettazione**

- Gli avvisi `react-hooks/exhaustive-deps` sono risolti o motivati individualmente.
- Cambiando un filtro o una squadra, la UI mostra sempre dati aggiornati.

### P2.2 Ridurre componenti monolitici

**Problema**

Alcuni componenti superano 1.000–2.000 righe e mescolano fetching, mutazioni, validazione, stato modale e rendering.

**Fix**

- Separare componenti presentazionali, hook di caricamento e funzioni server/API.
- Organizzare il codice per feature: utenti, squadre, pagamenti, messaggi, campionati.
- Centralizzare tipi e mapping di stato.
- Eliminare duplicazioni tra manager admin/coach/athlete.
- Evitare nuovi layer generici privi di responsabilità chiara.

**Criteri di accettazione**

- I componenti principali hanno una responsabilità leggibile.
- Le query e le mutazioni non sono duplicate in più componenti senza motivo.
- Le feature possono essere testate senza montare intere dashboard.

### P2.3 Uniformare errori, loading ed empty state

**Problema**

Molti errori vengono solo stampati in console e alcune query ignorano l'errore. L'utente può vedere una lista vuota senza sapere se è realmente vuota o se il caricamento è fallito.

**Fix**

- Definire stati espliciti `loading`, `empty`, `error`, `unauthorized`, `success`.
- Restituire risposte API con formato coerente.
- Non mostrare `error.message` direttamente all'utente quando contiene dettagli interni.
- Centralizzare logging server-side con request ID e contesto minimo.

**Criteri di accettazione**

- Ogni schermata principale distingue errore da lista vuota.
- Le API usano status code coerenti.
- I log non contengono password, token, dati personali non necessari o payload completi.

## Priorità P2 — test e verifica continua

### P2.4 Correggere Jest e creare la base dei test

**Problema**

`npm test` non trova test e segnala che `moduleNameMapping` è un'opzione sconosciuta.

**Fix**

- Rinominare `moduleNameMapping` in `moduleNameMapper` in `jest.config.js`.
- Creare test unitari per helper di validazione, ruolo, date, import/export e calcolo rate.
- Creare test API per autenticazione e autorizzazione.
- Aggiungere fixture Supabase o un database di test isolato.

**Criteri di accettazione**

- `npm test -- --runInBand` termina con codice 0.
- I test coprono almeno i rami autorizzato/non autorizzato.
- I test non usano dati di produzione.

### P2.5 Test E2E per i ruoli

**Scenari minimi**

- Login admin e accesso a una pagina admin.
- Login coach e rifiuto di una pagina/API admin.
- Login atleta e rifiuto di dati di un'altra squadra.
- Reset password obbligatorio e redirect controllato.
- Creazione messaggio e upload allegato autorizzato.
- Tentativo anonimo di leggere documenti, pagamenti e ruoli.
- Presenza evento entro e oltre la scadenza.

**Criteri di accettazione**

- Gli scenari girano in CI con database Supabase di test.
- Ogni regressione di autorizzazione blocca la pipeline.

### P2.6 Controlli CI

Creare una pipeline che esegua in questo ordine:

1. `npm ci`
2. controllo secret accidentalmente committati
3. `npx tsc --noEmit`
4. `npm run lint`
5. `npm test -- --runInBand`
6. test RLS/API
7. `npm run build`
8. `npm audit --omit=dev`

La pipeline deve fallire su errori TypeScript, lint, test o vulnerabilità high non approvate.

## Sequenza consigliata di implementazione

### Fase 1 — blocco immediato dei rischi

- Separare client anonimo e client admin.
- Sostituire i controlli basati su `user_metadata.role`.
- Applicare RLS corretta a `user_roles`, `system_logs`, documenti, template e pagamenti.
- Revocare privilegi pubblici e verificare REST anonimo.

### Fase 2 — protezione input e identità

- Eliminare password hardcoded.
- Aggiungere validazione Zod.
- Mettere limiti e ownership sugli upload.
- Sanitizzare HTML.

### Fase 3 — ripristino dei gate tecnici

- Correggere/eliminare backup rotti.
- Riattivare controlli TypeScript/ESLint.
- Correggere Jest e creare primi test.
- Aggiornare dipendenze vulnerabili.

### Fase 4 — refactoring controllato

- Risolvere warning React hooks.
- Ridurre componenti monolitici.
- Uniformare error handling e logging.
- Aggiungere test E2E e pipeline CI.

## Verifica finale di rilascio

Il rilascio è approvabile solo quando:

- non esistono endpoint admin accessibili con un ruolo alterato dal client;
- le richieste anonime non leggono né modificano dati applicativi;
- nessuna Service Role Key entra nel bundle client;
- TypeScript, lint, test e build passano senza bypass;
- upload, reset password e anteprime HTML hanno test di sicurezza;
- le vulnerabilità high delle dipendenze sono risolte o formalmente accettate;
- esiste un rollback documentato per le policy RLS e le migrazioni database.
