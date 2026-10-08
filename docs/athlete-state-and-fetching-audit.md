# Audit stato e data fetching area Atleta

Data audit: 6 ottobre 2026  
Ambito: area atleta personale e area familiare/delegata che riusa i manager atleta.  
Vincoli: analisi del codice corrente; nessuna modifica applicativa, nessuna nuova dipendenza, nessuna installazione di TanStack Query.

## 1. Current architecture

La navigazione è client-side tramite `next/link`. Il document non viene ricaricato, ma il segmento pagina precedente viene smontato e il nuovo manager viene montato.

Il tree globale in `src/app/layout.tsx` mantiene montati durante il cambio route:

```text
AuthProvider
└─ AccessibleProfileProvider
   └─ TeamProvider
      └─ LayoutShell
         ├─ AppHeader / RoleSidebar / BottomNavigation
         └─ pagina corrente
            └─ manager atleta della sezione
```

Conseguenze:

- `useAuth` conserva account, sessione e profilo personale tra le route; usa anche `sessionStorage` per il profilo personale per 5 minuti.
- `AccessibleProfileProvider` conserva subject/profilo delegato e area attiva; ricarica `/api/me/accessible-profiles` al bootstrap e su focus/visibility.
- `TeamProvider` conserva squadre e squadra selezionata; la selezione è persistita in `localStorage`. Per i coach ricarica `/api/coach/teams`; per l’atleta la lista viene alimentata dai manager che ricevono le squadre dal payload.
- ogni manager atleta conserva i propri dati in `useState`; questo stato è locale al page segment e viene perso all’unmount.
- al remount il relativo `useEffect` parte nuovamente dopo la disponibilità di auth/profile e chiama l’endpoint della pagina.
- non esiste una cache condivisa di server state per calendario, dashboard, messaggi, quote/amministrazione o profilo. Il coordinatore `runClientRefresh` coalesca refresh concorrenti, ma non conserva i dati tra unmount e remount.

Il componente `/athlete/fees` non monta un manager quote autonomo: la page monta `AthleteAdministrationManager`, che carica il contratto amministrazione e renderizza al suo interno `AthleteFeesContent`.

## 2. Pages and managers

| Page | Manager/hook | Fetch/API | Trigger | Lost on unmount |
| ---- | ------------ | --------- | ------- | --------------- |
| Dashboard / Oggi `/dashboard` | `DashboardClient` → `AthleteDashboard`; `useAuth`, `useAccessibleProfiles`, `useTeamContext`; `runClientRefresh` | `GET /api/athlete/dashboard`; in parallelo `GET /api/athlete/dashboard/alerts`; apertura dettaglio messaggio: `GET /api/athlete/messages?view=full&id=...`; dettaglio squadra: query Supabase client-side su `teams`, `activities`, `team_members`; mutation RSVP/assenza via `/api/athlete/events/attendance` e `/api/athlete/events/early-absence` | `useEffect` su callback/auth/subject; focus/visibility, online, timer `next_recalculation_at`; apertura modal per dettaglio; mutation | stagione, memberships, eventi prossimi, preview messaggi, unread count, alert, prossimo match, stato loading/error/offline/denied, modali, dettaglio squadra/messaggio e selezione squadra |
| Calendario `/athlete/calendar` | `AthleteCalendarManager`; `useAuth`, `useAccessibleProfiles`, `useTeamContext`; `runClientRefresh` | `GET /api/athlete/calendar`; server query su `team_members`, `teams`, `event_teams`, `events`, `event_attendances`, più risoluzione disponibilità attendance; mutation attendance/early absence | `useEffect` quando auth/profile/user sono pronti; focus, online; timer per ricalcolo attendance; cambio subject; retry e mutation | eventi, squadre autorizzate, stato load/error/offline/denied, evento selezionato, modale assenza, modalità agenda/month, mese/data/view, filtri tipo e apertura filtri mobile |
| Messaggi `/athlete/messages` | `AthleteMessagesManager`; `useAuth`, `useAccessibleProfiles`, `useTeamContext`, `useSearchParams`; `runClientRefresh` | Lista: `GET /api/athlete/messages?view=minimal`; dettaglio: `GET /api/athlete/messages?view=full&id=...`; allegati on demand da `MessageDetailModal`: endpoint attachment; read state da modal via endpoint condiviso `/api/messages/read` | lista su mount/cambio subject/user e callback `loadMessages`; deep link `messageId`/`subjectProfileId`; apertura messaggio; online; cambio subject; read state aggiornato localmente dopo conferma | lista messaggi, stato load/error/offline/denied, messaggio selezionato, filtro tutti/non letti, disponibilità deep link |
| Quote / Amministrazione `/athlete/fees` | `AthleteAdministrationManager` → `AthleteFeesContent`; `useAuth`, `useAccessibleProfiles`, `useSearchParams`; `runClientRefresh` | `GET /api/athlete/administration`; server query in parallelo su `season_profiles`, `athlete_profiles`, `fee_installments` con relazioni `membership_fees → teams → activities`; il manager non chiama direttamente `/api/athlete/fees` | `useEffect` dopo auth/profile; cambio subject; online; retry; querystring `section` serve solo a focalizzare la sezione dopo il caricamento | contratto iscrizione/certificato/quote, stato loading/error/offline, sezione focus implicita nel mount |
| Profilo `/athlete/profile` | `AthleteProfileManager`; `useAuth`, `useAccessibleProfiles`, `usePush`; `runClientRefresh` | `GET /api/athlete/profile`; server query parallele su `profiles`, `athlete_profiles`, `team_members`, poi `teams`, `activities`, documenti personali/squadra; push: `serviceWorker.getRegistration().pushManager.getSubscription()`, subscribe/unsubscribe con endpoint notifiche | `useEffect` dopo auth/profile; cambio subject; online; mount per rilevare supporto/permesso/sottoscrizione push; azione esplicita per push | contratto profilo, stato loading/error/offline/denied, supporto/permesso/sottoscrizione push, busy/error della mutation push |

### Dettaglio Dashboard / Oggi

`AthleteDashboard` oggi usa un endpoint aggregato. Sul server il contratto include, condizionatamente ai permessi:

- memberships da `team_members`;
- prime rate da `fee_installments` e relativo `membership_fees`;
- messaggi da `message_recipients`/`messages`, creator da `profiles` e read state da `message_reads`;
- squadre da `teams`, relazioni `event_teams`, eventi da `events`;
- attività, palestre, attendance e disponibilità attendance;
- club team e prossima partita/campionato.

Gli alert sono stati separati in `/api/athlete/dashboard/alerts`, ma il relativo endpoint rilegge `athlete_profiles.medical_certificate_expiry` e il contratto quote. Il dashboard quindi ha un fetch critico e un fetch alert, non un unico payload indivisibile.

### Dettaglio Calendario

L’endpoint calendario carica l’intero insieme di eventi autorizzati per le squadre del subject, non un intervallo mese/giorno. Il mese e i filtri sono quindi UI state/route state lato client, mentre il fetch non cambia quando l’utente cambia mese: il filtraggio è locale su `events` già caricati.

### Dettaglio Messaggi

La lista usa `view=minimal`, mentre il dettaglio usa `view=full&id`. È una separazione corretta per il payload, ma entrambe le richieste ricostruiscono il contesto subject, membership e destinatari server-side. La shell esegue inoltre un fetch separato `countOnly=1` per il badge.

### Dettaglio Quote / Amministrazione

La pagina realmente navigata è Amministrazione. `AthleteFeesContent` è presentazionale: filtri, raggruppamento per squadra, totali e contatori sono calcolati localmente. La sorgente server state è il contratto amministrazione, che include quote insieme a certificato e domanda di iscrizione.

### Dettaglio Profilo

Il profilo è un fetch autonomo e `cache: 'no-store'`. Anche per il subject personale, l’endpoint profilo ricarica il profilo atleta/soggetto e le membership, mentre `useAuth` conserva già il profilo account personale tramite `/api/me/profile`: sono contratti diversi ma parzialmente sovrapposti.

### Responsabilità miste nei manager

