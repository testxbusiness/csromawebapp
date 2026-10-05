# Performance audit CSRoma

## Diagnosi route lente e riduzione reload

Audit diagnostico eseguito sulla branch `performance-audit` il 4 ottobre 2026. Il perimetro è solo osservazionale: non sono state modificate query, policy RLS, indici, route o componenti di produzione.

### Metodo ed etichette

- **MISURATO**: valore fornito dalle misurazioni Chrome Performance su preview Vercel.
- **OSSERVATO NEL CODICE**: comportamento dedotto dalla lettura dei file, senza attribuirgli un tempo.
- **IPOTESI**: causa plausibile da confermare con timing runtime.
- **NON MISURATO**: dato che non è disponibile in questo audit.

Nessun tempo interno di middleware, Vercel, Supabase o PostgreSQL è stato inventato. I dati disponibili misurano il risultato browser, non la durata delle singole query.

## 1. Inventario tecnico

| Area | Evidenza |
|---|---|
| Next.js | `^15.5.21`, App Router |
| React | `19.1.0` / `react-dom 19.1.0` |
| Supabase | `@supabase/ssr ^0.7.0`, `@supabase/supabase-js ^2.56.0` |
| Package manager | npm, `package-lock.json` presente |
| Rendering | Root shell e provider client; le route atleta lente montano manager client che fanno `fetch` dopo l’idratazione |
| Auth | Middleware SSR chiama `supabase.auth.getUser()`; `useAuth` chiama `getSession()` e poi `/api/me/profile` |
| PWA | `public/sw.js`, `public/push-sw.js`, `PwaBootstrap`, manifest e fallback offline presenti |
| Configurazione | `reactStrictMode`, compressione, `optimizePackageImports` per lucide/Radix; nessuna cache applicativa esplicita per i payload privati |

### Classificazione route

| Classe | Route | Motivazione |
|---|---|---|
| CRITICAL | `/dashboard` | LCP 4,83–7,49 s; è la home autenticata e combina auth, profilo e dashboard aggregata |
| HIGH | `/athlete/messages`, `/athlete/fees` | LCP 3,70 s e 3,08 s; fetch client e payload privati no-store |
| NORMAL | `/athlete/profile` | LCP misurato 2,18 s, vicino ma sotto il target |
| LOW/NORMAL | `/athlete/calendar`, `/athlete/campionati` | LCP rispettivamente 0,06 s e 0,18 s; non proporre ottimizzazioni senza nuove prove |
| P3 | `/login` | LCP 0,24 s, INP 232 ms: problema d’interazione, non di caricamento iniziale |

## 2. Evidenza browser disponibile

| Route | LCP | INP | CLS | Elemento LCP | Stato |
|---|---:|---:|---:|---|---|
| `/dashboard` | MISURATO: 4,83–7,49 s | MISURATO: 16–24 ms | MISURATO: 0 | `p.text-sm.font-semibold` | P1 |
| `/athlete/fees` | MISURATO: 3,08 s | non fornito | MISURATO: 0 | `span.cs-list-row__content` | P1 |
| `/athlete/messages` | MISURATO: 3,70 s | MISURATO: 8 ms | MISURATO: 0 | `p.mt-1.text-sm.text-secondary` | P1 |
| `/athlete/profile` | MISURATO: 2,18 s | non fornito | non fornito | non fornito | osservare |
| `/athlete/campionati` | MISURATO: 0,18 s | non fornito | non fornito | non fornito | baseline veloce |
| `/athlete/calendar` | MISURATO: 0,06 s | MISURATO: 24 ms | non fornito | non fornito | baseline veloce |
| `/login` | MISURATO: 0,24 s | MISURATO: 232 ms | non fornito | non fornito | P3 |

Il fatto che gli elementi LCP delle tre route lente siano testo supporta l’ipotesi di dati non ancora disponibili/renderizzati quando il browser misura LCP. Non è evidenza di un problema di paint o CSS.

## 3. Percorso comune di autenticazione

### Percorso osservato

