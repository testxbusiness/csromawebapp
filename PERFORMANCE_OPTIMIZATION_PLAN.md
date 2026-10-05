# Piano incrementale di ottimizzazione performance

Piano derivato dall’audit diagnostico. Non contiene implementazione e non autorizza modifiche a route, schema, RLS o indici prima delle misurazioni indicate.

## Stato di avanzamento

| Task | Stato | Data | File principali | Verifiche | Note |
|---|---|---|---|---|---|
| PERF-001 | Completato | 05/10/2026 | `src/server/performance/request-timing.ts`, middleware e Route Handler atleta/profilo | `npx tsc --noEmit`, 4 suite/6 test Jest, `npm run build`, `git diff --check` | Strumentazione opt-in con `PERFORMANCE_DIAGNOSTICS=1`; nessuna query, policy RLS o risposta modificata quando disattivata. |
| PERF-002 | Completato | 05/10/2026 | `src/server/auth/require-account-context.ts`, `src/server/auth/require-account-context.test.ts` | test mirato 1/1, suite completa 103 suite/415 test passati con 2 suite/3 test falliti non correlati, `npx tsc --noEmit`, `npm run build`, `git diff --check` | Memoizzazione per istanza del client Supabase: una sola risoluzione concorrente di user/account/ruoli nello stesso request tree; nessun contesto condiviso tra request o tramite storage client. |
| PERF-004 | Completato | 05/10/2026 | `src/app/api/athlete/dashboard/route.ts`, test route dashboard | 2 suite API/3 test, suite completa 104 suite/417 test passati con 2 suite/3 test falliti non correlati, `npx tsc --noEmit`, `npm run build`, `git diff --check` | Attività, palestre, presenze, disponibilità e prossima partita vengono risolte in parallelo dopo la disponibilità dei rispettivi ID; contratto e autorizzazioni invariati. |
| PERF-003 | Completato | 05/10/2026 | `src/app/api/athlete/dashboard/route.ts`, `src/app/api/athlete/dashboard/alerts/route.ts`, `src/components/athlete/AthleteDashboard.tsx` | 2 suite API/3 test, suite completa 104 suite/417 test passati con 2 suite/3 test falliti non correlati, `npx tsc --noEmit`, `npm run build`, `git diff --check` | Alert amministrativi spostati su endpoint subject-aware parallelo; payload dashboard critico e stato successivo non attendono più gli alert. |
| PERF-009 | Completato | 05/10/2026 | `src/components/athlete/AthleteDashboard.tsx` | suite dashboard mirata 4/4, `npx tsc --noEmit`, `npm run build`, `git diff --check` | RSVP e assenza aggiornano lo stato locale già riflesso nella UI; rimossi i refetch aggregati successivi alle mutation. Timer/focus/online e cambio subject restano gli unici refresh automatici. |
| PERF-010 | Completato | 05/10/2026 | coordinatore refresh client, contesti atleta/coach/famiglia, badge unread | test coordinatore 2/2, suite mirate con 1 failure temporale preesistente dashboard, `npx tsc --noEmit`, `git diff --check` | Focus/visibility e online condividono una finestra di deduplica per `(utente, route, subject)`; il badge unread decrementa localmente dopo una lettura confermata e conserva `countOnly=1` come fallback. |

## PERF-001 — Baseline runtime correlata

**Problema**  I dati disponibili misurano solo il risultato browser, non i segmenti middleware/auth/API/DB.

**Evidenza (MISURATO / NON MISURATO)**  LCP dashboard 4,83–7,49 s, messages 3,70 s, fees 3,08 s; tempi interni NON MISURATI.

**File coinvolti**  `src/middleware.ts`, `src/hooks/useAuth.ts`, `src/app/api/me/profile/route.ts`, endpoint atleta e configurazione logging preview.

**Soluzione proposta**  Definire request id e Server-Timing/log strutturati solo per preview/staging, con fasi auth, contesto subject e query aggregate; nessuna modifica al contratto o comportamento.

**Miglioramento atteso**  Diagnosi affidabile e priorità verificabili, non miglioramento LCP diretto.

**Complessità di implementazione**  S

**Rischio di regressione**  Basso, se disabilitato fuori da preview.

**Come testare prima**  HAR + Performance trace delle tre route; snapshot di status code, JSON e request count.

**Come testare dopo**  Ripetere gli stessi trace e verificare correlazione 1:1 request id, nessun cambio payload/status.

