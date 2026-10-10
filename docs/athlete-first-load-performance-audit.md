# Athlete First Load Performance Audit

Audit diagnostico dello stato corrente del repository al 8 ottobre 2026.

## 1. Executive summary

Questo audit separa il percorso di primo caricamento atleta in bootstrap, attesa prima della query, request/API, lavoro server, database, payload e lavoro client.

Il documento include ora i risultati del HAR WebInspector raccolto in preview l'8 ottobre 2026. Non sono stati modificati query, endpoint contract, staleTime, business logic, UI, policy Supabase o comportamento di cache. I valori non presenti nel HAR, in particolare il tempo client `mount → query enabled → fetch start`, restano marcati `NOT MEASURED`.

Le evidenze dal codice mostrano un waterfall comune:

```text
middleware auth
→ AuthProvider getSession
→ /api/me/profile (salvo cache sessionStorage valida)
→ /api/me/accessible-profiles
→ selezione subject/area
→ query pagina abilitata
```

Il ranking distingue ora due livelli diversi:

- `CLIENT_CONTEXT_WATERFALL`: tempo browser prima che la query pagina parta; nel HAR non è ricostruibile perché non contiene i marker client;
- `SERVER_SUBJECT_CONTEXT`: tempo dentro `requireSubjectAthleteContext` e risoluzione account/subject/stagione/team, misurato da `Server-Timing`.

Nel Dashboard il `SERVER_SUBJECT_CONTEXT` è circa 1,02–1,46 s, mentre `dashboard-enrichment` è circa 0,81–1,22 s. Il candidato payload più importante resta Calendar: 112.447 byte JSON nel HAR.

La conclusione su Redis è `NOT NEEDED` per il momento: mancano misure runtime che dimostrino un problema di cache server condivisa, mentre il costo osservabile dal codice è soprattutto waterfall/context, query aggregate e possibile ampiezza del dataset.

## 2. Measurement methodology

### Runtime instrumentation

È stata completata una strumentazione opt-in:

- Server: `PERFORMANCE_DIAGNOSTICS=1`.
- Browser: `NEXT_PUBLIC_PERFORMANCE_DIAGNOSTICS=1`.
- Le durate client usano `performance.now()`.
- Le route emettono `Server-Timing` e un log JSON tecnico.
- Il client emette mount pagina, query enabled, fetch start, response received, response parsed e first useful render.
- Sono emesse solo label tecniche (`dashboard`, `calendar`, `events`, `transform`, ecc.). Non vengono emessi account ID, subject ID, email, nomi, contenuti o messaggi.

In Chrome DevTools:

1. avvia preview con entrambe le variabili a `1`;
2. apri Network e attiva la colonna `Waterfall`/`Timing`;
3. sulle request API osserva l'header `Server-Timing` nella sezione Timing;
4. filtra la Console per `performance-diagnostic`;
5. per il cold load usa una nuova sessione/hard reload, per il warm load conserva sessione e shell ma visita una route nuova;
6. registra i valori con lo stesso `requestId` server quando disponibile.

Il browser può non fornire `content-length` per risposte chunked/compressed; in quel caso il payload va rilevato dalla dimensione trasferita in Network oppure esportando la response preview. La strumentazione non altera la response body.

### Definizioni operative

- **Cold first load:** hard reload/login fino al primo render utile.
- **Warm first page load:** Auth/context già pronti, query pagina non ancora cached.
- **Cached return:** query già presente nella Query Cache; usato solo come confronto.
- **First useful render:** primo commit nel quale la pagina dispone di dati principali, non il primo commit dello skeleton.

### What was and was not measured

| Area | Stato |
|---|---|
| Mappa route/provider/query | Misurata staticamente dal codice corrente |
| Server phase labels | Disponibili in preview con `Server-Timing` |
| Client pre-request wait | Disponibile in preview con log client |
| TTFB/API/payload reali | Misurati dal HAR per le API presenti |
| Client `mount → enabled → fetch start` | `NOT MEASURED`: il HAR non contiene i marker client |
| React Profiler/browser render | `NOT MEASURED`: il HAR non contiene un trace Profiler |
| EXPLAIN/EXPLAIN ANALYZE staging | `NOT MEASURED`: nessuna connessione staging usata in questo audit |

## 3. Current first-load architecture

Il root layout mantiene montati i provider durante la navigazione client-side:

```text
AuthProvider
└─ QueryProvider
   └─ QuerySessionCacheBoundary
      └─ AccessibleProfileProvider
         └─ TeamProvider
            └─ LayoutShell
               ├─ navigation/shell/unread badge
               └─ athlete page manager
```

La navigazione non causa document reload. Il manager della route viene montato e la query TanStack parte quando il contesto è sufficiente.

Il subject usato dalle query è distinto dall'account:

- account: `account.authUserId`;
- subject personale: `account.ownerProfileId`;
- subject delegato: `selectedProfileId`.

Le query pagina usano key account-aware e subject-aware. Il server continua a verificare account, ruolo, relazione, permessi, atleta e stagione tramite `requireSubjectAthleteContext`.

## 4. Global provider/bootstrap timing

### Middleware

`src/middleware.ts` intercetta anche le route applicative e API. Con instrumentation attiva misura `middleware-auth`, che chiama `supabase.auth.getUser()` per la sessione server.

Non è presente una query DB esplicita nel middleware. Il suo tempo è quindi separabile dal tempo del route handler.

Valore runtime: `NOT MEASURED`.

### AuthProvider

Su cold load `useAuthState` esegue:

1. `supabase.auth.getSession()`;
2. se esiste user, `/api/me/profile` salvo cache `sessionStorage` valida per 5 minuti;
3. `profile` e `account` vengono pubblicati nel context;
4. `authInitialized` e `profileLoading` permettono ai consumer di avanzare.

`/api/me/profile` ora misura separatamente:

- `account-context`;
- `profile-query`;
- `route-total`.

Il retry dopo `401` può produrre una seconda request profile: va contato separatamente nel cold-load report.

### AccessibleProfileProvider

Quando auth/account sono pronti esegue `/api/me/accessible-profiles`; lo ripete su focus/visibility tramite `runClientRefresh`. Per il self athlete, anche una risposta vuota è una request di bootstrap che precede il riconoscimento definitivo del subject personale.

La route ora misura:

- `account-context`;
- `active-season`;
- `relationships-profiles-overrides` (tre query parallele);
- `active-memberships`;
- `route-total`.

Il HAR precedente alla nuova deploy dell'instrumentation non aveva ancora `Server-Timing` su questo endpoint, ma registra **17 request** in circa 2 minuti e 34 secondi, tutte `200`, con payload di soli 15 byte e durata 1,02–1,79 s. Le duplicazioni più evidenti sono due request praticamente contemporanee alle 17:31:00, tre request tra 17:31:26.173 e 17:31:26.681, e coppie ravvicinate alle 17:32:33, 17:33:10 e 17:33:33.

La causa probabile è composta da due meccanismi correnti:

1. `useEffect(() => refresh(), [refresh])` esegue una request diretta quando cambiano `authLoading`, `user` o `account`, perché cambiano anche le dipendenze della callback `refresh`.
2. Un secondo effect registra listener `focus`/`visibilitychange` e invoca `runClientRefresh`. Il coordinator coalesca solo le invocazioni che passano da lui; la request diretta dell'effect iniziale non è registrata nel coordinator e può quindi sovrapporsi alla request focus/visibility.