1. Il middleware (`src/middleware.ts`) intercetta le route non statiche e chiama `supabase.auth.getUser()`. Non interroga il database direttamente, ma può aggiornare i cookie SSR.
2. Il root layout monta `AuthProvider`, `AccessibleProfileProvider`, `TeamProvider`, `LayoutShell` e `PwaBootstrap` (`src/app/layout.tsx`). Sono boundary client persistenti.
3. `useAuth` (`src/hooks/useAuth.ts`) chiama `supabase.auth.getSession()` al mount e, per un utente autenticato, `fetch('/api/me/profile', { cache: 'no-store' })`.
4. `/api/me/profile` chiama `requireAccountContext`: `auth.getUser()`, lettura `app_accounts`, lettura `account_roles`, poi lettura `profiles` con `select('*')` (`src/app/api/me/profile/route.ts`).
5. I manager atleta attendono `authLoading`/`profileLoading`, poi eseguono una seconda richiesta API specifica alla pagina.

Questa è una dipendenza bloccante comune. I tempi dei singoli passaggi sono **NON MISURATI**; il divario browser è **MISURATO**.

## 4. Traccia `/dashboard`

La pagina è interamente client (`src/app/dashboard/page.tsx`). Non produce il contenuto atleta dal server: mostra skeleton finché `useAuth` non ha user/profile/role, quindi `AthleteDashboard` effettua il fetch aggregato.

### Grafo delle dipendenze

```text
navigazione
  └── middleware auth.getUser(): NON MISURATO
       └── hydration dei provider + useAuth.getSession(): NON MISURATO
            └── GET /api/me/profile: NON MISURATO
                 ├── auth.getUser(): NON MISURATO
                 ├── app_accounts: NON MISURATO
                 ├── account_roles: NON MISURATO
                 └── profiles select(*): NON MISURATO
                      └── render DashboardPage / risoluzione ruolo: NON MISURATO
                           └── GET /api/athlete/dashboard: NON MISURATO
                                ├── requireSubjectAthleteContext
                                │    ├── requireAccountContext (auth + account + roles)
                                │    ├── athlete_profiles
                                │    ├── seasons is_active
                                │    ├── activities della stagione
                                │    └── teams della stagione
                                ├── alert amministrativi (atteso prima del blocco principale)
                                │    ├── athlete_profiles
                                │    └── load fees: installments → membership_fees → teams → activities
                                ├── memberships + prime fee installments: parallele
                                ├── recipients messaggi → creator profiles → message_reads
                                ├── teams + event_teams + membership_fees + club teams: parallele
                                ├── events (eventuali batch sequenziali)
                                ├── activities
                                ├── gyms + attendance: parallele
                                ├── attendance availability
                                └── prossimo match
                                     └── JSON + setState client
                                          └── testo della dashboard / LCP MISURATO 4,83–7,49 s
```

### Diagnosi

| Aspetto | Risultato |
|---|---|
| Architettura | OSSERVATO NEL CODICE: pagina e dashboard sono client; il contenuto utile arriva dopo auth/profile e un endpoint aggregato |
| Chiamate Supabase | OSSERVATO NEL CODICE: molteplici, con gruppi paralleli ma anche sequenze; non misurato il numero effettivo per dataset |
| Waterfall | OSSERVATO NEL CODICE: `administrativeAlerts` viene atteso prima di `memberRes/feeRes`; dopo i gruppi paralleli seguono eventi, attività, attendance e match |
| Duplicazione | OSSERVATO NEL CODICE: auth/account/ruoli vengono risolti in `/api/me/profile` e di nuovo da `requireSubjectAthleteContext` nell’endpoint dashboard |
| LCP | MISURATO: testo `p.text-sm.font-semibold`; IPOTESI: il testo compare solo dopo il fetch aggregato e gli `setState` |
| Rischio | Medio/alto: la dashboard è il punto di aggregazione per più ruoli e contesti delegati |

La dashboard contiene anche un refresh completo dei dati dopo una risposta attendance (`AthleteDashboard.tsx:289`) e dopo early absence (`:335`), osservato nel codice. È corretto verificare se sia sostituibile con patch dello stato già applicate localmente.

## 5. Traccia `/athlete/messages`

La route server renderizza `PageHeader`, ma `AthleteMessagesManager` è client e il suo contenuto utile dipende da `fetch('/api/athlete/messages?view=full')` (`src/components/athlete/AthleteMessagesManager.tsx:47-123`). Il fallback Suspense non anticipa il fetch interno del client manager.

### Percorso

