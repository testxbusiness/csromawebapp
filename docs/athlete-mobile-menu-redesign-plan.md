# Athlete Mobile Menu Redesign — audit e piano operativo

Stato: Goal 1 completato il 14/10/2026
Branch: `athlete-mobile-menu-redesign`  
Perimetro: audit del repository e piano di implementazione. Nessuna modifica funzionale o visuale è stata introdotta con questo goal.

## 1. Baseline e conclusioni rapide

L’app usa Next.js App Router, React client components per la shell autenticata e un `QueryClient` condiviso per server state. Le route atleta sono:

| Destinazione | Route reale | Componente principale |
| --- | --- | --- |
| Oggi | `/dashboard` | `src/app/dashboard/DashboardClient.tsx` / `AthleteDashboard` |
| Calendario | `/athlete/calendar` | `AthleteCalendarManager` |
| Campionato | `/athlete/campionati` | `AthleteChampionshipsManager` |
| Messaggi | `/athlete/messages` | `AthleteMessagesManager` |
| Amministrazione | `/athlete/fees` | `AthleteAdministrationManager` |
| Profilo | `/athlete/profile` | `AthleteProfileManager` |

La bottom navigation personale ha già cinque elementi e nell’ordine desiderato: Oggi, Calendario, Campionato, Messaggi, Profilo. Il burger mobile invece apre ancora `RoleSidebar` con sei elementi, incluso Amministrazione. Il redesign deve quindi intervenire principalmente sulla shell mobile e sul modello di navigazione secondaria, non sulle route.

La route storica `/athlete/fees` è già stata trasformata concettualmente in Amministrazione e contiene domanda di iscrizione, certificato e quote. Il profilo non contiene ancora un hub né un summary amministrativo. Gli alert amministrativi di Oggi già riusano certificato/quote e linkano alla pagina Amministrazione.

## 2. Audit navigazione Athlete

### Shell autenticata e montaggio

`src/app/layout.tsx` monta, nell’ordine, `AuthProvider`, `QueryProvider`, `QuerySessionCacheBoundary`, `AccessibleProfileProvider`, `TeamProvider` e `LayoutShell`. Non esistono nested layout specifici per `/athlete`; la shell è globale e decide il comportamento in base a pathname, ruolo e area attiva.

`src/components/navigation/LayoutShell.tsx`:

- determina l’area autenticata per `/dashboard`, `/athlete`, `/coach` e `/admin`;
- monta `AppHeader`, sidebar desktop, `NextStepViewport` e `BottomNavigation`;
- mantiene lo stato locale `mobileMenuOpen`;
- apre il drawer quando `AppHeader` invoca `onMenuOpen`;
- monta `RoleSidebar variant="mobile"` nel drawer;
- aggiunge al drawer account, ruolo e logout;
- usa `router.back()` per il back sui detail mobile;
- invoca `silentRefresh()` entrando in Dashboard o Profile da un’altra route.

È condiviso da Athlete, famiglia, Coach e Admin. Ogni modifica al drawer/header deve essere condizionata al contesto atleta/famiglia e non deve alterare la shell Admin/Coach.

### Header

`src/components/navigation/AppHeader.tsx` è condiviso. Per `mobile-root` mostra il pulsante menu; per `mobile-detail` mostra la freccia back; il logo è sempre un `Link` a `/dashboard`; utilities e logout sono ricevuti come slot.

In `LayoutShell`:

- Dashboard usa `variant="mobile-root"`;
- tutte le altre route usano `variant="mobile-detail"`;
- il tema è fornito tramite `ThemeToggle` in `utilities`;
- il logout è esposto nell’header da `sm` in su e nel drawer mobile;
- il logo punta correttamente a Dashboard/Oggi, anche quando l’utente è in Amministrazione o Profilo.

Rischio: rimuovere il menu in modo globale romperebbe Coach/famiglia e l’accesso mobile alle destinazioni secondarie. Il pulsante deve sparire almeno per Athlete personal e per la vista famiglia selezionata solo dopo aver definito dove collocare le azioni secondarie.

### Drawer e sidebar

`src/components/navigation/RoleSidebar.tsx` è condiviso tra sidebar desktop, drawer mobile e sidebar Admin.

- `athleteItems` contiene attualmente sei voci: Oggi, Campionati, Calendario, Messaggi, Amministrazione, Profilo.
- `getItemsForRole()` restituisce questi item per il ruolo `athlete`.
- per `family_member`, `resolveFamilyNavigation()` filtra le voci in base ai permessi e divide il risultato in `items.slice(0, 5)` e `moreItems`.
- `variant="mobile"` usa gli stessi item del desktop e aggiunge una descrizione, quindi oggi è un menu completo, non un menu secondario dedicato.
- l’active state usa `pathname.startsWith(href)`; per le voci di cambio area gestisce anche `activeArea` e `selectedProfile`.
- Coach usa `coachItems` più `coachMoreItems`; Admin usa gruppi separati.