La strumentazione client ora emette `accessible-profiles-fetch-start` e `accessible-profiles-response` con source `initial-effect` o `focus-visibility`, per confermare il contributo di ciascun trigger nella prossima preview.

La scelta del subject è un passaggio successivo alla risposta: legge localStorage, valida l'ID contro i profili accessibili e pubblica `selectedProfileId`/`activeArea`.

### TeamProvider

Per l'atleta non esegue un fetch iniziale separato: le squadre arrivano dai payload Dashboard, Calendar o Messages e vengono inserite nel context. Per il coach esiste `/api/coach/teams`, fuori scope.

Per il first load atleta il provider può comunque aggiungere un render/context update, ma non è un endpoint DB separato.

### QueryProvider / QuerySessionCacheBoundary

`QueryProvider` crea un QueryClient in-memory. `gcTime` globale è 30 minuti; il refetch on focus è attivo. `QuerySessionCacheBoundary` pulisce il QueryClient al cambio identità o logout.

La query pagina non è abilitata finché non risultano pronti auth/profile, account, subject e permessi rilevanti. Questo protegge l'isolamento ma crea il possibile `pre-request wait` da misurare.

## 5. Dashboard

Route: `/dashboard`.

Query principali al mount:

- `/api/athlete/dashboard`;
- `/api/athlete/dashboard/alerts`;
- badge shell `/api/athlete/messages?countOnly=1` quando il badge è abilitato.

Dashboard e alerts sono avviati in parallelo da due query TanStack indipendenti. Gli alert non bloccano il rendering principale quando il dashboard ha già dati.

### Critical path

```text
auth/profile/access profiles/subject
→ dashboard enabled
→ dashboard + alerts (parallel)
→ first useful render quando il contratto dashboard è disponibile
```

### Server/database sequence

Nel dashboard handler, dopo il subject context:

1. memberships e prime fee installments: parallele;
2. message recipients: sequenziale, dipende dagli ID squadra ottenuti dalle memberships;
3. creator profiles e read state: attualmente sequenziali nel codice;
4. se non ci sono squadre, ritorno anticipato;
5. teams, event-team links, membership fees e championship club teams: parallele;
6. events: sequenziale dopo gli event IDs;
7. activities, gyms, attendance e championship matches: parallele;
8. map/normalizzazione finale del contratto.

`Server-Timing` esistente espone `subject-context`, `memberships-fees`, `dashboard-messages`, `team-catalog`, `events`, `dashboard-enrichment` e `route-total`.

La nuova instrumentation aggiunge anche `account-context`, `subject-resolution`, `athlete-profile`, `active-season`, `season-membership`, `active-season-teams`, oltre a fasi granulari per dashboard enrichment e messaggi.

### Metrics from HAR

| Metric | Value |
|---|---:|
| Page/navigation start | 17:30:59.321Z |
| Query enabled | NOT MEASURED |
| Request start | 17:31:00.054Z / 17:33:10.862Z |
| Pre-request wait | NOT MEASURED |
| TTFB/wait | 4,254–4,289 ms |
| API total | 4,259–4,296 ms |
| Payload size | 12,348 bytes JSON |
| Response received | NOT separately exported |
| First useful render | NOT MEASURED |
| Total first-load time | document onLoad 933 ms; API completion later |

### Classification

- Primary measured server bottleneck: `SERVER_SUBJECT_CONTEXT` (1,02–1,46 s in the HAR samples).
- Secondary measured server bottleneck: `dashboard-enrichment` (0,81–1,22 s).
- Separate unmeasured client candidate: `CLIENT_CONTEXT_WATERFALL`.
- Additional structural candidate: `SEQUENTIAL_DB_QUERIES` — recipients → creator/read and catalog → events.

## 6. Calendar

Route: `/athlete/calendar`.

Endpoint: `/api/athlete/calendar`.

### Critical path

```text
auth/profile/access profiles/subject + view_schedule
→ calendar enabled
→ calendar request
→ client filtering/conflict marking
→ first useful calendar render
```

### Server/database sequence

1. `team_members` autorizzati;
2. `teams` dopo gli ID membership;
3. `event_teams` dopo gli ID squadra, con batching a 100;
4. `events` dopo gli event IDs, con batching a 100;
5. `event_attendances` dopo gli event IDs;
6. `resolveAttendanceAvailability`, che può eseguire ulteriori query server-side;
7. `buildCalendarEvents` e arricchimento availability.

Le fasi `subject-context`, `team-memberships`, `teams`, `event-team-relations`, `events`, `attendance`, `attendance-availability`, `transform` e `route-total` sono ora disponibili in `Server-Timing`.

Il calendario carica l'insieme autorizzato completo. Mese, vista, filtro evento e squadra selezionata sono filtri locali e non cambiano la request corrente.

### Payload/client

Il HAR misura 112.447 byte JSON per Calendar, classe 50–200 KB. Il costo client potenziale resta `CLIENT_TRANSFORM` per `filterCalendarEvents` + `markCalendarConflicts` e il rendering della vista calendario.

### Metrics

| Metric | Value |
|---|---:|
| Page/navigation start | NOT MEASURED |
| Query enabled | NOT MEASURED |
| Request start | 17:31:31.240Z |
| Pre-request wait | NOT MEASURED |
| TTFB/wait | 3,876 ms |
| API total | 3,886 ms |
| Payload size | 112,447 bytes JSON |
| Response received | NOT separately exported |
| First useful render | NOT MEASURED |
| Total first-load time | NOT MEASURED |

### Classification

- Primary measured candidate: `DATABASE_QUERY`/server handler — request totale 3.886 s.
- Secondary measured candidate: `PAYLOAD_SIZE` — 112.447 byte JSON.
- Separate unmeasured client candidate: `CLIENT_CONTEXT_WATERFALL`.

## 7. Messages

Route: `/athlete/messages`.

Query principale first load:

- `/api/athlete/messages?view=minimal`;
- dettaglio `view=full&id=...` solo per deep link/apertura;
- badge `countOnly=1` nella shell è una request distinta.

### Critical path

```text
auth/profile/access profiles/subject + receive_messages
→ messages list enabled
→ minimal list request
→ local read/team filtering
→ first useful list render
```

### Server/database sequence

1. `team_members`;
2. `message_recipients`;
3. per `countOnly=1`, `message_reads` e ritorno;
4. per lista, `messages`;
5. `message_reads` e `teams` parallele;
6. creator profiles e normalizzazione minimal;
7. full view: recipient/teams/profiles/attachments enrichment aggiuntivi.

`Server-Timing` misura subject, memberships, recipients, read state, messages query ed enrichment.

### Classification

- Primary measured server candidate: `SERVER_SUBJECT_CONTEXT` — circa 0,99–1,45 s nelle liste minimal del HAR.
- Secondary measured server candidate: `messages-enrichment` — 819 ms nel full detail.
- Separate unmeasured client candidate: `CLIENT_CONTEXT_WATERFALL`.

Il payload minimal evita il body completo per la lista, ma il numero di recipient viene caricato prima di limitare i messaggi: da verificare con record reali.

### Metrics from HAR