| Manager | Fetching | Business logic | Trasformazione dati | UI state | Semplificazione futura |
| ------- | -------- | -------------- | ------------------- | -------- | ---------------------- |
| `AthleteDashboard` | Sì, dashboard, alert, dettaglio messaggio e team detail | Sì, permessi delegati, subject reset, attendance e sincronizzazione locale | Sì, selezione widget, preview, stati evento, mapping team | Sì, modali, selezioni, feedback e offline | È il candidato più importante da scomporre: query hooks separati, mutation dedicate e componenti presentazionali; il manager non dovrebbe orchestrare tutti i domini |
| `AthleteCalendarManager` | Sì, calendario e mutation attendance | Sì, reset subject, disponibilità, retry e timer | Sì, filtri, conflitti e mapping per widget calendario | Sì, mese/vista/filtri/modali | Estrarre query calendario e mutation; lasciare nel componente solo view state e trasformazioni visuali. La key deve prevedere intervallo futuro |
| `AthleteMessagesManager` | Sì, lista, dettaglio e integrazione read state | Sì, deep link subject/message, abort e reset | Sì, filtro unread/team e conteggio visualizzato | Sì, filtro e modal | Buon candidato: separare `useAthleteMessages`, `useAthleteMessageDetail` e mutation read; il manager può diventare composizione leggera |
| `AthleteAdministrationManager` | Sì, contratto amministrazione | Limitata a permesso implicito/denied e focus deep link | Quasi nulla; delega quote a `AthleteFeesContent` | Sì, load/error/offline e focus | Candidato semplice: una query `administration`, con `AthleteFeesContent` puramente presentazionale |
| `AthleteFeesContent` | No | No | Sì, filtri, totali, raggruppamento | Sì, filtro rate | Non va trasformato in query hook; deve restare componente UI alimentato da dati server |
| `AthleteProfileManager` | Sì, profilo e stato subscription push | Sì, contesto subject e mutation push | Minima, soprattutto iniziali/date | Sì, push/error/busy/loading | Separare `useAthleteProfile` dalla gestione push; la parte render è già relativamente lineare |

Il fatto che un manager contenga più responsabilità non è di per sé un errore funzionale, ma aumenta il rischio della migrazione: bisogna evitare di spostare modali, filtri e stato di presentazione dentro la cache server.

## 3. State classification

| State/Data | Server state | UI state | Route/filter state |
| ---------- | ------------ | -------- | ------------------ |
| Sessione Supabase, account, ruolo, profilo personale | Sì, risolto da auth/API; conservato nel provider | Stato `loading`/`profileLoading` del provider | No |
| Profili accessibili e permessi delegati | Sì: `/api/me/accessible-profiles` | `loading`, `error`, area attiva come contesto | Subject selezionato e area attiva hanno anche persistenza locale |
| Squadre atleta autorizzate | Sì, derivato dai payload dashboard/calendario/messaggi | `teams` nel `TeamProvider` | `selectedTeamId` è filtro/context state, persistito in `localStorage` |
| Eventi dashboard | Sì | — | Eventuale squadra/filtro visuale locale |
| Eventi calendario | Sì | — | Mese/data, vista agenda/month/week, filtro tipo, squadra |
| Attendance/RSVP/early absence | Sì; mutation server-side | stato modal/feedback | evento selezionato e filtro squadra |
| Messaggi lista | Sì | — | filtro letti/non letti, squadra |
| Unread count | Sì, `message_reads` + destinatari | badge renderizzato | subject/area fanno parte della chiave concettuale |
| Messaggio selezionato/dettaglio | Sì per il contenuto; read state aggiornato dal server | modal aperto/chiuso | `messageId` e `subjectProfileId` da querystring |
| Quote/rate | Sì | — | filtro stato pagata/da pagare/scaduta |
| Certificato/domanda amministrativa | Sì | — | `section=certificate|fees` è deep-link/focus state |
| Profilo atleta, memberships, document metadata | Sì | — | subject |
| `calendarMode`, `currentDate`, `calView`, filtri calendar | No | Sì | Il valore è candidato a route/querystring se deve sopravvivere alla navigazione |
| `readFilter` messaggi | No | Sì | Candidato a querystring se deve essere condivisibile/deep-linkabile |
| `filter` quote | No | Sì | Candidato a querystring, altrimenti resta locale |
| Modali evento/messaggio/squadra | No | Sì | No, salvo deep link esplicito |
| Loading/error/offline/denied | No: stato di presentazione derivato dal fetch | Sì | No |
| Push support/permission/subscription/busy | La subscription è server/device state; busy/error sono UI state | Sì | No |

Regola di migrazione: eventi, messaggi, unread, quote, profilo, memberships, attendance, permessi e contratti amministrativi sono server state. Modali, filtri non condivisi, vista calendario e feedback sono UI state. Mese, squadra, stagione, subject e deep link sono parte della query key o della route/context key quando devono cambiare il risultato server-side.

## 4. Duplicate/shared queries

### 4.1 Messaggi: Dashboard, pagina Messaggi e badge shell

- Consumer: `AthleteDashboard`, `AthleteMessagesManager`, `BottomNavigation`.
- API: `/api/athlete/messages` con `view=minimal`, `view=full&id` e `countOnly=1`.
- Query equivalenti: tutti risolvono lo stesso subject, membership e destinatari; il badge calcola solo il conteggio ma rilegge recipients e `message_reads`; dashboard carica fino a 10 preview e read state; pagina Messaggi carica la lista minimal.
- Query condivisibile: sì, con query key concettuale `athleteKeys.messages(accountId, subjectProfileId, teamId, view/filter)` e una query separata `athleteKeys.unreadMessageCount(accountId, subjectProfileId)`. Il dettaglio deve avere key per `messageId`; il badge non dovrebbe duplicare la lista completa.
- Nota: `runClientRefresh` evita richieste concorrenti solo quando condividono esattamente la stessa chiave di refresh; non deduplica una richiesta lista con una `countOnly` perché sono endpoint/chiavi differenti.

### 4.2 Quote e dati amministrativi: Dashboard, Alert e Amministrazione

- Consumer: `AthleteDashboard` (`/api/athlete/dashboard`), `GET /api/athlete/dashboard/alerts`, `AthleteAdministrationManager` (`/api/athlete/administration`).
- Query: `fee_installments` con relazioni `membership_fees`, `teams`, `activities`; `athlete_profiles.medical_certificate_expiry`. Il dashboard completo carica solo le prime rate, gli alert ricaricano il contratto quote e Amministrazione carica il contratto completo.
- Query condivisibile: sì, ma con attenzione ai payload. Una query quote completa può alimentare riepilogo dashboard, alert e Amministrazione; il summary dashboard può essere una select/transform derivata dalla stessa cache. Certificato e domanda iscrizione possono avere query key separate se il prodotto vuole invalidazione indipendente.
- Rischio: dopo una mutation amministrativa futura, invalidare solo `/api/athlete/fees` sarebbe insufficiente perché la UI atleta corrente usa `/api/athlete/administration` e il dashboard usa due contratti diversi.

### 4.3 Profilo personale e profilo atleta

- Consumer: `useAuth` chiama `/api/me/profile`; `AthleteProfileManager` chiama `/api/athlete/profile`; `LayoutShell` e tutti i manager consumano `useAuth`.
- Query: il primo contratto è account/profile/ruoli; il secondo è subject athlete/membership/document/permissions. Per il profilo personale esiste sovrapposizione su nome, email e identità, ma non sono sostituibili senza cambiare autorizzazione e semantica account-vs-subject.
- Query condivisibile: condividere `accountKeys.me(accountId)` per `/api/me/profile`; mantenere distinta `athleteKeys.profile(subjectProfileId, activeTeamIds, permissions)`. Per il self subject, il contratto atleta può essere derivato solo quando le autorizzazioni e i dati richiesti coincidono, cosa che oggi non è garantita.

### 4.4 Squadre e contesto

- Consumer: `TeamProvider` conserva il contesto; Dashboard, Calendario, Messaggi e Campionato lo alimentano/consumano.
- Per atleta non c’è un endpoint globale unico per le squadre: i payload `dashboard`, `calendar` e `messages` restituiscono liste parzialmente equivalenti, con campi differenti.
- Query condivisibile: sì, ma prima va definito un contratto canonico subject→teams. La key deve includere account e subject; la squadra selezionata non deve ampliare l’autorizzazione, ma solo filtrare dati già autorizzati.