La modifica non deve eliminare `RoleSidebar` dal desktop né cambiare i gruppi Admin/Coach. Il comportamento target per Athlete è: nessun drawer mobile; le cinque destinazioni restano in `BottomNavigation`; Amministrazione è raggiungibile dal Profilo e resta una route separata.

### BottomNavigation

`src/components/navigation/BottomNavigation.tsx` contiene:

- `personalItems`, già composto da esattamente cinque destinazioni target;
- `coachItems`, anch’esso di cinque elementi ma con semantica Coach;
- mapping famiglia tramite `familyIcons` e `resolveFamilyNavigation()`;
- badge unread per Messaggi via `useAthleteUnreadMessageCount()`;
- active state basato sul pathname.

Il CSS in `src/app/globals.css` mostra la barra solo fino a 768px, con cinque colonne di default e regole per conteggi inferiori. `LayoutShell` la monta per Coach e per Athlete/famiglia quando l’area è personal oppure esiste un soggetto selezionato.

Gap rilevante: su `/athlete/fees`, l’active state della bottom navigation non attiva Profilo perché confronta solo il pathname con `/athlete/profile`. Il redesign deve introdurre un mapping concettuale `Amministrazione -> Profilo` nell’active state, senza aggiungere una sesta voce.

### Routing, back e dipendenze

- Il logo CS Roma è già shortcut a `/dashboard`.
- Il back usa la history browser con `router.back()`; non è un link fisso al Profilo.
- `/athlete/fees?section=certificate|fees` usa query params per il focus accessibile su una sezione amministrativa.
- i link degli alert Dashboard preservano `subjectProfileId` per la vista famiglia.
- `/athlete/calendar`, `/athlete/messages` e `/athlete/fees` usano `PageHeader`; Profile e Campionati hanno intestazioni interne.

## 3. Audit Profile

### Route, componenti e dati

`src/app/athlete/profile/page.tsx` monta direttamente `AthleteProfileManager`.

`src/components/athlete/AthleteProfileManager.tsx` usa `useAthleteProfileQuery()` e mostra:

- identità e numero di squadre;
- contatti: email, telefono, data di nascita;
- tesseramento e numero tessera;
- squadre e numeri di maglia;
- documenti autorizzati;
- stato account, ruoli e richiesta cambio password;
- notifiche push;
- installazione PWA.

La gestione push/PWA è locale al browser: `usePush`, `Notification`, `PushManager`, service worker e `InstallPwaButton`. Non è server state da spostare nel QueryClient.

### Query e contesto

`src/lib/athlete/profile.ts` usa `useQuery` con:

- key `athleteKeys.profile(accountId, subjectProfileId)`;
- account: `account.authUserId`;
- subject: `selectedProfileId ?? account.ownerProfileId`;
- request `/api/athlete/profile`, con `subjectProfileId` solo nella vista famiglia;
- `staleTime` 30 minuti, `gcTime` 60 minuti, `refetchOnWindowFocus: false`, `refetchOnReconnect: false`;
- retry disabilitato e distinzione 403/offline/error.

Le key sono correttamente isolate per account e subject. Il server continua a validare il contesto tramite `/api/athlete/profile` e il resolver soggetto.

### Classificazione per il futuro Profile hub

| Categoria | Dati/componenti attuali | Direzione prevista |
| --- | --- | --- |
| A. Main Profile | identità, contatti essenziali, numero squadre, tesseramento, stato sintetico | mantenere come overview compatta e leggibile |
| B. Summary | numero squadre, stato tesseramento, documenti disponibili, eventuali stati amministrativi | trasformare in card/righe riepilogative con link |
| C. Sottosezioni | documenti, amministrazione, notifiche, PWA, account/sicurezza, aspetto, logout | spostare in destinazioni secondarie del Profilo |
| D. Tecnico/non utile direttamente | elenco ruoli grezzo, `must_change_password` come dato interno, dettagli di stato account non necessari | non esporre in forma tecnica; sostituire con copy orientato all’azione |

Tema e logout non sono oggi dentro Profile: tema arriva da `ThemeToggle` nell’header e logout da `LayoutShell`. La loro collocazione nel Profile è quindi un cambiamento di shell e non solo di markup Profile.

## 4. Audit Administration

### Route e contratto

`src/app/athlete/fees/page.tsx` mantiene la route storica `/athlete/fees`, ma il titolo è “Amministrazione”. Monta `AthleteAdministrationManager` dentro `Suspense`.

`src/components/athlete/AthleteAdministrationManager.tsx` usa `useAthleteAdministrationQuery()` e compone:

1. domanda di iscrizione, con stato Consegnata/Da consegnare;
2. certificato medico, con stato Valido/In scadenza/Scaduto/Da consegnare;
3. quote associative, tramite `AthleteFeesContent` riusato da `AthleteFeesManager`.

Le sezioni vengono renderizzate solo se presenti nel contratto autorizzato. Per la famiglia la data del certificato resta nascosta, mentre il permesso viene rispettato. 403, offline, errore e loading sono distinti.

### Query, cache e mutazioni

`src/lib/athlete/administration.ts` usa:

- key `athleteKeys.administration(accountId, subjectProfileId)`;
- endpoint read-only `/api/athlete/administration`;
- `staleTime` 15 minuti, `gcTime` 30 minuti;
- `refetchOnReconnect: true`, `refetchOnWindowFocus: false`, `refetchOnMount: true`;
- retry disabilitato.

Il contratto server condiviso è in `src/server/athlete/administration.ts`; le quote riusano `buildAthleteFeesContract`, il certificato riusa il classificatore condiviso e la domanda usa `season_profiles.enrollment_application_delivered`. Non sono necessarie nuove query per costruire il futuro summary.

`src/components/athlete/AthleteFeesManager.tsx` contiene ancora un loader legacy separato su `/api/athlete/fees`, con stato locale, abort controller e `runClientRefresh`. La route corrente di Amministrazione non usa il default manager, ma importa da quel file `AthleteFeesContent`. Questo è debito tecnico da non ampliare: il futuro Profile deve usare la cache `administration`, non introdurre un terzo fetch per le quote.

### Dipendenze Dashboard/Profile

`src/lib/athlete/dashboard.ts` e `src/lib/athlete/dashboard-contract.ts` gestiscono dashboard e alert amministrativi. Oggi il payload Dashboard include dati fee legacy per compatibilità, mentre gli alert usano certificato e quote autorizzati e linkano `/athlete/fees?section=...`. Il Profile summary dovrebbe preferire il contratto Administration già esistente oppure dati già presenti nella cache Administration; non deve creare fetch paralleli per certificato/quote.

## 5. Audit TanStack Query e sicurezza del contesto

### Ownership e sessione

`src/components/providers/QueryProvider.tsx` crea un solo `QueryClient` per la sessione browser. `QuerySessionCacheBoundary` esegue `queryClient.clear()` quando cambia la combinazione `user.id:account.authUserId`. Il logout di `useAuth` chiude la sessione, resetta lo stato auth e pulisce cache PWA; il boundary rileva poi il cambio sessione e svuota QueryClient.

La policy attuale è in-memory per QueryClient: non sono presenti persister, localStorage, sessionStorage o IndexedDB per TanStack Query. La cache profilo/account di `useAuth` in `sessionStorage` è separata e non va confusa con QueryClient.

### Key e subject switching

`src/lib/query-keys.ts` usa la gerarchia `athlete/accountId/subjectProfileId/resource`, coerente con isolamento account e soggetto. Il cambio soggetto aggiorna il context e dispatcha `SUBJECT_CONTEXT_CHANGED_EVENT`; le query con nuova key non devono usare dati del subject precedente come placeholder/initial data. Le cache precedenti possono restare in memoria per un eventuale ritorno autorizzato.

### Invalidation e refresh

Le sincronizzazioni mirate sono in `src/lib/athlete/cache-synchronization.ts` e aggiornano solo le cache già presenti per attendance e messaggi. Le mutation di calendario/championship usano invalidate mirate. `runClientRefresh` resta usato dal context profili e dal loader legacy quote; non va reintrodotto nel nuovo Profile.

Rischi da evitare nei goal successivi:

- fetch duplicato di `/api/athlete/administration`, `/api/athlete/profile` o `/api/athlete/fees`;
- waterfall Profile → Administration → singole sezioni;
- `invalidateQueries()` senza filtro;
- refresh globale per aprire una sottosezione;
- listener `online` aggiuntivi quando la query policy già gestisce reconnect;
- uso di dati Dashboard come sostituto non autorizzato del contratto Administration;
- perdita del subject/account nelle CTA con query params.

## 6. Information Architecture target validata

Target mobile primaria:

```text
Oggi       /dashboard
Calendario /athlete/calendar
Campionato /athlete/campionati
Messaggi   /athlete/messages
Profilo    /athlete/profile
```

Il target è tecnicamente compatibile con le route esistenti e con `personalItems`. Amministrazione deve restare `/athlete/fees`, ma il Profilo diventa il punto di ingresso concettuale:

```text
Profilo
├── Overview atleta
├── Da completare / stato amministrativo
│   ├── Certificato
│   ├── Iscrizione
│   └── Quote
├── Amministrazione  → /athlete/fees
├── Dati sportivi
├── Documenti
└── Account e app
    ├── Notifiche
    ├── Installazione PWA
    ├── Account e sicurezza
    ├── Aspetto
    └── Logout
```