| Request | API total | Server route-total | Payload |
|---|---:|---:|---:|
| unread `countOnly=1` | 2.123–2.140 s | 1.608–1.625 s | 24 B |
| list `view=minimal` | 2.245–2.581 s | 1.741–2.097 s | 8.082 B |
| detail `view=full` | 3.462 s | 2.300 s | 941 B |

Query enabled, client pre-request wait e first useful render: `NOT MEASURED`.

## 8. Administration

Route: `/athlete/fees`.

Il manager corrente usa `/api/athlete/administration`; `/api/athlete/fees` è un endpoint legacy separato e non è il first-load contract della pagina attuale.

### Server/database sequence

Dopo `requireSubjectAthleteContext`, `loadAthleteAdministrationContract` esegue in parallelo:

- `season_profiles` se `view_documents`;
- `athlete_profiles` se `view_medical_status`;
- `loadAthleteFeesContract` se `view_payments`.

`loadAthleteFeesContract` esegue una query `fee_installments` con relazioni nested `membership_fees → teams → activities`, poi normalizza in mappe. Il relativo alert Dashboard usa una parte sovrapposta ma non identica del contratto.

La route misura subject context, contract e total; il dettaglio interno della query quote è staticamente identificato ma non ancora separato in `Server-Timing`.

### Classification

- Primary measured server bottleneck: `SERVER_SUBJECT_CONTEXT` — 1,394 ms.
- Secondary measured server phase: `administration-contract` — 304 ms.
- Separate unmeasured client candidate: `CLIENT_CONTEXT_WATERFALL`.

HAR: 2,189 ms API total, 1,699 ms route handler, payload 2,259 byte. Query enabled e first useful render: `NOT MEASURED`.

## 9. Profile

Route: `/athlete/profile`.

### Server/database sequence

1. `profiles`, `athlete_profiles`, `team_members`: parallele;
2. `teams`: dipende dalle memberships;
3. `activities`: dipende dalle teams;
4. documenti personali e documenti di squadra: paralleli, se il permesso è presente;
5. deduplica e build del contract.

La route misura `subject-context`, `profile-athlete-memberships`, `teams`, `activities`, `documents` e `route-total`.

### Classification

- Primary measured API latency: 2,935 ms, ma il deployment catturato non esponeva ancora il breakdown Server-Timing della route.
- Server candidate: `SERVER_SUBJECT_CONTEXT`, da confermare con i nuovi header granulari.
- Separate unmeasured client candidate: `CLIENT_CONTEXT_WATERFALL`.

HAR: 2,935 ms API total, 729 byte JSON. Server-Timing non presente nel deployment catturato; la nuova instrumentation copre subject context, base queries, teams, activities e documents.

## 10. Other athlete routes

### Campionati

`/athlete/campionati` usa query TanStack per catalogo e gruppi, con query di convocazione on demand. Il first load è dipendente da auth/context e dal catalog request; gruppo, convocazione e dettagli possono essere successivi all'interazione.

HAR: catalog 2,577 ms / 1,418 byte, group 2,575 ms / 9,008 byte, convocation 2,425 ms / 918 byte. Server-Timing non era presente nel deployment catturato; ora `championships` misura subject context, championship resolution, matches/standings e convocation.

### Team detail

Il dettaglio squadra della Dashboard è on demand e usa `/api/athlete/teams/detail`/query dedicata. Non è parte del first useful render iniziale Dashboard. Il HAR contiene invece `/api/athlete/events/detail`: 3,906 ms e 1,039 byte JSON; ora la route misura subject context, link/team membership, event, enrichment e attendance availability.

### Legacy fees endpoint

`/api/athlete/fees` esiste ancora, ma la pagina `/athlete/fees` corrente usa `/api/athlete/administration`. Non va confuso con il percorso principale durante il profiling.

## 11. Database/query findings

### Query count/parallelism summary

| Endpoint | Parallel groups | Sequential dependencies | Finding |
|---|---|---|---|
| `/api/me/profile` | nessuno nel route | account context → profile | bootstrap seriale |
| `/api/me/accessible-profiles` | relationships/profiles/overrides | account → season → memberships | base lookup parallelo, membership dipendente |
| `/api/athlete/dashboard` | memberships/fees; catalog; enrichment | context → messages → catalog → events | contratto più aggregato |
| `/api/athlete/dashboard/alerts` | certificate/fees in loader | context → loader | sovrapposizione con Administration |
| `/api/athlete/calendar` | nessun gruppo principale | memberships → teams → relations → events → attendance → availability | waterfall di autorizzazione/dataset |
| `/api/athlete/messages` | read state/teams | memberships → recipients → messages → enrichment | recipient discovery precede limit |
| `/api/athlete/administration` | season/athlete/fees | context → contract | contract base parallelo |
| `/api/athlete/profile` | profile/athlete/memberships; documents | context → teams → activities → documents | catena di catalogo |

### N+1 and duplicate-risk review

- Non è stato osservato un loop `.from()` per singolo evento o messaggio nei route principali esaminati.
- Calendar usa batching a 100 quando event/team ID superano la soglia, quindi il numero di request può crescere con dataset grandi.
- Dashboard e Calendar caricano domini sovrapposti ma con contratti diversi: non è corretto dedurre automaticamente che una query sia eliminabile.
- Dashboard/alerts e Administration rileggono dati quote/certificato: duplicazione funzionale confermata staticamente, costo reale non misurato.
- Messages carica recipients prima di limitare la lista minimal: possibile costo su dataset con molti destinatari.
- Non viene dichiarato alcun indice mancante. Senza EXPLAIN/EXPLAIN ANALYZE è solo un candidato da verificare.

### Possible EXPLAIN candidates

Da verificare esclusivamente su staging e con SELECT non distruttive:

- `message_recipients` filtrato per `profile_id`/`team_id` e ordinato per `created_at`;
- `event_teams` filtrato con grandi liste `team_id`;
- `events` filtrato con grandi liste `id`;
- `fee_installments` con filtro profile/team nested e ordinamento `due_date`;
- documenti filtrati per target user/team.

## 12. Payload findings

Il HAR fornisce response JSON sizes (non transfer size compresso, che resta `-1` nel file). La tabella seguente usa quindi la dimensione JSON osservata:

| Endpoint | Payload class | Evidence |
|---|---|---|
| dashboard | 12,348 B (`<50 KB`) | aggrega memberships, fee, messages, events, teams, gyms, attendance, match |
| dashboard alerts | 253 B (`<50 KB`) | contract ridotto ma fee nested possibile |
| calendar | 112,447 B (`50–200 KB`) | intero dataset eventi autorizzato, filtri mese lato client |
| messages minimal | 8,082 B (`<50 KB`) | lista messaggi + teams + recipients-derived contract |
| messages full | 941 B (`<50 KB`) | detail singolo osservato |
| administration | 2,259 B (`<50 KB`) | installments con relazioni fee/team/activity |
| profile | 729 B (`<50 KB`) | profilo, teams, activities, document metadata |
| championships group | 9,008 B (`<50 KB`) | matches, standings, labels |
| event detail | 1,039 B (`<50 KB`) | evento, teams, gym, creator, attendance |
| me/accessible-profiles | 15 B (`<50 KB`) | preview personale senza profili delegati |

La dimensione è JSON logical size; body/transfer compressi non sono disponibili nel HAR.

## 13. Client rendering findings