### 4.5 Query che non risultano duplicate in modo problematico

- Calendario non viene ricaricato al cambio mese: il fetch è unico per mount e il mese filtra localmente.
- Profilo non ha un secondo consumer identico nella shell; la sovrapposizione con `useAuth` è contrattuale, non una stessa query duplicata.
- Push subscription è device state e non dovrebbe essere trasformata in server-state cache generica.

## 5. Remount/refetch causes

### Dashboard

Quando si torna su `/dashboard`, `AthleteDashboard` viene montato da zero. Il suo `useEffect` dipendente da `loadAthleteData` esegue `loadAthleteData()`, che avvia dashboard e alert. Lo stato precedente non esiste più, quindi la UI parte in `loading` anche se `AuthProvider`, subject e team context sono ancora disponibili. Inoltre il ritorno alla dashboard da un’altra route attiva in `LayoutShell` un `silentRefresh()` del profilo account; grazie alla cache/sessione questo può non generare sempre una nuova chiamata, ma può modificare i tempi di montaggio.

### Calendario

Il `useEffect` principale dipende da auth/profile/user e da `loadData`; al mount crea un nuovo `AbortController` e chiama `/api/athlete/calendar`. Il mese selezionato non è persistito: tornando alla pagina si ricrea `currentDate = new Date()` e si perdono vista, filtri e evento selezionato. Focus/online e il timer attendance possono generare ulteriori refresh mentre la pagina è montata.

### Messaggi

Il `useEffect` dipendente da `loadMessages`/user/subject chiama la lista minimal. La pagina perde lista, filtro e dettaglio al cambio route; tornando esegue anche il nuovo fetch del badge nella shell se il suo effect viene rieseguito per contesto. Un deep link può aggiungere un fetch full del messaggio dopo il fetch lista, intenzionalmente. L’apertura di un messaggio non ricarica la lista: carica il dettaglio e aggiorna localmente read state dopo conferma.

### Quote / Amministrazione

Il manager amministrazione monta un nuovo controller e chiama `/api/athlete/administration` appena auth/profile sono pronti. Perde contratto, stato e focus; `section` resta disponibile solo nella URL e viene applicato dopo il caricamento. Il ritorno dalla pagina quindi rilegge rate, certificato e domanda, anche se il dashboard li aveva già letti.

### Profilo

Il `useEffect` chiama `/api/athlete/profile` a ogni mount dopo auth/profile. Il contratto viene perso, così come il rilevamento locale della subscription push; l’endpoint ricarica memberships e dati di profilo. L’account personale nel provider non è perso, ma non sostituisce il subject profile contract.

### Cambio subject, logout e autorizzazioni

Il cambio subject non è un semplice remount: emette `SUBJECT_CONTEXT_CHANGED_EVENT`, abortisce richieste attive e svuota esplicitamente gli stati dei manager. È corretto per privacy e autorizzazione, ma richiede un nuovo fetch per il subject successivo. Il logout cancella auth state e cache PWA/client state; qualsiasi cache futura deve essere invalidata per account e subject prima o durante il logout. Un 403 porta a stato denied e non deve essere servito da cache appartenente a un altro subject.

## 6. Proposed TanStack Query mapping

Mapping concettuale, senza implementazione:

| Current manager fetch | Future query / mutation |
| --------------------- | ----------------------- |
| `AthleteDashboard.loadAthleteData()` dashboard base | `athleteKeys.dashboard(accountId, subjectProfileId, selectedTeamId)`; idealmente split in `dashboardSummary`, `upcomingEvents`, `messagePreview`, `attendanceCapabilities` se i payload diventano indipendenti |
| dashboard alert fetch | `athleteKeys.administrativeAlerts(accountId, subjectProfileId)` |
| `AthleteDashboard` detail message | `athleteKeys.message(accountId, subjectProfileId, messageId)` |
| dashboard `loadTeamDetail(teamId)` | `athleteKeys.teamDetail(accountId, subjectProfileId, teamId)` |
| `AthleteCalendarManager.loadData()` | `athleteKeys.calendar(accountId, subjectProfileId, teamFilter, from, to)`; oggi `from/to` è UI-only perché l’API restituisce tutto, ma è il punto corretto per futura lazy loading per mese |
| calendar attendance / early absence | `athleteKeys.calendar(...)` invalidation mirata o update cache dopo mutation; mutation key `athleteKeys.attendanceMutation(subjectProfileId, eventId)` |
| `AthleteMessagesManager.loadMessages()` minimal | `athleteKeys.messages(accountId, subjectProfileId, teamFilter, readFilter)`; il read filter può essere `select` locale se il server payload è già completo |
| `AthleteMessagesManager.loadMessageDetail()` | `athleteKeys.message(accountId, subjectProfileId, messageId)` |
| `BottomNavigation` `countOnly=1` | `athleteKeys.unreadMessageCount(accountId, subjectProfileId)` condivisa con dashboard; aggiornamento locale/invalidation dopo read mutation |
| `AthleteAdministrationManager.load()` | `athleteKeys.administration(accountId, subjectProfileId, seasonId)` |
| quote dentro amministrazione | `athleteKeys.fees(subjectProfileId, activeTeamIds, seasonId)` se estratte dal contratto; in alternativa restano parte della query administration |
| `AthleteProfileManager.loadProfile()` | `athleteKeys.profile(subjectProfileId, activeTeamIds)` |
| `useAuth.loadProfile()` | `accountKeys.me(accountId)`; mantiene separati auth/session e subject athlete |
| `AccessibleProfileProvider.refresh()` | `accountKeys.accessibleProfiles(accountId)` |
| `TeamProvider.loadCoachTeams()` / futuro team catalog atleta | `accountKeys.teams(accountId, subjectProfileId, role)` |

Default concettuale consigliato: `staleTime` breve per unread/attendance, più lungo per profilo e cataloghi; `gcTime` sufficiente a coprire la navigazione tra sezioni; `placeholderData`/stale-while-revalidate per evitare schermate vuote al ritorno; `enabled` vincolato a account, subject, permesso e sessione validi. Nessuna query deve usare il solo `subjectProfileId` senza account e senza validazione server-side.

I manager attuali contengono contemporaneamente fetching, business logic, trasformazione e UI state. La migrazione dovrebbe spostare fetching, stati loading/error e server transformations contrattuali nelle query/server function, lasciando nei componenti:

- modal, filtri, vista, focus e selezioni;
- trasformazioni puramente visuali (`filterCalendarEvents`, raggruppamento quote, conteggi UI);
- mutation orchestration e update/invalidation della cache;
- controlli di autorizzazione server-side, che non devono essere sostituiti da `enabled` client.

## 7. Recommended migration order

1. **Messaggi badge**: query piccola, chiave chiara e valore UX immediato; pilot a rischio basso se il contratto `countOnly=1` resta invariato.
2. **Profilo atleta**: una query isolata, nessuna mutation dati principale; richiede solo attenzione a self/delegated subject.
3. **Quote/amministrazione**: query singola di contratto, ma verificare la condivisione con dashboard alert.
4. **Messaggi lista/dettaglio**: introdurre lista e dettaglio separati, read state e invalidazione badge.
5. **Calendario**: grande payload, filtri, attendance e timer; migrare dopo aver definito key per intervallo e team.
6. **Dashboard**: ultima tra le pagine atleta perché aggrega il maggior numero di domini, ha due endpoint, modali/mutation e query già duplicate con altre pagine.
7. **Provider globali**: consolidare `accountKeys.me`, `accessibleProfiles` e team context dopo che le query di pagina sono stabili; non duplicare provider e QueryClient senza un piano di ownership.

## 8. Risks