Problemi da risolvere prima/durante l’implementazione:

1. `athleteItems` non può essere usato come menu mobile dopo il redesign senza separare desktop navigation e mobile primary navigation.
2. La famiglia ha permessi che possono ridurre le destinazioni disponibili: il permission filtering esistente deve essere sempre preservato. Il vincolo delle cinque destinazioni fisse vale per Athlete personal e non deve forzare link non autorizzati nella vista famiglia. Il caso `selectedProfile === null` resta volutamente limitato a Oggi.
3. `/athlete/fees` deve risultare con Profilo attivo nella bottom bar.
4. Il back da Amministrazione deve restare history-based, mentre l’accesso dal Profilo deve essere un link deterministico con eventuale `section`.
5. Tema e logout sono oggi header/shell concerns: spostarli nel Profile richiede un contratto esplicito per desktop, Coach/Admin e famiglia.
6. L’attuale Profile espone dettagli account grezzi; il redesign deve evitare di trasformare ruoli, stato tecnico e `must_change_password` in una pagina più affollata.
7. L’amministrazione è sensibile ai permessi delegati: un summary deve mostrare solo stati derivati da sezioni autorizzate e non usare “regolare” quando una sezione è semplicemente negata.

## 7. Piano di implementazione per goal

### Goal 1 — Navigation architecture + burger removal

**Obiettivo**

Rimuovere il burger/drawer dalla UX mobile Athlete senza rendere irraggiungibile alcuna funzione necessaria, mantenere cinque destinazioni primarie e rendere Profilo l’unica voce personale della bottom navigation.

**File/componenti probabilmente coinvolti**

- `src/components/navigation/LayoutShell.tsx`
- `src/components/navigation/AppHeader.tsx`
- `src/components/navigation/RoleSidebar.tsx`
- `src/components/navigation/BottomNavigation.tsx`
- `src/lib/navigation/family-navigation.ts`
- `src/app/globals.css`
- test `BottomNavigation`, `RoleSidebar`, `AppHeader` e nuovi test shell se necessari

**Attività**

- separare il menu mobile Athlete dalla sidebar condivisa;
- prima della rimozione, assicurare nell’attuale Profile un entry point minimo verso `/athlete/fees`;
- prima della rimozione, assicurare che il logout resti raggiungibile su tutti i viewport mobile interessati;
- censire le azioni oggi disponibili esclusivamente nel drawer e predisporre per ciascuna una destinazione alternativa oppure documentare perché non è necessaria nel contesto Athlete;
- non renderizzare pulsante menu/drawer nel contesto Athlete mobile;
- conservare header/back/logo e sidebar desktop;
- mantenere cinque item personali nell’ordine target;
- mappare `/athlete/fees` su Profilo come active area;
- verificare famiglia e Coach senza cambiare autorizzazioni o permission filtering né forzare cinque destinazioni nella vista famiglia.

**Non-goals**

- nessun redesign del contenuto Profile;
- nessun completamento visuale del Profile hub oltre agli entry point minimi necessari per la rimozione sicura del drawer;
- nessuna modifica API/query/database;
- nessun cambiamento alla navigazione desktop o Admin.

**Acceptance criteria**

- viewport mobile Athlete non mostra burger, overlay o drawer;
- bottom nav mostra esattamente Oggi, Calendario, Campionato, Messaggi, Profilo;
- Amministrazione non è una sesta voce e `/athlete/fees` attiva Profilo;
- il Profile corrente contiene almeno un entry point funzionante verso `/athlete/fees`;
- il logout è raggiungibile su ogni viewport mobile coperto dal goal;
- ogni azione precedentemente esclusiva del drawer ha un entry point alternativo verificato oppure una motivazione documentata;
- logo apre `/dashboard`;
- Coach, Admin, desktop e famiglia mantengono comportamento autorizzato; la famiglia conserva il permission filtering esistente.

**Test**

- Jest per BottomNavigation, RoleSidebar e AppHeader;
- test degli entry point minimi Profile → Administration e Profile/header → logout;
- test del censimento delle azioni precedentemente disponibili nel drawer;
- test di active state `/athlete/fees` → Profilo;
- typecheck/build;
- smoke manuale o Playwright a 375/390/768/1440 se l’ambiente lo consente.

**Rischi**

- cambiare `RoleSidebar` può alterare Coach/famiglia;
- la famiglia può avere meno di cinque voci per permessi e non deve essere riallineata forzatamente al set Athlete personal;
- rimuovere il drawer prima di predisporre entry point alternativi può creare una regressione funzionale;
- un controllo solo CSS lascerebbe il drawer nel DOM e non soddisferebbe il requisito UX.

**Dipendenze**

Nessuna; è il prerequisito per rendere il nuovo Profilo raggiungibile come hub.

### Goal 2 — Profile hub redesign