```text
navigazione → middleware getUser (NON MISURATO)
  → hydration/AuthProvider → getSession + /api/me/profile (NON MISURATO)
    → PageHeader immediato
    → AthleteMessagesManager useEffect
      → /api/athlete/messages?view=full (MISURATO solo come contributo al LCP complessivo: NON MISURATO come durata)
        → requireSubjectAthleteContext
        → team_members
        → message_recipients
        → messages
        → message_reads + teams parallele
        → creators
        → tutti i message_recipients
        → teams/profili destinatari parallele
        → message_attachments
        → JSON → setMessages → testo LCP
```

### Diagnosi

- **OSSERVATO NEL CODICE**: la vista `full` non limita i messaggi e carica corpo, destinatari e allegati metadata; i signed URL restano demand-driven.
- **OSSERVATO NEL CODICE**: il percorso full ha più query sequenziali dopo aver già caricato recipient IDs; i batch riducono N+1 ma non eliminano il waterfall.
- **OSSERVATO NEL CODICE**: la richiesta è `no-store` implicito/privato e non beneficia di una cache fetch persistente.
- **OSSERVATO NEL CODICE**: la bottom navigation esegue una richiesta separata `countOnly=1`; è intenzionale e più leggera, ma può concorrere durante il mount.
- **OSSERVATO NEL CODICE**: il cambio profilo abortisce la richiesta e ne avvia una nuova; è corretto per sicurezza, ma va evitato quando il cambio è identico o già in corso.
- **IPOTESI**: la causa P1 principale è la disponibilità ritardata dei dati client, amplificata dal numero di query server e dal payload full.
- **Correzione proposta**: payload iniziale minimale server/streaming con messaggi recenti e stato unread; dettaglio completo e allegati solo all’apertura. Impatto atteso alto, rischio medio.

## 6. Traccia `/athlete/fees`

`src/app/athlete/fees/page.tsx` è client e il fallback Suspense è `null`; `AthleteAdministrationManager` carica `/api/athlete/administration`, non direttamente `/api/athlete/fees`. Il componente visualizza poi `AthleteFeesContent`.

```text
navigazione → middleware getUser (NON MISURATO)
  → hydration/AuthProvider → getSession + /api/me/profile (NON MISURATO)
    → PageHeader
    → AthleteAdministrationManager useEffect
      → /api/athlete/administration no-store
        → requireSubjectAthleteContext
        → in parallelo: season_profiles, athlete_profiles, loadAthleteFeesContract
          → fee_installments
          → membership_fees
          → teams
          → activities
        → JSON → setContract
          → render fee rows / LCP MISURATO 3,08 s
```

### Diagnosi

- **OSSERVATO NEL CODICE**: il contratto amministrazione esegue in parallelo certificato, iscrizione e quote, ma la catena quote è seriale (`src/server/athlete/fees.ts:13-38`).
- **OSSERVATO NEL CODICE**: `fee_installments` viene letta prima di sapere i `membership_fee_id`, poi seguono tre lookup di arricchimento.
- **OSSERVATO NEL CODICE**: il contratto viene caricato dopo auth/profile; non esiste contenuto fees utile nel Server Component.
- **OSSERVATO NEL CODICE**: lo `Suspense fallback={null}` non offre uno skeleton anticipato e non trasforma un fetch client in streaming server.
- **IPOTESI**: il ritardo è dominato dal percorso auth/profile + catena quote, non dal painting del `span.cs-list-row__content`.
- **Correzione proposta**: un contratto server-side iniziale oppure un endpoint read-only che restituisca le quote già arricchite in una singola operazione DB/RPC autorizzata; prima misurare, perché schema/RLS non è nel perimetro di questo audit.

## 7. Confronto route veloci e lente

| Differenza | Veloci: calendar/campionati/login | Lente: dashboard/messages/fees | Evidenza |
|---|---|---|---|
| Dati iniziali | Calendar/campionati montano manager ma hanno payload/percorsi più contenuti; login non richiede contenuto autenticato | Dashboard aggrega molte sezioni; messages/fees attendono payload client | OSSERVATO NEL CODICE; il tempo è MISURATO solo a livello route |
| Waterfall | Non misurato il numero di query; tempi browser molto bassi | Dashboard ha sequenze esplicite; messages/full e fees arricchiscono in più passaggi | OSSERVATO NEL CODICE |
| Auth/profile | Il login non esegue il percorso autenticato; le altre route condividono shell | Tutte le route autenticate ereditano auth/profile client | OSSERVATO NEL CODICE |
| LCP | 0,06–0,24 s misurati | Testo disponibile solo dopo dati client | MISURATO + IPOTESI |
| Cache | API private e molti fetch `no-store`; nessuna conclusione sui tempi cache senza Network | Stessa limitazione, con payload più ricchi | OSSERVATO NEL CODICE |
| Suspense | Calendar/campionati non hanno lo stesso fallback vuoto della fees; non basta da solo a spiegare il divario | messages ha fallback ma fetch interno client; fees `fallback={null}` | OSSERVATO NEL CODICE |