**Criteri di accettazione**  Ogni segmento critico ha durata osservabile; nessun log sensibile e nessuna query aggiuntiva.

## PERF-002 — Misurare e ridurre la duplicazione auth/profile

**Problema**  Middleware, `useAuth` e endpoint subject-aware risolvono più volte sessione/account/ruoli.

**Evidenza (OSSERVATO NEL CODICE)**  `middleware.ts`; `useAuth.ts:301-314`; `/api/me/profile`; `requireSubjectAthleteContext`.

**File coinvolti**  Gli stessi file e `src/server/auth/require-account-context.ts`.

**Soluzione proposta**  Dopo PERF-001, condividere solo il contesto già sicuro nel perimetro della singola request/server tree oppure eliminare letture ridondanti documentate; non condividere dati auth tramite client storage come fonte autorevole.

**Miglioramento atteso**  Riduzione TTFB e attesa pre-fetch, da quantificare.

**Complessità di implementazione**  M

**Rischio di regressione**  Alto: autorizzazione e delegated subject sono sensibili.

**Come testare prima**  Test auth/RLS esistenti, trace con contatore chiamate e matrice atleta/famiglia/multi-ruolo.

**Come testare dopo**  Stessa matrice, verificando autorizzazioni identiche e meno segmenti/tempo.

**Criteri di accettazione**  Nessun accesso cross-subject; LCP dashboard ridotto senza cambiare JSON autorizzato; regressione zero sui test di contesto.

**Esito 05/10/2026**  `requireAccountContext` ora memoizza la promise di risoluzione usando l'istanza `SupabaseClient` come chiave, così le chiamate ripetute o concorrenti nello stesso Route Handler condividono `auth.getUser`, lettura `app_accounts` e lettura `account_roles`. Le promise fallite vengono rimosse dalla cache. `requireAthleteContext` riusa inoltre il client creato localmente invece di crearne un secondo. Il perimetro resta intenzionalmente limitato alla singola istanza server-side: middleware, browser `useAuth` e Route Handler distinti restano confini separati e non condividono dati autorevoli tramite client storage. Test aggiunto per verificare una sola risoluzione concorrente e risultato invariato. Misure LCP/TTFB su staging restano da ripetere con la procedura dell'audit.

## PERF-003 — Dashboard: separare il critical path dagli alert amministrativi

**Problema**  `loadAthleteDashboardAdministrativeAlerts` viene atteso prima del caricamento principale.

**Evidenza (OSSERVATO NEL CODICE)**  `src/app/api/athlete/dashboard/route.ts:21` attende gli alert prima di `memberRes/feeRes` a `:27`; il timing del blocco è NON MISURATO.

**File coinvolti**  `src/app/api/athlete/dashboard/route.ts`, `src/server/athlete/administration.ts`, contratto dashboard.

**Soluzione proposta**  Dopo la misura, spostare gli alert fuori dal primo payload oppure farli eseguire in parallelo se il contratto e la privacy lo consentono; mantenere stato esplicito “in aggiornamento”.

**Miglioramento atteso**  Riduzione del tempo prima del primo contenuto dashboard.

**Complessità di implementazione**  M

**Rischio di regressione**  Medio: alert e quote devono restare coerenti.

**Come testare prima**  Snapshot del contratto e trace con/without alert timing solo in staging.

**Come testare dopo**  Test endpoint, snapshot e trace LCP/JSON; verifica delegated permissions.

**Criteri di accettazione**  Primo contenuto non attende alert non critici; nessun alert autorizzato perso; LCP dashboard migliora rispetto alla baseline.

**Esito 05/10/2026**  Il Route Handler `/api/athlete/dashboard` non attende più `loadAthleteDashboardAdministrativeAlerts` e non include gli alert nel payload critico. È stato aggiunto `/api/athlete/dashboard/alerts`, che riusa la validazione `requireSubjectAthleteContext` e restituisce solo gli alert autorizzati con `Cache-Control: private, no-store`. `AthleteDashboard` avvia dashboard e alert in parallelo, rende la dashboard principale appena il payload critico è pronto e aggiorna gli alert successivamente; errori o abort del fetch alert non portano la dashboard in stato di errore. Il payload principale, le autorizzazioni e il comportamento delegated restano invariati per le sezioni critiche. La baseline fornita mostrava `administrative-alerts` a circa 1,08 s; la misura post-deploy va ripetuta verificando separatamente i due `Server-Timing`.

