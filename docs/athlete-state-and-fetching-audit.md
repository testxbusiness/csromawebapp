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