- **Account:** ogni key deve includere l’account autenticato, non solo il profilo soggetto. Il cambio account non può riusare cache precedente.
- **Subject/athlete switching:** il subject delegato è un contesto autorizzativo. Al cambio vanno abortite richieste, cancellata o separata la cache precedente e aggiornati badge, team e unread.
- **Team switching:** la squadra restringe il dato autorizzato ma non concede accesso. Una key con team selezionata deve distinguere `all teams` da una squadra specifica.
- **Logout:** invalidare cache QueryClient e storage locale; non lasciare dati di atleta disponibili dopo sign out o dopo il cambio account.
- **Mutation:** RSVP, assenza, read state e push devono aggiornare/invalidate le query correlate. Aggiornare solo la pagina corrente lascerebbe dashboard, badge e calendario incoerenti.
- **Dati familiari/delegati:** `subjectProfileId` è solo un hint client; ogni query API deve continuare a usare `requireSubjectAthleteContext` e permessi server-side. Mai usare placeholder/cache di un subject come fallback per un altro.
- **Autorizzazioni:** un 403 non è un empty state e non va mascherato da dati cached. Le query devono distinguere denied, not found, offline ed errore tecnico.
- **Account vs subject:** `/api/me/profile` descrive il proprietario dell’account; `/api/athlete/profile` descrive il subject atleta. Unificare le key senza un contratto esplicito rischia leakage o dati incompleti.
- **Stagione:** quote, domanda iscrizione, campionati e memberships possono dipendere dalla stagione attiva. La stagione deve comparire nella key se il server contract cambia con essa.
- **PWA/offline:** oggi il service worker non salva API autenticati. Una cache TanStack Query in memoria o persistita avrebbe policy diverse e non deve essere confusa con una garanzia offline.
- **Invalidazione troppo ampia:** invalidare `dashboard` a ogni read state o filtro UI riporterebbe il problema dei refresh; preferire update mirati e query key normalizzate.

## 9. Implementation notes — foundation e pilot unread (6 ottobre 2026)

- `QueryProvider` in `src/components/providers/QueryProvider.tsx` avvolge l’albero autenticato nel root layout e crea una sola `QueryClient` per mount client. La cache è esclusivamente in-memory; non sono stati aggiunti persister, storage browser o caching API nel service worker.
- La configurazione globale imposta solo `gcTime` sufficiente alla navigazione (`30 minuti`) e refetch su focus. Lo `staleTime` resta specifico per query: il badge unread usa `15 secondi`, breve ma non nullo, per evitare refetch ravvicinati senza rendere il conteggio eccessivamente obsoleto.
- `athleteKeys.messages.unread(accountId, subjectProfileId)` include sempre account autenticato e subject atleta. Il subject personale è `account.ownerProfileId`; quello delegato è `selectedProfileId`. Il team selezionato e i filtri UI non fanno parte della key perché non cambiano la richiesta `countOnly=1`.
- `useAthleteUnreadMessageCount` conserva il contratto `/api/athlete/messages?countOnly=1`, abilita la query solo con account, subject e permesso `receive_messages` disponibili, e lascia al server le verifiche definitive tramite `requireSubjectAthleteContext`.
- Il cambio subject seleziona immediatamente una key distinta senza `placeholderData` o fallback sulla query precedente. Le cache dei subject precedenti restano separate in memoria. Il read event aggiorna solo la query unread corrente (`setQueryData` per lettura confermata, invalidazione mirata negli altri casi).
- La `QuerySessionCacheBoundary`, collocata sotto `AuthProvider`, esegue `queryClient.clear()` quando la sessione/account passa a un’altra identità o diventa nulla durante il logout. Questo impedisce il riuso della cache dell’account precedente.
- In questo pilot non sono stati migrati Dashboard, Calendario, pagina Messaggi, Amministrazione, Profilo, `AccessibleProfileProvider`, `TeamProvider` o `AuthProvider`.

## 10. TanStack Query implementation — Phase 2: Athlete Profile (6 ottobre 2026)

- `athleteKeys.profile(accountId, subjectProfileId)` identifica il contratto `/api/athlete/profile` con account autenticato e subject separati. Non include squadra selezionata, stagione o filtri UI: l’endpoint non cambia richiesta in base a questi valori.
- `useAthleteProfileQuery` in `src/lib/athlete/profile.ts` mantiene il fetch client-side con `cache: 'no-store'`, conserva la risposta `AthleteProfileContract` nella Query Cache e abilita la query solo dopo sessione/account, subject e ruolo validi. Le autorizzazioni definitive restano in `requireSubjectAthleteContext` lato server.
- Lo `staleTime` del profilo è di 5 minuti, più lungo del badge unread; il `gcTime` globale di 30 minuti consente il ritorno tra pagine senza perdere subito la cache. Non è stata introdotta persistenza browser.
- `AthleteProfileManager` usa `isPending` solo quando non esiste alcun dato. Con dati cached il profilo resta visibile durante `isFetching`/refetch e gli errori tecnici o offline diventano un banner; il 403 continua a mostrare `DelegatedAccessDenied`.
- Il cambio subject produce immediatamente una query key distinta. Non vengono usati `placeholderData` o `previousData`, quindi il subject B non può visualizzare la risposta A; la cache A può restare disponibile per un successivo ritorno autorizzato.
- Il logout/cambio account continua a usare `QuerySessionCacheBoundary`, che esegue `queryClient.clear()` quando cambia l’identità della sessione. Non è stato aggiunto un secondo meccanismo di clearing.
- Supporto push, permission browser, `PushSubscription`, stato busy ed errori subscribe/unsubscribe restano nello stato locale di `AthleteProfileManager`; subscribe/unsubscribe non invalidano la query profilo.
- Test eseguiti: suite `AthleteProfileManager.test.tsx` con first load, error/denied/offline, push, cached remount e background refetch; `npx tsc --noEmit`.
- Non sono state migrate altre pagine o provider. Resta da eseguire, se necessario, una verifica manuale network dei percorsi account-switch/logout in ambiente autenticato.

## Sintesi

- **Causa principale dei reload percepiti:** non è un document reload; è l’unmount dei manager pagina, che cancella lo stato locale e al remount avvia nuovamente il fetch con stato `loading`.
- **Manager più problematici:** `AthleteDashboard` per ampiezza e aggregazione; `AthleteCalendarManager` per payload globale, timer e attendance; `AthleteMessagesManager` per lista/dettaglio/badge e read state. Amministrazione e Profilo sono più isolati.
- **Query duplicate trovate:** messaggi tra Dashboard, pagina Messaggi e badge shell; quote/certificato tra Dashboard, alert e Amministrazione; sovrapposizione parziale account profile (`/api/me/profile`) e subject athlete profile (`/api/athlete/profile`); liste squadre ripetute in più payload.
- **Primo pilot TanStack Query consigliato:** badge unread Messaggi, oppure la query Profilo se si privilegia il rischio tecnico minimo. Il badge ha impatto UX più diretto e permette di validare account+subject key, deduplica e invalidazione dopo read state con superficie ridotta.
- **Ostacoli architetturali:** distinzione account/subject/delegato, più ruoli, più squadre, autorizzazione server-side, contratti aggregati diversi per dashboard/amministrazione, `no-store`, reset espliciti al cambio subject e assenza attuale di un QueryClient/cache provider condiviso.

## 11. TanStack Query implementation — Phase 3: Athlete Administration (6 ottobre 2026)

- `athleteKeys.administration(accountId, subjectProfileId)` identifica il contratto completo di `/api/athlete/administration`. La key non include `section`, filtri quote, squadra selezionata o stagione: l’endpoint corrente non riceve questi parametri e il payload non cambia per tali valori.
- `useAthleteAdministrationQuery` in `src/lib/athlete/administration.ts` mantiene il fetch client-side con `cache: 'no-store'`, abilita la query solo dopo sessione/account, subject e ruolo validi, e conserva nella Query Cache quote, certificato, domanda di iscrizione e l’intero contratto amministrativo. Le verifiche definitive restano server-side in `requireSubjectAthleteContext`.
- Lo `staleTime` è di 3 minuti: Administration è meno volatile di unread/attendance, ma può cambiare dopo pagamenti, ricevute o aggiornamenti amministrativi. Il `gcTime` globale di 30 minuti resta sufficiente per la navigazione tra pagine; non è stata introdotta persistenza browser.