## PERF-004 — Dashboard: eliminare waterfall server confermati

**Problema**  Dopo gruppi paralleli rimangono fasi sequenziali: eventi, attività, availability e match.

**Evidenza (OSSERVATO NEL CODICE)**  `src/app/api/athlete/dashboard/route.ts:136-264`; durata reale NON MISURATA.

**File coinvolti**  Endpoint dashboard e funzioni `src/server/events/attendance-availability.ts`.

**Soluzione proposta**  Solo per dipendenze indipendenti confermate da PERF-001, avviare query in parallelo; mantenere dipendenze ID→lookup e limiti esistenti.

**Miglioramento atteso**  Riduzione della durata server aggregata.

**Complessità di implementazione**  M

**Rischio di regressione**  Medio/alto: query e error handling concorrenti.

**Come testare prima**  Test endpoint e fixture multi-team/multi-evento; trace per fase.

**Come testare dopo**  Confronto p50/p95, JSON byte-identico e suite auth/contract.

**Criteri di accettazione**  Nessuna query parte prima dei propri ID; p95 ridotto; nessun aumento di errori o duplicati.

## PERF-005 — Dashboard: payload iniziale minimo e streaming controllato

**Problema**  La pagina `/dashboard` è client e mostra dati utili solo dopo hydration e fetch aggregato.

**Evidenza (MISURATO + OSSERVATO NEL CODICE)**  LCP 4,83–7,49 s; `src/app/dashboard/page.tsx` è `'use client'`, `AthleteDashboard.tsx:413` fa fetch.

**File coinvolti**  `src/app/dashboard/page.tsx`, `src/components/athlete/AthleteDashboard.tsx`, route dashboard, eventuali `loading.tsx`/boundary.

**Soluzione proposta**  Valutare un Server Component wrapper con payload minimo e Suspense per sezioni non critiche; lasciare interazioni e mutazioni nei client island.

**Miglioramento atteso**  LCP più vicino al target 2,5 s e contenuto progressivo.

**Complessità di implementazione**  L

**Rischio di regressione**  Alto: ruoli, famiglia, subject e shell sono condivisi.

**Come testare prima**  Test per ruolo/subject, screenshot e trace attuali.

**Come testare dopo**  LCP p75 target ≤2,5 s per dashboard su condizioni equivalenti; nessuna regressione deep link, contesto o mutazione.

**Criteri di accettazione**  Primo testo utile arriva prima del payload non critico; nessun doppio fetch equivalente durante il mount.

**Stato implementazione — 05/10/2026**  Introdotto il primo incremento a rischio controllato: `src/app/dashboard/page.tsx` è ora un Server Component con `Suspense`; il dispatcher con auth, ruoli, area familiare e subject è stato spostato in `DashboardClient.tsx`; aggiunti `DashboardLoadingState.tsx` e `loading.tsx` per una shell utile e stabile durante hydration/navigation. Non è stato modificato il fetch privato dashboard né il contratto API, quindi non vengono introdotte doppie risoluzioni auth/profile. Typecheck, build e diff check superati. Il test mirato atleta conserva un failure temporale già presente e non correlato (`Oggi · 20:00` vs data fixture); serve ancora misura LCP/TTFB su staging e una successiva separazione del payload critico/non critico per completare pienamente l’obiettivo “payload iniziale minimo”.

## PERF-006 — Messaggi: separare lista minima e dettaglio full

**Problema**  La pagina usa `view=full` al caricamento iniziale e attende destinatari/allegati metadata.

**Evidenza (MISURATO + OSSERVATO NEL CODICE)**  LCP messages 3,70 s; `AthleteMessagesManager.tsx:84`; full route `src/app/api/athlete/messages/route.ts:155-240`.

**File coinvolti**  `AthleteMessagesManager.tsx`, `src/app/api/athlete/messages/route.ts`, contratto messages.

**Soluzione proposta**  Lista iniziale limitata a subject/unread/creator/team; caricare destinatari e allegati quando si apre il messaggio, con autorizzazione invariata.

**Miglioramento atteso**  LCP e payload iniziale migliori; dettaglio invariato.

**Complessità di implementazione**  M

**Rischio di regressione**  Medio: deep link e stato letto.

