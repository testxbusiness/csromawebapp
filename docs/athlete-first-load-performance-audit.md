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