### Measurable with current instrumentation

- page mount;
- query enabled;
- fetch start e pre-request wait;
- response received;
- response parsed;
- first useful render quando il dato principale è presente.

### Static candidates

- Dashboard: normalizzazione e molte sezioni del contratto aggregato; render di eventi, memberships, messaggi e alert.
- Calendar: `filterCalendarEvents` + `markCalendarConflicts`, quindi FullCalendar/mobile calendar su dataset filtrato.
- Messages: `useMemo` per lista/team e filtro locale; il dettaglio è separato.
- Administration: trasformazioni quote/certificate principalmente leggere.
- Profile: mapping/display di memberships e documenti principalmente leggero; push detection è un side effect separato.

React Profiler e browser Performance sono `NOT MEASURED`. Non c'è evidenza sufficiente per introdurre memoization, virtualization o modifiche UI in questo goal.

## 14. Bottleneck ranking

Ranking aggiornato con il HAR e separazione client/server:

1. `SERVER_SUBJECT_CONTEXT`: 0,99–1,46 s sulle route Dashboard, alerts, Messages, Administration; comprende account, subject, stagione, membership e team IDs.
2. `SERVER_DASHBOARD_ENRICHMENT`: 0,81–1,22 s; è la seconda fase misurata del Dashboard.
3. `SERVER_MESSAGES_ENRICHMENT`: 819 ms sul dettaglio full; la lista minimal è più contenuta ma resta soggetta al costo recipients.
4. `CLIENT_CONTEXT_WATERFALL`: non misurato nel HAR; è distinto dal precedente perché avviene prima del fetch e va calcolato con i marker client.
5. `PAYLOAD_SIZE`/server handler Calendar: 3,886 s API e 112,447 B JSON; la dimensione è significativa, ma il HAR non consente di attribuire tutta la durata al trasferimento.

`middleware-auth`, `SERVER_SUBJECT_CONTEXT` e `CLIENT_CONTEXT_WATERFALL` non sono intercambiabili: il primo è middleware server, il secondo è handler/server DB, il terzo è attesa React/provider nel browser.

## 15. Impact/Effort recommendations

Nessuna raccomandazione è stata implementata.

| Intervention | Evidence | Expected gain | Effort | Risk |
|---|---|---:|---|---|
| QUICK WIN — raccogliere sessioni cold/warm con instrumentation e Network export | I valori runtime sono ancora mancanti | Determina il vero collo di bottiglia | Basso | Basso |
| QUICK WIN — confrontare Dashboard principale e alerts in waterfall | Sono query TanStack indipendenti | Isola se alerts impatta il primo render | Basso | Basso |
| QUICK WIN — misurare Calendar bytes/record per dataset reale | Payload completo e filtri locali | Quantifica il rischio payload | Basso | Basso |
| MEDIUM — verificare EXPLAIN sui candidati identificati | Filtri/ordinamenti e nested relations | Identifica eventuale DB cost non provato | Medio | Medio |
| MEDIUM — valutare parallelismo solo dove timing dimostra indipendenza | Esistono catene IDs reali | Riduce server duration solo se la dipendenza è evitabile | Medio | Alto: authorization/contract |
| STRUCTURAL — separare bootstrap context dal first-render contract | Waterfall provider osservato staticamente | Può ridurre pre-request wait | Alto | Alto: subject/account safety |
| STRUCTURAL — ridurre o segmentare payload Calendar/Dashboard | Candidate payload grandi, non ancora misurati | Riduce transfer/parse/render se confermato | Alto | Alto: API contract/business rules |

## 16. Redis assessment

**NOT NEEDED**.

Le misurazioni runtime non dimostrano ancora che il first load sia dominato da un dato condivisibile e cacheabile server-side. Inoltre:

- account e subject cambiano lo scope autorizzativo;
- Dashboard/Administration/alerts hanno contratti sovrapposti ma non identici;
- Calendar e Messages dipendono da membership, permessi, attendance/read state e freshness;
- la cache client in-memory è già stata introdotta per il ritorno tra route;
- Redis non ridurrebbe il pre-request context waterfall;
- Redis non sostituisce EXPLAIN né risolve automaticamente payload e render.

Redis potrebbe essere rivalutato solo dopo misure che mostrino un handler server ripetuto, costoso, deterministico e sicuro da cacheare per account/subject, con TTL e invalidazione espliciti. Al momento non è giustificato proporre un endpoint o TTL concreti.

## 17. Recommended implementation order

1. Raccogliere un dataset preview autenticato per cold load e warm first-page load.
2. Compilare la tabella metrica per Dashboard, Calendar, Messages, Administration e Profile.
3. Separare per endpoint pre-request wait, TTFB, Server-Timing, bytes e first useful render.
4. Verificare EXPLAIN solo sui candidati indicati e solo in staging.
5. Scegliere una singola ottimizzazione basata sul bottleneck misurato.
6. Solo dopo rivalutare payload split, parallelismo, DB tuning o eventuale caching server.

## Summary table

| Page | Pre-request | API | Payload | Client/render | Total | Primary bottleneck |
|---|---:|---:|---:|---:|---:|---|
| Dashboard / Oggi | NOT MEASURED | 4.259–4.296 s | 12,348 B | NOT MEASURED | 4.259–4.296 s API | SERVER_SUBJECT_CONTEXT |
| Calendar | NOT MEASURED | 3.886 s | 112,447 B | NOT MEASURED | 3.886 s API | SERVER_HANDLER / PAYLOAD_SIZE |
| Messages | NOT MEASURED | 2.245–2.581 s list; 3.462 s full | 8,082 B list; 941 B full | NOT MEASURED | same as API | SERVER_SUBJECT_CONTEXT / ENRICHMENT |
| Administration / Fees | NOT MEASURED | 2.189 s | 2,259 B | NOT MEASURED | 2.189 s API | SERVER_SUBJECT_CONTEXT |
| Profile | NOT MEASURED | 2.935 s | 729 B | NOT MEASURED | 2.935 s API | SERVER_SUBJECT_CONTEXT candidate |
| Campionati | NOT MEASURED | 2.425–2.577 s | 918–9,008 B | NOT MEASURED | same as API | subject/context; breakdown newly added |

## TOP 5 BOTTLENECKS

1. `SERVER_SUBJECT_CONTEXT` fino a 1,46 s, separato dal client waterfall.
2. `dashboard-enrichment` fino a 1,22 s.
3. `messages-enrichment` full 819 ms e recipients discovery nella lista.
4. Calendar handler 3,886 s con payload JSON 112 KB.
5. `/api/me/accessible-profiles` ripetuto 17 volte, con burst concorrenti e 1,02–1,79 s per request.

## TOP 5 QUICK WINS

1. Raccogliere cold/warm traces con le variabili diagnostiche abilitate.
2. Esportare Network response size e Server-Timing per una sessione con dataset piccolo e una con dataset grande.
3. Confrontare `query-enabled` con `query-fetch-start` per distinguere provider waterfall da API latency.
4. Misurare separatamente Dashboard principale, Dashboard alerts e unread badge.
5. Eseguire EXPLAIN staging sulle query candidate prima di dichiarare problemi di indice.

## Instrumentation left for preview

Files/areas:

- `src/server/performance/request-timing.ts` — Server-Timing/log JSON opt-in;
- `src/app/api/me/accessible-profiles/route.ts` — bootstrap context phases;
- `src/app/api/athlete/profile/route.ts` — profile phases;
- `src/app/api/athlete/calendar/route.ts` — calendar DB/transform phases;
- `src/app/api/athlete/championships/route.ts` — catalog/group/convocation phases;
- `src/app/api/athlete/events/detail/route.ts` — event authorization/enrichment phases;
- `src/server/auth/require-subject-profile.ts` — granular server subject-context phases;
- `src/lib/performance/athlete-first-load.ts` — client timing;
- athlete query modules and managers — query start/response/parsed/first useful render.

To remove after data collection, remove the diagnostic imports/calls and the helper only; do not remove the functional query or provider code. The server instrumentation is already guarded by environment flag and can remain dormant without changing normal behavior.

## Optimization 1 — Server Subject Context

### Baseline ufficiale

La baseline pre-ottimizzazione è il file immutato `docs/PRE-GOALS granular baseline`. Sui 14 request con `subject-context` misurato, il percorso aveva:

| Phase | Media | Mediana | Min | Max |
|---|---:|---:|---:|---:|
| `account-context` | 639,19 ms | 581,62 ms | 400,52 ms | 939,25 ms |
| `subject-resolution` | 0,05 ms | 0,02 ms | 0,01 ms | 0,35 ms |
| `athlete-profile` | 286,86 ms | 318,32 ms | 132,87 ms | 370,01 ms |
| `active-season` | 220,21 ms | 218,92 ms | 115,69 ms | 345,70 ms |
| `season-membership` | 272,36 ms | 309,55 ms | 115,77 ms | 322,02 ms |
| `active-season-teams` | 455,46 ms | 441,48 ms | 230,62 ms | 698,23 ms |
| `subject-context` | 1.874,17 ms | 1.837,34 ms | 1.211,03 ms | 2.643,90 ms |

`subject-resolution` resta intenzionalmente non ottimizzato: nella baseline è trascurabile.

### Causa trovata e dipendenze reali

Il grafo precedente era:

```text
account-context
  → subject-resolution
    → athlete-profile → active-season → season-membership → active-season-teams
```

Le dipendenze reali sono ora:

```text
account-context → subject-resolution
                         ├─ athlete-profile ─┐
                         └─ active-season ───┴─┬─ season-membership ─┐
                                               └─ active-season-teams ┴→ subject-context
```

In particolare, `athlete-profile` non dipende dalla stagione, e `season-membership` e `active-season-teams` dipendono entrambi solo dall'ID della stagione. Anche `app_accounts` e `account_roles` dipendono solo dall'utente autenticato e vengono quindi letti in parallelo dopo `auth.getUser()`.

### Query prima/dopo

| Area | Prima | Dopo |
|---|---|---|
| Account | `auth.getUser()` → `app_accounts` → `account_roles` seriali | `auth.getUser()` → `app_accounts` + `account_roles` parallele |
| Subject self | `athlete_profiles`, stagione, `season_profiles`, `activities`, `teams` seriali | `athlete_profiles` + stagione parallele; `season_profiles` + team IDs parallele |
| Active-season teams atleta | `activities.select('id')` → `teams.select('id').in('activity_id', ...)` | Il resolver atleta usa l'opzione esplicita `filterBySeasonRelation`: una query `teams.select('id, activities!inner(season_id)').eq('activities.season_id', ...)`; gli altri consumer mantengono il percorso legacy |
| Subject delegato | relationship, profile e override già parallele | invariato; le verifiche di relationship/permission restano obbligatorie |

Per il percorso self il numero di operazioni server passa da 8 a 7: viene eliminato il round-trip separato su `activities`. Per un subject delegato passa da 11 a 10; le tre query di risoluzione delegata restano tre query parallele. L'opzione è esplicita e confinata al resolver atleta, così i consumer coach/admin del helper condiviso conservano il comportamento precedente. Il numero di chiamate non è stato ridotto artificialmente fondendo controlli autorizzativi non equivalenti.

### Parallelismo e sicurezza

- `MUST_BE_SEQUENTIAL`: autenticazione → account/ruoli; account → subject resolution; stagione → membership/team IDs.
- `CAN_RUN_IN_PARALLEL`: account e ruoli dopo l'utente; profilo atleta e stagione; membership e team IDs dopo la stagione.
- La query embedded sui team filtra la relazione FK `teams.activity_id → activities.id` per la stagione richiesta; non aggiunge team né modifica il set autorizzato.
- Restano invariati account isolation, subject personale/delegato, relazione attiva, permission, ruolo atleta, stagione attiva, membership stagionale e semantica 401/403/404.
- Non è stato introdotto caching cross-request, Redis, storage client, schema change, indice, modifica RLS o modifica di contratto API.

### Instrumentation e confronto finale

Sono mantenuti senza rinomina `account-context`, `subject-resolution`, `athlete-profile`, `active-season`, `season-membership`, `active-season-teams`, `subject-context` e `route-total`. Il codice non dichiara valori post-ottimizzazione: per confermare il guadagno serve un HAR finale da preview autenticata confrontato con `PRE-GOALS granular baseline`. In particolare vanno verificati durata media/mediana di `account-context`, `active-season-teams` e `subject-context`, oltre all'assenza di regressioni 401/403/404.

## Optimization 2 — Accessible profiles refresh ownership

### Scope e baseline

Il file read-only `docs/PRE-GOALS granular baseline` è stato analizzato senza modificarlo. La baseline allegata contiene quattro request a `/api/me/accessible-profiles`, di cui due praticamente concorrenti all'avvio; l'audit storico documenta inoltre una sessione precedente con fino a 17 request. Il goal corrente interviene esclusivamente sul client provider e sui test del provider: non modifica endpoint, autorizzazione, database, selected subject UX, TeamProvider o persistenza.

### Mappa dei trigger

| Trigger | Comportamento | Coordinator | Stato locale |
|---|---|---|---|
| mount / auth ready / account ready | fetch quando auth e account sono pronti; il cambio di `authLoading`, account ID o user ID riattiva il bootstrap | sì, chiave account-aware | aggiorna profiles, loading, error e `profilesLoaded` |
| ricreazione callback/auth object | nessun fetch se account ID e user ID restano invariati | non applicabile | nessun cambiamento |
| focus / `visibilitychange` | refresh solo con document visibile e account attivo | sì, stessa chiave del bootstrap; concorrenza e burst ravvicinati sono coalescati | aggiorna solo dopo una risposta valida |
| subject change | nessun fetch automatico | non applicabile | valida la selezione contro la lista corrente |
| logout | nessun endpoint; pulisce profiles e subject locale quando la sessione non è più presente | chiave `anonymous`, senza request | reset di profiles, selected profile e area personale |
| login / cambio account | nuovo bootstrap per il nuovo account | sì, nuova chiave account | la risposta del vecchio account non può sovrascrivere il nuovo stato |
| refresh esplicito | nuova verifica anche entro la finestra di freshness | sì, `force=true` | consente di rilevare revoche e aggiornare permissions |

### Implementazione