**Come testare prima**  Test API full/minimal, deep link messageId, delegated family e fixture allegati.

**Come testare dopo**  LCP p75 ≤2,5 s; lista non contiene dati non necessari; dettaglio e read-state restano corretti.

**Criteri di accettazione**  Nessun fetch attachments/recipients full al mount; apertura dettaglio in place; zero reload completo.

**Stato implementazione — 05/10/2026**  Completato il flusso lista/dettaglio: `AthleteMessagesManager` carica `view=minimal` all’ingresso e `view=full&id=...` solo quando l’utente apre una riga. Un deep link con `messageId` non presente nella prima pagina viene risolto direttamente dal dettaglio autorizzato. Le richieste vengono abortite al cambio subject/unmount e non cambiano il contratto di autorizzazione o il read-state. Test mirati messaggi (9 test), typecheck, build e diff check superati; resta da verificare su staging il payload/TTFB.

## PERF-007 — Fees: ridurre la catena di arricchimento

**Problema**  `fee_installments → membership_fees → teams → activities` è seriale.

**Evidenza (MISURATO + OSSERVATO NEL CODICE)**  LCP 3,08 s; `src/server/athlete/fees.ts:13-38`; contatori e durate DB NON MISURATI.

**File coinvolti**  `src/server/athlete/fees.ts`, `src/server/athlete/administration.ts`, API administration/fees, contratti.

**Soluzione proposta**  Misurare prima; poi usare una query relazionale già autorizzata o un servizio server che riduca round trip, senza introdurre RPC/schema implicitamente.

**Miglioramento atteso**  Riduzione TTFB/API e LCP fees.

**Complessità di implementazione**  M/L

**Rischio di regressione**  Alto: quote per squadra/stagione e delegated access.

**Come testare prima**  Fixture multi-team, quote duplicate/stagioni, autorizzazione e JSON snapshot.

**Come testare dopo**  Confrontare query count, p95, payload e risultato per ogni team; nessuna query fuori stagione.

**Criteri di accettazione**  LCP fees ≤2,5 s nel profilo target o miglioramento misurato ≥30%; contratto invariato e access control invariato.

**Stato implementazione — 05/10/2026**  Completata la riduzione della catena: `src/server/athlete/fees.ts` carica rate, quote, squadre e attività con una singola query relazionale su `fee_installments`, filtrata da `profile_id` e `activeTeamIds`. Il builder mantiene invariati contratto JSON, importi, stati e raggruppamento per squadra; con zero squadre attive la query viene evitata. Aggiunto test del servizio su query unica e contesto annidato. Test fees mirati (17 test), typecheck, build e diff check superati; la misura p50/p95 su staging resta da ripetere.

## PERF-008 — Loading UX e Suspense per fees/messages

**Problema**  Fees usa `Suspense fallback={null}`; messages ha fallback ma il manager fa fetch client.

**Evidenza (OSSERVATO NEL CODICE)**  `src/app/athlete/fees/page.tsx`, `src/app/athlete/messages/page.tsx`.

**File coinvolti**  Le due `page.tsx`, componenti `LoadingState`, eventuali `loading.tsx`.

**Soluzione proposta**  Mostrare skeleton stabile e progressivo coerente con l’elemento atteso; non confondere UX anticipata con miglioramento LCP reale.

**Miglioramento atteso**  Percezione migliore; LCP solo se il contenuto reale viene streammato.

**Complessità di implementazione**  XS/S

**Rischio di regressione**  Basso.

**Come testare prima**  Screenshot e Web Vitals attuali.

**Come testare dopo**  Verificare CLS ≤0,1, skeleton senza layout shift e LCP attribuito al contenuto reale.

**Criteri di accettazione**  Nessun fallback vuoto sulle route P1; nessun CLS aggiuntivo; testo di errore/offline invariato.

**Stato implementazione — 05/10/2026**  Eliminato il `Suspense fallback={null}` da `/athlete/fees`, rimosso il boundary client non necessario e aggiunti `loading.tsx` route-level per fees e messages con PageHeader e `LoadingState` coerenti. I manager continuano a gestire autonomamente loading durante il fetch client, errori, offline e retry; non sono stati aggiunti fetch. Test mirati fees/messages/amministrazione (20 test), typecheck, build e diff check superati.

## PERF-009 — Evitare refetch dashboard dopo mutazioni già riflesse localmente