- `AthleteAdministrationManager` usa `isPending` solo quando non esiste alcun dato. Un ritorno entro cache mostra subito il contratto; un refetch stale resta in background e gli errori vengono mostrati come banner senza sostituire una pagina già utilizzabile. Il primo errore, offline e 403 mantengono rispettivamente le UI esistenti; 403 continua a prevalere come accesso negato.
- Il cambio subject produce immediatamente una key distinta, senza `placeholderData` o `previousData`. Le cache dei subject restano separate; tornando a un subject autorizzato è possibile riutilizzare la propria cache.
- `section=certificate|fees` continua a controllare solo focus/scroll e non crea una seconda query. `AthleteFeesContent` resta presentazionale e riceve `installments` dal manager; non è stata aggiunta una query fees duplicata.
- Non sono presenti mutation nella pagina Administration. Eventuali future mutation per pagamenti/ricevute/certificati dovranno invalidare o aggiornare in modo mirato `athleteKeys.administration(accountId, subjectProfileId)` e, se necessario, sincronizzare separatamente Dashboard/alerts; tale sovrapposizione resta fuori scope.
- Il logout/cambio account continua a usare `QuerySessionCacheBoundary`, che esegue `queryClient.clear()` quando cambia l’identità della sessione. Non è stato aggiunto un secondo sistema di clearing.
- Test eseguiti: first load, errore/offline, 403, cached remount, background refetch, isolamento subject A/B, deep-link `section` senza refetch duplicato e typecheck. La verifica network manuale in ambiente autenticato resta un follow-up operativo.
- Fuori scope: Dashboard, alert Dashboard, Messaggi, Calendario, Profilo, provider globali, endpoint/API, schema DB, policy Supabase, Service Worker e duplicazioni dei contratti Dashboard/Administration.

## 12. TanStack Query implementation — Phase 4: Athlete Messages (6 ottobre 2026)

- `AthleteMessagesManager` usa query separate per lista minimal e dettaglio full. Le chiavi includono sempre `accountId`, `subjectProfileId` e, per il dettaglio, `messageId`; i filtri lettura/squadra restano locali perché il payload minimal contiene già la lista autorizzata.
- La lista usa `staleTime` di 45 secondi e il dettaglio 3 minuti. Entrambe le query rispettano il contesto account/subject, mantengono gli endpoint esistenti e passano l’`AbortSignal` di TanStack Query.
- L’apertura di un messaggio usa la query dettaglio senza rifare la lista. La lettura confermata aggiorna miratamente lista e dettaglio e continua a emettere l’evento condiviso, così la query unread esistente aggiorna il badge senza refresh completo.
- Deep link `messageId`/`subjectProfileId`, permessi delegati, errori 403/404, offline, allegati on demand e filtri UI restano compatibili con il comportamento precedente. Non sono stati modificati Dashboard, Calendario, provider globali o la query unread.

## 13. TanStack Query implementation — Phase 5: Athlete Calendar (6 ottobre 2026)

- `athleteKeys.calendar(accountId, subjectProfileId)` identifica il payload completo di `/api/athlete/calendar`. La key include account autenticato e subject atleta, ma non include `currentDate`, mese, `calendarMode`, `calView`, filtri o `selectedTeamId`: l'endpoint restituisce tutti gli eventi autorizzati e questi valori restringono soltanto la visualizzazione locale.
- `useAthleteCalendarQuery` in `src/lib/athlete/calendar.ts` conserva il contratto API invariato, passa l'`AbortSignal` di TanStack Query e mantiene le verifiche definitive in `requireSubjectAthleteContext`. La query è abilitata soltanto con account, subject, ruolo e permesso `view_schedule` validi; un 403 resta distinto da un calendario vuoto.
- Lo `staleTime` è di 2 minuti: il calendario è dinamico ma non deve rifare il GET a ogni cambio pagina. Il `gcTime` globale di 30 minuti resta sufficiente per il ritorno alla route; la cache è esclusivamente in memoria.
- `AthleteCalendarManager` non possiede più server state locale né `loadData()` manuale. `isPending` mostra il caricamento solo senza dati cached; durante un refetch stale il calendario resta visibile. Gli errori offline/tecnici sostituiscono la UI soltanto quando non esiste una risposta cached.
- I listener legacy `focus`/`online` e `runClientRefresh` sono stati rimossi dal manager: il comportamento viene gestito dai default TanStack (`refetchOnWindowFocus` e `refetchOnReconnect`) senza duplicare richieste. Il cambio mese, vista e filtri continua a essere una trasformazione del payload cached.
- Il timer `next_recalculation_at` è preservato: alla prima scadenza valida invalida soltanto `athleteKeys.calendar(accountId, subjectProfileId)`, così il server può ricalcolare availability/capability senza introdurre polling continuo.
- Attendance e early absence aggiornano in modo mirato la query calendario con `setQueryData`; la mutation periodale invalida la stessa key dopo il salvataggio. Non restano contemporaneamente `setEvents`, refresh legacy e invalidazione globale.
- Il cambio subject produce immediatamente una key distinta senza `placeholderData`/`previousData`; il reset di evento selezionato, modali e richieste di mutation resta locale. Il logout/cambio account continua a essere gestito dall'unica `QuerySessionCacheBoundary` esistente.
- Test eseguiti: suite `AthleteCalendarManager.test.tsx` con first load, cached remount senza secondo GET, error/offline, subject familiare con accesso negato e comportamento visuale calendario; `npx tsc --noEmit`.
- Fuori scope: Dashboard, Messages, Administration, Profile, endpoint/API, `AccessibleProfileProvider`, `TeamProvider`, provider globali, schema DB, RLS e Service Worker. Il dettaglio evento e il modal di assenza mantengono i rispettivi contratti on demand esistenti.

## 14. TanStack Query implementation — Phase 6: Athlete Dashboard (8 ottobre 2026)

- `athleteKeys.dashboard(accountId, subjectProfileId)` identifica il contratto aggregato invariato di `/api/athlete/dashboard`; `selectedTeamId`, stagione e filtri restano fuori dalla key perché sono filtri/rendering locali sul payload già autorizzato.
- `athleteKeys.dashboardAlerts(accountId, subjectProfileId)` identifica separatamente `/api/athlete/dashboard/alerts`. Dashboard usa `staleTime` di 90 secondi; gli alert amministrativi usano 3 minuti. I default globali del `QueryClient` non sono stati modificati.
- `useAthleteDashboardQuery` e `useAthleteDashboardAlertsQuery` in `src/lib/athlete/dashboard.ts` passano l’`AbortSignal`, mantengono `cache: 'no-store'`, distinguono offline/sessione/403 e lasciano le verifiche definitive a `requireSubjectAthleteContext` lato server. Il payload e gli endpoint non sono stati riscritti.
- `AthleteDashboard` non possiede più il server state aggregato in `useState`, né `loadAthleteData`, né i listener legacy `online`/`visibilitychange` e `runClientRefresh`. Focus e riconnessione sono gestiti dalla foundation TanStack Query; il timer `next_recalculation_at` invalida soltanto la key Dashboard.
- Il ritorno con dati cached mantiene la Dashboard visibile durante `isFetching`; gli alert non bloccano il rendering principale e un errore di background refetch non sostituisce una Dashboard già disponibile. Modali, selezioni, feedback e busy state restano locali.
- Il dettaglio messaggio riusa `useAthleteMessageDetailQuery` e la key condivisa con la pagina Messaggi. Il read event aggiorna miratamente preview/count della Dashboard; la query unread del badge resta l’ownership dedicata e non è stata duplicata.
- Il dettaglio squadra on demand usa `useAthleteTeamDetailQuery` e `athleteKeys.teamDetail(accountId, subjectProfileId, teamId)`, mantenendo le stesse query Supabase client-side e le stesse policy. Il cambio subject blocca la visualizzazione del contesto precedente finché la nuova key non è attiva.
- RSVP e early absence aggiornano solo `upcomingEvents` della cache Dashboard con `setQueryData`; non viene invalidata l’intera Query Cache. Il contratto aggregato resta la fonte di verità per i successivi refetch.
- Fuori scope: endpoint/API, schema DB, RLS, Service Worker, consolidamento dei contratti Dashboard/Administration e rimozione del campo unread duplicato dal payload Dashboard.

## Phase 6B — Cross-query cache synchronization (8 ottobre 2026)