**Obiettivo**

Creare il nuovo hub `/athlete/profile` con overview personale e entry point alle sottosezioni, preservando i dati autorizzati e senza duplicare fetch. Il summary amministrativo dinamico non appartiene a questo goal.

**File/componenti probabilmente coinvolti**

- `src/components/athlete/AthleteProfileManager.tsx`
- `src/app/athlete/profile/page.tsx`
- `src/types/athlete-profile.ts`
- eventuali primitive UI esistenti in `src/components/ui`
- test `AthleteProfileManager.test.tsx`

**Attività**

- mantenere query profilo e key account/subject;
- ridurre l’overview a identità, dati essenziali e dati sportivi;
- aggiungere link a Amministrazione, Documenti, dati sportivi e account/app;
- conservare push e PWA come azioni interattive locali;
- predisporre gli entry point del nuovo hub senza costruire ancora il blocco dinamico “Da completare”;
- mantenere gli stati loading/error/offline/403 della query Profile;
- non esporre dettagli tecnici non necessari.

**Non-goals**

- non creare endpoint o query per singole card;
- non implementare il summary amministrativo “Da completare”;
- non usare `useAthleteAdministrationQuery` per costruire certificato, iscrizione o quote;
- non implementare ancora selector o summary dinamici di certificate/enrollment/fees;
- non spostare UI state nel QueryClient;
- non cambiare permessi, contratti API o modello account.

**Acceptance criteria**

- Profile è un hub leggibile su mobile;
- Amministrazione è raggiungibile da Profilo;
- il nuovo Profile hub espone entry point chiari alle sottosezioni previste;
- nessun summary amministrativo dinamico viene introdotto in questo goal;
- subject delegato non mostra dati del subject precedente;
- query profilo resta una sola e account/subject-aware;
- le impostazioni locali restano funzionanti.

**Test**

- test manager per dati, denied, offline, cached/background state e delegated subject;
- typecheck/build;
- verifica accessibilità link/heading/focus e smoke responsive.

**Rischi**

- sovraccaricare il Profile con contenuti già presenti in Administration;
- anticipare il summary amministrativo e creare una seconda fonte di verità prima del Goal 3;
- rompere push/PWA durante la separazione delle sezioni.

**Dipendenze**

Goal 1 per il corretto ingresso e active state; query attuali già disponibili.

**Stato implementazione — completato il 14/10/2026**

- `AthleteProfileManager` ora presenta un hub mobile-first con identità, dati essenziali, dati sportivi e accessi rapidi alle sottosezioni.
- L’entry point Amministrazione punta alla route esistente `/athlete/fees`; Documenti, Dati sportivi e Account e app usano ancore locali e non introducono query aggiuntive.
- La sezione Documenti resta condizionata a `permissions.view_documents`; i dati tecnici di account (ruoli, stato interno e flag cambio password) non vengono più esposti nell’overview.
- Push e installazione PWA restano azioni locali del browser. Gli stati Profile loading/error/offline/403, cache/background refetch e isolamento subject sono invariati.
- Aggiornati i test manager per entry point, accessibilità semantica delle heading/link e assenza di fetch amministrativi duplicati.
- Verifiche: `npm test -- --runInBand src/components/athlete/AthleteProfileManager.test.tsx` (14/14), `npx tsc --noEmit`, `npm run build`, `git diff --check`; smoke autenticato Playwright a 375×812, 390×844, 768×1024 e 1440×900 con scroll width coerente, heading/link/focus verificati, zero errori console e una sola `GET /api/athlete/profile` senza richieste Administration/Fees.
- Nessun summary dinamico “Da completare” e nessuna modifica a endpoint, contratto API, permessi o `src/types/athlete-profile.ts`.

### Goal 3 — Administration summary / cache integration

**Obiettivo**

Implementare esclusivamente in questo goal il blocco dinamico “Da completare” del Profilo, riusando contratto/cache Administration per certificato, iscrizione e quote, e mantenere `/athlete/fees` come pagina separata di dettaglio.

**File/componenti probabilmente coinvolti**

- `src/lib/athlete/administration.ts`
- `src/lib/query-keys.ts`
- `src/types/athlete-administration.ts`
- `src/components/athlete/AthleteAdministrationManager.tsx`
- `src/components/athlete/AthleteFeesManager.tsx`
- `src/server/athlete/administration.ts`
- `src/lib/athlete/dashboard-contract.ts`
- `src/components/athlete/AthleteProfileManager.tsx`
- test administration/profile/dashboard correlati

**Attività**

- definire un selector puro per stato sintetico autorizzato;
- implementare il summary “Da completare” per certificate/enrollment/fees;
- mantenere distinto “sezione non autorizzata” da “stato valido/assente”;
- usare la query Administration esistente e la stessa key account/subject;
- evitare fetch duplicati e waterfall; valutare prefetch solo se motivato e non necessario al primo passaggio;
- aggiornare/invalidate solo la query Administration quando cambiano dati amministrativi;
- documentare il loader fee legacy senza ampliarlo.