**Problema**  Attendance e early absence aggiornano lo stato locale e poi rilanciano `loadAthleteData()`.

**Evidenza (OSSERVATO NEL CODICE)**  `AthleteDashboard.tsx:280-289` e `:333-335`; frequenza e costo NON MISURATI.

**File coinvolti**  `src/components/athlete/AthleteDashboard.tsx`, endpoint attendance e contratto availability.

**Soluzione proposta**  Aggiornamento locale completo per i campi visibili, più invalidazione mirata solo quando una sezione realmente dipendente cambia.

**Miglioramento atteso**  Meno refetch e risposta interazione più stabile.

**Complessità di implementazione**  S

**Rischio di regressione**  Medio.

**Come testare prima**  Trace POST + GET e casi deadline/next-event.

**Come testare dopo**  Nessun GET dashboard se non necessario; stato, disponibilità e conflitti corretti.

**Criteri di accettazione**  Dopo RSVP/assenza il contenuto visibile è aggiornato in place; zero `window.location.reload`.

**Stato implementazione — 05/10/2026**  Completato l’aggiornamento locale per RSVP e segnalazione/revoca dell’assenza: evento selezionato, agenda e capability `attendance_availability` vengono aggiornati senza rilanciare `loadAthleteData()`. Restano attivi i refresh temporali, al focus e al ritorno online, oltre al retry esplicito e all’invalidazione al cambio subject. La suite dashboard mirata copre le mutation e l’invalidazione del subject (4/4), con typecheck, build e diff check superati. La misura runtime su staging resta da ripetere con trace POST + GET.

## PERF-010 — Deduplicare refresh focus/online e badge unread

**Problema**  Auth, contesti, manager e bottom navigation possono reagire allo stesso ritorno in foreground/online.

**Evidenza (OSSERVATO NEL CODICE)**  `useAuth.ts:382-423`, `AccessibleProfileContext.tsx`, `TeamContext.tsx`, manager atleta e `BottomNavigation.tsx:45-70`.

**File coinvolti**  I file sopra e un eventuale coordinatore client per request deduplication.

**Soluzione proposta**  Deduplicare per chiave `(subject, route, freshness window)`, mantenere abort controller e aggiornare unread localmente quando possibile; non disattivare i controlli di sessione.

**Miglioramento atteso**  Meno richieste concorrenti e meno lavoro dopo navigazione/focus.

**Complessità di implementazione**  M

**Rischio di regressione**  Medio/alto: dati stale e contesto account.

**Come testare prima**  Trace di focus, visibilitychange e online con request count.

**Come testare dopo**  Una sola richiesta per chiave durante la finestra; refresh corretto dopo cambio subject e logout.

**Criteri di accettazione**  Nessun loop; nessuna richiesta full messages generata dal solo badge; sicurezza invariata.

## PERF-011 — Limitare il profilo account al contratto usato

**Problema**  `/api/me/profile` usa `profiles.select('*')`.

**Evidenza (OSSERVATO NEL CODICE)**  `src/app/api/me/profile/route.ts:9-13`; payload/tempo NON MISURATI.

**File coinvolti**  Route profile, tipo `ProfileRow`, test correlati.

**Soluzione proposta**  Dopo aver misurato i campi effettivamente usati, selezionare solo quelli necessari mantenendo compatibilità esplicita.

**Miglioramento atteso**  Piccola riduzione payload e serializzazione.

**Complessità di implementazione**  XS

**Rischio di regressione**  Basso/medio.

**Come testare prima**  Snapshot JSON e ricerca consumatori dei campi.

**Come testare dopo**  Typecheck, test auth/profile e confronto byte/payload.

**Criteri di accettazione**  Nessun consumer riceve `undefined` inatteso; payload ridotto misurabilmente.

## PERF-012 — Profilare e correggere login INP

**Problema**  L’INP misurato è sopra target, ma l’interazione responsabile non è identificata.

**Evidenza (MISURATO)**  `/login` INP 232 ms, LCP 0,24 s.

**File coinvolti**  `src/app/(auth)/login/page.tsx`, form di login e callback/auth solo dopo attribution.

**Soluzione proposta**  Registrare l’azione precisa con Event Timing/long tasks; intervenire solo sull’handler dimostrato, preservando redirect auth.

**Miglioramento atteso**  INP ≤200 ms.

**Complessità di implementazione**  XS/S

**Rischio di regressione**  Basso/medio.