- I test manuali hanno evidenziato che le mutation attendance/early absence aggiornavano solo la cache della pagina d’origine e che il read state aggiornava solo alcuni consumer. Il problema era cross-cache, non di endpoint o staleTime.
- `src/lib/athlete/cache-synchronization.ts` centralizza `syncAthleteAttendanceCaches` e `syncAthleteMessageReadCaches`. Gli helper contengono solo aggiornamenti mirati di cache già presenti; `getQueryData` evita di creare payload Dashboard/Calendar/Messages parziali per route mai visitate.
- Attendance e early absence aggiornano bidirezionalmente `athleteKeys.dashboard(accountId, subjectProfileId)` e `athleteKeys.calendar(accountId, subjectProfileId)`. Le capability/availability vengono propagate solo quando il chiamante dispone del valore deterministico già calcolato; non viene ricostruito uno stato server-derived sconosciuto.
- Il read state aggiorna, se presenti, lista messaggi, dettaglio, query unread e preview/count Dashboard. La query unread resta la cache canonica del badge shell; `MessageDetailModal` continua a emettere il custom event legacy, che ora richiama lo stesso helper invece di decrementare separatamente.
- La transizione read è idempotente: lo stato precedente delle cache viene verificato e un marker per `QueryClient/account/subject/message` impedisce doppi decrementi quando mutation callback ed evento legacy arrivano entrambi o l’evento viene duplicato.
- Le key includono sempre account e subject; nessuna cache di un altro account/subject viene modificata. Le cache assenti restano assenti, salvo l’aggiornamento della query unread già esistente quando è presente.
- Anche la mutation di assenza su periodo propaga lo stato attendance per gli eventi selezionati alle cache già presenti; mantiene una invalidazione mirata del calendario perché la risposta non restituisce le capability complete per ogni evento. Sono rimasti fuori scope il modal dettaglio evento, gli endpoint/API, staleTime, default QueryClient, UI, provider, persistenza e refetch globali. Le invalidazioni timer già esistenti restano mirate alle rispettive query.
- Test aggiunti in `src/lib/athlete/cache-synchronization.test.ts`: attendance/early absence in entrambe le direzioni, message read tra tutti i consumer, idempotenza, cache assenti e isolamento subject.

## 15. Detail surfaces and modal caching audit (8 ottobre 2026)

### A. Detail inventory

Questo audit considera l'area atleta personale e familiare/delegata, inclusi Dashboard, Calendario, Messaggi, Amministrazione, Profilo e Campionato. Sono state escluse le modali esclusivamente amministrative/coach che non sono montate dall'area atleta.

| Entità / surface | UI component | Parent page | Data source | Fetch on open | Data lost on close | Data lost on route change |
| --- | --- | --- | --- | --- | --- | --- |
| Messaggio | `MessageDetailModal` | `/dashboard`, `/athlete/messages`, deep link `messageId` | lista minimal + `GET /api/athlete/messages?view=full&id=...` | Sì, se il dettaglio non è già nella query detail | Lo stato di selezione/modal sì; risposta resta nella Query Cache | La selezione sì; cache account/subject resta fino a `gcTime` o logout |
| Evento da Calendario | `EventDetails` → `EventDetailModal` | `/athlete/calendar` | evento completo della query calendario + `GET /api/athlete/events/detail?id=...` | Sì, sempre al mount di `EventDetails` | Sì: `data`, `error` e `retryToken` sono locali | Sì, oltre alla cache calendario; il detail non è cached |
| Evento da Dashboard | `EventDetailModal` | `/dashboard` | evento già presente nel payload dashboard | No | Solo lo stato selezionato | Sì, insieme alla query dashboard; non esiste una query detail separata |
| Squadra | `TeamDetailModal` | `/dashboard` | query Supabase client-side `teams`, schedules, coaches, members, profiles | Sì alla prima apertura per `teamId` | Lo stato selezionato sì; risposta resta nella Query Cache | Se la cache sopravvive, no; la selezione sì |
| Rata / quota | `FeeRow` espandibile | `/athlete/fees`, sezione quote di `/athlete/administration` | contratto administration (o legacy `/api/athlete/fees`) già caricato | No | Solo `expanded` locale | Il contratto legacy e l'espansione sì; la query administration resta cached |
| Certificato / domanda | sezioni inline, `section=certificate|fees` | `/athlete/administration` | `GET /api/athlete/administration` | No | Nessuna modal/detail indipendente | La pagina si smonta; il contratto resta cached |
| Documento atleta | lista inline nel profilo | `/athlete/profile` | `GET /api/athlete/profile`, metadata `athlete.documents.items` | No: non esiste apertura/download nella UI atleta corrente | Nessun detail state | Profilo precedente resta cached per account/subject |
| Allegato messaggio | link/button dentro `MessageDetailModal` | Dashboard / Messaggi | metadata nel full message; endpoint attachment on demand | Solo al click sul download, non all'apertura | URL in `attachmentUrls` locale sì | Sì; il download non viene conservato da Query Cache |
| Convocazione | `ResponsiveDetail` in `ChampionshipsManager` | `/athlete/campionati` | `GET /api/athlete/championships?view=convocation&matchId=...&clubTeamId=...` | Sì, all'apertura e al cambio club team | `convocation`, selezioni e membri sì alla chiusura | Sì; hook con stato locale |
| Partita / calendario campionato | pannelli inline, nessuna modal | `/athlete/campionati` | query group con `matches` e `standings` | No per riga partita | Solo espansione calendario/classifica | Sì, stato del group hook; nessun match detail autonomo |
| Finestra assenza su periodo | `EarlyAbsencePeriodModal` | `/athlete/calendar` | endpoint eventi per intervallo/subject, paginato | Sì quando l'utente cerca un intervallo | Risultati e selezione sì | Sì; è una workflow list, non un entity detail |

Non sono state trovate altre detail surface atleta con `Dialog`, `Sheet`, `Drawer`, `selectedMatch` o download di documento. `DetailsDrawer` e le modali del campionato presenti nel repository appartengono a flussi admin/coach oppure a form di gestione, non a una detail view atleta.

### B. Current behavior and fetch lifecycle

| Entità | Classificazione payload | Comportamento `open → close → reopen` | Cache/manual dedup attuale |
| --- | --- | --- | --- |
| Messaggio | B: la lista minimal contiene subject/data/read state ma il full aggiunge content, creator, recipients e attachments | La query detail viene richiesta una volta per `account + subject + messageId`; riaprendo mentre è in cache usa il dato cached secondo `staleTime` 3 minuti e può fare refetch se stale. La lista non viene rifatta per aprire il dettaglio | TanStack Query condivisa; `cache: 'no-store'` riguarda la richiesta HTTP, non impedisce la Query Cache |
| Evento Calendario | B: il parent ha evento, orari, squadre e attendance; il detail aggiunge descrizione/luogo/gym/creator e availability completa | Ogni chiusura smonta `EventDetails`; ogni riapertura crea `AbortController` e riparte da `setData(null)` con una nuova GET. È una richiesta ripetibile ed evitabile | Nessuna cache detail/dedup; abort solo della richiesta del mount precedente |
| Evento Dashboard | A per i campi renderizzati oggi | Nessuna GET al click; il modal legge `selectedEvent` | Query dashboard condivisa; nessun detail cache necessario per il contratto corrente |
| Squadra | B: membership contiene summary; detail aggiunge orari, staff e rosa | Prima apertura GET Supabase; riapertura usa la query `teamDetail` cached per 10 minuti | TanStack Query già presente, ma il `queryFn` è client-side Supabase e non un endpoint subject-scoped |
| Rata | A: il contratto contiene tutti i campi usati dal row espanso | Nessun fetch; il close non elimina il contratto parent | Query administration già condivisa; `FeeRow` è puro UI state |
| Convocazione | B/C: match parent contiene summary; la convocazione è un contratto dedicato già esposto dall'endpoint campionati | Il prossimo match atleta può invocare `loadConvocationData` in un effect prima dell'apertura; `openConvocationModal` invoca nuovamente lo stesso load. Quindi esiste un possibile doppio fetch per la prossima gara. Dopo close, la riapertura rifà la GET | Stato locale + `AbortController`; nessuna dedup/cache. Il server mantiene la verifica subject |
| Allegato | B per metadata, file/URL on demand | Il click può ripetere la richiesta dopo un remount; l'URL è mantenuto solo finché il modal resta montato | Nessuna cache manuale persistente; `cache: 'no-store'` |

### C. Strategy classification