**Non-goals**

- nessuna nuova query amministrativa;
- nessuna modifica a RLS, route API, contratti server o mutation operative;
- nessun trasferimento della pagina dettaglio dentro Profile.

**Acceptance criteria**

- Profile mostra solo summary autorizzato: certificato, domanda, quote;
- il blocco “Da completare” è presente solo dopo l’integrazione della query Administration prevista da questo goal;
- stati `missing/expired/expiring/overdue/due_soon` restano semanticamente distinti;
- Amministrazione resta una pagina separata con focus `section`;
- `/athlete/fees` ha Profilo attivo in bottom nav;
- cache e invalidation sono condivise senza global refresh.

**Test**

- test del selector di summary;
- test permessi famiglia per ogni sezione;
- test cache hit/no duplicate fetch e cambio subject;
- test alert Dashboard non regressivi;
- typecheck/build.

**Rischi**

- confondere assenza di permesso con stato valido/vuoto;
- usare payload Dashboard legacy come fonte del Profile;
- creare doppia implementazione tra `AthleteFeesManager` e `AthleteAdministrationManager`.

**Dipendenze**

Goal 2; il contratto Administration di G13.1+ è già disponibile.

### Goal 4 — Mobile header cleanup

**Obiettivo**

Semplificare l’header mobile spostando azioni secondarie nel Profilo senza regressioni desktop/Coach/Admin.

**File/componenti probabilmente coinvolti**

- `src/components/navigation/LayoutShell.tsx`
- `src/components/navigation/AppHeader.tsx`
- `src/components/ui/ThemeToggle.tsx`
- `src/components/athlete/AthleteProfileManager.tsx`
- eventuali componenti account/app da estrarre
- test header/layout/profile

**Attività**

- rendere il tema accessibile dal Profile nel contesto Athlete mobile;
- rendere logout accessibile dal Profile dopo la rimozione del drawer;
- decidere se mantenere un’azione account minimale nell’header;
- preservare logo, back, subject/team switcher e header desktop;
- mantenere PWA/notifiche nel gruppo Account e app.

**Non-goals**

- non cambiare il comportamento logout/auth;
- non rimuovere il tema da Coach/Admin;
- non cambiare service worker o persistenza.

**Acceptance criteria**

- Athlete mobile non perde logout o tema;
- nessuna azione secondaria obbliga ad aprire il drawer;
- account switching/logout puliscono ancora cache e stato;
- desktop e altri ruoli restano invariati.

**Test**

- test ThemeToggle e logout;
- test session cache boundary/account switching;
- smoke mobile/desktop e tastiera/focus.

**Rischi**

- logout non raggiungibile dopo la rimozione del drawer;
- duplicazione di controlli tema tra header e Profile;
- confondere logout con una mutation Profile.

**Dipendenze**

Goal 1 e Profile hub operativo del Goal 2.

### Goal 5 — Final regression audit

**Obiettivo**

Verificare che il redesign sia completo, accessibile, account/subject-safe e isolato da Coach/Admin/desktop.

**File/componenti probabilmente coinvolti**

- nessun file predeterminato; solo fix strettamente necessari emersi dall’audit
- test/navigation e documentazione di evidenza

**Attività**

- matrice route/ruolo/viewport/theme;
- verifica deep link `/athlete/fees?section=...` e back;
- verifica subject A → subject B e logout/account B;
- verifica first visit, return navigation, background refetch e offline/error/403;
- verificare `silentRefresh()` invocato da `LayoutShell` quando si entra in Dashboard/Profile da un’altra route; documentarne necessità, richieste prodotte e impatto UX/cache, rimuovendolo solo se la verifica dimostra che è ridondante;
- verifica badge unread e logo;
- controllare che non restino drawer/burger Athlete mobile né voci amministrazione duplicate.

**Non-goals**

- nessun nuovo redesign;
- nessuna ottimizzazione non collegata a regressioni osservate;
- nessuna modifica a Coach/Admin se non per ripristinare comportamento precedente.

**Acceptance criteria**

- tutti i cinque item primari rispettano route, label e active state;
- Amministrazione è separata e raggiungibile dal Profilo;
- nessun dato account/subject attraversa logout o switch;
- controlli automatici e smoke browser sono documentati;
- `git diff --check` pulito e nessun debug logging temporaneo.

**Test**

- Jest mirato + suite rilevanti;
- `npx tsc --noEmit` se disponibile nel progetto;
- `npm run build`;
- smoke Playwright/manuale con 375×812, 390×844/905, 768×1024, 1024×768 e 1440×900, chiaro/scuro e famiglia se disponibile.

**Rischi**

