# Sentry Fase 1 — verifica di prontezza Production

Data: 2 novembre 2026
Branch: `feat/sentry-observability`
Ambito: sola copertura Sentry Fase 1; nessun accesso o modifica a Supabase, Vercel o alle regole live Sentry.

## 1. Riepilogo

La build, TypeScript, ESLint e i test mirati delle utility Sentry passano. La verifica con un client Supabase reale e strumentato ha confermato che il precedente percorso poteva duplicare un errore PostgREST: l’SDK inviava l’evento prima che il risultato `{ error }` arrivasse al codice applicativo, che poi richiamava l’helper.

La doppia cattura è stata corretta con ownership esplicita e testata: l’SDK possiede gli errori PostgREST e i metodi Auth che strumenta; l’helper resta per le API non coperte (`rpc`, `getSession`/`getUser`, Storage). Gli scope dei Route Handler aggiungono ai relativi eventi i tag statici `feature`, `operation`, `runtime`. I test verificano un evento inatteso, zero eventi per conflitto e successo, privacy, tracing e risposta del vero Route Handler login.

Inoltre, la verifica live Browser/Preview/Debug ID non è stata ripetuta: l’ambiente locale non contiene DSN o credenziali Sentry. L’audit precedente (`docs/sentry-coverage-audit.md`, 1 novembre) documenta un mapping positivo Preview per Node/server al file TypeScript, ma non prova il browser né questa build.

## 2. Matrice dei test

| Verifica | Esito | Evidenza / limite |
| --- | --- | --- |
| `npm run build` | PASS | Build Next.js 15 completata, incluse validazione tipi e generazione delle pagine. Nessuna credenziale Sentry locale: non prova upload delle source map. |
| `npx tsc --noEmit` | PASS | Eseguito dopo la generazione `.next` della build. |
| `npm run lint` | PASS | `next lint`: nessun warning o errore ESLint; il comando avvisa che `next lint` è deprecato in Next.js 16. |
| Test utilità Sentry | PASS | `npm test -- --runInBand src/lib/sentry`: 3 suite, 22 test superati. |
| Test mirati handler e Sentry | FAIL preesistente | 8 suite passate, 1 fallita; 41 test passati, 2 falliti. In `src/app/api/coach/championships/mutations/route.test.ts`, atteso 403/400 ma ricevuto 500. Non sono stati modificati i rami business coach. |
| Cattura di un `{ error }` Supabase | PASS | Test con client Supabase reale, instrumentation SDK reale, risposta HTTP simulata e transport Sentry locale: un solo evento inatteso con tag e privacy. |
| Doppia cattura Supabase + helper manuale | PASS in test isolato | L’helper non ricattura gli errori SDK-owned; il test del vero Route Handler login verifica un solo evento. Fallback manuale solo per API non strumentate. |
| Errori previsti e HTTP 429 | PASS a livello unitario, NOT TESTED live | Coperti 401/403/422, conflitto SQL `23505`, `429`, rete e `AbortError`. Non è stata eseguita una prova con Supabase reale. |
| Cattura 5xx con risposta applicativa invariata | PASS su Route Handler | Il vero `POST /api/auth/login` mantiene `200`, `success: true`, `profile: null` con errore PostgREST; Sentry riceve un solo evento. |
| Fingerprint | PASS per la modifica locale | Rimosso fingerprint `['operational-error', feature, operation]`, che avrebbe accorpato errori tecnici diversi. Sentry usa il grouping predefinito basato anche sullo stack conservato. Nessun evento live esaminato. |
| Privacy eventi | PASS unitario / NOT TESTED live | Testano request, identità, payload, messaggio, tag, breadcrumb, contesti e frame data. Nessun evento live ispezionato in Sentry. |
| Duplicazione tra Query, frontend e server | NOT TESTED live | Il dedupe copre solo la stessa istanza errore nello stesso runtime. Non esclude duplicati fra errori ricostruiti dal client, SDK Supabase e server. |
| Source map Browser, Node, Preview e Debug ID | NOT TESTED in questa verifica | L’audit 1 novembre registra la prova Node/server Preview, inclusa risoluzione a `src/lib/sentry/preview-source-map-probe.ts`. Browser e Debug ID non sono stati provati qui. |
| Replay disabilitato | PASS da configurazione | `replaysSessionSampleRate: 0` e `replaysOnErrorSampleRate: 0` in `src/instrumentation-client.ts`. Da riconfermare nel progetto live. |
| Endpoint diagnostico pubblico persistente Sentry | PASS da ispezione del codice | Non è presente un endpoint diagnostico Sentry dedicato. Nessun endpoint di test è stato aggiunto. La route Admin `/api/admin/membership-fees/diagnostics` è preesistente e fuori ambito Sentry. |
| Regole Sentry live | NOT TESTED / non modificate | Non è stato effettuato accesso al progetto e non sono state create o cambiate regole. |