Non si raccomanda alcuna modifica a calendar/campionati: sono baseline rapide e il brief vieta interventi senza prove.

## 8. Audit reload, refresh e refetch

| Finding | Evidenza | Valutazione / alternativa senza reload |
|---|---|---|
| Refresh dashboard dopo attendance | OSSERVATO NEL CODICE: `AthleteDashboard.tsx:289` chiama `loadAthleteData()` dopo aver già aggiornato localmente l’evento | Verificare se basta l’update locale + invalidazione mirata del solo riepilogo; non è un reload di pagina |
| Refresh dashboard dopo early absence | OSSERVATO NEL CODICE: `:335` | Stessa strategia; misurare se il nuovo fetch cambia dati realmente visibili |
| Refresh su focus/visibilità auth | OSSERVATO NEL CODICE: `useAuth.ts:382-423`, throttled a 30 s; chiama `getSession` e potenzialmente `/api/me/profile` | Necessario per sessione, ma separare token refresh da refetch profilo dati |
| Refresh su online | OSSERVATO NEL CODICE: messages, fees, administration e contesti ricaricano al ritorno online | Necessario per dati no-store; deduplicare richieste simultanee e mantenere dati già mostrati |
| Badge messaggi | OSSERVATO NEL CODICE: `BottomNavigation` chiama `countOnly=1` al mount e dopo `MESSAGE_READ_STATE_CHANGED_EVENT` | Valutare aggiornamento locale del conteggio quando si marca letto, con fallback server |
| PWA auto-reload | OSSERVATO NEL CODICE: `PwaBootstrap.tsx:68` reload su `controllerchange` dopo consenso; `:133` reload su “Aggiorna ora” se non c’è worker waiting | Comportamento intenzionale di update, non causa delle route misurate; non automatizzare il reload senza consenso |
| Polling deployment | OSSERVATO NEL CODICE: `setInterval(checkDeploymentVersion, 60_000)` | Non ricarica da solo; può aggiungere una richiesta ogni minuto. Misurare impatto e mantenerlo fuori dal critical path |
| Router refresh | OSSERVATO NEL CODICE: nessuna occorrenza applicativa trovata | Nessuna azione |
| `revalidatePath`/`revalidateTag` | OSSERVATO NEL CODICE: nessuna occorrenza trovata | Nessuna invalidazione ampia evidenziata |
| Navigazione interna con `<a>` | OSSERVATO NEL CODICE: occorrenze rilevate in callback/auth e download/allegati; non evidenza di navigazione interna nelle shell principali, che usano `next/link` | Audit mirato solo sulle occorrenze realmente interne |
| Realtime/SWR/React Query/polling dati | OSSERVATO NEL CODICE: nessun uso rilevato per queste route | Nessun finding positivo; verificare dipendenze future |
| Redirect middleware | OSSERVATO NEL CODICE: login e mandatory password redirect; non sono loop dimostrati | Usare tracing Network per doppie navigazioni, senza modificare ora |

Non risultano reload completi durante i normali flussi dashboard/messages/fees. I refetch ripetuti sono più probabili dei reload: auth visibility, online, cambio subject, badge unread e refresh post-mutation.

## 9. Bundle, client boundaries e loading UX

- **OSSERVATO NEL CODICE**: dashboard, fees e managers atleta sono Client Components; il root layout monta numerosi provider client persistenti.
- **OSSERVATO NEL CODICE**: il boundary client della dashboard impedisce di far arrivare il testo utile dal server prima dell’idratazione.
- **NON MISURATO**: dimensione JS per route, tempo di hydration, long tasks e dimensione dei JSON. Non aggiungere memoizzazione senza queste misure.
- **OSSERVATO NEL CODICE**: `/api/me/profile` usa `select('*')`; è un candidato di payload inutile, ma la dimensione e il tempo non sono misurati.
- **OSSERVATO NEL CODICE**: PWA non cachea le API private; questo è coerente con il modello di sicurezza e non va cambiato senza prove e revisione privacy.
- **P3 login**: INP 232 ms è MISURATO, ma l’interazione precisa e l’handler responsabile sono NON MISURATI. Il codice usa `window.location.assign` dopo login: verificare l’event timing prima di proporre una sostituzione.