| Detail | Strategia futura | Motivo |
| --- | --- | --- |
| Evento Dashboard | A — nessuna query detail | Il modal corrente usa soltanto dati già nel payload dashboard; non creare un fetch aggiuntivo senza un requisito di campi completi |
| Rata, certificato, domanda | A — nessuna query detail | Sono già contenuti nel contratto administration; filtri e apertura row sono UI state |
| Messaggio | C — query detail già esistente e condivisa | La query `athleteKeys.messages.detail(accountId, subjectProfileId, messageId)` è già riusabile tra Dashboard, Messaggi e deep link |
| Squadra | C — query detail già esistente | `athleteKeys.teamDetail(accountId, subjectProfileId, teamId)` evita il refetch tra aperture; va però riesaminato il contratto di autorizzazione client-side |
| Evento Calendario | B — query detail dedicata, potenzialmente condivisa con Dashboard | Il payload detail è più ricco del parent; il contratto server e la verifica membership già esistono in `/api/athlete/events/detail` |
| Convocazione | B — query detail dedicata | Non è contenuta nel group payload; la combinazione partita + club team identifica il dato |
| Allegato | D per il file binario/URL; metadata resta nel messaggio | Il download è un’azione autorizzata ed effimera, non server state utile da visualizzare come cache generica |
| Finestra assenza su periodo | D rispetto a questo audit detail | È una ricerca/pianificazione di eventi per intervallo e una selezione temporanea; non va trattata come detail entity. Un futuro audit separato può valutare una query collection |
| Partita inline | A per i campi attuali | Il group payload contiene data, squadre, stato, luogo e set; oggi non esiste una UI di dettaglio partita |

### D. Proposed query keys and shared consumers

Le key concettuali per le query mancanti sono:

```text
athleteKeys.events.detail(accountId, subjectProfileId, eventId)
athleteKeys.championships.convocation(accountId, subjectProfileId, matchId, clubTeamId)
```

La key evento deve rappresentare il contratto autorizzato del subject; non includere mese, modal open, vista calendario o filtri locali. La key convocazione deve includere `matchId` e `clubTeamId`; la stagione/gruppo entra solo se modifica davvero la risposta server. Le key già attive restano:

```text
athleteKeys.messages.detail(accountId, subjectProfileId, messageId)
athleteKeys.teamDetail(accountId, subjectProfileId, teamId)
```

| Entity detail | Consumer 1 | Consumer 2 | Consumer 3 | Same contract? | Shared cache possible? |
| --- | --- | --- | --- | --- | --- |
| Messaggio | Dashboard | Messaggi | deep link `messageId` | Sì per full detail; lista minimal è un contratto diverso | Sì, già possibile e già implementato |
| Evento | Calendario | Dashboard | eventuale futura card campionato | No oggi: Dashboard usa subset parent, Calendario usa full endpoint | Sì solo se tutti consumano lo stesso full contract; altrimenti Dashboard resta A |
| Squadra | Dashboard | — | futura profile/campionato solo se introdotta | Detail query attuale unica; summary appare anche in più parent payload | Sì tecnicamente; prima verificare subject-scoping del `queryFn` |
| Convocazione | Campionato, prossima gara | Campionato, modal aperta | deep link futuro se aggiunto | Sì: stessa coppia match/club team e endpoint view | Sì, soprattutto per evitare prefetch + open duplicati |
| Quote | Administration | Dashboard/alerts con contratti diversi | — | No: summary dashboard e contratto administration non sono lo stesso payload | Condividere solo dopo normalizzazione esplicita; oggi preferire invalidazioni mirate |

### E. Parent payload versus detail payload

- **Messaggio:** la lista minimal e il full condividono id, subject, date, stato lettura e parte del mittente. Solo full aggiunge corpo completo, recipients normalizzati e attachments. Non usare la lista come `initialData` del detail se il modal deve dichiararsi completo: mostrerebbe correttamente un eventuale summary, ma può mascherare l'assenza del body/attachments e rendere ambiguo il loading.
- **Evento:** il calendario contiene id, title, tipo, date, team ids/names e attendance; il detail aggiunge descrizione, gym/address, creator, team autorizzati e attendance availability ricalcolata. Il Dashboard modal è deliberatamente A per il suo subset. Non usare automaticamente l'evento parent come `initialData` del detail calendario, perché `my_attendance`/availability e campi arricchiti potrebbero essere parziali o stantii.
- **Squadra:** la membership parent contiene nome, codice, attività e membership; il detail aggiunge schedules, coaches e athletes. È ragionevole mostrare summary mentre il detail arriva solo se la UI distingue chiaramente loading dei campi completi; non usare summary come detail completo.
- **Convocazione:** il match parent contiene solo dati gara; il detail contiene pubblicazione, membri convocati e stato del subject. Nessun `initialData` dal match per il contenuto della convocazione.
- **Quote/certificato/documenti:** il parent è già il contratto che renderizza i campi disponibili. Non esiste un detail payload separato da introdurre.

### F. Mutations and cache coherence

| Mutation | Detail query | Parent/list query | Other related queries | Update or invalidate |
| --- | --- | --- | --- | --- |
| `mark as read` | message detail | messages list | unread badge, Dashboard preview/count | Usare l’helper già esistente `syncAthleteMessageReadCaches`; aggiornare solo cache presenti e unread corrente, senza invalidazione globale |
| RSVP / attendance | event detail, se presente | calendar e Dashboard upcoming events | availability/capability del calendario | Aggiornamento mirato già applicato a calendar/dashboard; una futura event detail query va aggiornata se la risposta deterministica è disponibile, altrimenti invalidata solo per quella key |
| early absence / revoke | event detail | calendar e Dashboard | next-event availability | Stessa regola attendance; evitare di lasciare il modal con stato diverso dal parent |
| save convocation (solo admin/coach; non atleta) | convocation detail | championship group/match payload | next match convocation preview | Fuori dal consumer atleta in scrittura, ma una futura query condivisa dovrà invalidare `convocation(matchId, clubTeamId)` e il group query correlato dopo salvataggio |
| upload receipt / aggiornamento quota futuro | eventuale fee detail non esistente | administration, dashboard alerts/summary | certificato o enrollment solo se lo stesso mutation li modifica | Invalidare/aggiornare `administration(accountId, subjectProfileId)` e i consumer dashboard coinvolti; non creare una fee detail query solo per l’upload |
| document/certificate update futuro | metadata/document detail se introdotto | athlete profile o administration | dashboard alerts | Invalidate solo il contratto realmente modificato; URL/file non deve diventare cache persistente |

### G. Attachments and documents

- **Metadata:** può restare nel full message o nel profilo/administration parent, con cache account+subject. È il dato utile alla UI per nome file, status e disponibilità.
- **URL di download:** deve restare prodotto dall’endpoint autorizzato al momento del click. L’URL può essere breve/firmato e non deve essere assunto come autorizzazione permanente; non inserirlo in una cache condivisa senza conoscere TTL e policy.
- **Autorizzazione:** resta server-side. La query/cache deve essere separata per account e subject, ma la presenza di metadata o URL cached non concede accesso.
- **Blob/file binario:** non proporre caching TanStack in-memory del contenuto completo. Il codice attuale legge JSON con `download_url` e apre il link; il file resta fuori dalla Query Cache e dal Service Worker autenticato.
- **Riapertura:** il metadata del messaggio può arrivare dalla detail cache; il download può richiedere nuovamente un URL autorizzato dopo un remount. Questo è preferibile a conservare blob sensibili.

### H. Prefetch, freshness and loading UX

| Candidate | Priority | Conservative trigger | Rationale |
| --- | --- | --- | --- |
| Message detail | Medium | `pointerenter`/focus sul row selezionato, oppure solo click con fetch cancellabile | Payload piccolo ma l’utente può aprire molti messaggi; non prefetcheare tutta la lista |
| Event detail | Medium | click prima dell’apertura oppure `pointerenter` solo su evento evidenziato | Il parent contiene già molto; il full endpoint calcola attendance/permission e non va moltiplicato per tutti gli eventi |
| Team detail | Medium | pointer/focus sulla membership row, non `visible` per tutte le squadre | Detail include rosa/staff e può essere relativamente grande |
| Convocazione prossima gara | Alto, limitato a una sola gara | prefetch del next match già individuato; riusare la stessa cache all’apertura | È il dettaglio più probabile e oggi il codice lo carica già prima dell’apertura, ma senza dedup tra effect e modal |
| Allegati/documenti | Basso / evitare | click esplicito download | Possibili file grandi, URL sensibili e autorizzazione puntuale |