## 3. Evidenze e analisi tecnica

- Versioni verificate nel lock/runtime installato: `@sentry/nextjs` 11.10.0, `@sentry/core` 11.10.0, `@supabase/supabase-js` 2.56.0.
- Nel sorgente SDK `@sentry/core/.../integrations/supabase.js`, `instrumentSupabaseClient` installa wrapper per `SupabaseClient.from()` e per metodi Auth selezionati. Il wrapper PostgREST apre uno span, imposta il suo esito, e quando un risultato contiene `{ error }` costruisce un `Error` e chiama `captureException` con mechanism `auto.db.supabase.postgres`, quindi restituisce invariato il risultato al chiamante.
- Il wrapper Auth cattura sia errori restituiti nei risultati sia promise rifiutate, con mechanism `auto.db.supabase.auth`; poi restituisce il risultato o rilancia l’errore. Sono strumentati `reauthenticate`, `signInWithPassword`, `signOut`, gli altri metodi di login elencati dal SDK e i metodi Auth Admin `createUser`, `deleteUser`, `listUsers`, `getUserById`, `updateUserById`, `inviteUserByEmail`.
- Il wrapper PostgREST per promise rifiutate imposta errore sullo span e rilancia, ma non chiama `captureException`: qui l’eventuale catch Route Handler resta owner della cattura inattesa. Il SDK non avvolge `.rpc()`, `getSession`, `getUser`, né le chiamate Storage.
- Il repository conserva `instrumentSupabaseClient` per gli span e gli eventi automatici. `withSentryOperation` apre lo scope dell’handler asincrono con soli tag statici allowlistati (`feature`, `operation`, `runtime`), così l’evento SDK e le eventuali catture manuali hanno contesto funzionale corretto.
- `captureSupabaseError` richiede esplicitamente `sdkInstrumented`: con `true` è no-op e lascia l’evento al SDK; con `false` crea la cattura sanitizzata per RPC, `getSession`/`getUser` o Storage. Il booleano obbligatorio rende visibile l’ownership al call site.
- `runSdkOwnedOperation` è usato attorno alle promise Auth già strumentate che possono essere rilanciate. Marca l’istanza nel catch immediatamente successivo al wrapper SDK; il catch applicativo non produce una seconda cattura. Non è un fingerprint né un filtro globale.
- Per risultati Auth/PostgREST restituiti, i call site manuali ridondanti sono stati rimossi o diventano explicit no-op; per gli errori applicativi inattesi catturati nei catch, `captureUnexpectedServerError` mantiene messaggio statico, stack e tag. `onRequestError` resta owner soltanto per eccezioni che sfuggono al Route Handler. TanStack `QueryCache`/`MutationCache` catturano errori client delle request API; non sostituiscono l’ownership server del client Supabase.
- Le API RPC, `getSession`/`getUser` e Storage non coperte dall’SDK usano la cattura manuale, sempre nello scope route/client già taggato o con tag impostati dall’helper.
- Le catture manuali inviano un messaggio sintetico e conservano lo stack dell’`Error` originale quando disponibile.
- La precedente fingerprint per feature/operazione ignorava ogni differenza tecnica e creava bucket molto ampi. È stata rimossa; nessun fingerprint personalizzato resta nell’helper.
- Il grouping predefinito Sentry resta in uso: il test genera due errori tecnici distinti e verifica che nessun fingerprint globale li forzi nello stesso bucket.
- Query e Mutation Cache ricavano la feature dalla query/mutation key e classificano le mutazioni come `update`. Errori senza una feature riconosciuta non vengono catturati dal callback globale; query key/mutation key non sono state censite tutte in questa verifica.
- `statusOf` legge `status`, `statusCode` e `response.status`. Gestisce quindi gli errori HTTP 429 quando lo status è esposto in una di queste forme. Errori custom TanStack privi di questi campi non sono identificabili con certezza come 429: verificare gli errori concreti usati dai fetcher Fase 1 in Preview.
- Per errori Supabase SQL alcuni status HTTP non sono mantenuti dall’integrazione automatica; `beforeSend` ora considera anche i codici applicativi `P0001`, `23505`, `23514`, `22xxx`, `23xxx`, `PGRST116`, `PGRST301`, `42501`. La lista è intenzionalmente circoscritta, ma va confrontata con gli errori di dominio effettivamente attesi.