**Come testare prima**  Chrome Performance con click/submit esatto e test login/callback.

**Come testare dopo**  Stesso trace, INP ≤200 ms e flussi di login/recovery invariati.

**Criteri di accettazione**  Interazione attribuita e migliorata; nessuna navigazione auth duplicata.

## PERF-013 — Verifica caching e Router Cache senza cambiare policy

**Problema**  Le API private usano no-store e il comportamento di Router Cache/Full Route Cache non è misurato.

**Evidenza (OSSERVATO NEL CODICE + NON MISURATO)**  fetch no-store nei manager; assenza di `router.refresh`, `revalidatePath` e `revalidateTag` rilevata nel sorgente.

**File coinvolti**  Route atleta, `next.config.js`, shell/navigation.

**Soluzione proposta**  Misurare prima navigazione, seconda navigazione e ritorno back/forward; applicare solo cache sicure per dati pubblici o tag mirati, mai cacheare dati privati senza revisione.

**Miglioramento atteso**  Meno richieste nelle navigazioni ripetute, se il comportamento attuale lo permette.

**Complessità di implementazione**  M

**Rischio di regressione**  Alto per privacy/staleness.

**Come testare prima**  Network waterfall con cache on/off e matrice account/subject.

**Come testare dopo**  Cache hit verificati, dati sempre subject-correct, logout senza residui.

**Criteri di accettazione**  Nessun dato account-specifico condiviso tra subject/account; nessun reload completo aggiunto.

## PERF-014 — Gate finale Core Web Vitals e refetch

**Problema**  Serve una verifica ripetibile prima di implementare ulteriori ottimizzazioni.

**Evidenza (MISURATO)**  Baseline iniziale fornita dal brief; molte metriche di attribuzione ancora NON MISURATE.

**File coinvolti**  Nessun file di produzione obbligatorio; report e fixture di misura.

**Soluzione proposta**  Ripetere la matrice in preview con condizioni fisse e confrontare p75 LCP/INP/CLS, request count, JSON bytes, p95 API e reload/refetch.

**Miglioramento atteso**  Decisioni basate su regressioni reali.

**Complessità di implementazione**  S

**Rischio di regressione**  Basso.

**Come testare prima**  Trace baseline, HAR, Vercel/Supabase logs.

**Come testare dopo**  Stessa matrice su dashboard/messages/fees/login, più famiglia e multi-team.

**Criteri di accettazione**  Dashboard/messages/fees raggiungono o si avvicinano a LCP p75 ≤2,5 s; login INP p75 ≤200 ms; CLS ≤0,1; nessun reload completo nei flussi normali; refetch non necessario eliminato o motivato.

## Matrice di esecuzione

| Ordine | Task | Dipendenza |
|---:|---|---|
| 1 | PERF-001 | — |
| 2 | PERF-002 | PERF-001 |
| 3 | PERF-003 | PERF-001 |
| 4 | PERF-004 | PERF-001 |
| 5 | PERF-005 | PERF-002, PERF-003, PERF-004 |
| 6 | PERF-006 | PERF-001 |
| 7 | PERF-007 | PERF-001 |
| 8 | PERF-008 | PERF-005, PERF-006, PERF-007 |
| 9 | PERF-009 | PERF-001 |
| 10 | PERF-010 | PERF-001, PERF-009 |
| 11 | PERF-011 | PERF-001 |
| 12 | PERF-012 | PERF-001 |
| 13 | PERF-013 | PERF-001, PERF-010 |
| 14 | PERF-014 | PERF-005–PERF-013 |

## Quick wins implementabili dopo la misura

1. PERF-011 — limitare `select('*')` del profilo.
2. PERF-008 — sostituire `fallback={null}` delle fees con skeleton stabile.
3. PERF-009 — non rifare il fetch dashboard dopo patch locale se la misura conferma che i dati sono già completi.
4. PERF-006 — lista messages minimale e dettaglio on demand.
5. PERF-003 — togliere gli alert non critici dal critical path.
6. PERF-010 — deduplicare badge unread e refresh online/focus.
7. PERF-001 — Server-Timing in preview/staging per rendere verificabili tutti gli altri task.
8. PERF-012 — correggere esclusivamente l’handler identificato dall’INP attribution.

Le quick wins non autorizzano modifiche immediate: prima vanno raccolte le misure indicate nei rispettivi task.