- Il fetch iniziale passa ora da `runClientRefresh`, come focus e visibility; non esiste più un initial fetch diretto fuori dal coordinator.
- La callback di esecuzione legge account/sessione da un ref aggiornato a ogni render, quindi la ricreazione degli oggetti auth non riattiva l'effect. L'effect dipende soltanto dagli identificativi semantici (`accountId`, `userId`, `authLoading`).
- Focus e `visibilitychange` usano listener stabili e la stessa chiave `accessible-profiles:<authUserId>`. Il coordinator mantiene coalescing della request in-flight e freshness di 1,5 secondi per il doppio evento ravvicinato.
- Le risposte vengono applicate solo se account e user ID sono ancora quelli che hanno iniziato la request; un cambio account o logout non può far ricomparire dati dell'account precedente.
- Restano invariati `accessible-profiles-fetch-start` e `accessible-profiles-response`, con source `initial-effect` e `focus-visibility`; il refresh esplicito conserva la label `initial-effect` per mantenere confrontabile il conteggio HAR.

### Verifica

Sono stati aggiunti test per bootstrap singolo, focus + visibility concorrenti, rerender con identità auth ricreate, cambio account, logout e revoca delegated rilevata da refresh esplicito. La riduzione runtime effettiva deve essere confermata con un nuovo HAR autenticato: questa modifica non dichiara un miglioramento numerico senza una nuova misura.

## Optimization 3 — Dashboard Server

### Baseline ufficiale

Il baseline read-only è `docs/PRE-GOALS granular baseline`. I valori indicati nel goal sono:

| Phase | Dashboard sample 1 | Dashboard sample 2 |
|---|---:|---:|
| API total | ~5,41 s | ~7,50 s |
| `subject-context` | ~1,71 s | ~2,64 s |
| `dashboard-enrichment` | ~1,43 s | ~1,38 s |
| `dashboard-messages` | non dominante | ~1,00 s |
| `events` | ~768 ms | non dominante |
| response payload | ~12 KB | ~12 KB |
| `dashboard-response-transform` | ~0,25–0,82 ms | ~0,25–0,82 ms |

Il transform JavaScript non è il bottleneck misurato. Il baseline non è stato modificato.

### Query prima/dopo

Prima del goal, dopo il catalogo, il route handler eseguiva la query events e attendeva il risultato prima di avviare activities, gyms, attendance, attendance availability e championship match. Nel ramo messaggi, recipients, creator profiles e read-state erano sequenziali.

Ora:

- recipients resta sequenziale rispetto alle memberships perché i filtri includono gli ID dei team autorizzati;
- creator profiles e read-state partono in parallelo dopo che recipients ha restituito message IDs e creator IDs;
- la query events parte dopo event-team links, mentre activities, attendance availability e next championship match partono immediatamente in parallelo;
- gyms e `event_attendances` partono appena sono disponibili gli event rows, in parallelo tra loro;
- event-team links seleziona solo `event_id, team_id`; l'ordinamento `created_at` e il limite 500 restano invariati;
- event IDs sono deduplicati prima del fetch e i batch da 100 vengono eseguiti in parallelo, mantenendo il limite 10 per batch e il successivo `slice(0, 10)` del contratto.

### Parallelismo e dipendenze

```text
subject-context
  → memberships + fees
    → recipients
      → creators + read-state
    → team catalog
      → event-team IDs
        → events → gyms + attendance rows
      → activities
      → attendance availability
      → next championship match
```

`MUST_BE_SEQUENTIAL`: subject-context → memberships/fees → recipients; team catalog → event-team IDs → events; events → gyms/attendance rows. `CAN_RUN_IN_PARALLEL`: memberships e fees; creators e read-state; activities, events, attendance availability e championship match dopo il catalogo; gyms e attendance rows dopo gli events.

### Early exits e sicurezza

L'uscita anticipata esistente per zero team resta invariata: dopo il caricamento dei messaggi diretti, non vengono interrogati catalogo, eventi, activities, gyms, attendance o championship. Restano anche i no-op per zero event IDs, zero activity IDs, zero club-team IDs e zero event rows. Non sono state modificate autorizzazioni, `requireSubjectAthleteContext`, client subject-aware, RLS o response contract. I casi delegated subject, attendance, fees, championship e next match continuano a usare gli stessi dati e le stesse regole.

### Server-Timing

Sono mantenute senza rinomina le metriche esistenti `dashboard-messages`, `dashboard-enrichment`, `events`, `route-total` e le sottofasi `dashboard-message-recipients`, `dashboard-message-creators`, `dashboard-message-read-state`, `dashboard-message-transform`, `dashboard-enrichment-queries` e `dashboard-response-transform`. La semantica dei tempi ora riflette il parallelismo: le fasi aggregate misurano il completamento del gruppo, mentre le sottofasi misurano la rispettiva query.

### Verifica e metriche finali

Verificati localmente:

- `npx tsc --noEmit` — passato;
- `npx eslint src/app/api/athlete/dashboard/route.ts` — passato;
- `npx jest --runInBand src/app/api/athlete/dashboard/route.test.ts src/lib/athlete/dashboard-contract.test.ts` — 12 test passati;
- `git diff --check` — passato.

Un nuovo HAR autenticato non è disponibile in questa sessione, quindi le metriche finali non vengono dichiarate: `dashboard total`, `dashboard-enrichment`, `dashboard-messages`, `events` e `subject-context` sono `NOT MEASURED`. Il confronto runtime deve essere fatto contro `PRE-GOALS granular baseline`, con verifica dei casi teams/zero teams, messaggi presenti/assenti, eventi presenti/assenti, attendance, quote, championship, next match e delegated subject.

## Optimization 4 — Athlete Messages Server

### Baseline ufficiale

Il baseline read-only è `docs/PRE-GOALS granular baseline` e non è stato modificato.

| Request | API total | `subject-context` | `messages-enrichment` | Note |
|---|---:|---:|---:|---|
| minimal | ~3,46 s | ~2,16 s | ~567 ms | transform ~0,02–0,06 ms |
| full detail | ~3,40–4,07 s | ~1,58–1,74 s | ~0,94–1,47 s | payload full molto piccolo |

Il costo del transform JavaScript è irrilevante rispetto al contesto server e alle query del route handler.

### Recipients discovery

La discovery iniziale continua a usare il filtro autorizzativo diretto oppure team autorizzato e mantiene l'ordinamento `created_at DESC`. Per la lista minimal non viene applicato un limite arbitrario alle righe recipient prima di conoscere i messaggi: il limite è sui messaggi ordinati per `messages.created_at`, quindi limitare i recipient cambierebbe la semantica quando esistono più recipient per messaggio.

Per un deep link full con `id`, la discovery ora aggiunge `message_id = id` alla stessa OR autorizzativa. In questo caso il dataset viene ridotto prima della validazione 404 e non vengono scoperti i recipient dell'intero account.

La query mantiene solo le colonne necessarie alla risposta e al filtro (`id`, `message_id`, `team_id`, `profile_id`). La precedente seconda query full includeva anche `is_read` e `read_at`, ma quei valori non erano usati: il read state atleta resta derivato da `message_reads` account + subject.

### Query prima/dopo

Prima:

```text
subject-context
  → team_memberships
    → tutti i message_recipients visibili
      → messages (limit solo dopo la discovery)
        → read-state + team catalog
          → creator profiles
          → full: nuovo message_recipients per gli stessi message IDs
            → recipient catalog
              → attachment metadata
```

Dopo:

```text
subject-context
  → team_memberships
    → recipient discovery (message-id scoped for full deep link)
      → messages (limit invariato per minimal)
        ├─ read-state
        ├─ team catalog
        ├─ creator profiles
        └─ full: attachment metadata
            → full recipient catalog (solo dopo gli ID/rows necessari)
              → normalization
```

Nel full la discovery già filtrata per subject/team viene riusata per i messaggi caricati; è stato eliminato il round-trip duplicato `message_recipients IN (message_ids)`. La visibilità delegated resta filtrata esplicitamente prima del catalogo, perché il `dataClient` delegated è admin e non applica RLS sulle righe recipient.

### Parallelismo

Possono partire insieme dopo `messages`:

- `message_reads` per account + subject;
- catalogo teams usato dalla lista/contract;
- creator profiles;
- attachment metadata full.

Restano sequenziali per dipendenza reale:

- subject context → memberships → recipient discovery;
- recipient rows/messages → recipient team/profile catalog;
- catalogo/rows → normalization finale.

Non sono state parallelizzate query che richiedono l'autorizzazione del subject prima di essere eseguite.

### CountOnly, read behavior e attachments

`countOnly=1` continua a leggere solo recipient message IDs e `message_reads`; non carica body, creator, cataloghi o attachment metadata. Il contatore resta basato sulla coppia account + subject.

La sincronizzazione read non cambia: message unread → mutation read → lista/detail/count aggiornati tramite il flusso client esistente; un messaggio già letto non viene decrementato due volte. Gli attachment restano metadata-only nel list/detail e il binary/download URL continua a essere ottenuto on-demand dall'endpoint dedicato subject-authorized.

### Server-Timing

Restano confrontabili le metriche richieste `subject-context`, `team-memberships`/`memberships`, `message-recipients`, `messages-query`, `message-read-state`, `messages-enrichment` e `route-total`. Sono mantenute anche le metriche di dettaglio creator, recipient catalog, attachments e transform; il loro tempo ora riflette il fan-out concorrente dove applicabile.

### Verifica e metriche HAR finale

Verificati localmente:

- `npx tsc --noEmit` — passato;
- `npx eslint src/app/api/athlete/messages/route.ts src/app/api/athlete/messages/route.test.ts src/lib/athlete/messages-contract.ts` — passato;
- test route Messages countOnly/minimal/full/not-found, delegated filtering, denied e attachment metadata — 5 passati;
- `src/lib/athlete/messages-contract.test.ts`, `AthleteMessagesManager.test.tsx`, `MessageDetailModal.test.tsx` — 14 passati;
- `git diff --check` — passato.

Un nuovo HAR autenticato non è disponibile in questa sessione: le metriche post-ottimizzazione restano `NOT MEASURED` e devono essere confrontate direttamente con `PRE-GOALS granular baseline` per:

| Metriche HAR finale | Stato |
|---|---|
| minimal total | NOT MEASURED |
| full total | NOT MEASURED |
| `message-recipients` / recipients | NOT MEASURED |
| `messages-enrichment` | NOT MEASURED |
| `subject-context` | NOT MEASURED |

La verifica runtime deve includere self, delegated, denied, messaggio non accessibile, team recipient, direct profile recipient, countOnly, read/unread e detail con attachment.

## Optimization 5 — Calendar and Attendance Availability

### Baseline ufficiale

Il baseline read-only è `docs/PRE-GOALS granular baseline` e non è stato modificato.

| Request | API total | `subject-context` | `attendance-availability` | `events` | `event-team-relations` | `teams` | `attendance` | payload |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Calendar | ~5,30 s | ~2,19 s | ~982 ms | ~738 ms | ~361 ms | ~306 ms | ~133 ms | ~112 KB |
| Event Detail | ~5,91 s | ~1,94 s | ~1,56 s | — | — | — | — | — |

Il transform (`~0,54 ms`) non è un hotspot. `attendance-availability` era il flow condiviso dominante: dopo avere già caricato il dataset, Calendar lo rileggeva tramite membership, `event_teams`, `events` e `event_attendances`.

### Implementazione

Calendar ora:

- avvia `teams` ed `event-team-relations` in parallelo dopo la membership autorizzata;
- mantiene batching a 100 per le relazioni e deduplica gli event ID prima del fetch;
- avvia `events` e `event_attendances` in parallelo;
- mantiene batching a 100 per gli eventi oltre la soglia;
- passa a `resolveAttendanceAvailability` un seed request-local con team autorizzati, eventi, relazioni e attendance già caricati.

Il resolver conserva il rebuild completo di `buildAttendanceAvailability`, quindi restano invariate permission, early absence, next-event selection e `next_recalculation_at`. Il seed non è una cache cross-request e non sostituisce le verifiche server-side.

Event Detail ora riusa il risultato della membership già verificata per evitare la membership query duplicata del resolver. Il fan-out di gym, team, creator e attendance è concorrente. Il percorso detail riusa inoltre, request-scoped, l'evento e l'attendance già caricati: il resolver carica soltanto gli eventi circostanti necessari per mantenere la regola del prossimo evento e non rilegge l'evento aperto né la sua attendance. Il set autorizzato e la selezione del prossimo evento restano invariati.

### Query e round-trip prima/dopo

| Flow | Prima | Dopo |
|---|---|---|
| Calendar availability | 4 query duplicate: membership, event links, events, attendance | 0 query aggiuntive; rebuild in memoria sul seed della request |
| Calendar main pipeline | teams → relations; events → attendance separati | teams ∥ relations; events ∥ attendance |
| Event Detail availability | membership duplicata + event links + events + attendance | membership e attendance dell'evento aperto riusate; event links + soli eventi circostanti restano necessari per la regola globale del prossimo evento |
| Event Detail enrichment | gym → teams → creator → attendance sequenziali | gym ∥ teams ∥ creator ∥ attendance |

### Server-Timing e contratto

Restano invariate le label `subject-context`, `team-memberships`, `teams`, `event-team-relations`, `events`, `attendance`, `attendance-availability`, `transform` e `route-total`. Le fasi ora misurano anche i gruppi concorrenti, senza rinominare le metriche necessarie al confronto HAR.

Non sono stati introdotti range API, paginazione, lazy loading mensile, modifiche query key/staleTime, cache cross-request, schema/index/RLS changes o modifiche alle business rule. Il response contract Calendar e Event Detail resta invariato; `response_source` è usato internamente per availability e non viene esposto nel campo `my_attendance`.

### Verifica

Verificati localmente:

- `npx tsc --noEmit` — passato;
- ESLint sui route/helper/test modificati — passato;
- `npx jest --runInBand src/server/events/attendance-availability.test.ts src/app/api/athlete/events/detail/route.test.ts src/lib/athlete/calendar-contract.test.ts src/components/athlete/AthleteCalendarManager.test.tsx` — 22 test passati;
- `git diff --check` — passato.

Non è disponibile un HAR post-ottimizzazione in questa sessione. Le metriche finali da confrontare direttamente sono: Calendar total, `attendance-availability`, `events`, `event-team-relations`, `teams`, `attendance`, `subject-context`; Event Detail total, `attendance-availability`, enrichment e `subject-context`.

### DB candidate future