## 10. Findings principali ordinati per impatto

1. **P1 — Dashboard bloccata da una catena client auth/profile + aggregatore ampio.** MISURATO: LCP 4,83–7,49 s. OSSERVATO NEL CODICE: pagina client, doppia risoluzione auth/account/ruoli, molte query aggregate. **IPOTESI**: principale causa del ritardo.
2. **P1 — `administrativeAlerts` blocca l’inizio del lavoro principale della dashboard.** OSSERVATO NEL CODICE: è atteso prima di `memberRes/feeRes`; include la catena quote. Tempo NON MISURATO.
3. **P1 — Dashboard esegue più fasi server seriali dopo gruppi paralleli.** OSSERVATO NEL CODICE: eventi, attività, attendance availability e match non sono tutti concorrenti. Tempo NON MISURATO.
4. **P1 — Messaggi full arrivano solo dopo hydration e fetch client.** MISURATO: LCP 3,70 s. OSSERVATO NEL CODICE: `view=full` con corpo, destinatari, profili e allegati metadata.
5. **P1 — Fees usa un fallback Suspense vuoto e fetch client.** MISURATO: LCP 3,08 s. OSSERVATO NEL CODICE: contenuto utile non viene streammato e la catena fees è seriale.
6. **P1 — Auth/profile è lavoro duplicato.** OSSERVATO NEL CODICE: middleware, `useAuth`, `/api/me/profile` e ogni endpoint subject-aware ripetono porzioni del percorso. Latency attribution NON MISURATA.
7. **P2 — `profiles select('*')` nel profilo account.** OSSERVATO NEL CODICE: payload potenzialmente sovradimensionato. Byte e tempo NON MISURATI; non classificare ancora P1.
8. **P2 — Refresh dashboard post attendance/assenza.** OSSERVATO NEL CODICE: fetch completo dopo patch locale. Impatto e frequenza NON MISURATI.
9. **P2 — Refetch su focus/visibility/online e cambio contesto.** OSSERVATO NEL CODICE; throttle auth 30 s misurato solo come configurazione, frequenza reale NON MISURATA.
10. **P3 — Login INP sopra target.** MISURATO: 232 ms. Interazione, long task e costo handler NON MISURATI.

## 11. Matrice di impatto

| Finding | Priorità | Impatto atteso | Complessità | Rischio | Evidenza |
|---|---|---|---|---|---|
| Dashboard: payload iniziale server/streaming | P1 | Alto su LCP | L | Alto | MISURATO + OSSERVATO/IPOTESI |
| Separare alert amministrativi dal critical path | P1 | Medio/alto | M | Medio | OSSERVATO, tempo NON MISURATO |
| Ridurre waterfall dashboard | P1 | Alto se confermato | L | Alto | OSSERVATO, tempo NON MISURATO |
| Messaggi recenti minimale, dettaglio on demand | P1 | Alto | M | Medio | MISURATO + OSSERVATO |
| Fees contratto iniziale già arricchito | P1 | Medio/alto | M/L | Medio/alto | MISURATO + OSSERVATO |
| Condividere contesto auth/profile | P2 | Medio | M | Alto | OSSERVATO |
| Limitare `profiles select('*')` | P2 | Basso/medio | XS | Basso | OSSERVATO, byte NON MISURATI |
| Evitare dashboard refetch post mutazione | P2 | Medio su interazioni | S | Medio | OSSERVATO |
| Deduplicare refresh focus/online/badge | P2 | Medio su navigazione | M | Medio | OSSERVATO |
| Profilare login INP | P3 | Basso | S | Basso | MISURATO, causa NON MISURATA |

## 12. Quick wins diagnostici/prioritari