Categorie suggerite, senza fissare valori numerici ulteriori:

- **Molto breve:** eventuale attendance/event detail se la availability è sensibile al tempo e alle deadline.
- **Breve:** message detail e convocazione se pubblicazioni/read state possono cambiare durante la sessione.
- **Medio:** event detail generale e administration/metadata documenti.
- **Lungo:** team detail e cataloghi relativamente stabili.

Tutte le detail query devono usare `isPending`/skeleton del solo modal quando non esiste data. Con cached data il modal deve restare immediatamente leggibile durante `isFetching`; errori di background diventano stato non bloccante, mentre 403/404 restano distinti da empty. `gcTime` deve coprire apertura, chiusura, navigazione ad altra pagina e ritorno; il logout/account switch deve continuare a usare `QuerySessionCacheBoundary` e `queryClient.clear()`.

### I. Privacy, deep links and recommended implementation order

Ogni query proposta deve includere `accountId`, `subjectProfileId` quando il subject modifica il contratto, e l’entity ID. Questo è necessario per messaggi delegati, documenti, quote, membership di squadra ed eventi autorizzati. Il server deve continuare a validare account, role, subject access e membership: una key diversa isola la cache, ma non sostituisce RLS/API authorization. Nessuna query deve usare dati cached del subject A come placeholder per B. Un deep link `messageId` è già gestito senza dipendere dalla lista: dopo la lista, se l’id manca, viene richiesta direttamente la detail query. La stessa modalità è il modello da mantenere per eventuali deep link evento/convocazione futuri.

Ordine consigliato, dal minor rischio/maggior beneficio alla maggiore complessità:

1. **Verifica e test di riuso del messaggio detail** tra Dashboard, Messaggi e deep link; è già migrato e richiede soprattutto network/account-switch validation.
2. **Dedupe della convocazione next match** tramite una futura query condivisa `matchId + clubTeamId`; alto beneficio e contratto endpoint già disponibile.
3. **Migrazione del dettaglio evento calendario** a query detail condivisa; è il principale fetch ripetuto evitabile rimasto tra i modal atleta.
4. **Revisione del team detail**: mantenere la key esistente, ma valutare un endpoint/server contract subject-scoped prima di riusarlo fuori Dashboard.
5. **Prefetch conservativo** di messaggio/evento/team solo dopo aver misurato apertura reale e payload; nessun prefetch di massa.
6. **Audit separato dei campionati** per catalog/group cache e mutation convocation; non confondere group query con match detail finché le righe partita restano inline.
7. **Documenti/ricevute** solo se viene introdotta una vera UI di apertura/download; cache metadata separata, file binario fuori dalla Query Cache.

Conclusione dell’audit: i fetch ripetuti sicuramente evitabili sono il dettaglio evento calendario a ogni riapertura e, potenzialmente, la convocazione caricata sia dal prefetch del next match sia dall’apertura modal. Messaggi e squadra sono già coperti da detail query in-memory; eventi Dashboard, quote, certificati e match inline sono già coperti dal parent payload e non richiedono nuove detail query nel contratto corrente.

## 16. TanStack Query implementation — Athlete Convocation deduplication (8 ottobre 2026)

- `athleteKeys.championships.convocation(accountId, subjectProfileId, matchId, clubTeamId)` identifica il contratto della convocazione atleta. Non include modal state, tab o filtri UI; `clubTeamId` resta obbligatorio perché la stessa partita può avere convocazioni diverse per club team.
- `src/lib/athlete/convocations.ts` centralizza query options, `queryFn`, normalizzazione del payload e `prefetchAthleteConvocation`. Il contratto HTTP resta invariato: `GET /api/athlete/championships?view=convocation&matchId=...&clubTeamId=...`, con `subjectProfileId` aggiunto solo nel contesto familiare/delegato.
- Il prefetch del next match e il modal usano la stessa key e le stesse query options. `openConvocationModal` aggiorna soltanto selezione/modal state per l’atleta; se il prefetch è in corso, l’observer del modal si aggancia alla stessa richiesta senza una seconda GET.
- Il `staleTime` è di 60 secondi: breve per consentire una nuova pubblicazione/modifica della convocazione durante la sessione, ma sufficiente per `open → close → reopen` senza refetch immediato. Non è stato introdotto un `gcTime` speciale: resta il default globale di 30 minuti.
- `isPending`/loading viene applicato solo al detail modal. Con dati cached la convocazione resta visibile durante un eventuale background refetch; errori offline, 403 e tecnici mantengono stati distinti. Il cambio `clubTeamId` produce una key diversa e non usa dati del team precedente come placeholder.
- Account e subject effettivi entrano sempre nella key; il cambio subject seleziona una cache distinta e il logout/account switch continua a essere gestito dall’unica `QuerySessionCacheBoundary`. Le autorizzazioni definitive restano nel route handler esistente.
- Il percorso coach/admin conserva il proprio hook locale e il proprio flusso di modifica; la migrazione riguarda soltanto il consumer atleta e non modifica mutation, endpoint o business rule.
- Test aggiunti: `src/lib/athlete/convocations.test.ts` verifica deduplicazione di due prefetch concorrenti e separazione della cache tra club team diversi. Verificati anche typecheck e suite UI campionato esistenti.

## 17. TanStack Query implementation — Calendar Event Detail (8 ottobre 2026)

- `athleteKeys.events.detail(accountId, subjectProfileId, eventId)` identifica il contratto esistente di `GET /api/athlete/events/detail?id=...`. Mese, vista, filtri, squadra selezionata, modal state, RSVP e capability non fanno parte della key: il route handler ricava dal subject il contesto autorizzato e il risultato è identificato dall'evento.
- `src/lib/athlete/event-detail.ts` centralizza `useAthleteEventDetailQuery`, il `queryFn`, gli errori offline/403/404/tecnici e il contesto account/subject. La richiesta conserva `cache: 'no-store'`, passa l'`AbortSignal` di TanStack e lascia invariata l'autorizzazione server-side di `requireSubjectAthleteContext` e membership event.
- `EventDetails` in `AthleteCalendarManager` non possiede più `useState(data)`, `loadDetail` o `AbortController` propri. Il modal osserva la Query Cache; chiudere e riaprire lo stesso evento riusa il dato entro lo `staleTime` di 60 secondi. Non viene usato il Calendar event come `initialData`, perché il detail aggiunge descrizione, gym, creator e availability completa.
- Con dati cached, un errore di background non svuota il modal. Senza cache restano distinti offline, 403, 404 ed errore tecnico. Non è stato aggiunto un timer al detail: `attendance_availability.next_recalculation_at` continua a essere gestito dal timer Calendar; il detail usa staleTime breve e revalidation al successivo utilizzo, evitando un secondo timer/polling.
- `syncAthleteAttendanceCaches` aggiorna ora anche `athleteKeys.events.detail(...)`, ma solo quando `getQueryData(detailKey)` restituisce una cache già presente. RSVP ed early absence da Calendario, Dashboard o modal condividono quindi la stessa ownership e aggiornano subito detail, Calendar e Dashboard senza refetch globale. Le capability vengono propagate solo quando il patch le fornisce; altrimenti il detail conserva il valore cached.
- L’assenza su periodo aggiorna i campi deterministici del detail già presente e invalida soltanto quelle detail key coinvolte con `refetchType: 'none'`, perché la risposta batch non restituisce capability complete. La successiva apertura può quindi ricalcolare il detail dal server senza invalidare tutte le event detail dell’account.
- Il Dashboard non è stato collegato automaticamente alla detail query: il suo modal continua a usare il parent payload e non introduce un fetch aggiuntivo.
- Test aggiunti in `src/lib/athlete/event-detail.test.ts` e ampliati in `src/lib/athlete/cache-synchronization.test.ts`: riuso della cache close/reopen, key distinte per evento/subject, aggiornamento della detail cache già presente, mancata creazione di detail cache assenti e isolamento subject. Verificati anche i test Calendar/EventDetailModal esistenti.