Nessun EXPLAIN è stato eseguito: dopo la deduplicazione del flow non c'è evidenza sufficiente per introdurre un indice senza una nuova misura staging. Se il tempo resta dominante nel prossimo HAR, analizzare con SELECT-only `EXPLAIN (ANALYZE, BUFFERS)` le query `requireSubjectAthleteContext`, `event_teams` per team autorizzati ed `events` per event ID.

## Optimization 6 — Dashboard enrichment orchestration

### Baseline e diagnosi

Il baseline HAR `docs/PRE-GOALS granular baseline` / `docs/POST-GOALS granular baseline` è stato trattato come read-only. Nel POST `dashboard-enrichment` varia da circa 0,89 s a 1,58 s. Il codice mostrava che `resolveAttendanceAvailability` rileggeva, in sequenza, membership, `event_teams`, eventi e presenze, mentre il Dashboard aveva già caricato gli stessi dati o i relativi ID.

### Implementazione

Il Dashboard ora:

- misura separatamente `activities`, `gyms`, `event-attendance`, `attendance-availability` e `championship-match`, mantenendo `dashboard-enrichment` e `dashboard-enrichment-queries` per il confronto HAR;
- registra nel log diagnostico tecnico i conteggi non sensibili di membership, cataloghi, eventi, palestre, presenze e dati messaggi;
- riusa un seed request-local per `resolveAttendanceAvailability`, costruito da membership autorizzate, relazioni evento, eventi e presenze già lette;
- carica l’intero set futuro collegato necessario alla regola del prossimo evento prima del seed, senza limitare artificialmente `event_teams` a 500 righe;
- mantiene i rami indipendenti in parallelo: activities, eventi/palestre/presenze, availability e championship match.

Non sono state introdotte cache cross-request, modifiche a RLS/schema/indici, cambiamenti al subject-context o modifiche al response contract Dashboard. `response_source` è usato internamente per preservare le regole di availability e non cambia il campo pubblico `my_attendance`.

### Verifica

Verificati localmente:

- `npx tsc --noEmit` — passato;
- test Dashboard route e attendance availability — 11 passati;
- `git diff --check` — passato.

Un nuovo HAR post-modifica è ancora necessario per misurare la riduzione effettiva e la variabilità di `dashboard-enrichment`. Il prossimo campionamento deve includere: atleta con più team, nessun team, events sì/no, messages sì/no, attendance, championship e fees, verificando anche i dettagli `Server-Timing` e i conteggi diagnostici.

## Optimization 8 — Athlete Profile Pipeline

### Baseline e dependency graph

I baseline HAR `docs/PRE-GOALS granular baseline` e `docs/POST-GOALS granular baseline` sono stati usati in sola lettura. Il campione POST di riferimento per `/api/athlete/profile` misura:

| Fase | Durata POST round 1 |
|---|---:|
| `subject-context` | ~987 ms |
| `profile-athlete-memberships` | ~314 ms |
| `teams` | ~310 ms |
| `activities` | ~306 ms |
| `documents` | ~320 ms |
| `route-total` | ~2,24 s |

Il payload è inferiore a 1 KB. Il percorso prima della modifica era:

```text
subject-context
  → profiles ∥ athlete_profiles ∥ team_members
    → teams
      → activities
        → personal documents ∥ team documents
          → response transform
```

Dipendenze effettive e campi usati:

| Fase | Input | Query / SELECT | Output usato dopo |
|---|---|---|---|
| Profile | `subject.profileId` | `profiles`: `id, first_name, last_name, email, phone, birth_date` | subject response |
| Athlete profile | `subject.profileId` | `athlete_profiles`: `profile_id, membership_number, medical_certificate_expiry` | membership number, medical status |
| Memberships | `subject.profileId`, `activeTeamIds` | `team_members`: `id, team_id, jersey_number` | team IDs, jersey number |
| Teams | deduplicated membership team IDs | `teams`: `id, name, code, activity_id` | team response, activity IDs, document team IDs |
| Activities | deduplicated team activity IDs | `activities`: `id, name` | membership response |
| Documents | subject profile ID and team IDs; permission `view_documents` | `documents`: `id, title, status, file_name, created_at`, status `generated/sent` | document metadata response |

`subject-context` continua a fornire autorizzazione, active season e active team IDs, ma non il catalogo completo di `teams`/`activities` richiesto dal response contract. Non è stata duplicata né ampliata la query del resolver per tutte le altre route.

### Implementazione e dependency graph dopo

Il route handler mantiene in parallelo le tre query base. Dopo la loro conclusione, il documento personale — che richiede soltanto profile ID e `view_documents` — viene avviato prima della query teams. Dopo `teams`, `activities` e documenti-team partono insieme:

```text
subject-context
  → profiles ∥ athlete_profiles ∥ team_members
    → personal documents ────────────────┐
    → teams                               │
      → activities ∥ team documents ─────┴→ response transform
```

La query `documents` resta condizionata da `view_documents`; i documenti personali e team sono ancora uniti e deduplicati per `document.id`. Le permission, il data client delegated e i filtri di stato non sono cambiati.

La trasformazione del contract resta sincrona e non è stata ottimizzata: il payload è piccolo e il costo non è indicato come hotspot nei baseline. `push/device state` resta completamente fuori dal server handler e invariato.

### Query eliminate, request-scoped reuse e sicurezza

- Non sono state eliminate query necessarie al contract: `teams` e `activities` contengono campi non presenti nel solo subject context ma richiesti dalla pagina.
- Non sono state introdotte cache cross-request o modifiche a schema, indici, RLS, API contract, client AthleteProfileManager o staleTime.
- Non è stato aggiunto request-scoped reuse dal subject context perché il resolver non possiede le righe complete di teams/activities e renderlo più pesante avrebbe penalizzato tutte le route.
- È stato eliminato il vincolo seriale artificiale `activities → documents`; il documento personale può sovrapporsi alla risoluzione teams e documenti-team può sovrapporsi ad activities.
- Per un subject delegato i documenti continuano a essere letti con il client/autorizzazione già stabiliti dal context; i metadata sono restituiti solo quando `view_documents` è concesso.

### Server-Timing e verifica

Restano le label confrontabili `subject-context`, `profile-athlete-memberships`, `teams`, `activities`, `documents` e `route-total`. Dopo questa modifica, le durate delle fasi possono sovrapporsi: la somma delle fasi non rappresenta il critical path. Il prossimo HAR deve quindi confrontare sia `route-total` sia le singole durate e la loro sovrapposizione.

Verificati localmente:

- `npm exec tsc -- --noEmit` — passato;
- `npm run lint` — passato, nessun warning/error ESLint;
- `npm test -- --runInBand src/app/api/athlete/profile/route.test.ts src/server/profile/athlete-profile.test.ts` — 6 test passati;
- `git diff --check` — passato.

Il nuovo HAR autenticato non è stato generato in questa sessione. Il prossimo campionamento deve includere self athlete, subject delegato, più team, zero team, attività presenti/assenti, nessun documento, documenti personali, documenti team e permission `view_documents` negata, verificando:

| Metriche HAR finale | Stato |
|---|---|
| Profile API total | DA MISURARE |
| `route-total` | DA MISURARE |
| `subject-context` | DA MISURARE / invariato rispetto al goal precedente |
| `profile-athlete-memberships` | DA MISURARE |
| `teams` | DA MISURARE |
| `activities` | DA MISURARE |
| `documents` | DA MISURARE |