1. Aggiungere misure Server-Timing solo in preview/staging per middleware, `/api/me/profile`, `/api/athlete/dashboard`, messages e administration.
2. Registrare request waterfall e payload size delle tre route lente in Chrome Network con cache disabilitata e cache abilitata.
3. Verificare se `administrativeAlerts` cambia il JSON/LCP quando viene ritardato fuori dal critical path in una prova temporanea non consegnata.
4. Misurare un dashboard con `view=full` messages escluso dal critical path, senza cambiare il comportamento prodotto.
5. Profilare `/api/athlete/fees` per contare righe e durata di ogni lookup in staging.
6. Deduplicare, come esperimento locale non persistente, richieste identiche generate nello stesso mount e confrontare il waterfall.
7. Controllare il payload di `/api/me/profile` e quantificare quanto di `select('*')` viene serializzato e usato.
8. Misurare il delta tra patch locale attendance e refetch dashboard completo.
9. Misurare le richieste causate da focus/visibility/online in una sessione reale.
10. Registrare l’interazione login e i long tasks con Chrome Performance/INP attribution.

## 13. Cose che NON conviene ottimizzare ora

- `/athlete/calendar`: LCP MISURATO 0,06 s.
- `/athlete/campionati`: LCP MISURATO 0,18 s.
- CSS/painting del testo LCP prima di dimostrare che il testo è già disponibile al browser.
- `React.memo`, `useMemo` o `useCallback` generalizzati senza un profilo CPU/render.
- Service Worker e cache delle API private: il comportamento attuale è una scelta di sicurezza PWA coerente.
- Indici/RLS/PostgreSQL: non esistono query plan, `EXPLAIN ANALYZE` o statistiche staging in questo audit.
- Migrazioni di architettura o riscrittura globale della shell: il problema è ancora da scomporre con timing reali.

## 14. Misurazioni ancora mancanti

| Misurazione | Come ottenerla senza cambiare comportamento |
|---|---|
| Middleware `getUser` | Chrome DevTools Network: preservare log, aprire route in nuova sessione; correlare TTFB del document. Per attribuzione precisa, usare log preview/Vercel con request id. |
| `getSession`/hydration/useAuth | Performance recording con React DevTools Profiler e Network; marcare `DOMContentLoaded`, hydration e prima request `/api/me/profile`. |
| Durata e payload `/api/me/profile` | Network → request → Timing/Response; esportare HAR della sola preview autenticata. |
| Query Supabase individuali | In staging, log temporanei Server-Timing lato server oppure Supabase Logs con request correlation; non eseguire benchmark in produzione. |
| Query plan/index/RLS | Solo staging: `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` su SELECT equivalenti read-only dopo aver ottenuto i pattern reali; confrontare con Supabase query logs. |
| Numero reale di query per route | Network non mostra le query DB; usare log server strutturati per ogni fase dell’endpoint e conteggiare per request id. |
| Dimensione JSON e JS per route | Network Response size e build production (`npm run build`); annotare route/chunk, non modificare il codice. |
| Cache Router/Full Route/fetch | DevTools Network su seconda navigazione, confronto `transfer size`, `from memory/disk cache`, `x-nextjs-cache`/header Vercel se presenti. |
| Long tasks e hydration | Chrome Performance con screenshots e Web Vitals; osservare Main thread e long-task attribution intorno all’LCP. |
| Attendance refetch | Performance/Network durante una sola risposta attendance; confrontare request POST, eventuale GET dashboard e stato aggiornato. |
| Focus/online refetch | Aprire Performance recording, cambiare tab/online una volta, filtrare `/api/me/profile`, messages, fees, dashboard e accessible profiles. |
| Login INP 232 ms | Chrome Performance con interazione esatta identificata; usare Event Timing/INP attribution e long tasks dell’handler. |
| Regione/cold start | Vercel Functions Logs + regione Supabase + due misure cold/warm separate; nessun benchmark distruttivo. |

### Procedura minima ripetibile

1. Aprire la preview autenticata in Chrome Incognito con DevTools aperti.
2. Network: “Disable cache”, Preserve log, throttling inizialmente No throttling; esportare HAR.
3. Performance: registrare un hard reload di `/dashboard`, poi navigazioni client a messages e fees; annotare LCP e request initiator.
4. Ripetere una seconda volta senza hard reload per distinguere cold load da Router Cache.
5. Ripetere con una sessione focus/visibility e una transizione offline→online.
6. Correlare gli orari con Vercel Logs/Supabase Logs in staging/preview.