- ambiente autenticato/browser non disponibile;
- differenze tra CSS breakpoint 768 e dispositivi reali;
- regressioni sottili in permessi delegati non visibili con un solo account.

**Dipendenze**

Goal 1–4 completati.

## 8. File e aree da non modificare senza nuovo requisito

- API e autorizzazione `/api/athlete/*` salvo evidenza di blocco;
- RLS, migration e schema Supabase;
- route e componenti Coach/Admin non necessari alla guardia Athlete;
- service worker e persistenza browser;
- query keys esistenti, salvo estensione coerente account + subject;
- `re_design.md` e la cronologia del piano generale: questo documento è il piano operativo specifico del redesign menu.

## 9. Verifica eseguita per Goal 0

- branch verificata: `athlete-mobile-menu-redesign`;
- repository ispezionato senza modificare codice funzionale;
- route, shell, header, drawer, bottom navigation, Profile, Administration e query/cache analizzati;
- `impeccable context` tentato ma non eseguibile perché il motore locale richiede installazione con rete e scrittura fuori workspace;
- nessun test applicativo eseguito: il goal è esclusivamente audit/documentazione;
- `git diff --check` da eseguire dopo la scrittura del documento.

## 10. Prossimo goal raccomandato

Goal 2 — Profile hub redesign.

## 11. Verifica Goal 1 — Navigation architecture + burger removal

Stato: completato il 14/10/2026.

### Implementazione

- Athlete personale mobile non passa più `onMenuOpen` a `AppHeader`: il pulsante burger non viene renderizzato e `LayoutShell` non monta overlay/drawer in questo contesto.
- Il drawer e `RoleSidebar` mobile restano disponibili per Coach e famiglia; la sidebar desktop e i flussi Admin restano invariati.
- La bottom navigation personale mantiene esattamente cinque destinazioni: Oggi, Calendario, Campionato, Messaggi, Profilo.
- `/athlete/fees` attiva Profilo nella bottom navigation senza aggiungere una voce Amministrazione.
- Il Profile corrente espone il link deterministico `Apri Amministrazione` verso `/athlete/fees`.
- Il logout Athlete personale resta raggiungibile nell’header mobile; tema, logo, back, subject switcher e team switcher restano slot della shell esistente.

### Censimento azioni prima disponibili nel drawer

| Azione | Destinazione alternativa | Verifica |
| --- | --- | --- |
| Oggi, Calendario, Campionato, Messaggi | Bottom navigation personale | test BottomNavigation |
| Profilo | Bottom navigation personale | test BottomNavigation |
| Amministrazione | Link dal Profilo a `/athlete/fees`; area attiva Profilo | test Profile + BottomNavigation |
| Logout | Pulsante `Esci` nell’header mobile Athlete | test AppHeader |
| Tema | Utility `ThemeToggle` già presente nell’header | nessuna modifica al contratto |
| Squadra / soggetto | Switcher esistenti nell’header contestuale | nessuna modifica al permission filtering |
| Account/ruolo informativo | Header desktop/account badge; non è una destinazione operativa mobile | nessuna funzione persa |

### Test e note

- Jest mirato: 4 suite, 25 test superati (`AppHeader`, `BottomNavigation`, `RoleSidebar`, `AthleteProfileManager`).
- `npx tsc --noEmit`: superato.
- `git diff --check`: superato.
- Build e smoke browser non eseguiti in questo passaggio.
- Il launcher Impeccable locale è stato trovato ma non eseguito fino al context perché l’engine 0.1.11 richiede rete e scrittura in `~/.impeccable`; è stato applicato il fallback documentato nella skill.

### Prossimo goal raccomandato

Goal 2 — Profile hub redesign.

## 12. Verifica Goal 4 — Mobile header cleanup

Stato: completato il 14/10/2026.

### Implementazione

- Nel contesto Athlete personale, il tema non viene più mostrato nell’header mobile; resta visibile nell’header desktop e continua a essere disponibile nel Profile sotto “Account e app”.
- Il logout non viene più mostrato nell’header mobile Athlete personale; il Profile espone “Esci dall’account” e riusa `useAuth().signOut()` seguito dal redirect pubblico esistente a `/login`.
- Coach, Admin, famiglia e header desktop conservano gli slot e il comportamento precedenti; non sono stati modificati service worker, persistenza o query key.
- Logo, back, subject/team switcher e bottom navigation restano invariati. Notifiche push e installazione PWA restano nello stesso gruppo “Account e app”.
- `useTheme` ora usa il tema chiaro come fallback quando `matchMedia` non è disponibile, senza cambiare il comportamento dei browser supportati.
- Il logout desktop dell’header usa classi CSS responsive dedicate: il precedente `hidden sm:inline-flex` veniva sovrascritto dalla specificità di `.cs-btn` e lasciava “Esci” visibile a 375px.