### Falsi positivi e condizioni previste

Il percorso helper esclude tutti gli status 4xx, inclusi credenziali errate, sessione/link scaduti, autorizzazione, validazione, conflitti e 429; esclude inoltre alcuni errori di rete e `AbortError`. Il sanitizzatore filtra analogamente gli eventi Supabase auto-catturati 4xx e i codici SQL applicativi indicati sopra.

Restano due limiti: il payload `Error` creato dall’instrumentation PostgREST non conserva sempre lo status HTTP, e gli errori “temporaneamente offline” possono arrivare in forme diverse dai messaggi/codici riconosciuti. Non escludere ogni errore di rete genericamente senza verificare il tipo; la disponibilità intermittente può essere utile come segnale di sistema. Password errata e trasporto Auth retryable sono stati simulati con il client strumentato; link scaduti, sessione scaduta e HTTP 429 non sono stati provati su Supabase live.

### Privacy

`sanitizeSentryEvent` rimuove `user`, `request`, `server_name`, `extra`, `transaction` e breadcrumbs; converte messaggi e valori eccezione in testo statico; conserva solo tag e valori allowlistati; rimuove gli altri contesti; mantiene nel contesto trace solo correlatori e campi statici ammessi (`trace_id`, `span_id`, `parent_span_id`, `op`, `status`, `origin`). Nei frame elimina variabili, righe sorgente e `abs_path`, lasciando `filename` per mantenere il mapping delle source map. La configurazione SDK disabilita user info, cookie, header, body, query parameter, dati query DB e variabili stack-frame; Replay è a zero.

Verifica automatica: i test controllano le forme rappresentate nelle fixture, non ogni possibile serializzazione SDK (attachment, profili trace/span, eventi già serializzati, nome file). La presenza di `filename` è necessaria al mapping ma non è stata verificata con eventi live. Esito privacy complessivo: positivo sui campi trattati, da confermare con l’ispezione di un evento reale Preview prima del GO.

## 4. Analisi dei due test coach

I fallimenti sono:

1. match assegnato a un’altra squadra coach: atteso 403, ricevuto 500;
2. creazione gruppo senza squadra assegnata esplicitamente: atteso 400, ricevuto 500.

Entrambi si trovano in `src/app/api/coach/championships/mutations/route.test.ts` e sono gli stessi test richiamati come preesistenti nel testo di consegna. Le modifiche correnti al Route Handler aggiungono solo lo scope Sentry con tag allowlistati; i due risultati attesi dal test non sono stati cambiati. Non ho corretto il setup stagione né modificato le logiche coach, perché fuori perimetro. I test restano un fallimento preesistente/non attribuito a questo obiettivo e devono essere risolti o spiegati separatamente.

## 5. Verifiche manuali Preview

Eseguire solo dopo aver verificato che `NEXT_PUBLIC_SUPABASE_URL` e le credenziali Preview puntino a un progetto Supabase non Production. Non inserire dati reali né effettuare scritture di test.

1. Pubblicare una Preview approvata con variabili Sentry Preview e release associata al commit; non promuoverla a Production.
2. Nel browser Preview, generare un errore non gestito dalla console: `setTimeout(() => { throw new Error('sentry-preview-browser-check') }, 0)`. Verificare un evento in ambiente `preview`, senza Replay e senza dati personali, con stack riconducibile al sorgente TypeScript.
3. Usare la funzione Sentry `Capture an error`/prova evento disponibile nel pannello solo come verifica di configurazione; non usarla come prova del Route Handler applicativo.
4. Il test locale del vero Route Handler login è in `src/lib/sentry/supabase-ownership.test.ts`; non serve aggiungere un endpoint diagnostico. Per Preview, usare solo operazioni senza scritture.
5. Eseguire in Preview solo operazioni senza scritture: login con password errata, link di recupero scaduto già disponibile e sessione scaduta. Non generare 429 artificialmente tramite richieste massive; testarlo con mock. Accertare assenza di issue operative.
6. Per rete/abort e 429, usare test Jest o harness browser locale con errori controllati; controllare l’estrazione di `response.status`, `statusCode` e `status` usata dai fetcher reali.
7. Aprire gli eventi Browser e Node in Sentry: controllare `environment`, `release`, tag, fingerprint/grouping, request/contexts/breadcrumbs/exception, frame `filename` e Debug ID. Confermare il mapping a `.ts` nella release Preview e che Browser e Node usino la stessa release attesa.
8. Verificare nell’interfaccia Replay che non venga creato alcun replay per la prova browser.
9. Confermare che Preview abbia DSN/environment separati logicamente da Production e che il deployment Preview non punti a Supabase Production. Nessuna modifica alle variabili è stata fatta da questo audit.