### Test e note

- Jest mirato: 4 suite, 26 test superati (`ThemeToggle`, `AppHeader`, `AthleteProfileManager`, `QuerySessionCacheBoundary`), inclusi label/aria, focus tastiera, visibilità responsive del logout e clear cache al cambio account.
- `npx tsc --noEmit`: superato.
- `npm run lint`: superato; Next segnala solo il warning già previsto sulla deprecazione futura di `next lint`.
- `git diff --check`: superato.
- Il comportamento della session cache boundary/account switching non è stato alterato: `signOut()` continua a pulire auth/PWA state e `QuerySessionCacheBoundary` resta responsabile del clear QueryClient al cambio sessione.
- Smoke browser autenticato parziale: il Profile è stato verificato a 1200px e 375px con bottom navigation, controlli tema/logout nel Profile, overflow e focus tema; il primo passaggio ha evidenziato il bug CSS del logout desktop, poi corretto. Il test CLI Playwright completo non ha potuto avviare Chromium nell’ambiente locale (`SIGTRAP` del browser), quindi la matrice completa resta nel Goal 5.

### Rischi / questioni aperte

- Il controllo tema resta icon-only ma ha label ARIA dinamica; il controllo logout ha un’etichetta esplicita e focusabile.
- Il Profile è il punto di accesso mobile per tema/logout; sul desktop i controlli restano volutamente nell’header per evitare regressioni e duplicazioni visive.

### Prossimo goal raccomandato

Goal 5 — Final regression audit.

## 13. Verifica Goal 5 — Final regression audit

Stato: completato il 14/10/2026 con limitazione runtime autenticata documentata.

### Esito

- Matrice route/ruolo/viewport/theme e controlli deep link sono documentati in [`docs/athlete-mobile-menu-redesign-goal5-evidence.md`](athlete-mobile-menu-redesign-goal5-evidence.md).
- I cinque item Athlete personali mantengono route, label e `aria-current`; `/athlete/fees` attiva Profilo e resta raggiungibile dal Profile senza duplicare Amministrazione nella bottom navigation.
- Il drawer/burger Athlete personale non viene montato; famiglia, Coach, Admin e sidebar desktop restano isolati nei rispettivi rami di `LayoutShell`.
- Account/subject safety, logout/account switch, stati offline/error/403 e background refetch risultano coperti dai test esistenti e non sono stati alterati.
- `silentRefresh()` è stato mantenuto: aggiorna il contratto sessione/account/profile quando si entra in Dashboard/Profile da un’altra route; non sostituisce né duplica i query fetch di pagina. Il dettaglio di richieste e impatto UX/cache è nella scheda evidenze.
- Logo CSRoma, unread badge, tema, back history-based e link amministrativi sono coperti dai test di navigazione/Profile.

### Verifiche eseguite

- Jest mirato: 5 suite / 41 test superati.
- Suite Jest completa: 122 suite / 499 test superati; 2 failure preesistenti fuori perimetro in `src/app/api/coach/championships/mutations/route.test.ts`.
- `./node_modules/.bin/tsc --noEmit`: superato.
- `npm run build`: superato.
- `git diff --check`: superato.
- `npx playwright test --list`: 42 test scoperti.
- Playwright runtime autenticato del browser gestito: bloccato prima dell’esecuzione da `SIGTRAP` di Chromium in `tests/e2e/global-setup.ts`.
- Smoke autenticato bounded con Chrome di sistema: superato sui viewport 375×812, 390×844, 390×905, 768×1024, 1024×768 e 1440×900; verificati cinque item, assenza burger/overflow, deep link `section=fees`, focus amministrazione e back.
- Tema verificato a 390×844: toggle da `Attiva tema scuro` a `Attiva tema chiaro` e classe root `theme-dark`.
- Verifica `silentRefresh()`: transizione autenticata Profile → Dashboard con cache calda ha prodotto 0 richieste aggiuntive `/api/me/profile`; la funzione è stata mantenuta per il controllo sessione/account/profile quando il cache path non è già risolto.
- Account famiglia locale non dual-role: la voce `Area familiare` non è disponibile, quindi subject A → B non è stato eseguito via browser; restano le coperture test/server-side.
- Browser manuale: verificata la fallback offline locale.

### File modificati

- `docs/athlete-mobile-menu-redesign-plan.md`
- `docs/athlete-mobile-menu-redesign-goal5-evidence.md`

### Rischi residui

- Ripetere la matrice browser autenticata quando Chromium e le credenziali Athlete/famiglia saranno disponibili.
- I due failure Coach mutation restano da gestire in un goal separato.

### Prossimo goal raccomandato

Nessun ulteriore goal di redesign menu: il gate è chiuso con limitazione runtime esplicita. Eventuali interventi successivi devono essere un goal separato per la suite Coach o per l’infrastruttura E2E.