## 6. Configurazione iniziale alert Production

Configurare nel pannello Sentry dopo aver confermato i tag realmente presenti. Non ho creato o modificato regole live.

**Alert 1 — Errori critici**

- Tipo: Issue Alert, trigger “A new issue is created”.
- Filtri tutti: `environment = production`; `feature` è uno tra `auth`, `absence`, `messages`, `convocations`.
- Notifica immediata al canale operativo/responsabile.
- Priorità: auth P0; absence/messages/convocations P1.
- Escludere Preview tramite filtro ambiente; non basare l’esclusione sulle sole stringhe dei messaggi, che vengono sanitizzate. Le condizioni previste devono essere già filtrate prima dell’evento.

**Alert 2 — Regressioni**

- Tipo: Issue Alert, trigger “A resolved issue regressed”/nuovo evento su issue risolta.
- Filtri: `environment = production`; stessa allowlist `feature` dell’Alert 1.
- Notifica immediata al team; includere link issue e release che ha riaperto il problema.

**Alert 3 — Errori ricorrenti**

- Tipo: Metric Alert sul numero di eventi, filtro `environment = production` e feature allowlistata.
- Soglia iniziale: almeno 5 eventi in 15 minuti; finestra di valutazione 15 minuti; ri-notifica al massimo una volta ogni 60 minuti finché resta sopra soglia.
- Notifica team/digest operativo, non paging per il singolo evento isolato. Questa soglia usa il conteggio eventi e non richiede un numero minimo di utenti colpiti; ritoccarla dopo due settimane di traffico osservato.

**Configurazione ambiente e sorgenti**

- Separare `preview` e `production` tramite `SENTRY_ENVIRONMENT`/`VERCEL_ENV`; i canali Production devono filtrare esattamente `production`.
- Usare un DSN di ingest del progetto e un token upload sorgenti solo nei build environment Vercel; mai esporre `SENTRY_AUTH_TOKEN` come variabile pubblica.
- Verificare che la release Browser e Node coincida con la release dei Debug ID caricati. Mantenere le source map caricate in Sentry anche se eliminate dall’output (`deleteSourcemapsAfterUpload`).

## 7. Problemi residui e gravità

| Gravità | Problema | Azione prima del rilascio |
| --- | --- | --- |
| Risolto localmente | Ownership SDK/manuale dei risultati Supabase sovrapposta. | Test con SDK reale e Route Handler: un evento inatteso, zero per conflitto/successo; instrumentation e tracing restano attivi. |
| Alta | Verifica live di privacy, grouping e assenza duplicati non eseguita. | Completare le prove Preview e ispezionare gli eventi reali prima di approvare Production. |
| Alta | Browser source map/Debug ID non verificati in questa sessione. | Confermare evento Browser Preview mappato a TypeScript e release/debug ID corretti. |
| Media | Due test coach preesistenti falliscono con 500 al posto di 403/400. | Stabilire baseline o correggere separatamente il setup/test; non attribuire a Sentry senza evidenza. |
| Media | Le verifiche Preview e i duplicati tra runtimes non sono provati live. | Eseguire i controlli manuali Preview prima di Production. |
| Media | Errori TanStack privi di status normalizzato non identificano necessariamente 429/offline. | Validare shape degli errori dei fetcher e aggiungere test per quelle shape. |

## 8. Raccomandazione finale

**GO WITH CONDITIONS: il problema della doppia cattura Supabase è risolto e verificato con test controllati; la readiness Production richiede ancora le verifiche manuali Preview.** Build, TypeScript, ESLint e test mirati Sentry passano. Restano i due test coach preesistenti e non sono stati esaminati eventi live, source map Browser/Debug ID né le regole operative Sentry.
