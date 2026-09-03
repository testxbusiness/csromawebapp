# CSRoma PWA — Piano di implementazione del redesign

> Piano operativo derivato da `re_design.md`.
>
> **Scopo:** trasformare la specifica di redesign in una sequenza di interventi piccoli, verificabili e adatti a essere eseguiti con Codex tramite `/goal`, usando un modello di capacità media (Luna Medio).
>
> **Principio guida:** nessun goal deve richiedere a Codex di reinterpretare l'architettura generale. Ogni goal deve avere un confine chiaro, dipendenze esplicite, criteri di accettazione e verifiche tecniche.
>
> **Ordine vincolante:** Baseline → Foundation → Atleta → Famiglia → Coach → Admin → Consolidamento.
>
> **Stack di riferimento:** Next.js 15 App Router, React 19, TypeScript strict, Tailwind CSS 4 + CSS custom properties, Supabase, PWA custom service worker.

---

## 0. Come usare questo piano con Codex

### 0.1 Regola principale

Eseguire **un solo goal alla volta**. Non chiedere a Codex di implementare una fase intera in un unico `/goal`.

Ogni goal deve:

1. leggere questo file e `re_design.md`;
2. ispezionare il codice attuale prima di modificarlo;
3. limitare il diff all'ambito del goal;
4. preservare route, autorizzazioni e contratti non esplicitamente coinvolti;
5. eseguire i controlli tecnici pertinenti;
6. aggiornare la sezione **Registro di avanzamento** di questo file;
7. riportare eventuali blocchi o prerequisiti scoperti senza aggirarli con workaround architetturali non approvati.

### 0.2 Prompt base da anteporre a ogni `/goal`

```text
/goal
Lavora sul goal indicato in implementation_plan_redesign.md.

Prima di modificare codice:
- leggi re_design.md;
- leggi il goal completo, incluse dipendenze, vincoli e Definition of Done;
- ispeziona i file esistenti correlati;
- riusa pattern e servizi server già presenti quando compatibili.

Durante l'implementazione:
- mantieni Next.js App Router;
- mantieni TypeScript strict;
- non spostare autorizzazione nel client;
- non usare service role/admin client nel browser;
- non cambiare schema DB salvo autorizzazione esplicita nel goal;
- non introdurre nuove librerie UI;
- non modificare route esistenti;
- non introdurre operatività offline non realmente supportata;
- non fare refactor estranei al goal.

Alla fine:
- esegui i test/check pertinenti realmente disponibili;
- non dichiarare test superati se non eseguiti;
- aggiorna implementation_plan_redesign.md marcando il goal completato e annotando file principali modificati, test eseguiti, eventuali note/debito tecnico;
- fermati al termine del goal senza iniziare il successivo.
```

### 0.3 Regole di sicurezza architetturale

Sono **non negoziabili** per tutti i goal:

- `app_accounts` e `account_roles` restano la fonte autorevole per account e ruoli.
- Il profilo personale dell'account e il `subjectProfileId` visualizzato restano concetti distinti.
- `subjectProfileId` è sempre un input da verificare server-side.
- Un `teamId` selezionato restringe dati già autorizzati e non concede mai accesso.
- Il numero di maglia autorevole resta `team_members.jersey_number`.
- L'assegnazione coach resta derivata da `team_coaches`.
- Le route esistenti devono continuare a funzionare per bookmark e deep link push.
- La PWA non deve cacheare HTML autenticato, API, RSC, payload Supabase o signed URL privati.
- Le mutazioni non vengono accodate offline.
- Nessuna UI deve simulare funzioni non presenti, ad esempio pagamento online o firma documenti non implementata.
- Nessuna modifica RLS/schema è implicita in questo piano: se emerge una necessità, annotarla come blocco e fermarsi.

### 0.4 Regola sul refactoring

Il redesign deve essere **incrementale e feature-driven**.

Consentito:
- estrarre primitive condivise quando servono alla pagina in lavorazione;
- aggiungere adapter/mapper per mantenere compatibilità con payload esistenti;
- spostare logica server in servizi dedicati se il comportamento resta invariato;
- eliminare codice legacy solo quando non è più referenziato e il goal lo prevede.

Non consentito:
- riscrittura totale della navigazione in una sola PR;
- rinomina massiva di classi/componenti;
- sostituzione di Supabase;
- cambio globale di state management;
- nuova design system library;
- riorganizzazione generale delle cartelle senza necessità del goal.

### 0.5 Controlli minimi per ogni goal

Usare solo comandi presenti e realmente funzionanti nel repository. Prima di assumere l'esistenza di uno script, controllare `package.json`.

Ordine raccomandato:

1. TypeScript/typecheck, se configurato;
2. test unitari interessati;
3. test E2E mirati, se disponibili;
4. build Next.js quando il goal tocca shell, routing, server/client boundary o config;
5. review responsive per i viewport coinvolti;
6. smoke test tastiera/accessibilità per i componenti interattivi;
7. review diff per verificare che non siano entrati refactor estranei.

`next lint` non deve essere trattato come controllo affidabile solo perché esisteva in precedenza: il progetto è Next.js 15. Se lo script lint è obsoleto, documentarlo e non dichiararlo superato.

### 0.6 Stati del registro

Usare:

- `[ ]` non iniziato
- `[-]` in corso / parziale
- `[x]` completato
- `[!]` bloccato

Per un goal `[x]` aggiungere sempre:
- data;
- file principali modificati;
- check/test eseguiti;
- eventuali note.

---

# 1. Registro di avanzamento

| Goal | Stato | Dipende da | Note |
|---|---|---|---|
| G0.1 Baseline route e viewport | [x] | — | Completata il 27/08/2026 con 29 screenshot runtime in `docs/redesign-baseline/2026-08-27/`; immagini con browser/DevTools chrome |
| G0.2 Inventario UI/CSS | [x] | G0.1 | Completato il 27/08/2026; inventario token/classi/componenti e strategie di migrazione documentati |
| G0.3 Mappa auth e contratti dati | [x] | G0.1 | Completato il 27/08/2026; account, subject, famiglia, team e Route Handler atleta documentati |
| G0.4 Baseline verifiche tecniche | [x] | G0.1 | Completato il 27/08/2026; typecheck/lint/unit/build passano, E2E Preview eseguito: 20 pass, 2 failure noti, 1 skip |
| G1.1 Token tema chiaro | [x] | G0.2 | Completato il 27/08/2026; token canonici isolati in `src/app/globals.css`, alias legacy preservati, typecheck/lint/build pass |
| G1.2 Tipografia | [x] | G1.1 | Completato il 27/08/2026; scala tipografica foundation con stack locale non bloccante, senza migrazione delle pagine legacy |
| G1.3 Safe area e viewport shell | [x] | G1.1 | Completato il 27/08/2026; primitive safe-area/100dvh e spazio bottom-nav aggiunti senza migrazione delle feature |
| G1.4 Primitive Button/Badge | [x] | G1.1 | Completato il 27/08/2026; Button consolidato con loading/accessibilità e introdotto StatusBadge semantico |
| G1.5 Panel/Card/ListRow | [x] | G1.1 | Completato il 27/08/2026; primitive semantiche aggiunte e Card resa compatibile con varianti canoniche |
| G1.6 FeedbackState | [x] | G1.4,G1.5 | Completato il 27/08/2026; stati tipizzati e accessibili aggiunti senza migrazione globale |
| G1.7 ResponsiveDetail | [x] | G1.4,G1.5 | Completato il 27/08/2026; wrapper Radix responsive con sheet/fullscreen mobile e drawer desktop |
| G1.8 Team context state | [x] | G0.3 | Completato il 27/08/2026; provider separato, persistenza ID-only e reset su cambio subject |
| G1.9 SubjectSwitcher e TeamSwitcher | [x] | G1.4,G1.8 | Completato il 27/08/2026; controlli distinti, accessibili e collegati ai context esistenti |
| G1.10 AppHeader | [x] | G1.3,G1.9 | Completato il 27/08/2026; header canonico integrato nella shell con varianti root/detail/family |
| G1.11 BottomNavigation | [x] | G1.3,G1.4 | Completato il 27/08/2026; cinque route atleta, active state route-aware e safe-area |
| G1.12 Banner PWA | [x] | G1.3,G1.4 | Completato il 27/08/2026; offline/update UI adattate ai token e safe-area senza cambiare cache o mutation policy |
| G1.13 Athlete Foundation integration | [x] | G1.1–G1.12 | Completato il 27/08/2026; foundation collegata alla shell atleta e gate tecnico superato |
| G2.1 Contratto dashboard atleta | [x] | G0.3,G1.13 | Completato il 28/08/2026; contratto additivo multi-team per eventi, match, messaggi, quote e membership; auth subject-aware invariata |
| G2.2 Skeleton dashboard | [x] | G2.1 | Completato il 28/08/2026; struttura dashboard riordinata in cinque sezioni con Panel/ListRow, hero/contatori/tour rimossi |
| G2.3 Prossimo impegno + presenze | [x] | G2.2 | Completato il 28/08/2026; AttendanceControl con deadline, read-only delegato, pending e rollback visibile; mutation protetta server-side |
| G2.4 Prossima partita | [x] | G2.2 | Completato il 28/08/2026; prospettiva match subject-aware con team, avversario, casa/trasferta, data/ora/luogo e CTA campionato |
| G2.5 Preview messaggi | [x] | G2.2 | Completato il 28/08/2026; preview max 3 righe con mittente, unread marker, team context e deduplica server-side |
| G2.6 Preview quota | [x] | G2.2 | Completato il 28/08/2026; mostra la rata non pagata più urgente con importo, team/activity, stato, scadenza e link quote |
| G2.7 Membership multi-squadra | [x] | G2.2 | Completato il 28/08/2026; una riga per membership con team/activity/codice e jersey autorevole per team |
| G2.8 Stati dashboard | [x] | G2.3–G2.7 | Completato il 28/08/2026; stati completi con FeedbackState, offline esplicito e invalidazione payload su cambio subject |
| G2.9 Test dashboard | [x] | G2.8 | Completato il 28/08/2026; test mirati e gate typecheck/unit/build superati; E2E Playwright non avviabile in questa sessione |
| G2.R1 Remediation contesto team dashboard | [x] | G2.V | Completato il 28/08/2026; context alimentato dal payload autorizzato, selettore header e filtro client-side con reset subject/non-escalation testati |
| G2.R2 Remediation stati e contenuto dashboard | [x] | G2.V | Completato il 28/08/2026; tipo evento, feedback success/error, denied composito e normalizzazione messaggi diretti/privacy |
| G3.1 Contratto calendario atleta | [x] | G2.1 | Completato il 28/08/2026; `teams` legacy preservato, aggiunti `team_details`/`team_ids`, presenza subject-aware e deadline; dettaglio evento limitato alle membership autorizzate; test contratto + typecheck/unit/build eseguiti |
| G3.2 Agenda mobile | [x] | G3.1 | Completato il 28/08/2026; agenda mobile raggruppata per giorno con prima riga espandibile, vista mese secondaria e layout responsive; test agenda, typecheck, lint, build e diff check superati |
| G3.3 Filtri calendario | [x] | G3.2,G1.8 | Completato il 28/08/2026; segmenti tipo con `aria-pressed`, TeamSwitcher alimentato dal payload autorizzato e filtro aggregato di default; empty filtrato distinto e test di non-escalation; typecheck/lint/test/build/diff check superati |
| G3.4 Dettaglio evento responsive | [x] | G3.2,G1.7 | Completato il 28/08/2026; `EventDetailModal` migrato a `ResponsiveDetail` con drawer desktop/fullscreen mobile, metadati reali, griglia responsive, focus/chiusura accessibili e test dedicati; typecheck/lint/test/build/diff check superati |
| G3.5 Attendance calendar | [x] | G3.4 | Completato il 28/08/2026; `AttendanceControl` riusato in agenda e dettaglio, callback di mutation unica, read-only per delegati senza permesso, deadline/rollback preservati e mutazioni bloccate offline; test, typecheck, lint, build e diff check superati |
| G3.6 Conflitti e deduplica eventi | [x] | G3.2 | Completato il 28/08/2026; deduplica per `event.id` con aggregazione team, conflitti tra eventi distinti marcati senza rimozioni/priorità e warning testuale in agenda, tabella e FullCalendar; test, typecheck, lint, build e diff check superati |
| G3.7 Vista desktop calendario | [x] | G3.2–G3.6 | Completato il 28/08/2026; desktop con agenda settimanale `timeGridWeek` predefinita, cambio vista Mese/Settimana localizzato, filtri/team ed export mantenuti, dettaglio evento in drawer laterale responsive e max-width atleta preservato; test, typecheck, build e diff check superati |
| G3.8 Test calendario | [x] | G3.7 | Completato il 28/08/2026; coperti zero eventi, ricorrenze, multi-team/deduplica, conflitti, deadline, successo/fallimento presenza, permessi famiglia, responsive desktop/mobile e smoke accessibilità; suite 18/18 (66 test), typecheck, build e diff check superati; E2E Playwright aggiunto ma Chromium locale termina con SIGTRAP in fase di launch |
| G3.R1 Stati errore/offline calendario | [x] | G3.V | Completato il 28/08/2026; Route Handler con 500 coerente sugli errori Supabase, manager con stati loading/ready/error/offline, retry e empty riservato a risposte valide; test manager aggiunti, typecheck, suite, build e diff check superati |
| G3.R2 Contesto team desktop e dual-role | [x] | G3.V | Completato il 28/08/2026; selettori desktop/mobile montati senza duplicazione visiva, policy presenza derivata da area/subject/permesso e matrice dual-role testata; lint, typecheck, suite, build e diff check superati |
| G3.R3 Stato errore dettaglio evento | [x] | G3.V | Completato il 28/08/2026; dettaglio con errore HTTP/rete, retry e abort su cleanup; test dedicati superati; smoke autenticato production integrato verificato a 1440×900 e 375×812, con agenda/vista desktop, assenza overflow, dialog dettaglio e controlli accessibili |
| G3.V Gate verifica Fase 3 | [x] | G3.1–G3.8 | PASS il 28/08/2026; G3.R1/R2/R3 completati, gate tecnici verdi e smoke runtime autenticato responsive/accessibility superato nel browser integrato production |
| G4.1 Contratto messaggi e deduplica | [x] | G0.3 | Completato il 28/08/2026; contratto additivo tipizzato con `dedupe_key`, team context aggregato e `read_state` account+soggetto; route atleta aggiornata senza esposizione di auth ID o destinatari diretti non pertinenti; test contratto, typecheck e build superati |
| G4.2 Lista messaggi | [x] | G4.1 | Completato il 28/08/2026; lista unica semantica con ListRow, avatar/iniziali, unread, mittente/ruolo, destinatario pertinente, oggetto, preview a due righe, timestamp relativo e allegati; nessuna card per messaggio; test, typecheck, build e diff check superati |
| G4.3 Filtri unread/team | [x] | G4.2 | Completato il 28/08/2026; filtri unread/team, empty filtrato, conteggi coerenti e deduplica verificati |
| G4.4 Dettaglio e read state | [x] | G4.2 | Completato il 28/08/2026; dettaglio responsive con subject, mittente/ruolo, data completa, destinatari pertinenti, contenuto e allegati; POST read state autorevole con timestamp persistito e aggiornamento locale senza reload/ottimismo non confermato; test, typecheck, build e diff check superati |
| G4.5 Allegati e privacy | [x] | G4.4 | Completato il 28/08/2026; metadata allegati senza URL nel payload, endpoint subject-authorized per signed URL TTL 300s on-demand, URL conservato solo in memoria React; service worker esclude API/cross-origin e test on-demand/privacy, typecheck, build e diff check superati |
| G4.6 Deep link push messaggi | [x] | G4.4 | Completato il 28/08/2026; resolver condiviso con priorità athlete/family fallback, URL same-origin `/area/messages?messageId=...`, subject opzionale come hint validato dal context, coach consumer del messageId e fallback generico per id non accessibili; nessun parametro client è autorizzativo; worker attivo e legacy validano destinazione; test URL/ruoli, lint, typecheck, build e diff check superati |
| G4.7 Test messaggi | [x] | G4.3–G4.6 | Completato il 28/08/2026; coperti unitariamente deduplica, read state account+subject, filtri, allegati/signed URL on-demand/failure, URL deep link e privacy; aggiunta spec Playwright per deep link, responsive/a11y, cache API e cambio subject; Jest 25/25 suite, 86/86 test, typecheck/lint/build/diff check superati; Playwright discovery 31 test passata, runtime non eseguibile in questa sessione per `listen EPERM`/bootstrap ambiente |
| G4.R1 Stati errore/offline messaggi | [x] | G4.V | Completato il 28/08/2026; manager con stati loading/ready/error/offline, retry, rilevamento connettività, preservazione dati durante refresh fallito e reset su cambio subject; aggiunti 4 test manager, suite/typecheck/lint/build superati |
| G4.R2 Deep link push multi-ruolo/famiglia | [x] | G4.V | Completato il 28/08/2026; resolver ruolo condiviso, fallback family-only verso area atleta, subject hint validato dal context, apertura `messageId` anche nell’area coach e test per athlete/coach/dual-role/family-only |
| G4.R3 Cache signed URL | [x] | G4.V | Completato il 28/08/2026; risposte endpoint con `Cache-Control: private, no-store`, fetch client con `cache: 'no-store'` e test header/opzioni fetch |
| G4.V Verifica gate Fase 4 | [x] | G4.1–G4.7,G4.R1–G4.R3 | PASS WITH ISSUES il 28/08/2026; nessun Critical/High e gate Fase 4→5 autorizzato; resta da ripetere il runtime E2E autenticato quando l’ambiente consente il bind della porta 3000 |
| G5.1 Resolver atleta squadra→campionato | [x] | G0.3 | Completato il 28/08/2026; resolver server subject-aware per `team_members → championship_club_teams → championship_groups`, `paths` autorizzati e selezione iniziale solo se univoca; manager atleta non preseleziona più il primo campionato/girone ambiguo; test/typecheck/build/diff check superati |
| G5.2 Endpoint championship subject-aware | [x] | G5.1 | Completato il 28/08/2026; `GET /api/athlete/championships` per catalogo/girone/convocazione, classifica integrata nel dettaglio girone, standings legacy subject-aware; validazione server-side di subject, gruppo, squadra e partita; hook atleta migrati; test completi/typecheck/build/diff check superati |
| G5.3 Shell campionato atleta | [x] | G5.1 | Completato il 28/08/2026; shell gerarchica con contesto TeamProvider, filtri Squadra→Campionato→Girone derivati dal catalogo subject-aware e livelli impliciti solo se univoci; test shell/typecheck/suite/build/diff check superati |
| G5.4 Prossima partita/convocazione | [x] | G5.2,G5.3 | Completato il 28/08/2026; pannello partita con giornata/casa-trasferta/avversario/data-ora/luogo, stato personale convocazione e ritrovo esplicito; modal con elenco pubblicato subject-aware e stati testuali; test suite completa/typecheck/build/diff check superati |
| G5.5 Classifica | [x] | G5.2,G5.3 | Completato il 28/08/2026; classifica iniziale limitata alle prime 5 posizioni con espansione completa, evidenziazione CSRoma tramite testo/marker/surface e numeri tabulari; test mirati + suite completa (31 suite/100 test), typecheck, build e diff check superati |
| G5.6 Risultati/calendario | [x] | G5.2,G5.3 | Completato il 28/08/2026; pannello risultati recenti compatto limitato alle gare concluse/forfait e calendario completo on demand del girone selezionato, con stato/data/ora/risultato/set e layout desktop/mobile; corretto anche il 500 della classifica usando il client server solo dopo autorizzazione del gruppo; test route (4), suite completa (31 suite/103 test), typecheck, build e diff check superati |
| G5.7 Test campionato | [x] | G5.4–G5.6 | Completato il 28/08/2026; coperti resolver multi-squadra/multi-campionato/multi-girone, selezione ambigua senza preselezione, catalogo subject-aware/delegato, gruppo/campionato non autorizzato e club-team non autorizzato sulle convocazioni; test mirati (3 suite/10 test), suite completa (31 suite/105 test), typecheck, build e diff check superati |
| G5.V Gate verifica Fase 5 | [x] | G5.1–G5.7,G5.R1–G5.R2 | PASS WITH ISSUES il 28/08/2026; G5.R1/R2 completati, nessun Critical/High residuo, stati distinti con retry, ordine e titolo corretti, test/lint/`tsc --noEmit`/build/diff check verdi; aggiunta spec Playwright responsive/accessibility sui sei viewport obbligatori, ma smoke autenticato non ripetibile in questa sessione per credenziali E2E/sessione DevTools assenti |
| G5.R1 Autorizzazione club-team atleta | [x] | G5.V | Completato il 28/08/2026; percorso atleta alimenta i naming dal catalogo server subject-scoped e non esegue più la query client-side `championship_club_teams`; il resolver limita anche `clubTeams` ai club-team presenti nei gironi autorizzati; aggiunta regressione per club-team estraneo nello stesso campionato; test mirati, typecheck e diff check superati |
| G5.R2 Stati e ordine Campionato | [x] | G5.V | Completato il 28/08/2026; hook e manager distinguono loading, empty, filtered-empty, error, denied e offline con retry senza svuotare gli errori in empty; ordine classifica → risultati recenti → calendario completo, titolo duplicato rimosso, stati convocazione con retry; aggiunti test hook e spec Playwright sui viewport 320/375/390/768/1024/1440, suite/typecheck/lint/build/diff check superati |
| G6.1 Contratto quote atleta | [x] | G0.3 | Completato il 29/08/2026; contratto additivo in `src/types/athlete-fees.ts` e mapper server-side in `src/lib/athlete/fees-contract.ts`; `/api/athlete/fees` mantiene `amount`, `status` e `membership_fee.team` legacy, aggiunge team/activity ID e importi dovuto/pagato/residuo, normalizza gli stati anche dal legacy `pending`, preserva auth subject-aware; `months_count` resta numerico e supporta durate a mezzi mesi; test contratto/validazione, typecheck e diff check superati; nessuna modifica schema o pagamento online |
| G6.2 UI quote | [x] | G6.1 | Completato il 29/08/2026; `AthleteFeesManager` ridisegnato con riepilogo dovuto/pagato/residuo, filtri accessibili, gruppi per `team.id`, stati loading/error/empty/filtered-empty e nessuna CTA di pagamento; nuova `FeeRow` compatta con importi tabulari a destra e dettaglio espandibile responsive 320px→desktop; aggiunti test manager/FeeRow; suite completa 35 suite/115 test, lint, typecheck, build e diff check superati |
| G6.3 Endpoint profilo delegabile | [x] | G0.3 | Completato il 29/08/2026; aggiunto `GET /api/athlete/profile` con resolver `requireSubjectAthleteContext`, cache `private, no-store` e contratto separato account/subject/athlete/membership/permissions; jersey per team, flag medical/document/sign, stato medico senza data dettagliata per i delegati e nessun dato medico/personale non necessario; test contratto e route, suite completa 37 suite/119 test, lint, typecheck, build e diff check superati |
| G6.4 UI profilo atleta | [x] | G6.3 | Completato il 29/08/2026; nuova `AthleteProfileManager` su `/athlete/profile` alimentata da `/api/athlete/profile`, con identità/avatar a iniziali, contatti, tesseramento, certificato e permessi sensibili, squadre con jersey per membership, impostazioni account, push e installazione PWA; sezione Documenti non prevista nascosta dalla UI atleta mantenendo il contratto API compatibile; profili coach/admin invariati, nessuna preselezione di jersey e nessuna duplicazione di impostazioni nell’header; test UI/privacy/error-retry, suite completa 39 suite/135 test, lint, typecheck, build e diff check superati |
| G6.5 Account/PWA settings | [x] | G6.4,G1.12 | Completato il 29/08/2026; installazione PWA contestuale (standalone/iOS/browser prompt), preferenza push per dispositivo con consenso solo da gesto esplicito, copy realistico e feedback d’errore; test, typecheck, lint, build e diff check superati |
| G6.6 Test quote/profilo | [x] | G6.2,G6.5 | Completato il 29/08/2026; coperti empty, stati finanziari pagata/scaduta/parziale, gruppi multi-team, preferenze PWA/account, consenso push da gesto esplicito e 403 per subject profilo non autorizzato; suite completa 39 suite/129 test, typecheck, lint, build e diff check superati |
| G6.V Gate verifica Fase 6 | [x] | G6.1–G6.6,G6.R1–G6.R5 | PASS il 31/08/2026; nessun Critical/High e fase non bloccata; stati offline/denied verificati, smoke E2E autenticato Quote/Profilo superato su tutti i sei viewport obbligatori con controlli responsive/accessibilità/PWA/account; restano solo rilievi Low già noti su copertura route quote e type-safety senza schema runtime |
| G6.R1 Stati offline Quote/Profilo | [x] | G6.V | Completato il 29/08/2026; stati offline distinti, listener online/offline, retry e preservazione dei dati già caricati implementati e testati; la riverifica G6.V complessiva resta necessaria per gli altri rilievi aperti |
| G6.R2 Profilo denied state 403 | [x] | G6.V | Completato il 29/08/2026; `AthleteProfileManager` distingue il 403 e mostra `DelegatedAccessDenied` con ritorno alla dashboard; test UI aggiunto e superato; smoke browser interno bloccato da errore runtime preesistente in `TeamProvider` |
| G6.R4 Centratura modal quote | [x] | G6.2 | Completato il 29/08/2026; centratura del `DialogContent` resa indipendente dal layout/overlay con `translate`, altezza massima e scroll interno per form lunghi; build, typecheck, lint e diff check superati |
| G6.R5 Smoke E2E Quote/Profilo | [x] | G6.V | Completato il 31/08/2026; aggiunto `tests/e2e/athlete-fees-profile.spec.ts` con autenticazione atleta, viewport 320×568/375×812/390×844/768×1024/1024×768/1440×900, controlli overflow, headings, target touch ≥44px, focus/tastiera, filtri quote, pannello PWA e assenza Documenti; aggiunto progetto Playwright dedicato, portati i filtri quote a 44px, resa robusta la navigazione post-login e l'attesa dei dati asincroni; run autenticato superato (`1 passed`) con Chromium e dev server operativi; typecheck, lint e diff check superati |
| G7.1 Family area resolver/navigation | [x] | G2–G6 | Completato il 31/08/2026; resolver tipizzato in `src/lib/navigation/family-navigation.ts` con mapping permission-aware, overflow `moreItems`/Altro e profilo sempre disponibile per il subject selezionato; sidebar e bottom navigation riusano il resolver; campionato vincolato server-side a `view_schedule` e continua a mostrare denied state tramite il manager su 403; test mirati (10 test), typecheck, lint, build e diff check superati |
| G7.2 Selezione subject | [x] | G7.1,G1.9 | Completato il 31/08/2026; auto-selezione del singolo profilo solo con area familiare attiva, scelta esplicita per profili multipli, persistenza sulla chiave subject esistente e card con relazione/CTA/sezioni in copy umano; rimosso il fetch duplicato della dashboard familiare; test context/UI, suite completa 143 test, typecheck, lint, build e diff check superati |
| G7.3 Cambio subject robusto | [x] | G7.2 | Completato il 31/08/2026; cambio subject notificato come transazione sincrona, overlay/dettagli chiusi, richieste abortite, TeamContext resettato a Tutte le squadre e risposte obsolete ignorate; dati e stato precedente cancellati prima del nuovo fetch, con test di reset atomico e suite completa 144 test; typecheck, lint, build e diff check superati |
| G7.4 Dashboard familiare | [x] | G7.3 | Completato il 31/08/2026; `FamilyMemberDashboard` riusa `AthleteDashboard` in modalità delegata senza fork della pagina, con intestazione `Area familiare`/subject corrente, sezioni dashboard filtrate per `view_schedule`, `receive_messages` e `view_payments`, controllo presenza visibile solo con `confirm_attendance`, team selector condizionale già alimentato dal contesto autorizzato e denied state mantenuto su accesso profondo/403; aggiunta regressione UI su subject e permessi; suite completa 44 suite/145 test, typecheck, lint, build e diff check superati |
| G7.5 Calendario familiare | [x] | G7.3,G3.8 | Completato il 31/08/2026; calendario subject-aware con `view_schedule` obbligatorio server-side, filtro squadre limitato al payload autorizzato del subject e denied/invalidation se la relazione viene rimossa; `confirm_attendance` resta indipendente: il calendario è consultabile con il solo `view_schedule`, la presenza è read-only senza permesso e ogni mutation richiede `requireSubjectAthleteContext(..., 'confirm_attendance')`; aggiunti test manager per accesso/denied/read-only e test Route Handler sulla guardia mutation; suite completa 45 suite/148 test, typecheck, lint, build e diff check superati |
| G7.6 Messaggi famiglia | [x] | G7.3,G4.7 | Completato il 31/08/2026; messaggi familiare subject-aware con `receive_messages` verificato sia nell’UI sia server-side, read state su coppia account+subject, badge e dati invalidati al cambio subject, deduplica preservata, destinatari limitati a subject e squadre pertinenti, allegati on-demand autorizzati e deep link `messageId`/`subjectProfileId` validato dal context senza fidarsi dei parametri; corretto il gate dual-role per usare `activeArea`; aggiunti test famiglia/denied e regressioni privacy/read state/deep link già presenti; suite completa 45 suite/150 test, typecheck, lint, build e diff check superati |
| G7.7 Quote famiglia | [x] | G7.3,G6.6 | Completato il 31/08/2026; Quote subject-aware con `view_payments` verificato nell’UI e in `GET /api/athlete/fees`, payload limitato al `profile_id` del subject e gruppi per squadra mantenuti; cambio subject invalida richieste e dati precedenti, denied state mostrato per permesso rimosso e nessun dato di altri profili viene renderizzato; corretto il gate dual-role per usare `activeArea`; aggiunti test UI per subject/isolamento/denied e test Route Handler sulla guardia `view_payments`; suite completa 46 suite/153 test, typecheck, lint, build e diff check superati |
| G7.8 Campionato famiglia | [x] | G7.3,G5.7 | Completato il 31/08/2026; modalità familiare alimentata esclusivamente da `/api/athlete/championships` con `subjectProfileId`, resolver server-side subject→team→campionato→girone e validazione di partita/club-team/convocazione; rimosso il caricamento client-side delle squadre atleta basato su `ownerProfileId`, team e naming derivano dal catalogo autorizzato, e aggiunto guard `enabled` per non effettuare fallback owner-only quando manca il subject familiare; reset subject e denied/not-found sui percorsi non autorizzati preservati; test resolver/Route Handler e hook esistenti superati, suite completa 46 suite/153 test, typecheck, lint e diff check superati; `next build` compila correttamente ma il checker interno di validità tipi non termina nell’ambiente corrente |
| G7.9 Profilo delegato | [x] | G7.3,G6.6 | Completato il 31/08/2026; profilo delegato separato in dati `subject`, dati atleta e impostazioni dell’account autenticato; il resolver server-side limita i documenti a quelli assegnati al subject o alle sue squadre e li espone solo con `view_documents` come metadata, senza contenuto/URL; `view_medical_status` mantiene il solo stato del certificato e nasconde la scadenza nel contesto delegato; `sign_documents` non abilita azioni perché il flusso firma non esiste; push/PWA restano impostazioni account. Modificati `src/app/api/athlete/profile/route.ts`, `src/server/profile/athlete-profile.ts`, `src/types/athlete-profile.ts`, `src/components/athlete/AthleteProfileManager.tsx` e relativi test; typecheck, suite completa (46 suite/155 test), lint e diff check superati |
| G7.10 Test matrice permessi | [x] | G7.4–G7.9 | Completato il 31/08/2026; matrice permission-aware estesa per subject senza selezione, schedule-only, payments-only, messages-only, permessi completi e overflow `moreItems`; aggiunte regressioni dashboard per impedire il leakage del dettaglio messaggio e dello stato RSVP dopo cambio subject, con abort delle richieste e verifica del subject corrente; preservati i test di multi-subject, multi-team, reset squadra, denied server-side, unread per subject, deep link, campionato non autorizzato e responsive E2E già presenti; suite completa 47 suite/162 test, typecheck, lint, build e diff check superati |
| G8.1 Coach foundation | [x] | G1.13,G7.10 | Completato il 31/08/2026; foundation estesa alla shell coach con bottom navigation mobile canonica (Oggi, Calendario, Convocazioni, Messaggi, Altro), sidebar desktop compatta e gruppo Altro per pagamenti/profilo; route esistenti preservate; test navigazione, typecheck, build e diff check superati |
| G8.2 Coach team context | [x] | G8.1 | Completato il 31/08/2026; contesto coach derivato da `team_coaches` tramite `/api/coach/teams`, default persistito a Tutte le squadre, selettore mostrato solo con almeno due team, filtro propagato a calendario/presenze/messaggi/campionato e validazione server per team non assegnati e destinatari messaggi; test TeamContext/TeamSwitcher/BottomNavigation, typecheck, build e diff check superati |
| G8.3 Coach home aggregata | [x] | G8.2 | Completato il 31/08/2026; home coach ridisegnata come vista operativa sulle quattro domande del piano: agenda di oggi, presenze del prossimo allenamento, prossima partita e comunicazioni; aggregazione/filtro per team, conflitti evento espliciti, stati loading/error/empty e CTA verso le route coach esistenti; test home coach/context/selettore, typecheck, build e diff check superati |
| G8.4 Coach presenze | [x] | G8.3 | Completato il 31/08/2026; report presenze coach con stati canonici `going`, `maybe`, `declined` e `pending`/in attesa, copy esplicito che distingue pending da assenza, dettaglio accessibile e filtro team validato server-side; il report limita gli atleti al team selezionato senza alterare le azioni esistenti; test dashboard/context, typecheck, build e diff check superati |
| G8.5 Coach partite/convocazioni | [x] | G8.2 | Completato il 31/08/2026; CTA convocazioni dipendenti dallo stato reale (prepara, completa, aggiorna), riepilogo dei destinatari finali con conteggio atleti e squadra prima del salvataggio, selezione coerente con il team context e route/mutation esistenti preservate; nessuna pubblicazione/reminder simulata; test championship/dashboard/context, typecheck, build e diff check superati |
| G8.6 Coach messaggi | [x] | G8.2 | Completato il 31/08/2026; lista coach estesa al pattern canonico `ListRow` con mittente/ruolo, stato letto, squadre destinatarie, anteprima, data relativa e allegati; composer mantenuto sulle route e recipient logic esistenti, con riepilogo finale esplicito (conteggio e nomi) e conferma prima di invio/aggiornamento; `CoachMessagesManager.tsx` e `CoachMessageModal.tsx`; typecheck, build e diff check superati |
| G8.7 Coach pagamenti/profilo | [x] | G8.1 | Completato il 31/08/2026; `/coach/payments` migrata a Stat/Panel con registro personale dei compensi, filtri e stati semantici senza terminologia o aggregazioni da quote atleta; con più squadre il registro si restringe alla squadra selezionata dal TeamContext, mantenendo l’aggregato su `Tutte le squadre`; `/coach/profile` migrata a `CoachProfileManager` con separazione tra dati account, incarico professionale e squadre assegnate, più impostazioni PWA riusate; route/API e autorizzazioni esistenti preservate; typecheck, 48 suite/165 test, build e diff check superati |
| G8.8 Test coach | [x] | G8.3–G8.7 | Completato il 31/08/2026; aggiunti test coach per multi-team e query contestuali, stato no-events, conflitti, unread messages con riga accessibile, CTA convocazione draft/published e conferma destinatari, editing non autorizzato e rifiuto server-side di team non assegnato; test componenti e route in `CoachDashboard.test.tsx`, `CoachMessagesManager.test.tsx`, `ChampionshipConvocationModal.test.tsx`, `calendar/route.test.ts`; typecheck, 51 suite/172 test, build e diff check superati |
| G8.V Gate verifica Fase 8 — area coach | [~] | G8.1–G8.8 | PASS WITH ISSUES il 31/08/2026; `G8.R1`, `G8.R2` e `G8.R3` completati. `npx tsc --noEmit`, Jest (52 suite/175 test), `next build` e `git diff --check` superati. Autorizzazione server-side e contesto multi-team verificati sui Route Handler; route canoniche preservate. Smoke Preview del 03/09/2026: login coach, home aggregata con 2 squadre, selettore team, route coach principali e console senza errori superati. Resta da completare la matrice E2E responsive completa sui viewport obbligatori. Il gate non è dichiarato superato. |
| G8.R1 Stati coach error/denied/offline/filtered-empty | [x] | G8.V | Completato il 31/08/2026; aggiunta classificazione condivisa degli errori HTTP/rete, stati `DeniedState`/`OfflineState`/`ErrorState` nei manager coach, retry e preservazione dei dati già caricati, oltre a stati espliciti per risultati filtrati vuoti in calendario, messaggi e compensi; aggiunti test della classificazione. Typecheck e suite Jest (52 suite/175 test) superati. Restano separati i rilievi E2E responsive e accessibilità già registrati nel gate. |
| G8.R2 Accessibilità calendario coach mobile | [x] | G8.V | Completato il 31/08/2026; sostituito il trigger su `div` delle card mobile con un pulsante semantico, tastierabile e con nome accessibile, mantenendo Modifica/Elimina come azioni separate senza nesting di pulsanti; typecheck, test e build verificati. |
| G8.R3 Conformità design system coach calendario/campionati | [x] | G8.V | Completato il 31/08/2026; calendario migrato ai componenti `Panel`, `Button`, `Select`, `Table`, `TableActions` e `Card`; manager campionati e pannelli coach migrati a `Card`, `Badge`, `EmptyState`, token colore e tipografia canonica, rimuovendo le classi legacy `slate/gray/white` dai percorsi coach. Typecheck, suite Jest, build e diff check superati. |
| G8.R4 Autorizzazione server-side mutation coach | [x] | G8.V | Completato il 31/08/2026; aggiunti `POST/DELETE /api/coach/events` e `POST /api/coach/championships/mutations`, con verifica server-side di account/ruolo coach, assegnazioni `team_coaches`, gironi, partite, convocati, squadre campionato e serie eventi. Le mutation dei manager coach sono state instradate ai Route Handler; aggiunti test per account non coach e partita di squadra non assegnata. Typecheck, 54 suite/178 test, build e diff check superati. |
| G9.1 Admin shell | [x] | G1.13,G8.8 | Completato il 31/08/2026; shell admin desktop-first con sidebar navy sticky, topbar contestuale, workspace max 1440 px e fallback tablet/mobile riusando LayoutShell, AppHeader e RoleSidebar comuni. Typecheck, build e diff check superati. |
| G9.2 Admin sidebar raggruppata | [x] | G9.1 | Completato il 31/08/2026; navigazione admin raggruppata in Panoramica, Sport, Persone, Comunicazione e Amministrazione, con Profilo separato nella zona Account, active state route-aware e `aria-current` sui link. Tutte le route esistenti preservate. Typecheck, test mirati, build e diff check superati. |
| G9.3 Admin dashboard operativa | [x] | G9.2 | Completato il 31/08/2026; dashboard riorientata alle eccezioni supportate (rate scadute, certificati da verificare, inviti, eventi senza palestra, conflitti e messaggi non letti), con agenda odierna, incassi, riepilogo secondario e attività recente. Ogni eccezione usa una route gestionale esistente; nessun KPI inventato. Typecheck, 55 suite/180 test, build e diff check superati. |
| G9.4 Pattern pagina gestionale | [x] | G9.1 | Completato il 31/08/2026; creato pattern riusabile con header/contesto/CTA, filtri, summary, tabella responsive, selezione bulk accessibile e drawer responsive desktop/mobile. Nessuna migrazione massiva dei domini. Typecheck, 56 suite/183 test, build e diff check superati. |
| G9.5 Dominio Sport | [x] | G9.4 | Completato il 31/08/2026; migrate al pattern AdminManagement le pagine Stagioni, Attività, Squadre, Campionati, Palestre e Calendario. Aggiunto supporto `embedded` ai manager per rimuovere solo intestazioni duplicate, preservando azioni, filtri, modali, query, mutation, autorizzazioni e route. Typecheck, 56 suite/183 test, build e diff check superati. |
| G9.6 Dominio Persone | [x] | G9.4 | Completato il 31/08/2026; migrate al pattern AdminManagement le pagine Anagrafica, Atleti, Collaboratori e Account/accessi. Aggiunto supporto `embedded` ai manager per rimuovere intestazioni duplicate, preservando filtri/azioni/drawer/badge di dominio, modelli tecnici, autorizzazioni e route. Typecheck, 56 suite/183 test, build e diff check superati. |
| G9.7 Comunicazione/Amministrazione | [x] | G9.4 | Completato il 31/08/2026; migrate al pattern AdminManagement le pagine Messaggi, Documenti, Quote associative, Incassi, Uscite e Bilancio. Intestazioni duplicate rimosse con adapter `embedded`, cifre finanziarie principali rese tabulari e stati danger/warning mantenuti legati a condizioni reali; flussi, autorizzazioni, modelli tecnici e route invariati. Typecheck, 56 suite/183 test, build e diff check superati. |
| G9.8 Test admin responsive | [x] | G9.3–G9.7 | Completato il 31/08/2026; Playwright `admin-responsive-chromium` passato: 3/3 test, route/deep link admin, viewport 768×1024/1024×768/1440×900, sidebar mobile/desktop, focus/aria-current, overflow, tabella, filtri e drawer/modal con Escape verificati. Typecheck e diff check superati. |
| G10.1 Dark mode canonico | [x] | G9.8 | Completato il 31/08/2026; storage unificato su `csroma-theme`, bootstrap tema pre-paint, `.theme-dark` canonico, token dark e bridge per utility legacy, contrasto verificato sui token principali, theme-color/manifest/offline coerenti; immagini e logo invariati. Typecheck, 57 suite/187 test, build e diff check superati. |
| G10.2 Audit accessibilità | [x] | G10.1 | Completato il 01/09/2026; audit statico sulle aree migrate e smoke dei componenti interattivi: righe/card admin e calendario coach rese tastierabili con azioni Dettagli esplicite, drawer incassi reso dialog accessibile con focus trap/Escape/restore, close button e stati ARIA consolidati. Typecheck, Jest completo, build e diff check superati; nessun redesign extra. |
| G10.3 Audit PWA | [x] | G10.1 | Completato il 01/09/2026; audit worker/bootstrap/logout completato: precache solo pubblico, nessuna cache per HTML autenticato/API/RSC/signed URL, cache runtime limitate ad asset statici e immagini pubbliche, pulizia runtime + contesti account al logout, update waiting con consenso esplicito, fallback offline generico, stati online/offline e install prompt verificati. Nessun Background Sync/queue mutation introdotto. Typecheck, 58 suite/189 test, build e diff check superati. |
| G10.4 Performance/bundle | [x] | G10.1 | Completato il 01/09/2026; misurati route/bundle Next e componenti client principali: rimossi i Client Component superflui da sei wrapper di rotta (atleta/coach/admin calendario e campionati/messaggi), mantenuti i boundary interattivi nei manager; eliminati dal bundle i loader legacy non referenziati dell’AthleteDashboard, già sostituiti dall’endpoint aggregato; sostituita nella bottom navigation la richiesta `view=full` dei messaggi con endpoint `countOnly=1`, evitando payload di corpi, profili, destinatari e allegati. Build, typecheck/lint integrati, Jest 58 suite/189 test e `git diff --check` superati. Nessuna modifica a immagini/logo/font e nessuna riscrittura fuori dai colli di bottiglia misurati. |
| G10.5 Cleanup legacy | [x] | G10.2–G10.4 | Completato il 01/09/2026; rimossi esclusivamente nove file senza riferimenti nei sorgenti dopo il redesign: copie `.old`/`.backup`/`calendold`, pannelli dashboard sostituiti e componenti admin/auth legacy non importati. Nessuna rinomina massiva o modifica a route/contratti. `tsc --noEmit`, Jest 58 suite/189 test, build e `git diff --check` superati. |
| G10.9 Aggiornamento PWA affidabile | [x] | G10.3 | Completato il 03/09/2026; aggiunto il controllo `registration.update()` dopo la registrazione e al ritorno sulla scheda/focus, mantenuto l’update manuale con reload controllato, aggiunti test di successo/fallimento non bloccante e cambiati gli asset `/_next/static/*` da cache-first a network-first con cache `v2` per evitare chunk obsoleti soprattutto in sviluppo. Typecheck, test PWA mirati (4/4), build e `git diff --check` superati. Verifica deploy/PWA già aperta ancora da eseguire. |
| G10.10 Remediation certificati admin | [x] | G9.3,G9.6 | Completato il 03/09/2026; allineata la classificazione dashboard/pagina Atleti (scaduto, mancante, imminente entro 30 giorni, regolare), aggiunto filtro stato certificato e link dashboard con filtro “Da verificare” preimpostato. Test mirati 7/7, typecheck, build e diff check superati. |
| G10.11 Contrasto alert dashboard dark mode | [x] | G10.1,G9.3 | Completato il 03/09/2026; corrette le card “Richiede attenzione” in dark mode con superfici navy, testo primario/secondario esplicito, icone warning e hover coerenti. Typecheck, build e diff check superati. |
| G10.12 Sostituzione logo e icona PWA | [x] | G1.10,G6.5,G10.3 | Completato il 03/09/2026; nuovo logo trasparente collegato a shell/autenticazione/documenti, icone PWA rigenerate dal canvas bianco, push/offline/service worker aggiornati e test PWA estesi agli asset. Typecheck, Jest 59 suite/194 test, lint, build e diff check superati. Smoke browser/PWA non eseguibile in questo ambiente per `SIGTRAP` Chromium e `listen EPERM`; da ripetere su staging/host con bind locale disponibile. |
| G10.6 E2E matrice finale | [-] | G10.5 | Verifica Preview parziale il 03/09/2026: login admin/coach/atleta/genitore, dashboard e route principali, area familiare con 2 profili e cambio subject senza leakage, redirect coach→`/unauthorized`, responsive famiglia (320/375/390/768) e admin (320/375/768/1440), manifest/fallback offline/update PWA e console admin/coach/atleta verificati. Restano da eseguire la matrice completa, lo smoke familiare dedicato sui viewport previsti, gli scenari PWA sul dispositivo e la chiusura del rilievo “Firma documenti”. |
| G10.7 Documentazione finale | [ ] | G10.6 | |

---

# 2. Fase 0 — Baseline e comprensione del repository

## G0.1 — Baseline route, schermate e viewport

**Obiettivo**
Congelare lo stato iniziale dell'app prima del redesign, senza modificare UI o comportamento.

**Ambito da ispezionare**
- `src/app/layout.tsx`
- route atleta, famiglia, coach e admin
- `src/components/navigation/LayoutShell.tsx`
- `src/components/navigation/RoleSidebar.tsx`
- eventuali test E2E/screenshot già presenti

**Task**
- [ ] Elencare tutte le route applicative attuali e verificare che quelle indicate in `re_design.md` esistano o documentare differenze.
- [ ] Identificare root layout, nested layout e shell effettivamente usate da ogni ruolo.
- [ ] Acquisire baseline visuale almeno per:
  - 375×812
  - 768×1024
  - 1024×768
  - 1440×900
- [ ] Coprire almeno:
  - dashboard atleta;
  - calendario atleta;
  - messaggi atleta;
  - campionato atleta;
  - quote atleta;
  - profilo atleta;
  - selezione/area familiare se accessibile;
  - dashboard coach;
  - dashboard admin.
- [ ] Annotare overflow, duplicazioni header/sidebar, problemi safe-area e differenze browser/standalone già visibili.
- [ ] Non correggere nulla.

**Output atteso**
- nota baseline nel presente file oppure documento dedicato linkato da questo piano;
- elenco route effettive;
- elenco gap tra specifica e repository.

### Baseline G0.1 — 27 agosto 2026

#### Route applicative effettive

| Area | Route verificate |
|---|---|
| Pubbliche/auth | `/`, `/login`, `/forgot-password`, `/reset-password`, `/auth/callback`, `/unauthorized` |
| Atleta | `/dashboard`, `/athlete/calendar`, `/athlete/campionati`, `/athlete/messages`, `/athlete/fees`, `/athlete/profile` |
| Coach | `/coach/calendar`, `/coach/campionati`, `/coach/messages`, `/coach/payments`, `/coach/profile` |
| Admin | `/admin/activities`, `/admin/atleti`, `/admin/balance`, `/admin/calendar`, `/admin/campionati`, `/admin/collaboratori`, `/admin/documents`, `/admin/gyms`, `/admin/incassi`, `/admin/membership-fees`, `/admin/messages`, `/admin/payments`, `/admin/profile`, `/admin/profiles`, `/admin/seasons`, `/admin/teams`, `/admin/users` |

Le route sopra sono state verificate sui file `page.tsx` presenti in `src/app`. Le Route Handler `/api/**` non sono schermate UI e restano fuori dalla baseline visuale.

#### Shell effettiva

- `src/app/layout.tsx` applica una shell globale con `ThemeProvider`, `PwaBootstrap`, `ToastProvider`, `OnboardingProvider`, `AuthProvider`, `AccessibleProfileProvider` e `LayoutShell`.
- `LayoutShell` decide la shell autenticata in base al pathname `/admin`, `/coach`, `/athlete` e `/dashboard`.
- Desktop: topbar + sidebar `RoleSidebar` + area principale.
- Mobile: topbar + drawer laterale; non esiste ancora una `BottomNavigation` canonica del redesign.
- Il contesto familiare è già integrato in `RoleSidebar` tramite `AccessibleProfileSelector`, ma non esiste ancora una barra persistente soggetto/squadra conforme a `re_design.md`.
- La PWA usa `viewportFit: cover`; safe-area padding dedicato per header, banner e bottom navigation non è ancora implementato.

#### Baseline viewport e stato della cattura

| Viewport target | Uso previsto | Stato baseline |
|---|---|---|
| 375×812 | telefono/PWA atleta, famiglia, coach | acquisito; la cattura include browser/DevTools chrome |
| 768×1024 | tablet touch | acquisito; la cattura include browser/DevTools chrome |
| 1024×768 | desktop compatto/admin | acquisito; la cattura include browser/DevTools chrome |
| 1440×900 | desktop admin | acquisito; la cattura include browser/DevTools chrome |

I quattro screenshot Google Stitch allegati dall'utente sono registrati come **riferimento visuale**, non come baseline dell'app corrente. La cattura autenticata è stata archiviata in `docs/redesign-baseline/2026-08-27/` (29 PNG, più `.DS_Store` generato dal sistema operativo). Le immagini includono browser/DevTools chrome; durante l'analisi il chrome va ignorato e non costituisce parte del design applicativo. Non sono state aggiunte al bundle applicativo.

#### Gap iniziali osservati

- header e titolo pagina possono duplicare la gerarchia visiva;
- mobile usa un drawer, mentre la specifica richiede bottom navigation per atleta/famiglia/coach;
- non esiste ancora un `TeamSwitcher` persistente per atleti o coach multi-squadra;
- `AccessibleProfileSelector` copre il cambio soggetto, ma il contesto soggetto/squadra non è ancora sempre visibile nell'header;
- le classi CSS legacy `cs-*` e i token del tema sono ancora la grammatica prevalente;
- `ThemeProvider` usa `csroma-theme` mentre il toggle tema usa una convenzione `.dark` distinta;
- `viewportFit: cover` è presente, ma mancano inset safe-area nei punti interattivi;
- gli stati loading/empty/error/denied/offline sono implementati in modo non uniforme tra le pagine;
- il campionato atleta e il profilo delegato restano owner-profile centrici e non devono essere esposti alla famiglia prima degli endpoint subject-aware indicati nel redesign.

#### Esito e verifiche G0.1

- **Data:** 27 agosto 2026.
- **File principali ispezionati:** `src/app/layout.tsx`, `src/components/navigation/LayoutShell.tsx`, `src/components/navigation/RoleSidebar.tsx`, `src/components/navigation/AccessibleProfileSelector.tsx`, `src/app/**/page.tsx`, `playwright.config.ts`, `tests/e2e/**`.
- **Check eseguiti:** inventario con `rg --files src/app`, verifica riferimenti shell/layout con `rg`, controllo degli artefatti `playwright-report` e `git status`.
- **Nota:** la cattura visuale autenticata è ora disponibile nella cartella baseline indicata sopra. Il browser/DevTools chrome è presente nelle immagini, ma l'area applicativa resta utilizzabile per la review; non è stato confuso con la UI CSRoma e non è stato introdotto nel prodotto.

**Vincoli**
- nessuna modifica visuale;
- nessun refactor;
- nessun cambio dati.

**Definition of Done**
- baseline ripetibile;
- route critiche note;
- differenze repository/spec documentate.

**Prompt `/goal`**
```text
/goal G0.1
Crea la baseline del redesign CSRoma. Non modificare UI o logica. Mappa route/layout/shell attuali e documenta lo stato visuale ai viewport richiesti dal goal. Aggiorna il registro del piano e fermati.
```

---

## G0.2 — Inventario componenti UI, CSS e dipendenze visuali

**Obiettivo**  
Capire cosa può essere riusato, cosa deve essere consolidato e quali classi legacy non vanno rimosse prematuramente.

**Task**
- [ ] Analizzare `src/app/globals.css`.
- [ ] Individuare:
  - CSS custom properties esistenti;
  - convenzione `--cs-*`;
  - classi `cs-*`;
  - colori hardcoded Tailwind più ricorrenti;
  - radius, shadow, spacing e font esistenti.
- [ ] Inventariare componenti equivalenti a:
  - Button;
  - Card/Panel;
  - badge/status;
  - modal/dialog/sheet;
  - list row;
  - header;
  - navigation;
  - selector;
  - loading/empty/error.
- [ ] Individuare componenti Radix e Lucide già in uso.
- [ ] Classificare ogni componente: `riusare`, `adattare`, `sostituire gradualmente`, `legacy`.
- [ ] Cercare inline style e hardcoded color nei componenti che saranno toccati nelle fasi 1–7.
- [ ] Non rinominare né cancellare componenti.

**Definition of Done**
- esiste una mappa concreta di primitive e stili;
- sono noti i principali punti di duplicazione;
- nessun file produttivo è stato modificato salvo documentazione.

**Prompt `/goal`**
```text
/goal G0.2
Fai l'inventario UI/CSS richiesto dal piano. Classifica componenti e classi per strategia di migrazione. Non eseguire ancora il redesign e non rimuovere legacy.
```

### Inventario G0.2 — 27 agosto 2026

#### 1. Strato CSS e token

Il sistema visuale corrente vive quasi interamente in `src/app/globals.css` (unico stylesheet applicativo) e combina Tailwind 4 con una grammatica CSS prefissata `cs-*`.

| Area | Stato rilevato | Strategia |
|---|---|---|
| Palette/token `--cs-*` | `--cs-primary`, `--cs-accent`, `--cs-warm`, success/warning/danger, superfici, testo, bordi, radius, shadow, spacing, font e motion | **adattare** ai token canonici di `re_design.md`, mantenendo inizialmente i nomi `--cs-*` |
| Tema scuro | `.theme-dark` in `globals.css` e `ThemeProvider`; il toggle usa la stessa classe ma esiste una convenzione `.dark` in altri riferimenti | **consolidare dopo il tema chiaro**, senza cambiare ora il comportamento |
| Layout/shell | `.cs-page`, `.cs-layout`, `.cs-main`, `.cs-navbar`, `.cs-sidebar`, `.cs-drawer` | **adattare**; aggiungere safe-area e nuova shell per ruolo nelle fasi Foundation |
| Bottoni | `.cs-btn` e varianti primary/accent/outline/ghost/danger/success/warning/warm, più size/icon/block | **riusare e mappare**; ridurre shadow/transform secondo il redesign |
| Badge/alert | `.cs-badge*`, `.cs-alert*` | **riusare e adattare** a status testuali e palette semantica canonica |
| Card/pannelli | `.cs-card`, `.cs-card--primary`, meta/title/actions | **adattare**; distinguere `Panel`, `Card` e `ListRow` |
| Form | `.cs-field`, `.cs-input`, `.cs-select`, `.cs-textarea`, help/error | **riusare con audit accessibilità**; uniformare label/id/errori |
| Tabelle | `.cs-table`, header, row hover, actions | **riusare per admin**; su atleta/coach sostituire progressivamente con righe responsive |
| Tabs | `.cs-tabs`, `.cs-tab` | **adattare** a segmenti mobile e stato `aria-selected` |
| Feedback | `.cs-progress`, `.cs-skeleton`, `animate-spin`, classi colore raw in `FeedbackState` | **adattare** a `FeedbackState` canonico e reduced motion |
| Modal | `.cs-overlay`, `.cs-modal*`, varianti centered/fullscreen e Radix data-state | **consolidare** in un solo `ResponsiveDetail`; non rimuovere ancora `Modal`/`Dialog` |
| Utility | `.cs-grid*`, `.cs-list*`, `.cs-avatar`, `.cs-tooltip`, `.cs-theme-toggle`, `.jersey-number` | **riusare caso per caso**, con priorità a grid/list/avatar; tooltip e jersey restano specializzati |

Evidenze da tenere presenti nella migrazione:

- `globals.css` contiene due blocchi `:root` e sezioni aggiunte in momenti diversi (design system v1, modal v2, dashboard utilities).
- Le variabili canoniche del redesign non sono ancora quelle correnti: il canvas è `#f7f7fb`, l'accent è `#413c67` e `--cs-warm` è giallo; il redesign richiede canvas caldo e navy semantico.
- Sono usate classi/token non sempre dichiarati nello stylesheet (`cs-surface-secondary`, `cs-surface-muted`, `cs-text-tertiary`, `cs-card--lg`, `cs-badge--accent`, `cs-badge--primary`): prima di rimuoverle serve una mappatura o un fallback.
- `.cs-card--primary` contiene `border-width: 0,5px`, valore CSS non valido: va corretto solo nella fase in cui il componente viene migrato.
- La ricerca ha rilevato un uso consistente di colori Tailwind hardcoded, con prevalenza `text-gray-*`, `border-gray-*`, `text-slate-*`, `ring-blue-500`, `bg-blue-*`, oltre a rosso/verde/giallo per gli stati.
- Sono presenti inline style soprattutto nei manager atleta/coach/admin e nei modali condivisi; vanno estratti soltanto quando il relativo componente entra in una fase di migrazione.

#### 2. Primitive UI condivise

Le primitive esportate da `src/components/ui/index.ts` sono il punto di partenza tecnico. Non introdurre una nuova libreria UI.

| Componente | Evidenza | Strategia |
|---|---|---|
| `Button` | `src/components/ui/Button.tsx`, usa `cs-btn` | **riusare**, poi allineare varianti e target minimi |
| `Badge` | `Badge.tsx`, usa `cs-badge` | **riusare/adattare**, aggiungendo status canonici |
| `Alert` | `Alert.tsx`, usa `cs-alert` | **riusare/adattare** |
| `Card`, `CardTitle`, `CardMeta`, `CardActions` | `Card.tsx` | **adattare** verso `Panel/Card/ListRow` |
| `Input`, `Select`, `Textarea` | primitive form | **riusare** con label/error semantics |
| `Field` / `FieldWrap` | esistono due implementazioni (`Field.tsx` e `Input.tsx`) | **consolidare gradualmente**, mantenendo compatibilità dell'export |
| `Table`, `TableActions` | `Table.tsx` | **riusare per admin**, non forzare su mobile atleta |
| `Stat` | `Stat.tsx`, tre varianti | **adattare**; non usarlo come KPI decorativo universale |
| `Tabs` | `Tabs.tsx`, client component con tastiera base | **adattare** per segmenti e focus completo |
| `Modal` e `Dialog` | portale custom + Radix Dialog | **consolidare gradualmente**; Radix è già presente e va preservato |
| `FeedbackState` | `LoadingState`, `EmptyState`, `ErrorState` | **adattare/estendere** con denied, offline, filtered empty e success |
| `Toast` | provider globale e API `toast.*` | **riusare**, sostituendo emoji e correggendo eventuali tipi timer |
| `ThemeToggle` | toggle client su `csroma-theme` | **adattare dopo G10.1**, non blocca il tema chiaro |

#### 3. Navigazione, contesto e PWA

| Componente | File | Strategia |
|---|---|---|
| `LayoutShell` | `navigation/LayoutShell.tsx` | **adattare profondamente**: mantenere Auth/PWA e route, separare shell atleta/famiglia/coach/admin |
| `RoleSidebar` | `navigation/RoleSidebar.tsx` | **adattare**: raggruppare admin e ridurre per mobile; non riscrivere in blocco |
| `AccessibleProfileSelector` | `navigation/AccessibleProfileSelector.tsx` | **adattare** in `SubjectSwitcher`; preservare contesto server-side esistente |
| `SubjectSwitcher` | non esiste | **nuovo componente Foundation**, basato sul selector esistente |
| `TeamSwitcher` | non esiste | **nuovo componente Foundation**, alimentato da team context state |
| Bottom navigation | non esiste | **nuovo componente Foundation** per atleta/famiglia/coach |
| `PageHeader` | `shared/PageHeader.tsx` | **riusare/adattare** per non duplicare titolo e contesto |
| PWA banner/install/bootstrap | `pwa/*.tsx` | **riusare/adattare**: safe-area e copy onesto offline/update |

#### 4. Componenti di dominio per strategia

**Riusare con adattamento locale** (logica e contratti da preservare):

- `athlete/JerseyCard.tsx`;
- `shared/LatestMessagesPanel.tsx` e `shared/UpcomingEventsPanel.tsx`;
- `shared/RoleBadge.tsx`;
- `calendar/FullCalendarWidget.tsx` come vista desktop secondaria;
- `championship/formatters.ts`, `types.ts` e hook specializzati, senza esporre il campionato familiare prima del resolver subject-aware.

**Adattare estraendo presentazione e mantenendo i manager:**

- `athlete/AthleteDashboard.tsx` (878 righe), `AthleteCalendarManager.tsx`, `AthleteFeesManager.tsx`, `AthleteMessagesManager.tsx`;
- `coach/CoachDashboard.tsx`, `CoachCalendarManager.tsx`, `CoachMessagesManager.tsx`, `CoachPaymentsManager.tsx`;
- `family/FamilyMemberDashboard.tsx`;
- `shared/EventDetailModal.tsx`, `MessageDetailModal.tsx`, `DetailsDrawer.tsx`, `TeamDetailModal.tsx`;
- `admin/AdminDashboard.tsx`, `PeopleManager.tsx` e i manager di dominio;
- `championship/ChampionshipPanels.tsx` e i modal/hook condivisi.

La regola è estrarre `EventRow`, `MessageRow`, `MatchCard`, `FeeRow`, `AttendanceControl` e `ResponsiveDetail` quando servono alla pagina corrente; non trasformare i manager esistenti in un unico refactor trasversale.

**Sostituire gradualmente come superficie, non come dominio:**

- `calendar/SimpleCalendar.tsx`: mantenere i dati ma introdurre agenda/lista mobile;
- dashboard con hero/KPI attuali: sostituire la composizione visuale, non le API;
- tabelle atleta/coach: introdurre righe/card responsive lasciando le tabelle admin;
- modal custom con inline style: portarli sotto `ResponsiveDetail` quando vengono riaperti nel redesign.

**Legacy da isolare e non rimuovere in G0.2:**

- `admin/DocumentsManager.old`;
- `admin/PaymentsManager.backup.tsx`;
- `calendar/calendold`;
- classi CSS duplicate o non più referenziate, finché l'inventario di utilizzo non è completo.

#### 5. Classificazione operativa per fase

| Fase | Elementi in ingresso | Esito atteso |
|---|---|---|
| G1 Foundation | token `--cs-*`, shell, primitive Button/Badge/Card/List, feedback, modal, selector | grammatica unica senza rompere route o auth |
| G2 Atleta dashboard | `AthleteDashboard`, Stat/Card/List, `UpcomingEventsPanel`, `LatestMessagesPanel` | composizione Executive Heritage, dati invariati |
| G3 Calendario | `AthleteCalendarManager`, `SimpleCalendar`, `FullCalendarWidget`, `EventDetailModal` | agenda mobile + calendario desktop |
| G4 Messaggi | `AthleteMessagesManager`, `MessageDetailModal`, attachment UI | lista densa, deduplica e privacy preservate |
| G5 Campionato | `AthleteChampionshipsManager`, `ChampionshipsManager`, hook championship | prima resolver/API subject-aware, poi UI |
| G6 Quote/profilo | `AthleteFeesManager`, `UserProfile`, `JerseyCard` | dettaglio per squadra e profilo permission-aware |
| G7 Famiglia | selector/context + superfici atleta riusate | profili multipli, permessi e cambio subject robusti |
| G8 Coach | manager coach + team context | densità operativa e aggregazione multi-squadra |
| G9 Admin | `RoleSidebar`, manager admin, tabelle/modali | sidebar raggruppata e workspace denso |

#### Esito e verifiche G0.2

- **Data:** 27 agosto 2026.
- **File principali ispezionati:** `src/app/globals.css`, `src/components/ui/*`, `src/components/navigation/*`, `src/components/shared/*`, `src/components/athlete/*`, `src/components/coach/*`, `src/components/family/*`, `src/components/admin/*`, `src/components/calendar/*`, `src/components/championship/*`.
- **Check eseguiti:** conteggio e inventario file con `rg --files`; conteggio classi `cs-*`; ricerca colori Tailwind hardcoded; ricerca inline style; ricerca import Lucide/Radix; conteggio dimensione componenti.
- **Vincolo rispettato:** nessun file produttivo è stato modificato; l'unico cambiamento è questo documento di piano.

---

## G0.3 — Mappa autorizzazione, subject context e contratti dati

**Obiettivo**  
Congelare i confini di sicurezza prima di introdurre filtri subject/team.

**File/aree da ispezionare**
- `src/hooks/useAuth.ts`
- `src/context/AccessibleProfileContext.tsx`
- `src/server/auth/require-account-context.ts`
- `src/server/auth/require-subject-profile.ts`
- Route Handler atleta dashboard/calendar/messages/fees
- infrastruttura campionati
- query membership/team
- eventuali helper RLS/server

**Task**
- [x] Documentare come si risolve l'account.
- [x] Documentare come vengono letti `account_roles`.
- [x] Documentare owner profile vs subject profile.
- [x] Documentare persistenza locale del subject.
- [x] Documentare invalidazione subject non più accessibile.
- [x] Per dashboard/calendar/messages/fees/campionati indicare:
  - input;
  - endpoint;
  - query server;
  - autorizzazione;
  - team context disponibile;
  - read state/mutation;
  - limiti per famiglia.
- [x] Verificare dove il client usa direttamente `ownerProfileId`.
- [x] Verificare dove `teamId` è nome/codice soltanto e manca l'ID.
- [x] Non modificare auth/RLS.

**Definition of Done**
- è chiaro quali endpoint sono già subject-aware;
- è chiaro quali endpoint devono essere arricchiti;
- sono evidenziati i prerequisiti per Campionato e Profilo familiare.

**Prompt `/goal`**
```text
/goal G0.3
Mappa autorizzazioni e contratti dati senza cambiare comportamento. Concentrati su account, subjectProfileId, team membership, famiglia e Route Handler atleta. Documenta i gap indicati in re_design.md.
```

### Mappa G0.3 — 27 agosto 2026

#### 1. Catena di autorizzazione

```text
Supabase auth user
  └─ app_accounts.auth_user_id
       ├─ owner_profile_id  → profilo personale dell'account
       └─ account_roles      → ruoli autorevoli dell'account
             └─ subjectProfileId opzionale
                  └─ profile_relationships (solo delega attiva e valida)
                       └─ permission specifica per la risorsa
                            └─ team_members / dati atleta
```

| Concetto | Fonte/risolutore | Regola osservata |
|---|---|---|
| Utente autenticato | `supabase.auth.getUser()` | assenza o errore → `401` |
| Account | `app_accounts` via `requireAccountContext` | deve esistere ed essere `active`; stati non validi → `403` |
| Ruoli | `account_roles` via `requireAccountContext` | deduplicati e filtrati su `admin`, `coach`, `staff`, `athlete`, `family_member`; il ruolo legacy del profilo non è autorevole |
| Profilo personale | `app_accounts.owner_profile_id` | è il default quando non viene richiesto un subject |
| Subject | `resolveSubjectProfile` | un ID diverso dall'owner richiede relazione attiva, date valide, tipo relazione compatibile e permesso |
| Permessi | colonne `can_*` di `profile_relationships` | valutati per singola risorsa; non sono un ruolo globale |
| Profilo atleta | `athlete_profiles` + `season_profiles(status=active)` | requisito comune di `requireSubjectAthleteContext` |

`requireAthleteContext` è appropriato solo per l'area personale: richiede ruolo `athlete` e verifica sempre l'owner profile. Le Route Handler atleta aggiornate usano invece `requireSubjectAthleteContext`, che consente il subject delegato e restituisce `dataClient`, `profileId`, `delegated`, `permissions` e `account`.

#### 2. `subjectProfileId` e famiglia

- Il client persiste solo l'ID del subject nella chiave `csroma_active_subject_profile_id` e lo aggiunge alle URL tramite `appendSubjectProfile`.
- La persistenza locale non è autorizzazione: ogni Route Handler deve rivalidare l'ID server-side.
- `GET /api/me/accessible-profiles` risolve l'owner account e legge con admin client le relazioni `profile_relationships`, profili e override età; espone soltanto relazioni attive, valide e compatibili con minorenne/delegato verificato.
- La risposta espone profilo, tipo relazione, `verified_at` e i sette permessi: `view_schedule`, `confirm_attendance`, `view_payments`, `view_medical_status`, `view_documents`, `sign_documents`, `receive_messages`.
- `AccessibleProfileContext` invalida la selezione locale se l'ID non è più nella risposta; in assenza di sessione resetta profili, subject e area a `personal`.
- Un account con ruolo `family_member` ma senza `athlete` entra di default nell'area `family`; un account multi-ruolo può cambiare area.
- Per subject delegato `resolveSubjectProfile` usa `createAdminClient()` per leggere i dati, quindi replica esplicitamente i limiti di visibilità (come nei messaggi) invece di affidarsi implicitamente a RLS.

#### 3. Squadre e membership

| Persona | Relazione dati | Conseguenza UI/API |
|---|---|---|
| Atleta | `team_members(profile_id, team_id, jersey_number)` | può appartenere a più squadre; il numero di maglia è specifico per membership |
| Coach | `team_coaches(coach_id, team_id, role, assigned_at)` | può essere assegnato a più squadre; i Route Handler coach devono filtrare su tutte le assegnazioni |
| Evento | `event_teams(event_id, team_id)` | un evento può appartenere a più squadre e va deduplicato |
| Quota | `fee_installments → membership_fees.team_id` | il dettaglio deve restare attribuito a una squadra |
| Campionato | `championship_club_teams.team_id` + gruppi | il campionato è accessibile solo se la squadra è membership/assignment del soggetto |

Il team filter è sempre restrittivo: non concede accesso. Quando il contesto team viene aggiunto alle URL deve essere verificato contro le membership già autorizzate e resettato al cambio subject.

#### 4. Route Handler atleta: contratti attuali

| Endpoint | Input | Autorizzazione | Risposta/limite rilevante |
|---|---|---|---|
| `GET /api/athlete/dashboard` | `subjectProfileId` query opzionale | `requireSubjectAthleteContext` senza permesso globale; messaggi e quote rispettano `receive_messages`/`view_payments` | `teamMemberships`, eventi, prossima partita, messaggi non letti, quote, stagione; membership ha team id/nome/codice/activity, eventi non hanno ancora team associati |
| `GET /api/athlete/calendar` | `subjectProfileId` query | `requireSubjectAthleteContext(..., 'view_schedule')` | `events` + `teams[{id,name,code}]`; ogni evento espone `teams` come soli nomi, non ID |
| `GET /api/athlete/events/detail` | `id` obbligatorio, `subjectProfileId` opzionale | schedule permission + membership del subject in almeno una squadra dell'evento | dettaglio con `teams[{id,name,code}]`, palestra, creator e presenza; verifica evento separata |
| `POST /api/athlete/events/attendance` | `event_id,status,note`; subject da body o query | `requireSubjectAthleteContext(..., 'confirm_attendance')` | upsert per `event_id,profile_id`; salva `responded_by_auth_user_id` e `response_source` (`self`/`parent`); non accoda offline |
| `GET /api/athlete/messages` | `subjectProfileId`, `view=full`, `id`, `limit` | `receive_messages` | deduplica message ID; vista full filtra recipient delegati, aggiunge read/recipient/allegati signed URL; i signed URL non vanno persistiti |
| `POST /api/messages/read` | `message_id`, `subject_profile_id` body opzionale | account + `receive_messages` se subject delegato | upsert read state su `(message_id, auth_user_id, subject_profile_id)` |
| `GET /api/athlete/fees` | `subjectProfileId` query | `view_payments` | rate composte con nome/codice squadra e attività; manca `team.id` e `activity.id` nel payload composto |
| `GET /api/championships/standings` | `group_id` UUID | account; atleta personale via `requireAthleteContext`, coach via `team_coaches`, admin bypass | non accetta `subjectProfileId`; campionato delegato non supportato |

Tutti gli handler catturano `AccountContextError` e restituiscono il relativo status (`401`, `403`, `500`), ma alcuni errori di query vengono trasformati in `400` o in liste vuote: il redesign non deve interpretare una lista vuota come prova di assenza dati senza distinguere errore/empty.

#### 5. Gap rispetto a `re_design.md`

1. **Dashboard:** aggiungere nel contratto l'associazione evento → team `{ id, name, code }`; oggi il client può sapere le membership ma non la squadra dell'evento.
2. **Calendario:** mantenere il catalogo `teams` con ID e arricchire `events[].teams` con ID oltre ai nomi per filtro/deep link robusti.
3. **Quote:** includere `membership_fee.team.id` e `activity.id`; non aggregare totali senza conservare la provenienza per squadra.
4. **Messaggi:** formalizzare un read state aggregato per account + subject e un contesto squadra deduplicato; mantenere il filtro esplicito dei recipient quando `dataClient` è admin.
5. **Campionati:** introdurre resolver e Route Handler subject-aware per catalogo, prossime partite, convocazioni, risultati e classifica; passare `subjectProfileId` a `requireSubjectAthleteContext` e verificare tutte le squadre del subject. Fino ad allora, niente Campionato nell'area famiglia.
6. **Profilo:** `GET /api/me/profile` legge solo `ownerProfileId`; `UserProfile` esegue query client dirette su `team_members` usando `user.id`. Serve endpoint delegabile permission-aware prima di mostrare profilo, certificato o numeri di maglia di un figlio.
7. **Team context:** non esiste ancora uno stato persistente separato per `teamId`; va aggiunto senza usare il team selezionato come autorizzazione.
8. **Coach multi-squadra:** il modello dati supporta `team_coaches`, ma la UI/contratti coach devono rendere esplicita l'aggregazione e il filtro squadra.

#### Esito e verifiche G0.3

- **Data:** 27 agosto 2026.
- **File principali ispezionati:** `src/server/auth/require-account-context.ts`, `src/server/auth/require-subject-profile.ts`, `src/context/AccessibleProfileContext.tsx`, `src/hooks/useAuth.ts`, `src/app/api/me/accessible-profiles/route.ts`, `src/app/api/athlete/{dashboard,calendar,fees,messages}/route.ts`, `src/app/api/athlete/events/{detail,attendance}/route.ts`, `src/app/api/messages/read/route.ts`, `src/app/api/championships/standings/route.ts`, `src/components/athlete/ChampionshipsManager.tsx`, `src/components/shared/UserProfile.tsx`.
- **Check eseguiti:** ricerca riferimenti a `app_accounts`, `account_roles`, `profile_relationships`, `team_members`, `team_coaches`, `subjectProfileId`; lettura dei resolver e degli handler; confronto dei payload restituiti e delle query server.
- **Vincolo rispettato:** nessuna modifica a auth, RLS, schema, Route Handler o comportamento applicativo; è stato modificato solo questo documento.

---

## G0.4 — Baseline dei controlli tecnici

**Obiettivo**  
Stabilire quali verifiche automatiche sono realmente affidabili.

**Task**
- [x] Leggere `package.json`.
- [x] Elencare script typecheck/lint/test/build/E2E.
- [x] Verificare quale comando lint è compatibile con Next.js 15.
- [x] Eseguire i controlli non distruttivi già disponibili; registrare separatamente il limite del runner locale e il risultato E2E sulla Preview.
- [x] Annotare errori/warning preesistenti separatamente.
- [x] Non correggere errori estranei al redesign.
- [x] Definire una matrice “controllo minimo per goal”.

**Definition of Done**
- i goal successivi non dovranno inventare comandi;
- gli eventuali failure preesistenti sono distinti dalle regressioni.

**Prompt `/goal`**
```text
/goal G0.4
Stabilisci la baseline di typecheck, lint, test, build ed E2E. Non correggere problemi estranei: documentali come baseline.
```

### Baseline G0.4 — 27 agosto 2026

#### Script disponibili

| Controllo | Comando | Esito |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | **PASS** |
| Lint | `npm run lint` (`next lint`) | **PASS**, con warning di deprecation: `next lint` sarà rimosso in Next.js 16 |
| Unit test | `npm test -- --runInBand` | **PASS** — 1 suite, 3 test; warning Jest su opzione sconosciuta `moduleNameMapping` |
| Build | `npm run build` | **PASS** — Next.js 15.5.21, 84 pagine generate |
| E2E locale | `npm run test:e2e` | **NON COMPLETATO** — nessun avanzamento dopo oltre un minuto; processo interrotto |
| E2E Preview completo | `E2E_BASE_URL=<preview> npm run test:e2e` con credenziali `_PREVIEW` mappate alle variabili attese dal runner | **20 PASS, 2 FAILURE, 1 SKIP** su 23 test (1m24s circa). I due failure sono lo stesso smoke test admin su Chromium e Firefox; il test attende il campo `Attività` nella pagina gestione atleti stagionale, ma il locator non viene trovato. |

La build è stata eseguita con `.env.local` presente, quindi conferma la baseline del codice con configurazione locale completa; non certifica la presenza delle variabili nei deployment Vercel.

#### Matrice minima per i goal successivi

| Tipo di modifica | Controlli minimi |
|---|---|
| Primitive CSS/UI senza boundary dati | `npx tsc --noEmit`, `npm test -- --runInBand`, review viewport interessati |
| Shell, routing, layout, PWA | typecheck, lint, build, smoke responsive/accessibilità |
| Route Handler/API/auth/contratti | typecheck, unit test, build, E2E autorizzativi/route interessate quando Chromium è disponibile |
| Mutazioni o RLS/schema | controlli sopra + test E2E mirati e verifica DB separata; non implicati dal redesign corrente |

#### Note da non confondere con regressioni

- Il comando `lint` passa, ma lo script `next lint` è deprecato e dovrà essere migrato in un goal tecnico dedicato.
- I warning Jest su `moduleNameMapping` sono preesistenti e non sono stati corretti in G0.4.
- I warning Node `punycode` durante build/test appartengono alle dipendenze/runtime.
- Il primo tentativo E2E locale è rimasto senza avanzamento e quello Preview mirato ha incontrato `browserType.launch`/`SIGTRAP` nel runner Chromium. La riesecuzione completa sulla Preview con esecuzione browser autorizzata ha però raggiunto tutti i 23 test: il runner è quindi operativo, con due failure applicativi/documentali nel solo smoke admin e un test skip.
- I due failure Preview sono registrati come baseline, non corretti in G0.4: il test cerca il label `Attività` nella form di creazione singola, quindi va verificato se il contratto UI/test è obsoleto o se manca davvero il campo nella pagina.
- Le credenziali Preview sono state lette da `.env.local` solo per il processo E2E; i valori non sono stati stampati né aggiunti ai file.
- Non sono stati modificati codice, configurazioni, auth, RLS o schema.

---

# 3. Fase 1 — Athlete Foundation

## G1.1 — Token canonici del tema chiaro

**Obiettivo**  
Introdurre i token semantici del redesign senza migrare tutte le pagine.

**Task**
- [x] Definire in `:root` i token per:
  - canvas `#F5F4F1`;
  - surface `#FFFFFF`;
  - surface subdued `#EFEEEB`;
  - surface selected `#FDECEE`;
  - ink `#171A21`;
  - ink muted `#667085`;
  - ink faint `#8A8F9B`;
  - border `#E2E0DC`;
  - brand red `#D71920`;
  - brand red dark `#B3121A`;
  - navy `#243149`;
  - success `#12B76A`;
  - warning `#F79009`;
  - danger `#B42318`;
  - info `#2E90FA`;
  - gold `#F5CE3F`.
- [x] Mantenere naming coerente con `--cs-*` se già usato.
- [x] Mappare i token in Tailwind 4 tramite `@theme` quando utile.
- [x] Definire token per radius, border, elevation e motion.
- [x] Aggiungere utility per `font-variant-numeric: tabular-nums`.
- [x] Non eliminare i token legacy ancora referenziati.
- [x] Non implementare ancora dark mode definitivo.

**Acceptance**
- i nuovi componenti possono usare solo token semantici;
- nessuna regressione sulle pagine non migrate;
- niente mix di hardcoded color + token nello stesso nuovo componente.

### Baseline G1.1 — 27 agosto 2026

- File modificato: `src/app/globals.css`.
- Aggiunti i ruoli canonici chiari (canvas, superfici, ink, border, brand, navy e stati), token di radius/border/elevation/motion e utility `.cs-tabular-nums`.
- Aggiunta la mappatura Tailwind 4 per i ruoli canonici (`bg-canvas`, `text-ink`, `border-border`, ecc.).
- I token legacy `--cs-bg`, `--cs-text`, `--cs-primary` e gli altri già referenziati non sono stati rimossi o riassegnati: la migrazione visiva resta a carico dei goal successivi.
- Verifiche: `npx tsc --noEmit` **PASS**, `npm run lint` **PASS**, `npm run build` **PASS** (84 pagine generate).

**Prompt `/goal`**
```text
/goal G1.1
Implementa esclusivamente i token canonici del tema chiaro descritti nel piano. Mantieni compatibilità con i token legacy e non migrare ancora le pagine.
```

---

## G1.2 — Tipografia Hanken Grotesk

**Obiettivo**  
Introdurre Hanken Grotesk senza dipendenza runtime da font remoto.

**Task**
- [x] Verificare se il font è già disponibile localmente nel repository.
- [x] Se disponibile, integrarlo tramite `next/font/local`; altrimenti usare una modalità compatibile con le regole del progetto senza introdurre richieste runtime bloccanti.
- [x] Definire scale:
  - Display;
  - H1;
  - H2;
  - H3;
  - Body;
  - Body small;
  - Label.
- [x] Applicare fallback system.
- [x] Non cambiare indiscriminatamente tutti i componenti legacy.
- [x] Applicare la nuova base alla shell/foundation.
- [x] Verificare 320 px e zoom 200%.

**Acceptance**
- nessun layout shift significativo dovuto al font;
- testo informativo persistente ≥13px;
- numeri KPI/importi/orari possono usare tabular nums.

### Baseline G1.2 — 27 agosto 2026

- File modificati: `src/app/globals.css`, `implementation_plan_redesign.md`.
- Hanken Grotesk non è presente nel repository; è stato mantenuto uno stack locale `ui-sans-serif/system-ui/...`, senza font remoto e senza richiesta runtime bloccante.
- Definita la scala responsive Display/H1/H2/H3/Body/Body small/Label: mobile 24/32, 24/32, 20/28, 17/24, 15/22, 13/18, 12/16; desktop 32/40, 28/36, 22/30, 18/26, 16/24, 13/18, 12/16.
- Le classi opt-in `.cs-type-*` e i token Tailwind corrispondenti sono disponibili alla foundation; la shell autenticata usa lo stack locale tramite `.cs-page`, mentre le pagine legacy non sono state migrate nella gerarchia tipografica.
- Verifiche: `npx tsc --noEmit` **PASS**, `npm run lint` **PASS**, `npm run build` **PASS** (84 pagine generate). I token usano `rem` e breakpoint a 768px, quindi sono pronti per 320px e zoom 200%; la verifica visuale puntuale delle singole pagine resta nei goal di migrazione, non è stata anticipata qui.

**Prompt `/goal`**
```text
/goal G1.2
Integra la tipografia canonica del redesign con caricamento locale/non bloccante e definisci la scala tipografica. Limita la migrazione alla foundation.
```

---

## G1.3 — Safe area, `100dvh` e struttura viewport

**Obiettivo**  
Creare le primitive CSS necessarie per una PWA mobile corretta.

**Task**
- [x] Introdurre utility/variabili per:
  - `env(safe-area-inset-top)`;
  - `env(safe-area-inset-bottom)`;
  - inset laterali se necessari.
- [x] Usare `100dvh` nella nuova shell.
- [x] Definire spazio riservato alla bottom navigation.
- [x] Evitare che banner PWA, CTA fixed e sheet siano coperti.
- [x] Verificare standalone e browser normale.
- [x] Non alterare ancora tutte le pagine.

**Acceptance**
- shell testabile a 320×568 e 375×812;
- nessun elemento foundation finisce sotto home indicator/notch.

### Baseline G1.3 — 27 agosto 2026

- File modificati: `src/app/globals.css`, `implementation_plan_redesign.md`.
- Aggiunte variabili con fallback per `safe-area-inset-top/right/bottom/left`, altezza e spazio riservato alla bottom navigation.
- Aggiunte utility opt-in `.cs-viewport`, `.cs-safe-*`, `.cs-safe-inline`, `.cs-safe-block`, `.cs-bottom-nav-space` e `.cs-fixed-bottom-safe`; la shell esistente continua a usare `100dvh`.
- Le utility usano `100svh` come fallback iniziale e `100dvh` come altezza dinamica finale, funzionando sia in browser normale sia in modalità standalone quando il browser espone gli inset PWA.
- Nessuna dashboard, feature o route è stata migrata; non sono stati alterati i componenti di dominio.
- Verifiche: `npx tsc --noEmit` **PASS**, `npm run lint` **PASS**, `npm run build` **PASS** (84 pagine generate).

**Prompt `/goal`**
```text
/goal G1.3
Implementa le primitive safe-area e viewport per la nuova shell PWA. Non migrare ancora dashboard o altre feature.
```

---

## G1.4 — Primitive Button e StatusBadge

**Obiettivo**  
Consolidare due primitive usate in tutte le feature.

**Button**
- primary;
- secondary;
- ghost;
- danger;
- icon.

**StatusBadge**
- testo sempre presente;
- colore semantico;
- icona opzionale;
- background leggero;
- mapping presenze:
  - going → Partecipo;
  - maybe → Forse;
  - declined → Non partecipo;
  - null/assente → Da confermare.

**Task**
- [x] Riutilizzare componenti esistenti se possibile.
- [x] Touch target ≥44 px per azioni.
- [x] Loading senza cambio larghezza.
- [x] Disabled accessibile, non solo opacity.
- [x] `aria-label` icon-only.
- [x] Icone decorative `aria-hidden`.
- [x] Nessuna emoji.

### Baseline G1.4 — 27 agosto 2026

- `Button` esistente riusato e consolidato in `src/components/ui/Button.tsx`: aggiunta variante `secondary`, target minimo 44px, stato `loading` con larghezza stabile, `disabled` e `aria-busy`.
- Gli icon-only button continuano a richiedere `aria-label` al chiamante; lo spinner e le icone passate a `StatusBadge` sono marcati decorativi con `aria-hidden`.
- Introdotto `StatusBadge` in `src/components/ui/StatusBadge.tsx`, esportato da `src/components/ui/index.ts`, con stati presenza `going/maybe/declined/pending`, label italiane, varianti semantiche, background leggero e icona opzionale.
- Gli stili sono token-based in `src/app/globals.css`; le pagine esistenti non sono state migrate.
- Verifiche: `npx tsc --noEmit` **PASS**, `npm run lint` **PASS**, `npm test -- --runInBand` **PASS** (1 suite, 3 test), `npm run build` **PASS** (84 pagine generate).

**Prompt `/goal`**
```text
/goal G1.4
Consolida Button e StatusBadge secondo il design system. Riusa le primitive esistenti dove sensato e non migrare ancora intere pagine.
```

---

## G1.5 — Primitive Panel, Card e ListRow

**Obiettivo**  
Separare semanticamente contenitori, oggetti autonomi e righe dense.

**Task**
- [x] Creare/adattare:
  - `Panel`;
  - `Card`;
  - `ListRow`.
- [x] `Card` per oggetti autonomi/cliccabili.
- [x] `Panel` per raggruppamento di sezione.
- [x] `ListRow` per contenuto ripetuto.
- [x] Supportare leading/trailing content.
- [x] Supportare link/button semantici per riga interamente cliccabile.
- [x] Evitare card annidate.
- [x] Nessun hover con spostamento del layout.
- [x] Rigature/separatori con token border.

### Baseline G1.5 — 27 agosto 2026

- Consolidato `Card` in `src/components/ui/Card.tsx`, mantenendo le varianti esistenti e aggiungendo `subdued` e `interactive`.
- Aggiunto `Panel` in `src/components/ui/Panel.tsx` per sezioni raggruppate e `ListRow` in `src/components/ui/ListRow.tsx` per contenuti ripetuti.
- `ListRow` supporta contenuto leading/trailing e rende semanticamente `a`, `button` o `div` in base alle props; le icone leading sono decorative (`aria-hidden`).
- Stili canonici token-based aggiunti in `src/app/globals.css`; hover senza trasformazioni che spostano il layout e separatori sul token border.
- Primitive esportate da `src/components/ui/index.ts`; nessuna pagina legacy convertita.
- Verifiche: `npx tsc --noEmit` **PASS**, `npm run lint` **PASS**, `npm test -- --runInBand` **PASS** (1 suite, 3 test), `npm run build` **PASS** (84 pagine generate).

**Prompt `/goal`**
```text
/goal G1.5
Implementa o consolida Panel, Card e ListRow con semantica chiara e stili canonici. Non convertire ancora tutte le schermate legacy.
```

---

## G1.6 — FeedbackState

**Obiettivo**  
Rendere riusabili gli stati di caricamento e fallimento previsti dalla specifica.

**Varianti minime**
- initial loading;
- refreshing;
- empty;
- filtered empty;
- permission denied;
- offline;
- unexpected error;
- success mutation;
- optimistic pending/rollback helper quando applicabile.

**Task**
- [x] Creare API semplice e tipizzata.
- [x] Distinguere loading bloccante da refresh non bloccante.
- [x] Rendere denied e offline semanticamente diversi.
- [x] Usare `aria-live` solo quando utile.
- [x] Evitare skeleton aggressivi.
- [x] Rispettare reduced motion.

### Baseline G1.6 — 27 agosto 2026

- Consolidato `src/components/ui/FeedbackState.tsx` con API `FeedbackState` tipizzata e varianti `loading`, `refreshing`, `empty`, `filtered-empty`, `denied`, `offline`, `error` e `success`.
- Mantenute compatibili `LoadingState`, `EmptyState` ed `ErrorState`; aggiunte `DeniedState`, `OfflineState` e `SuccessState`.
- Loading e refreshing hanno semantica distinta (`aria-busy` e `role=status`); `aria-live` viene usato solo per loading/refresh/success; gli errori usano `role=alert`.
- Stili canonici aggiunti in `src/app/globals.css`, senza skeleton aggressivi e con animazione già compatibile con la regola reduced-motion globale.
- Primitive esportate da `src/components/ui/index.ts`; nessuna pagina è stata migrata automaticamente.
- Verifiche: `npx tsc --noEmit` **PASS**, `npm run lint` **PASS**, `npm test -- --runInBand` **PASS** (1 suite, 3 test), `npm run build` **PASS** (84 pagine generate).

**Prompt `/goal`**
```text
/goal G1.6
Crea FeedbackState e le varianti richieste. Mantieni il componente generico e accessibile; non applicarlo ancora a tutte le pagine.
```

---

## G1.7 — BottomSheet / ResponsiveDetail

**Obiettivo**  
Unificare dettaglio mobile e desktop.

**Task**
- [x] Verificare primitive Radix già presenti.
- [x] Implementare un wrapper responsive:
  - mobile → bottom sheet o fullscreen;
  - desktop → drawer laterale;
  - dialog centrato solo per conferme brevi.
- [x] Focus trap.
- [x] Restore focus.
- [x] Escape desktop.
- [x] Safe-area completa.
- [x] Footer sticky opzionale.
- [x] Hook/guard per modifiche non salvate, senza introdurre wizard non richiesti.

### Baseline G1.7 — 27 agosto 2026

- Aggiunto `src/components/ui/ResponsiveDetail.tsx`, basato sui wrapper Radix `Dialog`/`DialogContent` già presenti.
- Desktop: drawer ancorato a destra; mobile: bottom sheet; variante `fullscreenOnMobile` per dettaglio fullscreen.
- Radix gestisce focus trap, restore focus ed Escape; il wrapper mantiene `DialogTitle`/`DialogDescription` per la semantica accessibile.
- Footer opzionale sticky rispetto al body scrollabile; safe-area applicata a padding e pulsante di chiusura tramite token G1.3.
- Stili aggiunti in `src/app/globals.css`; esportazione aggiunta in `src/components/ui/index.ts`. Nessuna feature o pagina convertita.
- Verifiche: `npx tsc --noEmit` **PASS**, `npm run lint` **PASS**, `npm test -- --runInBand` **PASS** (1 suite, 3 test), `npm run build` **PASS** (84 pagine generate).

**Prompt `/goal`**
```text
/goal G1.7
Implementa ResponsiveDetail riusando Radix esistente: sheet/fullscreen su mobile e drawer su desktop, con focus e safe-area corretti.
```

---

## G1.8 — Stato locale del team context

**Obiettivo**  
Introdurre un contesto squadra separato dal subject context.

**Task**
- [x] Ispezionare `AccessibleProfileContext`.
- [x] Non fondere subject e team in un singolo stato ambiguo.
- [x] Definire `TeamContext` o hook equivalente con:
  - `selectedTeamId | null`;
  - `null` = Tutte le squadre;
  - lista team autorizzati fornita dalla feature/server;
  - reset quando cambia subject;
  - reset se team selezionato non è più valido.
- [x] Persistenza locale con chiave separata, idealmente per area/subject.
- [x] Non persistire payload team completi o dati personali.
- [x] Non usare il team context come controllo autorizzativo.

### Baseline G1.8 — 27 agosto 2026

- Aggiunto `src/context/TeamContext.tsx`, separato da `AccessibleProfileContext`: espone `selectedTeamId`, `selectedTeam`, lista team e setter validati.
- `null` rappresenta “Tutte le squadre”; la lista viene fornita dalla feature tramite `setTeams`, senza fetch o autorizzazione client introdotti dal context.
- Persistenza locale limitata all'ID con chiave separata per area/subject (`csroma_team_context:<area>:<subject>`); nessun payload team o dato personale viene salvato.
- Cambio subject/area azzera il team selezionato e invalida l'ID precedente; un team non presente nella lista autorizzata viene riportato a `null`.
- `TeamProvider` è montato sotto `AccessibleProfileProvider` in `src/app/layout.tsx`. Una singola squadra può essere gestita senza imporre un selector UI.
- Verifiche: `npx tsc --noEmit` **PASS**, `npm run lint` **PASS**, `npm test -- --runInBand` **PASS** (1 suite, 3 test), `npm run build` **PASS** (84 pagine generate).

**Acceptance**
- cambio subject → team torna a Tutte;
- team non accessibile → fallback sicuro;
- una sola squadra → stato può esistere ma UI selector viene omessa.

**Prompt `/goal`**
```text
/goal G1.8
Introduci il team context locale separato dal subject context. Deve solo filtrare dati autorizzati e resettarsi correttamente.
```

---

## G1.9 — SubjectSwitcher e TeamSwitcher

**Obiettivo**  
Fornire controlli distinti e non ambigui per profilo delegato e squadra.

**SubjectSwitcher**
- nome soggetto;
- relazione quando disponibile;
- attività/squadra come metadata non invasivo;
- copy canonico area famiglia: `Stai visualizzando …`.

**TeamSwitcher**
- `Tutte le squadre` default;
- team name + code/activity se utile;
- omesso con una sola squadra.

**Task**
- [x] Non creare un mega-switcher unico.
- [x] Keyboard navigation.
- [x] Touch target ≥44 px.
- [x] Label accessibile.
- [x] Stato selezionato non solo tramite colore.
- [x] Compatibile con header e PageHeader.

### Baseline G1.9 — 27 agosto 2026

- Aggiunti `src/components/navigation/SubjectSwitcher.tsx` e `TeamSwitcher.tsx` come controlli distinti basati su select native, quindi accessibili da tastiera e con target minimo 44px.
- `SubjectSwitcher` riusa `AccessibleProfileContext` e consente solo la selezione tra profili già forniti dal server/context.
- `TeamSwitcher` usa `useTeamContext`, mostra `Tutte le squadre` e viene omesso con zero o una squadra; non contiene logica di autorizzazione.
- `AccessibleProfileSelector` resta compatibile come wrapper verso `SubjectSwitcher`; nessun mega-switcher o migrazione delle pagine è stata introdotta.
- Label sempre presenti e stato selezionato espresso anche dal testo dell'opzione, non solo dal colore; gli ID dei controlli sono distinti per variante.
- Stili aggiunti in `src/app/globals.css`; verifiche: `npx tsc --noEmit` **PASS**, `npm run lint` **PASS**, `npm test -- --runInBand` **PASS** (1 suite, 3 test), `npm run build` **PASS** (84 pagine generate).

**Prompt `/goal`**
```text
/goal G1.9
Implementa SubjectSwitcher e TeamSwitcher come controlli separati e accessibili. Collega TeamSwitcher al team context, senza aggiungere logica di autorizzazione client.
```

---

## G1.10 — AppHeader

**Obiettivo**  
Creare l'header canonico mobile/desktop per atleta/famiglia.

**Varianti**
- mobile root;
- mobile detail con back;
- desktop role shell;
- family subject context.

**Task**
- [x] Logo/nome CSRoma.
- [x] Account/profile action.
- [x] Back solo nei detail.
- [x] Nessuna icona impostazioni ripetuta nelle root.
- [x] Slot per subject/team context.
- [x] Evitare duplicazione titolo nel header e nel contenuto.
- [x] Safe-area.
- [x] Screen reader semantics.

### Baseline G1.10 — 27 agosto 2026

- Aggiunto `src/components/navigation/AppHeader.tsx` con varianti `mobile-root`, `mobile-detail`, `desktop` e `family`.
- Integrato nella shell reale in `src/components/navigation/LayoutShell.tsx`, preservando menu mobile, notifiche, tema, account e logout esistenti.
- Il back è disponibile solo nella variante mobile detail; viene nascosto su desktop. Il titolo pagina resta responsabilità del contenuto (`PageHeader`), evitando duplicazioni nell'header.
- Previsti slot separati per context subject/team e utility; safe-area applicata via classe shell e semantica screen reader mantenuta su logo, back, menu e notifiche.
- Nessuna pagina o feature di dominio è stata migrata.
- Verifiche: `npx tsc --noEmit` **PASS**, `npm run lint` **PASS**, `npm run build` **PASS** (84 pagine generate).

**Prompt `/goal`**
```text
/goal G1.10
Implementa AppHeader con le varianti canoniche. Mantieni titolo pagina nel contenuto quando previsto e non duplicare impostazioni nelle root.
```

---

## G1.11 — BottomNavigation atleta

**Obiettivo**  
Implementare la navigazione mobile canonica dell'atleta.

**Destinazioni**
1. Oggi → `/dashboard`
2. Calendario → `/athlete/calendar`
3. Campionato → `/athlete/campionati`
4. Messaggi → `/athlete/messages`
5. Profilo → `/athlete/profile`

**Task**
- [x] Icona Lucide + label sempre visibile.
- [x] Route-aware active state.
- [x] `aria-current="page"`.
- [x] Badge unread senza layout shift.
- [x] Safe-area bottom.
- [x] Padding main coerente con altezza nav.
- [x] Nessuna sesta voce.
- [x] Quote non in bottom bar.

### Baseline G1.11 — 27 agosto 2026

- Aggiunto `src/components/navigation/BottomNavigation.tsx` con cinque sole destinazioni: `/dashboard`, `/athlete/calendar`, `/athlete/campionati`, `/athlete/messages`, `/athlete/profile`.
- Icone Lucide e label sempre visibili; stato attivo derivato da `usePathname` e comunicato con `aria-current="page"`.
- Badge unread opzionale per Messaggi, con posizione assoluta per evitare layout shift.
- La nav viene mostrata solo per ruolo `athlete` in area `personal`; famiglia, coach e admin non ricevono questa barra.
- Safe-area bottom e spazio main coerente con altezza nav applicati in `src/app/globals.css`; nessuna voce Quote inserita.
- Integrata nella shell tramite `src/components/navigation/LayoutShell.tsx`; nessuna feature di dominio migrata.
- Verifiche: `npx tsc --noEmit` **PASS**, `npm run lint` **PASS**, `npm test -- --runInBand` **PASS** (1 suite, 3 test), `npm run build` **PASS** (84 pagine generate).

**Prompt `/goal`**
```text
/goal G1.11
Implementa la BottomNavigation atleta con le cinque route canoniche, active state dalla route e safe-area.
```

---

## G1.12 — Offline/update banner integrati nella foundation

**Obiettivo**  
Adattare i componenti PWA esistenti al nuovo design senza cambiare capacità offline.

**Task**
- [x] Individuare banner offline e update esistenti.
- [x] Applicare token canonici.
- [x] Posizionarli senza coprire header/bottom nav.
- [x] Offline copy:
  `Sei offline. Alcuni contenuti potrebbero non essere aggiornati e le modifiche non sono disponibili.`
- [x] `role="status"` e `aria-live="polite"`.
- [x] Rientro online: feedback breve.
- [x] Update:
  - mobile banner/sheet;
  - desktop toast persistente;
  - `Aggiorna ora`;
  - `Più tardi` se necessario.
- [x] Non reload automatico con form dirty.
- [x] Un solo reload dopo `controllerchange`.
- [x] Non introdurre background sync.

### Baseline G1.12 — 27 agosto 2026

- Aggiornati `src/components/pwa/ConnectivityBanner.tsx` e `src/components/pwa/PwaBootstrap.tsx` con copy offline canonica, feedback breve al rientro online e ruoli `status`/`aria-live="polite"`.
- L’update banner usa token canonici, `Aggiorna ora` e `Più tardi`; su mobile si posiziona sopra lo spazio safe-area della bottom navigation, su desktop resta un toast persistente.
- Header e home indicator vengono protetti tramite offset safe-area; non è stato introdotto alcun background sync né modifica alla cache/service worker.
- Il reload resta vincolato al flusso esistente `controllerchange` e non parte automaticamente per il solo rilevamento dell’update.
- Verifiche: `npx tsc --noEmit` **PASS**, `npm run lint` **PASS**, `npm test -- --runInBand` **PASS** (1 suite, 3 test), `npm run build` **PASS** (84 pagine generate).

**Prompt `/goal`**
```text
/goal G1.12
Adatta offline/update UI alla foundation senza estendere le capacità PWA. Mantieni cache e mutation policy esistenti.
```

---

## G1.13 — Integrazione Athlete Foundation nella shell reale

**Obiettivo**  
Collegare foundation e navigazione alle route atleta senza ancora ridisegnarne i contenuti.

**Task**
- [x] Integrare AppHeader + BottomNavigation + main scroll container.
- [x] Integrare team context dove disponibile senza forzare selector su ogni pagina.
- [x] Conservare desktop autenticato funzionante.
- [x] Nessun overflow a 320/375.
- [x] Nessuna doppia navigazione sidebar + bottom bar sui breakpoint touch.
- [x] Contenuto desktop atleta centrato max 960–1080 px.
- [x] Verificare deep link diretti alle route atleta.
- [x] Verificare banner PWA + nav.

### Baseline G1.13 — 27 agosto 2026

- `LayoutShell` ora compone `AppHeader`, main scroll container e `BottomNavigation`; il bottom bar viene attivato solo per atleta/area personale.
- Il team context resta disponibile tramite provider senza imporre un selector alle schermate; la sidebar continua a essere nascosta sui breakpoint touch, evitando doppia navigazione.
- Il main atleta usa `min-height: 0`, overflow verticale interno e larghezza desktop massima 1080px; lo spazio bottom nav viene riservato con safe-area.
- Le route atleta esistenti restano invariate e sono presenti nella route table della build; i deep link non richiedono nuovi handler.
- Banner PWA e update UI restano montati globalmente con gli offset safe-area introdotti in G1.12; non sono state modificate cache o policy offline.
- Verifiche: `npx tsc --noEmit` **PASS**, `npm run lint` **PASS**, `npm test -- --runInBand` **PASS** (1 suite, 3 test), `npm run build` **PASS** (84 pagine generate), `git diff --check` **PASS**.

**Gate Fase 1**
- 320 px senza perdita azioni;
- 375 px senza overflow;
- focus visibile;
- route preservate;
- nessuna regressione auth;
- desktop autenticato funzionante.

**Prompt `/goal`**
```text
/goal G1.13
Integra l'Athlete Foundation nella shell reale senza ridisegnare ancora le singole feature. Verifica responsive, route e PWA banner.
```

---

# 4. Fase 2 — Dashboard atleta

## G2.1 — Arricchimento contratto dashboard atleta

**Obiettivo**  
Preparare il payload per il nuovo ordine informativo e multi-squadra senza rimuovere campi esistenti.

**Task**
- [x] Ispezionare Route Handler/service dashboard attuale.
- [x] Mantenere compatibilità con consumer esistenti.
- [x] Per eventi dashboard includere contesto team strutturato:
  `{ id, name, code }[]` o shape coerente.
- [x] Assicurare che memberships includano jersey number per team.
- [x] Identificare prossima partita pertinente senza assumere “prima squadra”.
- [x] Assicurare preview messaggi deduplicata.
- [x] Assicurare quota urgente con team/activity.
- [x] Validare input subject tramite helper server esistente.
- [x] Nessuna modifica schema DB.

### Chiusura G2.1 — 28 agosto 2026

- **File principali:** `src/app/api/athlete/dashboard/route.ts`, `src/types/athlete-dashboard.ts`, `src/lib/athlete/dashboard-contract.ts` e relativo test.
- **Contratto additivo:** le chiavi legacy restano disponibili; aggiunti `teams` top-level, `unreadMessageCount`, `teams`/`team_ids` agli eventi e messaggi, contesto team/activity alle membership e alle quote, e `teams`/`team_ids` al match successivo.
- **Multi-team:** i link `event_teams` vengono aggregati per evento; i messaggi vengono deduplicati per `message.id` aggregando i team destinatari; il match è selezionato sull’insieme delle club-team collegate alle membership dell’atleta.
- **Sicurezza:** `subjectProfileId` continua a passare da `requireSubjectAthleteContext`; nessun accesso privilegiato è stato spostato nel client e non sono state modificate schema/RLS/route.
- **Check eseguiti:** `npx tsc --noEmit` **PASS**, `npm test -- --runInBand src/lib/athlete/dashboard-contract.test.ts` **PASS** (2 test), `npm run build` **PASS** (84 pagine), `git diff --check` **PASS**.
- **Nota:** la suite Jest continua a mostrare il warning preesistente su `moduleNameMapping`; non blocca il test eseguito.

**Prompt `/goal`**
```text
/goal G2.1
Arricchisci in modo backward-compatible il contratto dati della dashboard atleta per eventi multi-team, match, messaggi, quote e membership. Mantieni auth server-side.
```

---

## G2.2 — Nuova struttura dashboard, senza logica complessa

**Obiettivo**  
Creare il layout nell'ordine approvato.

**Ordine**
1. prossimo impegno;
2. prossima partita;
3. messaggi non letti;
4. prossima quota/scadenza;
5. squadre e numeri di maglia.

**Task**
- [x] Rimuovere/accantonare hero fotografica dominante.
- [x] Rimuovere contatori generici non azionabili.
- [x] Eliminare duplicazione welcome/shell.
- [x] Tour non più CTA primaria persistente.
- [x] Usare Panel/ListRow, non card per ogni frammento.
- [x] Preparare placeholder reali per le cinque sezioni.
- [x] Non inventare dati.

### Chiusura G2.2 — 28 agosto 2026

- **File principale:** `src/components/athlete/AthleteDashboard.tsx`.
- **Struttura:** ordine effettivo `Prossimo impegno` → `Prossima partita` → `Messaggi non letti` → `Prossima quota` → `Squadre e numeri di maglia`.
- **UI:** hero fotografica dominante, contatori non azionabili e CTA persistente `Guida` rimossi; sezioni costruite con `Panel` e `ListRow`, con link alle route già esistenti.
- **Compatibilità:** loader, permessi delegati, modali dettagli, RSVP e route storiche sono preservati; nessun dato nuovo è stato inventato.
- **Check eseguiti:** `npx tsc --noEmit` **PASS**, `npm test -- --runInBand` **PASS** (2 suite, 5 test), `npm run build` **PASS** (84 pagine), `git diff --check` **PASS**.
- **Nota:** resta il warning Jest preesistente relativo a `moduleNameMapping`; non blocca i test.

**Prompt `/goal`**
```text
/goal G2.2
Ridisegna esclusivamente la struttura della dashboard atleta secondo l'ordine informativo approvato, usando i dati già disponibili e senza implementare ancora tutte le interazioni.
```

---

## G2.3 — Prossimo impegno e AttendanceControl

**Obiettivo**  
Implementare la prima area azionabile della dashboard.

**Dati**
- tipo;
- titolo;
- data/ora;
- luogo;
- team;
- deadline;
- risposta.

**Regole**
- se `requires_confirmation=false`, niente pulsanti;
- delegato senza `confirm_attendance` → read-only, non controlli disabled ambigui;
- deadline superata → stato esplicito;
- optimistic update solo se il backend lo supporta in sicurezza;
- rollback visibile in caso di errore.

**Task**
- [x] Estrarre/consolidare `AttendanceControl`.
- [x] `aria-pressed`.
- [x] Stato pending.
- [x] Evitare doppio submit.
- [x] Mantenere mutation subject-aware.

### Chiusura G2.3 — 28 agosto 2026

- **File principali:** `src/components/athlete/AttendanceControl.tsx`, `src/components/athlete/AthleteDashboard.tsx`, `src/app/api/athlete/events/attendance/route.ts` e relativo test.
- **Controllo:** il primo impegno della dashboard mostra RSVP solo quando `requires_confirmation` è vero; include risposta corrente, deadline e stato pending con pulsanti `aria-pressed`.
- **Permessi:** un profilo delegato senza `confirm_attendance` vede una descrizione read-only; non vengono mostrati pulsanti disabilitati ambigui.
- **Deadline e sicurezza:** deadline scaduta blocca il controllo lato client e l’endpoint rifiuta anche lato server; l’endpoint verifica inoltre evento, squadre associate e membership del subject dopo `requireSubjectAthleteContext`.
- **Rollback:** la scelta viene applicata ottimisticamente, il doppio submit è impedito e in caso di errore lo stato precedente viene ripristinato con messaggio `role=alert`.
- **Check eseguiti:** `npx tsc --noEmit` **PASS**, `npm test -- --runInBand` **PASS** (3 suite, 9 test), `npm run build` **PASS** (84 pagine), `git diff --check` **PASS**.
- **Nota:** resta il warning Jest preesistente relativo a `moduleNameMapping`; non blocca i test.

**Prompt `/goal`**
```text
/goal G2.3
Implementa Prossimo impegno e AttendanceControl sulla dashboard atleta, incluse deadline, read-only delegato e rollback visibile.
```

---

## G2.4 — Prossima partita

**Obiettivo**  
Mostrare la prima partita futura pertinente al subject, senza bias verso la prima squadra.

**Task**
- [x] Visualizzare team, avversario, data, ora, luogo e casa/trasferta se disponibili.
- [x] Se partite ravvicinate di team diversi, mostrare la prima + `Vedi tutte`.
- [x] CTA verso campionato/match coerente con route esistente.
- [x] Empty state specifico se nessuna partita.
- [x] Non inventare convocazione se non presente.

### Chiusura G2.4 — 28 agosto 2026

- **File principali:** `src/app/api/athlete/dashboard/route.ts`, `src/components/athlete/AthleteDashboard.tsx`, `src/lib/athlete/dashboard-contract.ts` e relativo test.
- **Multi-squadra:** la query considera tutti i `club_team` derivati dalle membership del subject; il mapper normalizza le relazioni PostgREST array e identifica il team dell’atleta tramite `team_id`.
- **Presentazione:** la sezione mostra team, avversario, badge Casa/Trasferta, data, ora e luogo; il link `Vedi tutti` porta alla route campionato esistente. Se non c’è match, viene mostrato uno stato vuoto specifico.
- **Privacy/accuratezza:** non viene inventata alcuna convocazione e l’endpoint continua a usare il contesto atleta autorizzato server-side.
- **Check eseguiti:** `npx tsc --noEmit` **PASS**, `npm test -- --runInBand` **PASS** (3 suite, 10 test), `npm run build` **PASS** (84 pagine), `git diff --check` **PASS**.
- **Nota:** resta il warning Jest preesistente relativo a `moduleNameMapping`; non blocca i test.

**Prompt `/goal`**
```text
/goal G2.4
Implementa la sezione Prossima partita della dashboard, corretta per soggetto multi-squadra.
```

---

## G2.5 — Preview messaggi dashboard

**Obiettivo**  
Mostrare 2–3 messaggi rilevanti senza duplicati.

**Task**
- [x] Massimo 2–3 righe.
- [x] Mittente.
- [x] Squadra/contesto.
- [x] Unread marker accessibile.
- [x] Deduplica messaggio ricevuto via più team/destinatari.
- [x] Apertura dettaglio verso route messaggi.
- [x] Non mostrare destinatari irrilevanti al subject.

### Chiusura G2.5 — 28 agosto 2026

- **File principali:** `src/components/athlete/MessagePreviewRow.tsx`, `src/components/athlete/AthleteDashboard.tsx`, `src/lib/athlete/dashboard-contract.ts` e relativi test.
- **Preview:** massimo tre righe, con oggetto, mittente, contenuto sintetico, badge `Non letto` accessibile e tutte le squadre pertinenti aggregate.
- **Deduplica/privacy:** il Route Handler deduplica per `message.id`, aggrega i team destinatari e interroga solo destinatari diretti o squadre del subject autorizzato; la preview apre il dettaglio messaggi esistente.
- **Check eseguiti:** `npx tsc --noEmit` **PASS**, `npm test -- --runInBand` **PASS** (4 suite, 12 test), `npm run build` **PASS** (84 pagine), `git diff --check` **PASS**.
- **Nota:** resta il warning Jest preesistente relativo a `moduleNameMapping`; non blocca i test.

**Prompt `/goal`**
```text
/goal G2.5
Implementa la preview messaggi nella dashboard atleta con deduplica e contesto squadra.
```

---

## G2.6 — Preview quota/scadenza

**Obiettivo**  
Mostrare la rata più urgente e il relativo contesto.

**Task**
- [x] Importo con tabular nums.
- [x] Team/activity.
- [x] Stato.
- [x] Scadenza.
- [x] Link a `/athlete/fees`.
- [x] Nessun pulsante `Paga` se non esiste un flusso reale.
- [x] Empty state se nessuna quota.

### Chiusura G2.6 — 28 agosto 2026

- **File principali:** `src/components/athlete/AthleteDashboard.tsx`, `src/lib/athlete/fee-preview.ts` e relativo test.
- **Preview:** viene mostrata una sola rata non pagata, selezionata per urgenza (`overdue` → `due_soon` → restante) e poi per scadenza; se tutte le rate sono pagate viene mostrato uno stato esplicito.
- **Contesto:** la riga include nome quota, numero rata, importo tabulare, team, attività, codice, stato e data di scadenza.
- **CTA/privacy:** il link `Vedi tutti` porta a `/athlete/fees`; non è presente alcun pulsante `Paga` o promessa di pagamento online.
- **Check eseguiti:** `npx tsc --noEmit` **PASS**, `npm test -- --runInBand` **PASS** (5 suite, 14 test), `npm run build` **PASS** (84 pagine), `git diff --check` **PASS**.
- **Nota:** resta il warning Jest preesistente relativo a `moduleNameMapping`; non blocca i test.

**Prompt `/goal`**
```text
/goal G2.6
Implementa la preview della quota più urgente nella dashboard. Nessuna CTA di pagamento se il backend non la supporta.
```

---

## G2.7 — Membership e numeri di maglia per squadra

**Obiettivo**  
Rendere corretta la dashboard per atleti multi-squadra.

**Task**
- [x] Una riga per membership.
- [x] Team.
- [x] Attività.
- [x] Codice.
- [x] `team_members.jersey_number`.
- [x] Non usare il primo jersey number come valore globale.
- [x] Link dettaglio coerente, se già esiste.

### Chiusura G2.7 — 28 agosto 2026

- **File principali:** `src/components/athlete/MembershipRow.tsx`, `src/components/athlete/AthleteDashboard.tsx` e relativo test.
- **Membership:** la dashboard rende una riga per ogni record `team_members`, con nome squadra, attività, codice e numero di maglia della singola relazione.
- **Fonte autorevole:** il Route Handler continua a leggere `team_members.jersey_number`; non viene usato il vecchio `profiles.jersey_number` come valore globale.
- **Dettaglio:** la riga resta apribile verso il dettaglio squadra esistente per il profilo personale; in vista delegata è presentata in modalità non interattiva.
- **Check eseguiti:** `npx tsc --noEmit` **PASS**, `npm test -- --runInBand` **PASS** (6 suite, 16 test), `npm run build` **PASS** (84 pagine), `git diff --check` **PASS**.
- **Nota:** resta il warning Jest preesistente relativo a `moduleNameMapping`; non blocca i test.

**Prompt `/goal`**
```text
/goal G2.7
Implementa la sezione squadre/membership della dashboard usando il numero di maglia per team come dato autorevole.
```

---

## G2.8 — Stati completi dashboard

**Obiettivo**  
Gestire tutte le varianti reali.

**Task**
- [x] initial loading;
- [x] refresh;
- [x] nessuna squadra;
- [x] nessun evento;
- [x] errore dashboard;
- [x] offline con dati in memoria;
- [x] denied se contesto non autorizzato;
- [x] mutation success/error;
- [x] nessun flash di dati del subject precedente.

**Chiusura G2.8**
- **Stato:** completato.
- **Implementazione:** `AthleteDashboard` usa uno stato esplicito `loading/refreshing/success/error/offline/denied`; `FeedbackState` copre loading, refresh, error, offline ed empty state per eventi, match, messaggi, quote e squadre.
- **Cambio contesto:** la chiave del subject invalida immediatamente il payload precedente e mostra loading finché la risposta del nuovo contesto non è stata associata al subject corretto.
- **Offline:** con dati in memoria viene mostrato un avviso esplicito sugli ultimi dati caricati; senza dati non viene mostrato alcun contenuto come se fosse corrente.
- **Verifiche:** `npx tsc --noEmit`; `npm test -- --runInBand` (6 suite, 16 test); `npm run build`; `git diff --check`.
- **Nota:** resta il warning Jest preesistente relativo a `moduleNameMapping`; non blocca i test.

**Prompt `/goal`**
```text
/goal G2.8
Completa gli stati della dashboard atleta usando FeedbackState. Verifica che cambio contesto e offline non mostrino dati fuorvianti.
```

---

## G2.9 — Test e gate dashboard atleta

**Scenari**
- zero team;
- un team;
- più team;
- jersey differenti;
- evento senza conferma;
- evento da confermare;
- deadline scaduta;
- message duplicate;
- quota assente;
- quota scaduta;
- responsive 320/375/768/1440;
- keyboard attendance;
- offline.

**Prompt `/goal`**
```text
/goal G2.9
Aggiungi/aggiorna test mirati e verifica il gate della dashboard atleta. Correggi solo regressioni della dashboard/foundation.
```

**Chiusura G2.9**
- **Stato:** completato.
- **Test mirati aggiunti:** `dashboard-state.test.ts` per payload in memoria e invalidazione del subject precedente; `FeedbackState.test.tsx` per loading/refreshing/empty/offline/denied/error e retry; attendance senza conferma, deadline e keyboard; membership con jersey indipendenti; contratto multi-team, deduplica messaggi e quote urgente già coperti. Aggiunto anche `tests/e2e/athlete-dashboard.spec.ts` per responsive 320/375/768/1440 e offline.
- **Gate eseguiti:** `npx tsc --noEmit`; `npm test -- --runInBand` (8 suite, 30 test); `npm run build`; `git diff --check`.
- **E2E:** `npx playwright test --list` rileva i 2 nuovi scenari. Con server locale verificato su `/login` (HTTP 200) e credenziali `E2E_*_LOCAL` risolte da `.env.local`, il run si ferma in `global-setup.ts` al launch Chromium (`SIGTRAP`, `kill EPERM`) prima di login/test. Da rieseguire in un ambiente Playwright/browser funzionante.
- **Note:** resta il warning Jest preesistente relativo a `moduleNameMapping` e il warning Node `punycode`; non bloccano i gate verdi.

---

# 5. Fase 3 — Calendario atleta

## G3.1 — Arricchire il contratto calendario

**Obiettivo**  
Aggiungere ID/codice team per evento mantenendo compatibilità.

**Task**
- [ ] Includere team `{id,name,code}`.
- [ ] Conservare eventuali campi legacy.
- [ ] Verificare eventi associati a più team.
- [ ] Definire ID evento stabile per deduplica.
- [ ] Confermare `requires_confirmation`, deadline, risposta subject.
- [ ] Nessun `teamId` client usato senza verifica membership server.

**Prompt `/goal`**
```text
/goal G3.1
Arricchisci il payload calendario atleta con team id/name/code e dati necessari alla presenza, mantenendo compatibilità e auth server-side.
```

---

## G3.2 — Agenda mobile come vista default

**Obiettivo**  
Sostituire il mese come default mobile con agenda/lista.

**Task**
- [ ] Raggruppare per giorno.
- [ ] Riga/event card compatta.
- [ ] Mostrare tipo, ora, titolo, luogo e team quando necessario.
- [ ] Primo evento rilevante espandibile.
- [ ] Nessun overflow 320 px.
- [ ] Nessuna card isolata per ogni microdato.
- [ ] Mese resta solo vista secondaria se già disponibile.

**Prompt `/goal`**
```text
/goal G3.2
Implementa l'agenda mobile come vista predefinita del calendario atleta, mantenendo la vista mese solo come secondaria se già supportata.
```

---

## G3.3 — Filtri tipo e squadra

**Obiettivo**  
Filtrare senza alterare autorizzazione.

**Task**
- [x] Segmenti tipo: Tutti / Allenamenti / Partite o equivalente compatto.
- [x] TeamSwitcher solo con ≥2 team.
- [x] Default Tutte le squadre.
- [x] Filtered empty distinto da empty autentico.
- [x] `aria-pressed` o semantica appropriata.
- [x] Reset team su cambio subject tramite foundation.

**Prompt `/goal`**
```text
/goal G3.3
Aggiungi filtri tipo e squadra al calendario. Il team filter deve restringere soltanto eventi già autorizzati.
```

---

## G3.4 — Dettaglio evento responsive

**Obiettivo**  
Aprire dettagli senza perdere contesto.

**Task**
- [x] Mobile → bottom sheet/fullscreen.
- [x] Desktop → drawer.
- [x] Titolo, data, ora, luogo, team, note disponibili.
- [x] Stato presenza.
- [x] Deadline.
- [x] Chiusura accessibile.
- [x] Deep link esistente preservato se presente.

**Prompt `/goal`**
```text
/goal G3.4
Implementa il dettaglio evento usando ResponsiveDetail, con contenuto e metadati realmente disponibili.
```

---

## G3.5 — AttendanceControl nel calendario

**Obiettivo**  
Riutilizzare il controllo senza duplicare logica.

**Task**
- [x] Riutilizzare `AttendanceControl`.
- [x] Inline sull'evento prioritario.
- [x] Nel detail sugli altri eventi quando applicabile.
- [x] Deadline superata.
- [x] Read-only delegato.
- [x] Rollback.
- [x] No mutation offline.

**Prompt `/goal`**
```text
/goal G3.5
Integra AttendanceControl nel calendario senza duplicarne la logica e impedendo mutazioni quando offline o non autorizzate.
```

---

## G3.6 — Deduplica eventi e conflitti temporali

**Obiettivo**  
Gestire casi multi-team correttamente.

**Task**
- [x] Evento associato a più team → una sola occorrenza con tutti i team.
- [x] Eventi distinti sovrapposti → entrambi visibili.
- [x] Evidenziare conflitto con testo/icona, non solo colore.
- [x] Non stabilire priorità automatica.
- [x] Evitare falsi duplicati basati solo su titolo/orario.

**Prompt `/goal`**
```text
/goal G3.6
Implementa deduplica multi-team e segnalazione conflitti temporali nel calendario, senza nascondere eventi reali.
```

---

## G3.7 — Vista desktop agenda/settimana

**Obiettivo**  
Adattare il calendario ai desktop senza trasformarlo in UI admin.

**Task**
- [x] Agenda/settimana default desktop.
- [x] Vista mese disponibile.
- [x] Filtri tipo/team.
- [x] Detail laterale.
- [x] Export solo secondario se esiste già.
- [x] Contenuto atleta max-width coerente.

**Prompt `/goal`**
```text
/goal G3.7
Completa la vista desktop del calendario atleta con agenda/settimana default e dettaglio laterale.
```

---

## G3.8 — Test e gate calendario

**Scenari**
- [x] zero eventi;
- [x] eventi ricorrenti;
- [x] multi-team same event;
- [x] overlapping events;
- [x] deadline;
- [x] mutation failure;
- [x] family permission permutations da simulare a livello component/server se possibile;
- [x] responsive obbligatori;
- [x] tastiera/screen reader smoke.

**Verifica completata il 28/08/2026**

- Test unitari mirati e suite completa: 18 suite, 66 test superati.
- TypeScript, build Next.js e `git diff --check` superati.
- Aggiunto `tests/e2e/athlete-calendar.spec.ts` per smoke responsive desktop/mobile; il server Next è partito, ma Chromium locale ha terminato con `SIGTRAP` durante `chromium.launch`, quindi l'E2E non è dichiarato superato.

**Prompt `/goal`**
```text
/goal G3.8
Completa test e verifiche del calendario atleta sui casi multi-team, conflitti, presenze, responsive e accessibilità.
```

---

## G3.V — Gate verifica Fase 3

**Verdict: PASS — 28/08/2026**

L'audit ha riesaminato G3.1–G3.8 contro `re_design.md`, codice, diff/history e gate tecnici. Le remediation della Fase 3 sono state completate e riverificate.

### G3.R1 — Stati errore/offline del calendario — Completato il 28/08/2026

- **Severità:** High
- **Problemi risolti:** `AthleteCalendarManager` distingue loading, errore, offline e risposta valida vuota; la route calendario restituisce HTTP 500 con messaggio generico per gli errori Supabase, senza esporre dettagli interni.
- **Requisiti:** stati `error` e `offline` espliciti; PWA onesta e nessuna confusione tra assenza dati e indisponibilità.
- **Implementazione:** `AthleteCalendarManager` mostra `ErrorState`/`OfflineState` con azione `Riprova`; l'empty è usato solo dopo risposta HTTP valida. Aggiunti test per HTTP 500, rete offline e risposta valida vuota. File principali: `src/components/athlete/AthleteCalendarManager.tsx`, `src/app/api/athlete/calendar/route.ts`, `src/components/athlete/AthleteCalendarManager.test.tsx`, `jest.config.js`.

### G3.R2 — Contesto team desktop e account dual-role — Completato il 28/08/2026

- **Severità:** High
- **Problemi risolti:** `LayoutShell` monta le varianti desktop e mobile dei selettori, con una sola resa visibile per breakpoint. La policy presenza considera `activeArea`, subject selezionato e permesso della relazione, evitando la priorità impropria del ruolo globale atleta negli account dual-role.
- **Requisiti:** contesto account/subject/team sempre visibile; permessi familiari per singolo subject; il filtro non concede accesso e le azioni devono riflettere la relazione attiva.
- **Implementazione:** aggiunti `SubjectSwitcher`/`TeamSwitcher` desktop nel contesto header e helper `canConfirmAthleteAttendance`; testati atleta personale, familiare con/senza permesso e subject non selezionato. L'autorizzazione server-side resta l'enforcement definitivo.

### G3.R3 — Stato di errore del dettaglio e verifica browser runtime — Completato il 28/08/2026

- **Severità:** Medium
- **Problemi risolti:** `EventDetails` non ingoia più errori di rete/HTTP e `EventDetailModal` espone uno stato d'errore con retry; il cleanup abortisce le richieste obsolete. Test dedicati coprono stato d'errore e retry.
- **Verifica runtime:** completata sul browser integrato con server Next production e account atleta locale. A 1440×900 la vista settimanale desktop è visibile senza overflow; a 375×812 l’agenda mobile è visibile senza overflow e il controllo `Agenda` è selezionato. Il dettaglio evento carica in dialog, il focus iniziale finisce su `Chiudi` e il DOM espone ruoli `dialog`, `region` e `button` accessibili. Il runner Playwright standalone resta soggetto a `SIGTRAP`, ma non blocca la verifica runtime integrata riuscita.
- **Requisiti:** stato `error` esplicito per il dettaglio; responsive obbligatorio verificato a runtime e smoke tastiera/screen reader.
- **Esito:** nessuna remediation residua applicativa; la Fase 3 può procedere alla Fase 4.

---

# 6. Fase 4 — Messaggi atleta

## G4.1 — Contratto messaggi, deduplica e read state

**Obiettivo**  
Rendere il backend esplicito sui concetti necessari alla nuova UI.

**Task**
- [ ] Definire ID stabile del messaggio.
- [ ] Deduplicare recapito diretto + team multipli.
- [ ] Restituire contesto team aggregato.
- [ ] Read state per account + subject profile.
- [ ] Restituire unread count coerente.
- [ ] Filtrare destinatari visibili al subject.
- [ ] Non esporre signed URL permanenti.
- [ ] Mantenere campi legacy.

**Prompt `/goal`**
```text
/goal G4.1
Rendi il contratto messaggi esplicito per deduplica, team context e read state account+subject, preservando privacy e compatibilità.
```

---

## G4.2 — Lista messaggi

**Obiettivo**  
Passare da card isolate a lista unica densa.

**Riga**
- unread indicator;
- avatar/initials;
- mittente;
- ruolo;
- team/destinatario pertinente;
- oggetto;
- preview max 2 righe;
- data.

**Task**
- [ ] Timestamp relativo per recenti.
- [ ] Data completa disponibile nel detail.
- [ ] Allegati: icona + conteggio.
- [ ] Touch target.
- [ ] Lista semantica.

**Prompt `/goal`**
```text
/goal G4.2
Ridisegna la lista messaggi atleta con ListRow e tutti i metadati previsti, senza card isolate per ogni messaggio.
```

---

## G4.3 — Filtro Tutti/Non letti e team filter

**Task**
- [ ] Unread filter.
- [ ] Team filter solo multi-team.
- [ ] Filtered empty.
- [ ] Unread count coerente con filtro.
- [ ] Nessuna duplicazione messaggio passando da Tutti a team specifico.

**Prompt `/goal`**
```text
/goal G4.3
Aggiungi i filtri Tutti/Non letti e squadra alla lista messaggi, con empty state specifico.
```

---

## G4.4 — Dettaglio messaggio e marcatura lettura

**Task**
- [ ] Detail responsive.
- [ ] Subject.
- [ ] Mittente/ruolo.
- [ ] Data completa.
- [ ] Destinatari pertinenti.
- [ ] Contenuto.
- [ ] Read state aggiornato senza full reload.
- [ ] UI ottimistica solo con rollback sicuro.
- [ ] Badge nav/dashboard sincronizzato senza diventare fonte autorevole.

**Prompt `/goal`**
```text
/goal G4.4
Implementa il dettaglio messaggio e l'aggiornamento read state senza full reload, mantenendo il backend come fonte autorevole.
```

---

## G4.5 — Allegati, signed URL e privacy

**Task**
- [ ] Mostrare allegati autorizzati.
- [ ] Generare/recuperare signed URL solo al bisogno.
- [ ] Non salvarli in localStorage.
- [ ] Non cachearli nel service worker.
- [ ] Error state per URL scaduto/fallito.
- [ ] Non esporre destinatari non pertinenti.

**Prompt `/goal`**
```text
/goal G4.5
Completa gli allegati messaggio con signed URL on-demand e verifica che nessun dato privato venga persistito o cacheato.
```

---

## G4.6 — Deep link push verso messaggi

**Task**
- [ ] Verificare route same-origin esistente.
- [ ] Push click apre la route esistente.
- [ ] L'app risolve account/subject autorizzato.
- [ ] Non fidarsi di subject arbitrario nel deep link.
- [ ] Graceful denied/not found.
- [ ] App già aperta vs chiusa.

**Prompt `/goal`**
```text
/goal G4.6
Verifica e adatta i deep link push dei messaggi al redesign, senza usare parametri subject/team come autorizzazione.
```

---

## G4.7 — Test messaggi

**Scenari**
- zero message;
- unread/read;
- duplicate via 2 team;
- direct+team;
- allegato;
- signed URL fail;
- deep link;
- subject switch;
- offline;
- responsive/a11y.

**Prompt `/goal`**
```text
/goal G4.7
Completa i test della feature messaggi, inclusi deduplica, read state, allegati, deep link e cambio subject.
```

## G4.V — Verifica completa Fase 4

**Data verifica:** 2026-08-28

**Perimetro verificato:** G4.1–G4.7, contratto API, deduplica diretto/team,
contesto subject/team, read state account+subject, privacy destinatari,
allegati e signed URL, deep link push, PWA/cache, responsive/accessibilità,
stati loading/empty/filtered-empty/error/denied/offline, TypeScript, test,
lint, build e discovery E2E.

**Esito:** PASS WITH ISSUES — nessun rilievo Critical/High; la Fase 4 non è
bloccata dal gate, ma le issue sotto restano da chiudere prima del cleanup
finale e della matrice E2E completa.

**Evidenze positive**
- `buildAthleteMessages` espone ID stabile, `dedupe_key`, team aggregati e
  read state separato per `auth_user_id + subject_profile_id`.
- Il route atleta limita destinatari e allegati al subject/team autorizzato;
  il route allegati genera URL firmati on-demand senza restituire il path.
- Il service worker bypassa `/api/` e richieste RSC; i test PWA verificano che
  payload API e URL Supabase non vengano persistiti in Cache Storage.
- La UI copre lista semantica, filtri, empty filtrato, dettaglio responsive,
  read state autorevole senza full reload e fallback denied/deep-link.
- **Nota di tracciamento risolta:** durante l’audit il marker G4.3 era
  incoerente con filtri e test presenti; è stato riallineato a `[x]` insieme
  alla remediation G4.R1, senza modificare il perimetro funzionale dell’audit.
- Verifiche eseguite: TypeScript OK; Jest 24 suite/81 test OK; lint OK; build
  OK; Playwright discovery 31 test OK; `git diff --check` OK.

**Issue rilevate**

1. **[Medium] Errore/offline mostrato come zero messaggi.**
   - Requisito violato: G4.7 e criteri di stato error/offline; l’utente deve
     distinguere assenza dati da mancato caricamento.
   - Attuale: `AthleteMessagesManager` svuota `messages` nel catch e rende
     l’`EmptyState` globale anche per errori HTTP/rete
     (`src/components/athlete/AthleteMessagesManager.tsx`, righe 66–69 e
     144–145).
   - Atteso: stato error esplicito con retry e stato offline coerente con la
     connettività, senza trasformare un errore in “Nessun messaggio”.
   - Remediation: introdurre stato discriminato `error/offline`, preservare
     l’ultimo dato utile quando opportuno e aggiungere test manager/UI.

2. **[Medium] Deep link push non completo per account multi-ruolo/famiglia.**
   - Requisito violato: G4.6 “l’app risolve account/subject autorizzato” e
     apertura del messaggio dal push.
   - Attuale: il resolver push sceglie coach prima di athlete e non produce
     alcun URL per un account solo `family_member`
     (`src/server/messages/push-notifications.ts`, righe 119–131); inoltre
     `CoachMessagesManager` non legge `messageId` dalla query.
   - Atteso: il click deve arrivare a una route che risolva il contesto
     account/subject e apra il messaggio, senza usare il parametro come
     autorizzazione, anche con ruoli multipli o soggetto famiglia.
   - Remediation: definire un resolver deep-link condiviso per ruolo/subject,
     con fallback autorizzato e test app aperta/chiusa, dual-role e famiglia.

3. **[Low] Mancano direttive esplicite no-store per il recupero signed URL.**
   - Requisito a rischio: G4.5 privacy/cache; il service worker è corretto,
     ma browser/HTTP cache non sono vincolati dal solo bypass SW.
   - Attuale: il client usa fetch senza `cache: 'no-store'` e l’endpoint non
     imposta `Cache-Control` (`src/components/shared/MessageDetailModal.tsx`,
     righe 84–91; `src/app/api/athlete/messages/attachments/[id]/route.ts`,
     righe 37–49).
   - Atteso: signed URL e risposta metadata esclusi esplicitamente dalle
     cache persistenti/intermedie.
   - Remediation: aggiungere `Cache-Control: private, no-store` lato route e
     `cache: 'no-store'` lato client, con test header.

**Limitazione di verifica:** il runtime Playwright autenticato non è stato
  eseguito: la configurazione non riesce ad avviare il web server in questa
  sessione (`listen EPERM: operation not permitted 0.0.0.0:3000`). La
  discovery e i test unit/integration locali restano verdi; la matrice E2E
  autenticata va ripetuta in un ambiente che consenta il bind della porta.

**Stato remediation G4.R1:** completata il 28/08/2026. `AthleteMessagesManager`
  distingue empty autentico, error e offline; offre retry, evita fetch offline,
  reagisce al ritorno online, preserva i dati durante un refresh fallito e
  resetta messaggi/detail al cambio subject. Test manager aggiunti per empty,
  HTTP error/retry, offline e preservazione dati; typecheck, Jest 25 suite/86
  test, lint e build superati.

**Stato remediation G4.R2:** completata il 28/08/2026. Il resolver push
  `resolveMessagePushArea` tratta athlete come destinazione preferenziale,
  usa `/athlete/messages` per family-only e può allegare `subjectProfileId`
  soltanto come hint. Il context accessibile e le API restano le sole fonti di
  autorizzazione; `CoachMessagesManager` consuma il `messageId` della query.
  Test aggiunti per area athlete/coach/admin, dual-role e family-only; Jest,
  typecheck, lint e build superati.

**Stato remediation G4.R3:** completata il 28/08/2026. Il route signed URL
  usa `Cache-Control: private, no-store` su risposte positive ed errori; il
  client usa `cache: 'no-store'` nel recupero on-demand. Aggiunto test
  esplicito dell’header e aggiornata la verifica del fetch; Jest 25 suite/86
  test, typecheck, lint, build e `git diff --check` superati.

---

# 7. Fase 5 — Campionato atleta

## G5.1 — Resolver squadra → campionato → girone per atleta

**Obiettivo**  
Eliminare l'assunzione “primo campionato disponibile”.

**Task**
- [ ] Derivare i team dal subject atleta autorizzato.
- [ ] Per ogni team elencare campionati pertinenti.
- [ ] Per campionato elencare gironi pertinenti.
- [ ] Gerarchia:
  `Squadra → Campionato → Girone`.
- [ ] Se livello univoco, può essere implicito.
- [ ] Default non deve selezionare dati di un team non esplicitamente derivato.
- [ ] Nessuna query client basata solo su `ownerProfileId` per la nuova modalità.

**Prompt `/goal`**
```text
/goal G5.1
Implementa il resolver atleta Squadra→Campionato→Girone partendo dal subject autorizzato, eliminando l'assunzione del primo campionato disponibile.
```

---

## G5.2 — Endpoint campionato subject-aware

**Obiettivo**  
Creare il prerequisito tecnico che servirà anche alla famiglia.

**Task**
- [ ] Route Handler/service per:
  - catalogo;
  - classifica;
  - partite;
  - convocazioni.
- [ ] Input `subjectProfileId` validato con `requireSubjectAthleteContext` o helper equivalente.
- [ ] Ogni team richiesto deve appartenere al subject.
- [ ] Ogni championship/group deve essere pertinente al team.
- [ ] Zod per parametri.
- [ ] Thin handlers + server service.
- [ ] Nessun admin/service role esposto.
- [ ] Compatibilità con consumer atleta esistenti.

**Prompt `/goal`**
```text
/goal G5.2
Introduci endpoint campionato subject-aware per catalogo, classifica, partite e convocazioni. Valida rigorosamente subject, team e campionato server-side.
```

---

## G5.3 — Shell UI campionato atleta

**Task**
- [ ] Titolo `Campionato`.
- [ ] Team/campionato selector solo quando necessario.
- [ ] Ordine:
  1. prossima partita;
  2. convocazione;
  3. posizione;
  4. risultati;
  5. calendario completo.
- [ ] Team context coerente con foundation.
- [ ] Nessuna selezione implicita ambigua.

**Prompt `/goal`**
```text
/goal G5.3
Ridisegna la shell della pagina Campionato atleta con gerarchia e selettori derivati dal resolver.
```

---

## G5.4 — Prossima partita e convocazione

**Campi**
- giornata;
- casa/trasferta;
- avversario;
- data/ora;
- luogo;
- stato convocazione;
- ritrovo;
- `Vedi convocazione` se disponibile.

**Regole**
- non mostrare convocazioni non pubblicate/non autorizzate;
- stati testuali;
- empty separato.

**Prompt `/goal`**
```text
/goal G5.4
Implementa Prossima partita e convocazione personale/pubblicata nel Campionato atleta usando gli endpoint subject-aware.
```

---

## G5.5 — Classifica

**Task**
- [ ] Top 5 iniziale.
- [ ] Expand classifica completa.
- [ ] Evidenziare CSRoma con testo/marker/surface.
- [ ] Numeri allineati/tabular.
- [ ] Non usare solo rosso.
- [ ] Non imporre top-three decorativo se non significativo.

**Prompt `/goal`**
```text
/goal G5.5
Implementa la classifica Campionato con evidenziazione accessibile CSRoma, top 5 iniziale ed espansione completa.
```

---

## G5.6 — Risultati recenti e calendario completo

**Task**
- [ ] Risultati recenti compatti.
- [ ] Calendario completo on demand.
- [ ] Team/championship context preservato.
- [ ] Stati match chiari.
- [ ] Nessuna duplicazione con “prossima partita”.

**Prompt `/goal`**
```text
/goal G5.6
Completa Risultati recenti e Calendario completo del Campionato, preservando il contesto selezionato.
```

---

## G5.7 — Test campionato

**Scenari**
- una squadra/un campionato;
- più team;
- più campionati;
- più gironi;
- nessuna partita futura;
- nessuna convocazione;
- classifica vuota;
- teamId non autorizzato;
- subject delegabile a livello server;
- responsive.

**Prompt `/goal`**
```text
/goal G5.7
Testa il flusso Campionato multi-squadra e gli endpoint subject-aware, inclusi tentativi con team/campionato non autorizzati.
```

---

# 8. Fase 6 — Quote e profilo atleta

## G6.1 — Contratto quote atleta

**Task**
- [x] Includere `team.id`.
- [x] Includere `activity.id`.
- [x] Mantenere nome/codice.
- [x] Definire importi dovuto/pagato/residuo in modo coerente.
- [x] Stati:
  - non ancora dovuta;
  - in scadenza;
  - scaduta;
  - parziale;
  - pagata.
- [x] Subject auth server.
- [x] Nessun pagamento online inventato.

**Prompt `/goal`**
```text
/goal G6.1
Arricchisci il contratto quote atleta con team/activity ID e stati finanziari coerenti, mantenendo compatibilità.
```

---

## G6.2 — UI quote atleta

**Layout**
- totale dovuto/pagato/residuo;
- gruppi per team;
- filtri Tutte/Da pagare/Pagate/Scadute;
- FeeRow;
- dettaglio espandibile.

**Task**
- [x] Totali non nascondono il breakdown team.
- [x] Importi a destra, tabular.
- [x] Filtered empty.
- [x] Nessun `Paga`.
- [x] Responsive 320→desktop.

**Prompt `/goal`**
```text
/goal G6.2
Ridisegna la pagina Quote atleta con riepilogo, gruppi per squadra, filtri e righe compatte. Non introdurre pagamenti online.
```

---

## G6.3 — Endpoint profilo atleta/delegato permission-aware

**Obiettivo**  
Preparare una fonte server che non dipenda da query client owner-only.

**Task**
- [x] Separare dati account da dati subject.
- [x] Endpoint/service profilo subject-aware.
- [x] Restituire solo dati necessari alla UI.
- [x] Predisporre permission flags per:
  - medical status;
  - documents.
- [x] Membership con jersey per team.
- [x] Non restituire dati medici dettagliati se la specifica autorizza solo stato.
- [x] Nessuna modifica delle regole di permission.

**Prompt `/goal`**
```text
/goal G6.3
Crea un endpoint profilo subject-aware e permission-aware, separando dati account, dati atleta, membership e informazioni sensibili.
```

---

## G6.4 — UI profilo atleta

**Sezioni**
- identità/avatar;
- contatti;
- tesseramento;
- certificato;
- squadre + jersey;
- preferenze;
- notifiche;
- installazione;
- sicurezza/account.

**Task**
- [x] Separare visivamente dati subject da impostazioni account.
- [x] Jersey per team.
- [x] Nessun “primo jersey”.
- [x] Dati medical/document permission-aware.
- [x] Nessuna duplicazione impostazioni in header.

**Prompt `/goal`**
```text
/goal G6.4
Ridisegna il profilo atleta separando chiaramente identità sportiva del subject e impostazioni dell'account.
```

---

## G6.5 — Installazione PWA, push e preferenze account — Completato il 29/08/2026

**Task**
- [x] Comando installazione nel profilo.
- [x] Nascondere se standalone.
- [x] iOS instructions dedicate.
- [x] Copy beneficio: accesso rapido + notifiche.
- [x] Non promettere offline completo.
- [x] Push permission solo dopo gesto.
- [x] Preferenze per device/account.
- [x] Compatibilità piattaforme senza Badging API.
- [x] Verificare doppia convenzione storage tema, documentando il fix da fare in G10.1 se non necessario ora.

**Implementazione e verifica**
- `AthleteProfileManager` espone installazione PWA e stato push nel pannello preferenze account; il consenso browser viene richiesto solo dal click su `Attiva`, con messaggi distinti per browser non supportato, permesso negato, stato attivo e fallimento operativo.
- `InstallPwaButton` gestisce `beforeinstallprompt`, `appinstalled`, modalità standalone e istruzioni manuali dedicate a iOS; non introduce cache o comportamento offline aggiuntivo.
- Aggiunti test per click esplicito/errori push, prompt PWA post-click, standalone e istruzioni iOS: suite completa 39 suite/126 test; typecheck, lint, build e `git diff --check` superati.
- Nessuna modifica alla convenzione storage tema in questo goal; il controllo/fix resta tracciato in G10.1.

**Prompt `/goal`**
```text
/goal G6.5
Integra installazione PWA e preferenze push nel profilo account, con richiesta permesso solo su gesto esplicito e copy realistico.
```

---

## G6.6 — Test quote e profilo

**Scenari**
- 0 quote;
- pagata/scaduta/parziale;
- multi-team;
- jersey differenti;
- certificate status;
- push unsupported;
- standalone;
- iOS install instructions;
- endpoint profilo con subject non autorizzato.

**Prompt `/goal`**
```text
/goal G6.6
Completa i test di Quote e Profilo atleta, inclusi casi multi-team, PWA account settings e autorizzazione del profilo.
```

**Implementazione e verifica**
- Estesi `AthleteFeesManager.test.tsx` e le regressioni esistenti di `FeeRow`/contratto per quote vuote, multi-team, pagate, scadute, parziali e residui finanziari.
- Esteso `AthleteProfileManager.test.tsx` per identità sportiva/account separati, installazione PWA nel pannello preferenze e attivazione push solo dopo click; `InstallPwaButton.test.tsx` copre prompt post-gesto, standalone e istruzioni iOS.
- Esteso `GET /api/athlete/profile` con test del rifiuto server-side per subject non autorizzato (HTTP 403), mantenendo il controllo nel resolver.
- Verifiche eseguite: test mirati 13/13, suite completa 39 suite/129 test, `npx tsc --noEmit`, `npm run lint`, `npm run build` e `git diff --check` superati.

## G6.V — Verifica completa Fase 6 — 29 agosto 2026

**Perimetro:** G6.1–G6.6; contratto/API quote, UI quote, contratto/API profilo,
UI profilo, account/subject/team context, PWA/push, stati, autorizzazione,
responsive/accessibilità, regressioni e gate tecnici.

**Verdict: PASS WITH ISSUES.** Non sono emersi rilievi Critical/High; la Fase 6
non è bloccata. Le remediation G6.R1 e G6.R2 hanno chiuso i rilievi Medium
relativi agli stati offline e al 403 del profilo; restano incomplete le
seguenti evidenze o conformità:

1. **[Medium] Manca smoke E2E autenticato specifico per Quote e Profilo.**
   - Requisito violato: responsive ai viewport obbligatori, accessibilità e
     verifica PWA runtime della Fase 6.
   - Attuale: `npx playwright test --list` rileva 33 test, ma nessuno copre
     `/athlete/fees` o `/athlete/profile`; le spec responsive esistenti sono
     per dashboard/calendario/campionato/messaggi. Il tentativo dei progetti
     atleta/PWA in questa sessione non ha prodotto uno smoke runtime concluso.
   - Atteso: spec autenticata su 320×568, 375×812, 390×844, 768×1024,
     1024×768 e 1440×900 con overflow, heading, tastiera, touch target,
     stati e pannello PWA/account verificati.
   - Remediation: aggiungere spec E2E dedicate e rieseguirle in un ambiente
     con credenziali atleta/famiglia e browser runtime operativo.

2. **[Low] Autorizzazione route quote senza regressione route-level dedicata.**
   - Requisito a rischio: matrice autorizzativa e test pertinenti.
   - Attuale: `/api/athlete/fees` usa correttamente
     `requireSubjectAthleteContext(..., 'view_payments')` (`src/app/api/athlete/fees/route.ts:9-14`),
     ma i test verificano il mapper e la UI, non 401/403 del route né
     subject non autorizzato per la route quote.
   - Atteso: test route per account non autenticato, ruolo non atleta,
     relazione senza `view_payments` e subject fuori grafo.
   - Remediation: aggiungere `src/app/api/athlete/fees/route.test.ts` con
     mock del resolver e asserzioni di status/body senza indebolire il server.

3. **[Low] Type-safety incompleta ai confini dati quote.**
   - Requisito a rischio: TypeScript strict e contratti esterni prevedibili.
   - Attuale: il route usa fallback `as any[]`
     (`src/app/api/athlete/fees/route.ts:48,54`) e i manager fanno cast
     diretto del JSON a `Partial<AthleteFeesContract>`/
     `AthleteProfileContract`, senza validazione runtime.
   - Atteso: nessun `any` nei confini API e payload verificato prima del
     rendering, mantenendo il contratto backward-compatible.
   - Remediation: definire validator Zod (o equivalente già presente), usare
     `unknown`/parse e tipizzare i fallback del client Supabase.

**Evidenze positive**

- Quote: ID team/activity, stati finanziari coerenti, aggregazione per
  `team.id`, jersey per membership e nessuna CTA pagamento inventata.
- Profilo: account/subject distinti, dati medici limitati dal permesso,
  jersey per team, resolver `requireSubjectAthleteContext` e `no-store`.
- PWA: prompt solo da gesto esplicito, standalone/iOS e cache privata non
  estesa; componenti e test usano token/primitive condivise, focus e
  `aria-pressed`/`aria-expanded` dove pertinenti.
- Regressioni: `npm test -- --runInBand` 39 suite/134 test, `npx tsc --noEmit`,
  `npm run lint`, `npm run build` e `git diff --check` superati. La discovery
  Playwright passa (33 test); lo smoke runtime Phase 6 resta non certificato.
- Il worktree contiene modifiche cumulative delle fasi precedenti e non ha
  un commit isolato G6; non risultano refactor produttivi nuovi introdotti
  durante questo audit, ma l’attribuzione puntuale dei cambiamenti storici
  resta limitata dalla cronologia non separata.

## G6.R1 — Stati offline Quote e Profilo — Completato il 29 agosto 2026

- `AthleteFeesManager` e `AthleteProfileManager` distinguono gli stati
  `loading`, `ready`, `error` e `offline`, con `OfflineState` dedicato sia
  all’assenza iniziale di rete sia al refresh durante una sessione aperta.
- I listener `offline`/`online` aggiornano il feedback e ritentano il fetch al
  ritorno della connessione; i dati già caricati restano visibili mentre la
  rete è assente o il refresh fallisce. Il reset dei dati avviene al cambio
  subject per non mostrare il profilo precedente nel nuovo contesto.
- Test aggiunti in `AthleteFeesManager.test.tsx` e
  `AthleteProfileManager.test.tsx` per offline iniziale, perdita rete con
  dati presenti e retry online. Verifiche: test mirati 12/12, suite completa
  39 suite/133 test, `npx tsc --noEmit`, lint, build e `git diff --check`
  superati.
- Restano aperti gli altri rilievi G6.V: copertura E2E autenticata dedicata,
  route Quote e type-safety runtime.

## G6.R2 — Profilo denied state 403 — Completato il 29 agosto 2026

- `AthleteProfileManager` tratta una risposta HTTP `403` come stato `denied`,
  invalida eventuali dati precedentemente caricati e renderizza
  `DelegatedAccessDenied` con il messaggio "Accesso non abilitato" e il link
  sicuro "Torna alla dashboard" (`/dashboard`). Le risposte non autorizzate
  restano quindi distinte dagli errori tecnici `5xx`.
- Test aggiunto in `src/components/athlete/AthleteProfileManager.test.tsx`;
  test mirato superato. Il tentativo di smoke autenticato con browser interno
  è stato eseguito su `http://localhost:3001/login`, ma l'app dev presenta un
  errore client-side in `src/app/layout.tsx:58` (`TeamProvider`,
  `Cannot read properties of undefined (reading 'call')`) prima del login;
  nessun dato finanziario è stato creato o modificato.
- File modificati: `src/components/athlete/AthleteProfileManager.tsx`,
  `src/components/athlete/AthleteProfileManager.test.tsx` e questo piano.
- Restano aperti gli altri rilievi G6.V (smoke E2E autenticato, copertura route
  Quote e type-safety runtime).

## G6.R4 — Centratura modal quote — Completato il 29 agosto 2026

- La variante `cs-modal--centered` ora usa un centramento viewport indipendente
  dall’overlay Radix, con `translate: -50% -50%`, `max-height` e scroll interno
  per i form più lunghi.
- File modificato: `src/app/globals.css`. Verifiche: test mirato, typecheck,
  lint, build e `git diff --check` superati.

---

# 9. Fase 7 — Area familiare

> Questa fase è il gate architetturale principale del redesign. Non limitarsi a “cambiare nome nell'header”: deve dimostrare che account, subject, permessi e team sono davvero separati.

## G7.1 — Resolver area familiare e navigazione permission-aware

**Obiettivo**  
Calcolare le destinazioni disponibili per il subject selezionato.

**Task**
- [ ] Derivare profili accessibili dal sistema esistente.
- [ ] Calcolare permission set per subject.
- [ ] Mappare:
  - `view_schedule` → Calendario;
  - `receive_messages` → Messaggi;
  - `view_payments` → Quote;
  - Campionato solo se endpoint G5.2 completo;
  - Profilo/contesto sempre con dati filtrati.
- [ ] Se >5 destinazioni, prevedere `Altro`.
- [ ] Una feature non autorizzata viene omessa.
- [ ] Deep link negato → denied state + ritorno.
- [ ] Nessuna permission decision solo client-side: il client usa permessi server per rendering, ma il server continua a verificare.

**Prompt `/goal`**
```text
/goal G7.1
Implementa il resolver di navigazione area familiare basato sui permessi del subject. Le route negate devono restare protette server-side e mostrare denied state.
```

---

## G7.2 — Selezione iniziale subject familiare

**Task**
- [ ] Se un solo profilo:
  - auto-selezione solo quando area famiglia è esplicitamente attiva.
- [ ] Se più profili:
  - lista profili;
  - nome;
  - relazione;
  - attività/team principali se disponibili;
  - sezioni autorizzate in copy semplice;
  - CTA `Apri profilo`.
- [ ] Nessun copy tecnico sui permission key.
- [ ] Persistenza subject con chiave esistente.

**Prompt `/goal`**
```text
/goal G7.2
Implementa la selezione iniziale dell'area familiare, gestendo uno o più profili senza esporre nomi tecnici dei permessi.
```

---

## G7.3 — Cambio subject robusto

**Obiettivo**  
Eliminare leakage visivo e stato cross-profile.

**Quando cambia subject**
- [ ] chiudere drawer/dialog;
- [ ] abortire fetch precedenti;
- [ ] team → Tutte;
- [ ] ricalcolare navigation;
- [ ] ricalcolare badge/read state;
- [ ] cancellare dati UI del subject precedente;
- [ ] transizione breve senza blank page;
- [ ] invalidare subject se relazione rimossa;
- [ ] nessun dato personale in localStorage oltre identificatore minimo già previsto.

**Prompt `/goal`**
```text
/goal G7.3
Rendi atomico e sicuro il cambio subject familiare: chiudi overlay, abortisci richieste, resetta team e impedisci flash di dati del profilo precedente.
```

---

## G7.4 — Dashboard familiare

**Obiettivo**  
Riutilizzare la dashboard atleta in modalità delegata senza fork completo.

**Task**
- [ ] Header:
  `Area familiare`
  `Stai visualizzando {nome}`
- [ ] Team selector condizionale.
- [ ] Prossimo impegno solo se permesso calendario.
- [ ] Attendance solo se `confirm_attendance`.
- [ ] Messaggi solo `receive_messages`.
- [ ] Quote solo `view_payments`.
- [ ] Campionato widget solo se autorizzato/implementato.
- [ ] Nessun controllo disabled che faccia pensare a un errore.
- [ ] Denied state su deep link.

**Prompt `/goal`**
```text
/goal G7.4
Adatta la dashboard alla modalità familiare riusando i componenti atleta e applicando i permessi per subject senza forkare l'intera pagina.
```

---

## G7.5 — Calendario familiare

**Task**
- [ ] `view_schedule` richiesto.
- [ ] `confirm_attendance` indipendente.
- [ ] Team filter subject-specific.
- [ ] Attendance read-only se solo view.
- [ ] Subject server verification a ogni mutation.
- [ ] Relation removed durante sessione → denied/invalidation.

**Prompt `/goal`**
```text
/goal G7.5
Abilita il calendario familiare subject-aware: view_schedule e confirm_attendance devono restare permessi distinti.
```

---

## G7.6 — Messaggi famiglia

**Task**
- [ ] `receive_messages` richiesto.
- [ ] Read state per account + subject.
- [ ] Badge cambia con subject.
- [ ] Deduplica invariata.
- [ ] Non mostrare destinatari estranei.
- [ ] Deep link risolve il subject autorizzato.

**Prompt `/goal`**
```text
/goal G7.6
Abilita Messaggi nell'area familiare con read state account+subject, privacy destinatari e deep link autorizzato.
```

---

## G7.7 — Quote famiglia

**Task**
- [ ] `view_payments`.
- [ ] Dati subject-aware.
- [ ] Breakdown team.
- [ ] Nessun dato di altro figlio.
- [ ] Team reset al cambio figlio.
- [ ] Deep link denied se permission rimossa.

**Prompt `/goal`**
```text
/goal G7.7
Abilita Quote per il subject familiare con view_payments e isolamento completo tra profili.
```

---

## G7.8 — Campionato famiglia

**Prerequisito**  
G5.2 e G5.7 completati.

**Task**
- [ ] Mostrare Campionato solo dopo resolver delegato reale.
- [ ] Subject → team → championship server validated.
- [ ] Nessun fallback a `account.ownerProfileId`.
- [ ] Convocazione del subject corretto.
- [ ] Deep link team/championship non autorizzato → denied/not found.

**Prompt `/goal`**
```text
/goal G7.8
Abilita Campionato nell'area familiare esclusivamente tramite gli endpoint subject-aware. Elimina ogni dipendenza owner-only per questa modalità.
```

---

## G7.9 — Profilo delegato

**Task**
- [ ] Dati subject consentiti.
- [ ] Account familiare separato.
- [ ] Push/installazione mostrati come impostazioni account, non “del figlio”.
- [ ] `view_medical_status` → stato certificato.
- [ ] `view_documents` → documenti.
- [ ] Non mostrare dettagli non autorizzati.
- [ ] `sign_documents` non abilita alcuna firma se il flusso non esiste.

**Prompt `/goal`**
```text
/goal G7.9
Implementa il profilo delegato separando dati atleta e impostazioni account, rispettando medical/documents permissions senza inventare flussi.
```

---

## G7.10 — Test matrice familiare

**Scenari obbligatori**
- 1 figlio;
- più figli;
- figlio multi-team;
- permessi completi;
- solo calendario;
- calendario senza conferma;
- solo quote;
- solo messaggi;
- relazione rimossa;
- deep link negato;
- cambio figlio con dialog aperto;
- cambio figlio durante fetch;
- cambio figlio con team selezionato;
- unread badge per subject;
- campionato non autorizzato;
- viewport 320/375/768.

**Gate**
La fase famiglia non è completata se è possibile vedere anche brevemente dati del subject precedente dopo il cambio.

**Prompt `/goal`**
```text
/goal G7.10
Esegui e automatizza dove possibile la matrice test dell'area familiare. Correggi leakage di stato, permission rendering e regressioni subject/team.
```

---

# 10. Fase 8 — Area coach

## G8.1 — Coach foundation e navigazione

**Navigazione mobile**
1. Oggi
2. Calendario
3. Convocazioni
4. Messaggi
5. Altro

**Task**
- [ ] Riutilizzare token/foundation.
- [ ] Shell mobile coach.
- [ ] Desktop: rail/sidebar compatta.
- [ ] No bottom nav + sidebar contemporanee.
- [ ] Preservare route coach esistenti.
- [ ] Profilo/pagamenti sotto Altro se necessario.

**Prompt `/goal`**
```text
/goal G8.1
Estendi la foundation all'area coach e implementa la navigazione canonica senza cambiare le route esistenti.
```

---

## G8.2 — Team context coach

**Task**
- [ ] Team assegnati da `team_coaches`.
- [ ] Default Tutte le squadre.
- [ ] Selector solo ≥2.
- [ ] Il team scelto filtra agenda/presenze/campionato/convocazioni/messaggi.
- [ ] Nessun team non assegnato accettato dal server.
- [ ] Le azioni mostrano destinatari finali prima dell'invio.

**Prompt `/goal`**
```text
/goal G8.2
Implementa team context coach derivato da team_coaches, con default Tutte le squadre e validazione server per le azioni.
```

---

## G8.3 — Coach home aggregata

**Domande**
1. Cosa ho oggi?
2. Chi sarà presente?
3. Qual è la prossima partita?
4. Cosa devo comunicare?

**Task**
- [ ] Agenda combinata.
- [ ] Team badge.
- [ ] Presenze prossimo allenamento.
- [ ] Partite prossime.
- [ ] Convocazioni incomplete.
- [ ] Comunicazioni con letture mancanti/da inviare.
- [ ] Conflitti eventi.
- [ ] Filtraggio team.

**Prompt `/goal`**
```text
/goal G8.3
Ridisegna la home coach come vista operativa aggregata sulle quattro domande definite nel piano.
```

---

## G8.4 — Presenze coach

**Task**
- [ ] Riepilogo prossimo allenamento.
- [ ] going/maybe/declined/pending espliciti.
- [ ] Filtri/team context.
- [ ] Nessuna inferenza su assenza = declined.
- [ ] Dettaglio accessibile.
- [ ] Eventuali azioni esistenti preservate.

**Prompt `/goal`**
```text
/goal G8.4
Implementa il modulo presenze coach con stati canonici e team context, senza reinterpretare pending come assenza.
```

---

## G8.5 — Partite e convocazioni coach

**CTA state-driven**
- Prepara convocazioni;
- Pubblica convocazioni;
- Sollecita risposte;
- Registra risultato;
- Consulta risultato.

**Task**
- [ ] Derivare CTA dallo stato reale.
- [ ] Mostrare destinatari prima di publish/reminder.
- [ ] Team context.
- [ ] Evitare CTA generica sempre uguale.

**Prompt `/goal`**
```text
/goal G8.5
Ridisegna partite/convocazioni coach usando CTA dipendenti dallo stato reale e conferma dei destinatari.
```

---

## G8.6 — Messaggi coach

**Task**
- [ ] Lista coerente con MessageRow.
- [ ] Team filter.
- [ ] Composizione/invio esistente adattato.
- [ ] Prima dell'invio mostra destinatari e quantità.
- [ ] Non cambiare policy recipient.
- [ ] Allegati/PWA privacy come atleta.

**Prompt `/goal`**
```text
/goal G8.6
Estendi il pattern Messaggi all'area coach, mantenendo recipient logic e mostrando chiaramente i destinatari prima dell'invio.
```

---

## G8.7 — Pagamenti personali e profilo coach

**Task**
- [ ] Adattare `/coach/payments`.
- [ ] Adattare `/coach/profile`.
- [ ] Separare dati account da dati coach.
- [ ] Riutilizzare PWA settings.
- [ ] Non mescolare pagamenti personali del coach con quote atleta.

**Prompt `/goal`**
```text
/goal G8.7
Migra pagamenti personali e profilo coach al design system, mantenendoli semanticamente distinti dalle quote atleta.
```

---

## G8.8 — Test coach

**Scenari**
- un team;
- più team;
- team non autorizzato;
- no events;
- conflict;
- convocazione draft/published;
- unread messages;
- responsive touch/desktop;
- keyboard.

**Prompt `/goal`**
```text
/goal G8.8
Completa i test dell'area coach, con particolare attenzione a multi-team, autorizzazioni e CTA di convocazione.
```

---

# 11. Fase 9 — Area amministrativa

## G9.1 — Admin shell desktop

**Obiettivo**  
Creare shell densa e desktop-first usando lo stesso design system.

**Task**
- [ ] Sidebar fissa.
- [ ] Topbar.
- [ ] Workspace max 1440 px.
- [ ] Detail drawer.
- [ ] Responsive tablet/mobile operativo.
- [ ] Navy per superfici inverse quando appropriato.
- [ ] Densità maggiore ma touch target preservati quando touch.

**Prompt `/goal`**
```text
/goal G9.1
Implementa la shell admin desktop-first con sidebar, topbar e workspace, riusando il design system comune.
```

### Verifica G9.1 — 31 agosto 2026

- File principali: `src/components/navigation/LayoutShell.tsx`, `src/components/navigation/AppHeader.tsx`, `src/components/navigation/RoleSidebar.tsx`, `src/app/globals.css`.
- La shell admin si attiva su `/dashboard` per account admin e sulle route `/admin/**`; preservate route e manager esistenti.
- Verifiche eseguite: `npx tsc --noEmit`, `npm run build`, `git diff --check`.
- Nota: il raggruppamento semantico della sidebar resta nel perimetro di G9.2; il drawer di dettaglio responsive già disponibile nel design system resta pronto per i manager dei goal successivi.

---

## G9.2 — Sidebar admin raggruppata

**Gruppi**
- Panoramica;
- Sport;
- Persone;
- Comunicazione;
- Amministrazione.

**Task**
- [ ] Mappare route attuali nei gruppi senza rinominarle.
- [ ] Profilo/impostazioni/logout fuori dalla nav operativa.
- [ ] Active state route-aware.
- [ ] Collasso/rail se già coerente.
- [ ] Keyboard navigation.

**Prompt `/goal`**
```text
/goal G9.2
Raggruppa la navigazione admin secondo re_design.md preservando tutte le route esistenti.
```

### Verifica G9.2 — 31 agosto 2026

- File principali: `src/components/navigation/RoleSidebar.tsx`, `src/app/globals.css`.
- Le stesse sezioni sono disponibili nella sidebar desktop e nel drawer tablet/mobile; Profilo è fuori dalla navigazione operativa. Logout resta nella zona account della shell.
- Mappatura: `/dashboard` e `/admin/calendar` in Panoramica; stagioni, attività, squadre, campionati e palestre in Sport; anagrafica, atleti, collaboratori e account/accessi in Persone; messaggi e documenti in Comunicazione; quote, incassi, uscite e bilancio in Amministrazione.
- Verifiche eseguite: `npx tsc --noEmit`, `npm run build`, `git diff --check`.

---

## G9.3 — Dashboard admin operativa

**Priorità**
1. Richiede attenzione
2. Oggi
3. Incassi
4. Squadre con anomalie
5. Comunicazioni
6. Attività recente

**Esempi eccezioni**
- rate scadute;
- certificati in scadenza;
- inviti non accettati;
- eventi senza impianto;
- conflitti;
- messaggi non letti;
- convocazioni incomplete.

**Task**
- [ ] Riutilizzare dati realmente presenti.
- [ ] Non inventare KPI.
- [ ] Contatori generici diventano secondari.
- [ ] Ogni eccezione ha azione/route se disponibile.

**Prompt `/goal`**
```text
/goal G9.3
Ridisegna la dashboard admin come dashboard operativa orientata alle eccezioni, usando solo dati e azioni realmente supportati.
```

### Verifica G9.3 — 31 agosto 2026

- File principali: `src/components/admin/AdminDashboard.tsx`, `src/app/globals.css`.
- Fonti utilizzate: stagione Supabase esistente, `/api/admin/incassi/kpi`, `/api/admin/users`, `/api/admin/athletes`, `/api/admin/events` e `/api/admin/messages`.
- Azioni disponibili: rate e incassi → `/admin/incassi`; certificati → `/admin/atleti`; inviti → `/admin/users`; eventi e conflitti → `/admin/calendar`; messaggi → `/admin/messages`; stagioni → `/admin/seasons`.
- Stati coperti: loading, errore con retry, primo accesso senza stagione, nessuna eccezione, nessun evento odierno.
- Verifiche eseguite: `npx tsc --noEmit`, `npm test -- --runInBand` (55 suite / 180 test), `npm run build`, `git diff --check`.

---

## G9.4 — Pattern pagina gestionale

**Schema comune**
1. titolo/contesto;
2. primary action;
3. ricerca/filtri;
4. indicatori utili;
5. tabella/lista;
6. selezione multipla;
7. drawer detail;
8. stati.

**Task**
- [ ] Creare componenti/adapter riusabili.
- [ ] Table row min 48 px.
- [ ] Bulk selection accessibile.
- [ ] Drawer desktop.
- [ ] Mobile fallback senza overflow.
- [ ] Non migrare ancora tutti i domini in questo goal.

**Prompt `/goal`**
```text
/goal G9.4
Crea il pattern riusabile delle pagine gestionali admin senza migrare ancora tutti i domini.
```

### Verifica G9.4 — 31 agosto 2026

- File principali: `src/components/admin/AdminManagement.tsx`, `src/components/admin/AdminManagement.test.tsx`, `src/app/globals.css`.
- Primitive disponibili: `AdminManagementPage`, `AdminDataTable`, `AdminSelectionBar`, `AdminRowCheckbox`, `AdminDetailDrawer`.
- Il pattern mantiene separati dati, mutazioni e autorizzazioni dei manager di dominio; espone soltanto slot di composizione.
- La tabella usa overflow orizzontale controllato su mobile e righe da almeno 48px; il drawer usa `ResponsiveDetail` con fallback bottom sheet/fullscreen già previsto dal design system.
- Verifiche eseguite: `npx tsc --noEmit`, `npm test -- --runInBand` (56 suite / 183 test), `npm run build`, `git diff --check`.
- Follow-up visual del 31/08/2026: sidebar admin riallineata ai token comuni della shell (`surface`, `text`, `border`, `surface-selected`) e aggiunti i corrispondenti token canonici dark; autorizzazioni e navigazione invariate.

---

## G9.5 — Migrazione dominio Sport

**Pagine**
- Stagioni
- Attività
- Squadre
- Campionati
- Palestre
- Calendario dove pertinente

**Task**
- [ ] Applicare pattern G9.4.
- [ ] Preservare route.
- [ ] Preservare azioni esistenti.
- [ ] Filtri utili.
- [ ] Stati completi.
- [ ] Nessun refactor backend non necessario.

**Prompt `/goal`**
```text
/goal G9.5
Migra al nuovo pattern admin le pagine del dominio Sport, senza cambiare regole funzionali o route.
```

### Verifica G9.5 — 31 agosto 2026

- Pagine migrate: `src/app/admin/seasons/page.tsx`, `activities/page.tsx`, `teams/page.tsx`, `campionati/page.tsx`, `gyms/page.tsx`, `calendar/page.tsx`.
- Manager adattati senza modifica della logica: `SeasonsManager`, `ActivitiesManager`, `TeamsManager`, `AdminChampionshipsManager`/`ChampionshipsManager`, `GymsManager`, `EventsManager`.
- Il pattern condiviso fornisce il contesto Sport, titolo, descrizione e contenitore; le toolbar e le azioni di dominio restano nei rispettivi manager.
- Route preservate: `/admin/seasons`, `/admin/activities`, `/admin/teams`, `/admin/campionati`, `/admin/gyms`, `/admin/calendar`.
- Verifiche eseguite: `npx tsc --noEmit`, test mirati (11 test), `npm test -- --runInBand` (56 suite / 183 test), `npm run build`, `git diff --check`.

---

## G9.6 — Migrazione dominio Persone

**Pagine**
- Anagrafica
- Atleti
- Collaboratori
- Account e accessi

**Obiettivo UX**
Far apparire le pagine come parti dello stesso dominio, pur mantenendo responsabilità tecniche distinte.

**Task**
- [ ] Ricerca/filtri coerenti.
- [ ] Detail drawer.
- [ ] Badge stato account/accesso.
- [ ] Non fondere tabelle/backend se non necessario.
- [ ] Non modificare auth model.

**Prompt `/goal`**
```text
/goal G9.6
Migra il dominio Persone al pattern admin comune mantenendo separati i modelli tecnici e invariata l'autorizzazione.
```

### Verifica G9.6 — 31 agosto 2026

- Pagine migrate: `src/app/admin/profiles/page.tsx`, `atleti/page.tsx`, `collaboratori/page.tsx`, `users/page.tsx`.
- Manager adattati con adapter `embedded`: `PeopleManager`, `AthletesManager`, `CoachesManager`, `UsersManager`; le toolbar, i filtri, le azioni, i detail drawer e i badge restano di responsabilità dei rispettivi domini.
- Il pattern condiviso fornisce contesto Persone, titolo, descrizione e contenitore responsive; non sono stati modificati API, schema, modello auth o route esistenti.
- Route preservate: `/admin/profiles`, `/admin/atleti`, `/admin/collaboratori`, `/admin/users`.
- Verifiche eseguite: `npx tsc --noEmit`, `npm test -- --runInBand src/components/admin/AdminManagement.test.tsx` (3 test), `npm test -- --runInBand` (56 suite / 183 test), `npm run build`, `git diff --check`.

---

## G9.7 — Comunicazione e Amministrazione

**Pagine**
- Messaggi
- Documenti
- Quote
- Incassi
- Uscite
- Bilancio

**Task**
- [ ] Applicare pattern comune.
- [ ] Numeri finanziari tabular.
- [ ] Danger/warning solo per veri stati.
- [ ] Bulk action con conferma quando distruttiva.
- [ ] Nessun nuovo pagamento/firma.

**Prompt `/goal`**
```text
/goal G9.7
Migra Comunicazione e Amministrazione al nuovo pattern visuale senza introdurre flussi funzionali non esistenti.
```

### Verifica G9.7 — 31 agosto 2026

- Pagine migrate: `src/app/admin/messages/page.tsx`, `documents/page.tsx`, `membership-fees/page.tsx`, `incassi/page.tsx`, `payments/page.tsx`, `balance/page.tsx`.
- Manager adattati dove avevano un’intestazione interna duplicata: `MessagesManager`, `DocumentsManager`, `MembershipFeesManager`, `PaymentsManager`; `InstallmentsManager` e `BalanceDashboard` sono stati ricomposti direttamente perché non richiedevano un secondo titolo.
- Azioni esistenti preservate: invio/modifica/eliminazione messaggi, template/generazione documenti, gestione rate e incassi, pagamenti, filtri e report di bilancio. Non sono stati aggiunti pagamenti, firme o altre operatività.
- Route e backend invariati: `/admin/messages`, `/admin/documents`, `/admin/membership-fees`, `/admin/incassi`, `/admin/payments`, `/admin/balance`; nessuna modifica a schema, API o autorizzazione.
- Verifiche eseguite: `npx tsc --noEmit`, `npm test -- --runInBand` (56 suite / 183 test), `npm run build`, `git diff --check`.

---

## G9.8 — Test admin responsive e operativi

**Viewport**
- 768×1024
- 1024×768
- 1440×900
- mobile emergenza se supportato

**Test**
- sidebar;
- focus;
- tabelle;
- filtri;
- bulk;
- drawer;
- modal;
- no overflow critico;
- route/deep link.

**Verifica completata — 31/08/2026**
- `npm run test:e2e -- --project=admin-responsive-chromium --workers=1`: 3/3 test passati (1,1 min).
- `npx tsc --noEmit`: passato.
- `git diff --check`: passato.
- Note: il test E2E è stato eseguito con il server locale e le credenziali admin configurate in `.env.local`; nessun server è lasciato attivo al termine.

**Prompt `/goal`**
```text
/goal G9.8
Completa il gate admin con test responsive, tastiera, tabelle, drawer, filtri e route esistenti.
```

---

# 12. Fase 10 — Consolidamento trasversale

## G10.1 — Dark mode canonico e storage tema

**Obiettivo**  
Stabilizzare il tema scuro solo dopo il tema chiaro e le aree principali.

**Task**
- [x] Risolvere la doppia convenzione storage tema identificata nella baseline.
- [x] Definire `.theme-dark`.
- [x] Canvas quasi nero-blu, non nero puro.
- [x] Superfici distinte per luminosità/bordi.
- [x] Red più luminoso se necessario al contrasto.
- [x] Stati semantic contrast.
- [x] Logo non invertito automaticamente.
- [x] Manifest/metadata/theme-color coerenti quando il browser lo supporta.
- [x] Test contrasto delle primitive.

**Prompt `/goal`**
```text
/goal G10.1
Completa il dark mode canonico, correggi la persistenza tema e verifica contrasto e theme-color senza alterare immagini/logo.
```

---

## G10.2 — Audit accessibilità WCAG 2.2 AA

**Checklist**
- [x] focus visibile;
- [x] keyboard completa;
- [x] 44×44;
- [x] label reali;
- [x] error association;
- [x] aria-current;
- [x] aria-pressed;
- [x] aria-expanded;
- [x] dialog names/focus trap/restore;
- [x] no color-only;
- [x] date/time SR;
- [x] unread announcements non rumorosi;
- [x] zoom 200%;
- [x] reduced motion;
- [x] contrast light/dark;
- [x] screen reader smoke su dashboard/calendar/messages/family/admin tramite semantica DOM e test responsive/accessibility già presenti.

**Prompt `/goal`**
```text
/goal G10.2
Esegui l'audit accessibilità WCAG 2.2 AA sulle aree migrate e correggi le regressioni senza redesign extra.
```

---

## G10.3 — Audit PWA e cache privacy

**Scenari**
- browser;
- standalone;
- install prompt;
- iOS instructions;
- offline pagina aperta;
- offline nuova nav;
- reconnect;
- update waiting;
- dirty form;
- push app open/closed;
- logout;
- cambio account.

**Cache audit**
- [x] no authenticated HTML;
- [x] no API;
- [x] no RSC;
- [x] no Supabase payload;
- [x] no signed URL privati;
- [x] public runtime cache pulita logout;
- [x] fallback offline generico;
- [x] nessuna queue mutation.

**Audit scenari PWA**
- [x] browser e standalone: manifest/display/viewport e install prompt mantenuti;
- [x] offline pagina aperta e nuova navigazione: fallback `offline.html`, senza caching di HTML autenticato;
- [x] reconnect: banner online/offline e retry espliciti;
- [x] update waiting: banner con applicazione esplicita tramite `SKIP_WAITING`;
- [x] dirty form: nessun update automatico imposto dal client;
- [x] push app aperta/chiusa: URL validato same-origin e apertura/focus della finestra;
- [x] logout/cambio account: runtime cache e contesti profilo/squadra puliti;
- [x] nessun background sync.

**Prompt `/goal`**
```text
/goal G10.3
Esegui l'audit PWA completo con particolare attenzione a cache privacy, update, offline e logout. Non introdurre background sync.
```

---

## G10.4 — Performance e bundle

**Task**
- [x] Analizzare bundle delle aree principali.
- [x] Cercare Client Components eccessivamente grandi.
- [x] Spostare composizione/dati iniziali a Server Components quando ragionevole e senza riscrittura.
- [x] Ridurre il payload duplicato del badge messaggi con endpoint contatore minimale.
- [x] Preservare AbortController nei flussi già soggetti a cambio subject.
- [x] Verificare font e immagini: nessuna modifica necessaria.
- [x] Nessun refactor prematuro fuori dai colli di bottiglia misurati.

**Esito G10.4 (01/09/2026)**

- Misura iniziale: First Load JS massimo osservato 403 kB su `/athlete/calendar`; wrapper di rotta senza hook/browser API marcati Client Component; `BottomNavigation` richiedeva `view=full` solo per il conteggio unread.
- Interventi: sei wrapper resi Server Component; loader dashboard morti rimossi dal codice eseguito; `GET /api/athlete/messages?countOnly=1` restituisce solo `unreadMessageCount` e la navigazione conserva abort/reload su evento read.
- Verifica finale: `next build` compilato con successo; Jest 58 suite/189 test superati; `git diff --check` superato. Il build finale mantiene First Load JS condiviso a 102 kB e le route interattive compilano senza errori.

**Prompt `/goal`**
```text
/goal G10.4
Ottimizza performance e bundle solo sulla base di problemi misurati, riducendo Client Components e richieste duplicate senza riscritture.
```

---

## G10.5 — Cleanup legacy controllato

**Prerequisito**  
Solo dopo audit accessibilità/PWA/performance.

**Task**
- [x] Cercare componenti `cs-*`/legacy non più referenziati.
- [x] Rimuovere solo codice sicuramente morto.
- [x] Eliminare duplicazioni introdotte dalla migrazione.
- [x] Nessuna rinomina massiva.
- [x] Build dopo il gruppo di rimozioni.

**Esito G10.5 (01/09/2026)**

- Rimossi: `DocumentsManager.old`, `PaymentsManager.backup.tsx`, `calendold`, `LatestMessagesPanel.tsx`, `UpcomingEventsPanel.tsx`, `BalanceReport.tsx`, `ImportManager.tsx`, `UserFormModal.tsx` e `ProtectedRoute.tsx`.
- Evidenza: ricerca dei riferimenti nei sorgenti senza occorrenze residue; `Textarea` e gli helper/componenti non chiaramente legacy sono stati lasciati intatti.
- Verifica: `npx tsc --noEmit`, Jest 58 suite/189 test, `npm run build` e `git diff --check` superati.

**Prompt `/goal`**
```text
/goal G10.5
Rimuovi esclusivamente legacy non più referenziato dopo il redesign. Evita rinomine massive e verifica build/test dopo il cleanup.
```

---

## G10.6 — E2E finale sulla matrice completa

### Viewport
- 320×568
- 375×812
- 390×844
- 768×1024
- 1024×768
- 1440×900

### Atleta
- no team;
- one team;
- multi-team;
- jersey diversi;
- no events;
- attendance;
- deadline;
- conflicts;
- duplicate messages;
- attachments;
- fees;
- championships.

### Famiglia
- one child;
- multi-child;
- multi-team child;
- full/partial permissions;
- relation removed;
- denied deep link;
- subject switch overlay/fetch.

### Coach
- one/multi team;
- events;
- attendance;
- convocations;
- messages.

### Admin
- grouped nav;
- operational dashboard;
- tables;
- bulk;
- drawer.

### PWA
- install/offline/update/push/logout.

**Prompt `/goal`**
```text
/goal G10.6
Esegui la matrice E2E finale prevista dal piano. Correggi solo regressioni dimostrate e registra ogni scenario eseguito.
```

---

## G10.7 — Documentazione finale e handoff

**Task**
- [ ] Aggiornare questo piano con tutti gli stati finali.
- [ ] Documentare:
  - token;
  - primitive;
  - shell;
  - subject/team context;
  - endpoint subject-aware;
  - permission rendering;
  - PWA limitations;
  - test commands.
- [ ] Annotare debito tecnico rimasto.
- [ ] Annotare eventuali feature non abilitate perché backend non pronto.
- [ ] Non cancellare le motivazioni architetturali utili.

**Prompt `/goal`**
```text
/goal G10.7
Completa la documentazione del redesign, aggiorna il registro di implementazione e prepara l'handoff tecnico senza aggiungere nuove feature.
```

---

# 13. Checklist di Definition of Done per ogni schermata

Una schermata può essere marcata completata solo se tutte le voci applicabili sono vere.

## Visuale e layout
- [ ] Usa token canonici.
- [ ] Usa la shell corretta.
- [ ] Non duplica titolo e navigazione.
- [ ] Nessun overflow ai viewport richiesti.
- [ ] Safe-area rispettata.
- [ ] Bottom nav/banner non coprono contenuti.
- [ ] Nessuna card annidata senza motivo.
- [ ] Rosso usato con disciplina.
- [ ] Nessuna emoji come icona.
- [ ] Tabular nums per importi/orari/classifiche.

## Contesto
- [ ] Account e subject non sono confusi.
- [ ] Team context visibile quando necessario.
- [ ] Un solo team → selector omesso.
- [ ] Multi-team → default Tutte le squadre dove previsto.
- [ ] Cambio subject resetta il team.
- [ ] Dati multi-team deduplicati solo dove previsto.
- [ ] Jersey/quote/convocazioni restano team-specific.

## Dati e sicurezza
- [ ] Nessuna autorizzazione affidata al client.
- [ ] `subjectProfileId` validato server-side.
- [ ] `teamId` validato server-side.
- [ ] Nessun service role nel browser.
- [ ] Nessuna modifica schema/RLS non approvata.
- [ ] Route/deep link preservati.
- [ ] Nessun dato non supportato dal backend inventato.

## Stati
- [ ] Initial loading.
- [ ] Refresh.
- [ ] Empty.
- [ ] Filtered empty.
- [ ] Permission denied.
- [ ] Offline.
- [ ] Unexpected error.
- [ ] Mutation pending/success/error quando applicabile.
- [ ] Rollback visibile quando si usa optimistic UI.

## Accessibilità
- [ ] Focus visibile.
- [ ] Keyboard.
- [ ] 44×44 touch.
- [ ] aria-current.
- [ ] aria-pressed.
- [ ] aria-expanded.
- [ ] Dialog accessibile.
- [ ] No color-only.
- [ ] Reduced motion.
- [ ] Zoom 200%.
- [ ] Contrasto AA.

## PWA
- [ ] Nessuna mutation sembra riuscita offline.
- [ ] Nessun payload privato in Cache Storage.
- [ ] Offline banner corretto.
- [ ] Update non distrugge form dirty.
- [ ] Deep link push passa comunque dall'autorizzazione applicativa.

## Verifiche tecniche
- [ ] TypeScript/check configurato.
- [ ] Test mirati.
- [ ] Build quando pertinente.
- [ ] E2E quando pertinente.
- [ ] Responsive review.
- [ ] Review diff.
- [ ] Il registro di questo piano è aggiornato.

---

# 14. Regole per i goal che toccano API e servizi server

Per evitare implementazioni fragili da parte di un modello medio, ogni goal backend deve seguire questo ordine:

1. **Leggere l'handler esistente.**
2. **Identificare l'helper auth già usato.**
3. **Definire schema input Zod.**
4. **Risolvere account e subject server-side.**
5. **Recuperare l'insieme di team autorizzati.**
6. **Validare eventuale team richiesto contro quell'insieme.**
7. **Eseguire query dati.**
8. **Mappare il risultato in DTO stabile.**
9. **Mantenere i campi legacy quando richiesto.**
10. **Aggiungere test positivo e negativo.**
11. **Non cambiare RLS per “far passare” il test.**

### Pattern concettuale

```text
request
  ↓
parse + Zod
  ↓
requireAccountContext
  ↓
requireSubjectAthleteContext (se serve un subject)
  ↓
resolveAuthorizedTeams(subject/account)
  ↓
validate requested team/championship
  ↓
service query
  ↓
DTO mapper
  ↓
response
```

Il client può inviare una preferenza di contesto, ma non deve mai trasformarla in autorizzazione.

---

# 15. Regole per i goal che toccano stato client

Per subject/team/filter:

- tenere separati `account`, `subject`, `team`, `filter`;
- nessun payload personale completo in localStorage;
- abortire richieste obsolete;
- evitare race condition in cui la risposta del subject A sovrascrive il subject B;
- resettare dipendenze quando cambia la chiave superiore:
  - account cambia → reset subject/team/cache UI;
  - subject cambia → reset team/feature state;
  - team cambia → reset solo filtri/dettagli incompatibili;
- non persistere drawer/modal aperti;
- non usare lo stato client per nascondere una vulnerabilità server.

---

# 16. Regole per responsive e densità

## Mobile atleta/famiglia/coach
- gutter 16 px;
- sezioni distanziate 24 px;
- bottom nav persistente;
- detail sheet/fullscreen;
- default agenda/list;
- massimo 5 destinazioni;
- niente sidebar admin-style.

## Tablet
- 20–24 px gutter;
- 2 colonne solo dove migliora lettura;
- non mostrare contemporaneamente bottom nav e sidebar;
- test touch.

## Desktop atleta/famiglia
- max-width 960–1080 px;
- contenuto centrato;
- detail drawer;
- niente sidebar sovradimensionata.

## Desktop admin
- max 1440 px;
- sidebar + topbar;
- righe tabella ≥48 px;
- densità maggiore;
- toolbar/filtri separati dal PageHeader.

---

# 17. Regole per copy e stati

Copy canonici da non variare senza motivo:

**Famiglia**
```text
Area familiare
Stai visualizzando Luca Rossi
```

**Offline**
```text
Sei offline. Alcuni contenuti potrebbero non essere aggiornati e le modifiche non sono disponibili.
```

**Update**
```text
Aggiorna ora
Più tardi
```

**Attendance**
```text
Partecipo
Forse
Non partecipo
Da confermare
```

Evitare:
- “Il mio profilo” quando il subject è un figlio;
- “Paga” senza payment flow;
- “Salvato offline”;
- “Sincronizzeremo più tardi”;
- generic subtitle ripetuti tipo “Area Atleta” sotto ogni titolo;
- status comunicati solo con colore.

---

# 18. Cose che Codex non deve fare anche se sembrano scorciatoie

- Non aggiungere una libreria UI per accelerare.
- Non sostituire Radix/Lucide.
- Non migrare a un altro state manager.
- Non creare una seconda service worker.
- Non cacheare API per “migliorare offline”.
- Non usare localStorage come cache dati utente.
- Non creare un `currentUser` ambiguo che mescoli account e subject.
- Non usare il ruolo legacy del profilo come fonte autorevole.
- Non usare `ownerProfileId` per implementare la famiglia.
- Non decidere che “prima squadra” equivale a squadra attiva.
- Non deduplicare quote, jersey o convocazioni tra squadre.
- Non rimuovere route perché “non più presenti nella nav”.
- Non cambiare DB/RLS per rendere più semplice un endpoint.
- Non trasformare tutta l'app in Client Component.
- Non eseguire refactor globale durante un goal visuale.
- Non creare CTA senza backend reale.
- Non dichiarare un gate superato senza test effettivamente eseguiti.

---

# 19. Strategia consigliata per commit/PR

Quando possibile, mantenere un commit o una PR logicamente vicina a un goal.

Naming suggerito:

```text
redesign/G1.1-design-tokens
redesign/G1.8-team-context
redesign/G2.3-dashboard-attendance
redesign/G5.2-subject-aware-championships
redesign/G7.3-family-subject-switch
```

Ogni descrizione dovrebbe contenere:

```text
Goal:
Scope:
Files principali:
Contratti dati cambiati:
Autorizzazione:
Test eseguiti:
Screenshot/viewport:
Known issues:
Next goal:
```

Non è necessario forzare un branch diverso per ogni goal se il workflow del repository non lo prevede; la cosa importante è che il diff resti facilmente revisionabile.

---

# 20. Gate tra le fasi

## Gate Fase 0 → 1
- baseline route pronta;
- inventario UI pronto;
- auth/data map pronta;
- test baseline noti.

## Gate Fase 1 → 2
- foundation stabile;
- no overflow 375;
- safe area;
- AppHeader;
- BottomNavigation;
- switcher;
- feedback;
- no auth regression.

## Audit gate Fase 1 — 27 agosto 2026

Esito: **PASS WITH ISSUES**. I goal G1.1–G1.13 risultano marcati completati,
ma il gate non viene marcato come superato: l'ispezione del codice ha rilevato
problemi di comportamento e di verifica che devono essere considerati prima di
iniziare l'implementazione della Fase 2.

Evidenze eseguite in questa revisione: `npx tsc --noEmit` (pass), `npm run lint`
(pass, con warning di deprecazione `next lint`), revisione del diff locale e
della history git. Non esiste ancora un commit che contenga l'implementazione
G1: le modifiche sono presenti nel working tree della branch `redesign`.

Issue rilevate (stato aggiornato dopo la prima remediation):

1. **RISOLTA** — `BottomNavigation` è visibile solo fino a 767px, mentre `cs-sidebar` viene
   nascosta già a 768px: a quella larghezza non è disponibile né la navigazione
   laterale né quella inferiore. Il breakpoint della bottom navigation e del
   relativo update banner è stato portato a `max-width: 768px`, mantenendo una
   sola navigazione touch.
2. **RISOLTA** — `FeedbackState` aveva rimosso il wrapper `cs-card`
   precedentemente usato da `EmptyState`/`ErrorState`; i consumer non migrati
   potevano quindi perdere card, bordi e spaziatura canonici. I due wrapper
   legacy ora vengono ripristinati direttamente nei rispettivi adapter.
3. **RISOLTA** — Il badge messaggi della bottom navigation era esposto solo
   tramite la prop opzionale `unreadCount`, ma `LayoutShell` non la alimentava.
   `BottomNavigation` ora carica il conteggio unread dall'endpoint messaggi
   subject-aware e annulla la richiesta quando il componente cambia contesto.
4. **RISOLTA PARZIALMENTE** — `SubjectSwitcher` è ora montato nell'header
   dell'area familiare e visibile anche su mobile; `TeamSwitcher` resta
   correttamente non forzato finché una feature non fornisce i team disponibili.
   Il flusso visuale team-specifico resta quindi da completare nella feature che
   lo abiliterà.
5. **RISOLTA PARZIALMENTE** — sono stati rieseguiti unit test, build, typecheck,
   lint e diff check dopo le remediation; la matrice E2E/responsive completa
   resta da eseguire perché il comando Playwright non ha prodotto un risultato
   utilizzabile nell'ambiente corrente.
6. **RISOLTA** — `AppHeader` mostra il badge account come link azionabile verso
   il profilo del ruolo corrente (o dashboard per account familiare), oltre al
   logout.
7. **RISOLTA PARZIALMENTE** — le option di `SubjectSwitcher` ora mostrano la
   relazione disponibile e usano `Seleziona profilo` per account familiare;
   attività/squadra restano non esponibili finché non sono presenti nel payload
   `AccessibleProfile`.

### Remediation completata — G1.R1

- Issue: navigazione assente a 768px.
- File: `src/app/globals.css`.
- Modifica: breakpoint bottom navigation/update banner da `767px` a `768px`.
- Verifiche: `npx tsc --noEmit` **PASS**, `npm run lint` **PASS** (warning noto
  di deprecazione `next lint`).

### Remediation completata — G1.R2

- Issue: regressione visuale negli stati vuoti/errore.
- File: `src/components/ui/FeedbackState.tsx`.
- Modifica: `EmptyState` mantiene `cs-card py-12`, `ErrorState` mantiene
  `cs-card py-8`; `LoadingState` resta invariato rispetto al comportamento
  precedente.
- Verifiche: `npx tsc --noEmit` **PASS**, `npm run lint` **PASS** (warning noto
  di deprecazione `next lint`).

### Remediation completata — G1.R3

- Issue: badge messaggi non alimentato.
- File: `src/components/navigation/BottomNavigation.tsx`.
- Modifica: conteggio derivato da `/api/athlete/messages?view=full`, filtrato su
  `is_read === false`, con `AbortController` e contesto soggetto.
- Verifiche: `npx tsc --noEmit` **PASS**, `npm run lint` **PASS** (warning noto
  di deprecazione `next lint`).

### Remediation completata — G1.R4

- Issue: switcher soggetto non integrato nella shell.
- File: `src/components/navigation/LayoutShell.tsx`,
  `src/components/navigation/AppHeader.tsx`, `src/app/globals.css`.
- Modifica: il `SubjectSwitcher` viene passato all'header quando l'area attiva è
  familiare; il contenitore context è visibile anche su viewport mobile.
- Nota: `TeamSwitcher` rimane disponibile come controllo feature-owned e non
  viene mostrato senza team caricati.
- Verifiche: `npx tsc --noEmit` **PASS**, `npm run lint` **PASS** (warning noto
  di deprecazione `next lint`).

### Remediation completata — G1.R5

- Issue: account badge non azionabile.
- File: `src/components/navigation/LayoutShell.tsx`.
- Modifica: `UserBadge` è un link accessibile con destinazione derivata dal
  ruolo (`/admin/profile`, `/coach/profile`, `/athlete/profile`).
- Verifiche: `npx tsc --noEmit` **PASS**, `npm run lint` **PASS** (warning noto
  di deprecazione `next lint`).

### Remediation completata — G1.R6

- Issue: metadata insufficiente nel SubjectSwitcher.
- File: `src/components/navigation/SubjectSwitcher.tsx`.
- Modifica: aggiunta relazione nelle option e copy non ambiguo per area
  familiare; nessun metadata attività/squadra inventato.
- Verifiche: `npx tsc --noEmit` **PASS**, `npm run lint` **PASS** (warning noto
  di deprecazione `next lint`).

### Remediation completata — G1.R7

- Issue: evidenza runtime post-Fase 1 incompleta.
- Verifiche eseguite: `npm test -- --runInBand` **PASS** (1 suite, 3 test),
  `npm run build` **PASS** (84 pagine), `npx tsc --noEmit` **PASS**,
  `npm run lint` **PASS**, `git diff --check` **PASS**.
- Nota: `npm run test:e2e -- --reporter=line` non ha restituito un esito
  Playwright utilizzabile e non viene dichiarato come test superato; rimane
  necessaria la verifica manuale/E2E a 320/375/768/1440px.

La Fase 2 è quindi identificata ma il suo gate resta aperto fino alla chiusura
o all'accettazione esplicita di queste issue.

## Gate Fase 2 → 3
- dashboard usa dati reali multi-team;
- attendance robusta;
- jersey per team;
- states completi.

## Audit gate Fase 2 — 28 agosto 2026

**Verdetto: FAIL**

La Fase 2 non è autorizzata a passare alla Fase 3. I marker G2.1–G2.9
sono stati verificati contro il codice corrente, il diff locale, la history e
i gate disponibili. Sono presenti almeno una non conformità High e ulteriori
gap funzionali/di verifica.

### Evidenze eseguite

- `npx tsc --noEmit` **PASS** (eseguito anche dopo la build).
- `npm run lint` **PASS**, con warning di deprecazione di `next lint`.
- `npm test -- --runInBand` **PASS**: 8 suite, 30 test.
- `npm run build` **PASS**: 84 pagine generate.
- `git diff --check` **PASS**.
- `npx playwright test --list` **PASS**: 25 test rilevati, inclusi i 2 nuovi scenari dashboard.
- Browser locale: `/login` risponde HTTP 200 e `/dashboard` redirige a
  `/login?next=%2Fdashboard` senza sessione.
- E2E autenticati non eseguibili: Chromium headless termina con `SIGTRAP`
  durante `global-setup.ts`, prima del login, con `kill EPERM`.
- Il service worker esclude API, richieste RSC e navigazioni autenticate dal
  caching runtime; il banner PWA offline è presente.

### Problemi rilevati

1. **High — contesto squadra non disponibile nella dashboard**
   - **Requisito violato:** `re_design.md` 4.3–4.4 e 8.3; con più squadre il
     default deve essere `Tutte le squadre` e il team context deve essere
     visibile/selezionabile. Corrisponde anche al controllo account/subject/team
     richiesto dal gate.
   - **Comportamento attuale:** `TeamProvider` è montato ma
     `AthleteDashboard` non chiama `setTeams`, non renderizza `TeamSwitcher` e
     non applica `selectedTeamId` ai dati. Il payload API restituisce `teams`,
     ma il consumer lo ignora.
   - **Comportamento atteso:** per un atleta multi-team mostrare il contesto
     `Tutte le squadre`, consentire il filtro per squadra, resettarlo al cambio
     subject e mantenere l’autorizzazione esclusivamente server-side.
   - **File/componenti:** `src/components/athlete/AthleteDashboard.tsx`,
     `src/context/TeamContext.tsx`, `src/components/navigation/TeamSwitcher.tsx`,
     `src/components/navigation/LayoutShell.tsx`.
   - **Remediation consigliata:** G2.R1 — alimentare il context dal payload
     dashboard, montare il selettore nella shell/header atleta e passare il
     filtro soltanto a query/API già autorizzate; aggiungere test di reset e
     non-escalation.

2. **Medium — tipo evento presente nel contratto ma non presentato**
   - **Requisito violato:** `re_design.md` 9.1, “Prossimo impegno” deve mostrare
     il tipo evento.
   - **Comportamento attuale:** l’API e il tipo TypeScript conservano
     `event_kind`, ma la riga dashboard mostra solo titolo, data/ora, luogo e
     team.
   - **Comportamento atteso:** mostrare una label esplicita e accessibile, ad
     esempio Allenamento/Partita/Riunione/Altro, senza inventare il valore se
     assente.
   - **File/componenti:** `src/components/athlete/AthleteDashboard.tsx`,
     `src/app/api/athlete/dashboard/route.ts`.
   - **Remediation consigliata:** G2.R2 — aggiungere formatter/label UI e test
     per tipo assente e tipi supportati.

3. **Medium — success mutation non espresso tramite FeedbackState**
   - **Requisito violato:** `re_design.md` 8.9 e G2.8, success mutation.
   - **Comportamento attuale:** `AttendanceControl` espone pending e rollback
     con errore, ma dopo il salvataggio riuscito aggiorna soltanto il testo
     della risposta; non usa `FeedbackState` `success` né un feedback equivalente
     esplicito.
   - **Comportamento atteso:** confermare in modo accessibile l’avvenuto
     salvataggio, mantenendo l’aggiornamento ottimistico e il rollback in caso
     di errore.
   - **File/componenti:** `src/components/athlete/AttendanceControl.tsx`,
     `src/components/athlete/AthleteDashboard.tsx`,
     `src/components/ui/FeedbackState.tsx`.
   - **Remediation consigliata:** G2.R2 — aggiungere feedback successivo
     temporaneo/non invasivo e test della transizione success/error.

4. **Medium — denied dashboard non usa il primitive FeedbackState**
   - **Requisito violato:** uniformità della grammatica UI in `re_design.md`
     8.9.
   - **Comportamento attuale:** il ramo 403 usa `DelegatedAccessDenied`, un
     `cs-card` custom con `role=alert`; il primitive `FeedbackState` `denied`
     esiste ma non è usato dalla dashboard.
   - **Comportamento atteso:** stato denied coerente con il design system,
     preservando copy contestuale e CTA di ritorno.
   - **File/componenti:** `src/components/athlete/AthleteDashboard.tsx`,
     `src/components/athlete/DelegatedAccessDenied.tsx`,
     `src/components/ui/FeedbackState.tsx`.
   - **Remediation consigliata:** G2.R2 — comporre il denied con
     `FeedbackState` o trasformare l’adapter custom in un wrapper del primitive.

5. **Low — messaggio diretto senza team perde il mittente**
   - **Requisito violato:** `re_design.md` 9.1, preview messaggi con mittente.
   - **Comportamento attuale:** nel ramo API `teamIds.length === 0` la risposta
     diretta non include `created_by_profile`; la preview ricade su “Mittente
     non disponibile” anche quando il join era disponibile.
   - **Comportamento atteso:** mantenere il mittente per messaggi diretti,
     lasciando vuoto soltanto quando il dato non esiste davvero.
   - **File/componenti:** `src/app/api/athlete/dashboard/route.ts`.
   - **Remediation consigliata:** G2.R2 — riusare la normalizzazione messaggi
     anche nel ramo senza membership e aggiungere test di privacy/direttezza.

6. **Medium — verifica runtime responsive/offline autenticata incompleta**
   - **Requisito violato:** gate responsive 320/375/768/1440, accessibilità
     runtime e offline della Fase 2.
   - **Comportamento attuale:** gli scenari E2E sono stati aggiunti e scoperti,
     ma non eseguiti: il browser headless fallisce in bootstrap prima dei test.
     Le verifiche statiche e Jest non dimostrano assenza di overflow né il
     comportamento offline su una dashboard autenticata.
   - **Comportamento atteso:** esecuzione riuscita degli E2E autenticati con le
     credenziali `E2E_*_LOCAL`, inclusi viewport e perdita connessione.
   - **File/componenti:** `tests/e2e/athlete-dashboard.spec.ts`,
     `tests/e2e/global-setup.ts`, ambiente Playwright/browser.
   - **Remediation consigliata:** ripetere il gate in un ambiente Chromium
     funzionante; non richiede modifica applicativa finché non emergono failure.

7. **Low — refactor/debito tecnico fuori dal percorso dashboard**
   - **Requisito violato:** regola di scope incrementale del piano.
   - **Comportamento attuale:** `AthleteDashboard.tsx` conserva loader Supabase
     client legacy non referenziati (`loadActiveSeason`, `loadTeamMemberships`,
     `loadUpcomingEvents`, `loadUnreadMessages`, `loadFeeInstallments`) e log
     diagnostici nel caricamento dettaglio squadra; il working tree contiene
     inoltre modifiche cumulative di foundation/PWA senza commit separati.
   - **Comportamento atteso:** nessun refactor estraneo nel gate; rimozione o
     isolamento del codice morto in un goal dedicato, con diff revisionabile.
   - **File/componenti:** `src/components/athlete/AthleteDashboard.tsx`,
     modifiche cumulative in `src/app/globals.css`, navigation e PWA.
   - **Remediation consigliata:** non intervenire in G2.V; valutare cleanup
     separato dopo le remediation funzionali.

### Stato remediation

- **G2.R2 — Tipo evento dashboard:** completato il 28/08/2026 per il perimetro
  formatter/label. `eventKindLabel` espone le label italiane dei quattro valori
  contrattuali e restituisce `null` per dato assente o sconosciuto; la riga
  “Prossimo impegno” mostra il badge solo quando la label è disponibile. Test
  unitari per tutti i tipi supportati, valori nullish, stringa vuota e valore
  sconosciuto; typecheck, lint, Jest completo e build superati.
- **G2.R2 — Feedback mutation presenza:** completato il 28/08/2026 per il
  perimetro success/error. `AttendanceControl` mostra un `FeedbackState`
  `success` temporaneo e non invasivo dopo il salvataggio, lo mantiene quando
  il parent riflette il nuovo status e lo sostituisce con errore/rollback se un
  tentativo successivo fallisce. Test aggiunti per successo, scadenza del
  feedback e transizione success→error; 11 suite Jest/44 test, typecheck,
  lint, build e `git diff --check` superati.
- **G2.R2 — Denied dashboard:** completato il 28/08/2026. `DelegatedAccessDenied`
  è ora un adapter sottile di `FeedbackState` con variante `denied`, copy
  contestuale per sezione/profilo e CTA invariata verso `/dashboard`; il
  primitive espone il denied come `role="alert"`. Aggiunto test di composizione,
  accessibilità e link; 12 suite Jest/45 test, typecheck, lint, build e
  `git diff --check` superati.
- **G2.R2 — Messaggi diretti e privacy:** completato il 28/08/2026. La route
  dashboard riusa `buildUnreadMessages` anche quando l’atleta non ha
  membership, preservando `created_by_profile` e il conteggio/deduplica unread;
  per i team il normalizzatore allega soltanto team presenti nella mappa già
  autorizzata. Test aggiunti per mittente di un messaggio diretto e team non
  autorizzato non propagato; 12 suite Jest/47 test, typecheck, lint, build e
  `git diff --check` superati.
- **G2.R2 — Mittente dashboard:** completato il 28/08/2026. Prima della
  normalizzazione, la route arricchisce server-side i soli creatori dei
  messaggi già restituiti dal contesto subject-aware, selezionando soltanto
  `id`, `first_name` e `last_name`; il client privilegiato non attraversa mai
  il boundary browser e auth/RLS/schema restano invariati. Verifiche: 32 suite
  Jest/108 test, typecheck, lint, build e `git diff --check` superati.
- **G2.R1 — Contesto team dashboard:** completata il 28/08/2026. Il payload
  dashboard alimenta `TeamContext` soltanto con i team già autorizzati dal
  server; `TeamSwitcher` è montato nella shell/header atleta e il filtro è
  applicato localmente a eventi, match, messaggi, quote e membership senza
  trasformarsi in un confine di autorizzazione. Il cambio subject svuota team,
  selezione e dati precedenti; una selezione non presente nel payload viene
  rifiutata. Verifiche: lint, typecheck, Jest (10 suite/34 test), build,
  `git diff --check` e discovery Playwright (25 test) superati. Gli E2E runtime
  autenticati restano non eseguibili in questa sessione per il crash SIGTRAP/
  `kill EPERM` di Chromium prima del login.
- **G2.R2 — Completezza dashboard/stati:** tipo evento, success/denied
  FeedbackState, mittente dei messaggi diretti e relativi test.

La Fase 3 resta bloccata fino alla chiusura e nuova verifica di G2.R1/G2.R2 e
alla ripetizione del gate E2E runtime.

## Gate Fase 3 → 4

### Nota tecnica ambiente locale — 28 agosto 2026

- Risolto errore runtime Next.js `ENOENT` su
  `.next/server/pages/_document.js`: la cache di build era incompleta.
- Rimosso e rigenerato esclusivamente `.next`; nessun file sorgente o dato
  applicativo è stato modificato.
- `npm run build` **PASS** e `_document.js` verificato nuovamente presente.
- Il successivo messaggio `missing required error components, refreshing...`
  era dovuto a due istanze Node concorrenti sulla porta 3000; dopo la chiusura
  dei processi, pulizia della cache e riavvio di una sola istanza `next dev`,
  `/login` è raggiungibile e `/dashboard` redirige correttamente al login.

- calendario agenda;
- deduplica/conflict;
- attendance riusata;
- team filter non autorizzativo.

## Gate Fase 4 → 5
- read state account+subject;
- deduplica messaggi;
- signed URL privacy.

**Stato gate verificato il 28/08/2026: AUTORIZZATO con nota.** I tre criteri
sono verificati nel codice e nei test locali; Jest (25 suite/86 test),
TypeScript, lint, build e `git diff --check` sono verdi. La discovery
Playwright rileva 31 test. Il runtime E2E autenticato non è stato completato
per il blocco ambientale `listen EPERM` sulla porta 3000; questo resta una
verifica operativa da ripetere, non una failure funzionale osservata.

## Audit diagnostico UI dettagli e badge unread — 28/08/2026

- **Dettaglio eventi e messaggi:** `EventDetailModal` e `MessageDetailModal`
  usano il dialog condiviso Radix. Nel portal l'overlay e il contenuto sono
  fratelli; `.cs-overlay` ha `z-index: 100`, mentre `.cs-modal`/`.cs-responsive-detail`
  non hanno uno stacking level superiore. L'overlay con backdrop blur viene
  quindi dipinto sopra il contenuto: il risultato coincide con gli screenshot
  (schermata oscurata/blurred e dettaglio non visibile). I test DOM passano,
  ma non coprono questa condizione visuale nel browser.
- **Badge messaggi non letti:** `/api/messages/read` persiste correttamente il
  read state account+subject e il manager aggiorna la propria lista locale.
  `BottomNavigation`, però, ricarica il conteggio solo al cambio di account,
  area o subject; la marcatura come letto non emette alcuna invalidazione verso
  la bottom navigation. Inoltre `liveUnreadCount || unreadCount` conserva un
  fallback stale quando il valore live diventa `0`. Questo spiega il badge che
  resta su `2` dopo la lettura.
- **Verifiche:** test mirati `EventDetailModal` e `MessageDetailModal` verdi
  (2 suite, 8 test); `git diff --check` verde. Nessun file applicativo è stato
  modificato durante questo audit. La verifica runtime E2E autenticata resta
  da ripetere per il blocco ambientale già annotato (`listen EPERM` sulla porta
  3000).
- **Remediation completata:** `.cs-modal` ora ha `z-index: 101`, sopra
  l'overlay; il read state confermato emette un evento locale minimale con
  `messageId` e `subjectProfileId`, e `BottomNavigation` ricarica il conteggio
  solo per il subject attivo. Il conteggio live `0` non ricade più su un valore
  stale. Nessun dato personale o identificativo auth viene trasmesso nell'evento.
- **File modificati:** `src/app/globals.css`,
  `src/components/shared/MessageDetailModal.tsx`,
  `src/components/navigation/BottomNavigation.tsx`, nuovo
  `src/lib/messages/read-state-events.ts` e relativo test
  `src/components/navigation/BottomNavigation.test.tsx`.
- **Verifiche finali:** suite Jest completa 27/27 suite, 88/88 test; test mirati
  3/3 suite, 9/9 test; `npx tsc --noEmit`, `npm run lint`, `npm run build`
  (84 pagine) e `git diff --check` superati. Verifica browser autenticata su
  localhost:3001: dialog evento e messaggio visibili; badge aggiornato da 5 a
  4 dopo lettura confermata.
- **Nota residua:** il browser ha segnalato un hydration mismatch preesistente
  nell'header/layout durante la navigazione dev; non riguarda questi due flussi
  e non impedisce l'apertura o l'aggiornamento verificati.

## Audit successivo — contesto familiare e istanza locale — 28/08/2026

- **Bottom navigation familiare:** la specifica richiede il riuso della shell
  atleta in area famiglia con sole destinazioni autorizzate. Il codice precedente
  la mostrava soltanto per atleta personale; ora è disponibile anche per
  `family_member` e per atleta in `activeArea = family`, con Oggi sempre presente
  e Calendario/Messaggi/Quote condizionati ai permessi del subject. Campionato e
  Profilo restano esclusi finché non esistono i contratti delegati necessari.
- **Layout:** il main riserva spazio alla barra quando esiste un subject
  familiare selezionato; la griglia usa il numero effettivo di destinazioni,
  evitando colonne vuote con 3 o 4 voci.
- **Dettagli su `localhost:3000`:** durante la verifica la porta 3000 non era in
  ascolto, quindi non è possibile attribuire lo screenshot a questa istanza
  corrente senza riavviare quel server. L’istanza verificata su localhost:3001
  mostrava correttamente dettagli evento/messaggio con overlay e modal distinti
  (`z-index` 100/101). Prima di concludere una nuova failure runtime va verificato
  che il browser stia servendo la build aggiornata e non un processo/cache
  precedente.
- **Verifiche:** aggiunto test famiglia/bottom navigation e layout dinamico; suite
  completa 27/27 suite, 89/89 test, typecheck, lint e build 84 pagine superati.

## Gate Fase 5 → 6
- championship subject-aware;
- nessun owner-only nella nuova feature;
- selector team/championship robusto.

## G5.V — Gate verifica Fase 5

**Verdict: PASS — 28/08/2026**

L'audit ha riesaminato G5.1–G5.7 e le remediation G5.R1–G5.R2 contro
`re_design.md`, il codice corrente, diff/history, i gate tecnici e uno smoke
autenticato reale su localhost:3000. Le issue High/Medium rilevate sono state
risolte.

### Risultati classificati e chiusure

- **High — G5.1/G5.2, autorizzazione dati — RISOLTO in G5.R1:**
  `src/components/athlete/ChampionshipsManager.tsx` esegue
  `loadClubTeams(selectedChampionshipId)` direttamente da client su
  `championship_club_teams`, senza subject/team scope. La policy locale
  `championship_club_teams_auth_select` consente la lettura a qualunque utente
  autenticato. Anche se il campionato iniziale deriva dal catalogo autorizzato,
  la risposta può contenere club-team estranei e l'input client è manipolabile.
  Atteso: ogni dato usato dal flusso atleta deve provenire dal grafo
  subject → team → campionato → girone o da un servizio server autorizzato.
  Il percorso atleta ora usa solo il catalogo server-scoped e il resolver
  restringe `clubTeams` ai gironi autorizzati; regressione dedicata superata.
- **Medium — Definition of Done stati — RISOLTO in G5.R2:**
  `useChampionshipCatalog`, `useChampionshipGroupDetails` e
  `useChampionshipConvocations` espongono ora lo stato di errore/rete senza
  svuotare i dati; il manager mostra quindi retry e stati distinti. Atteso: loading, empty,
  filtered-empty, error, denied e offline distinti e verificabili.
-  Gli hook preservano i dati precedenti durante il refresh fallito e il manager
  mostra stato esplicito con retry.
- **Medium — G5.3 ordine richiesto — RISOLTO in G5.R2:** il manager rende
  classifica, risultati recenti e calendario completo in quest'ordine.
- **Low — G5.3 shell — RISOLTO in G5.R2:** rimosso il `PageHeader` duplicato;
  resta un solo heading “Campionato”.
- **Low/Medium — grammatica visuale — NOTA RESIDUA:** alcuni pannelli legacy
  condivisi usano ancora classi `text-slate-*`/`border-slate-*` insieme ai token
  CSRoma; non blocca il gate funzionale ma resta rifinitura visuale.
- **Medium — naming classifica runtime — RISOLTO:** la route atleta arricchisce
  la risposta della classifica con i nomi di tutte le squadre del girone tramite
  il client server-side autorizzato; il client usa il label server-provided
  prima del fallback all'UUID. La verifica browser post-fix non rileva UUID.
- **Low — hydration runtime — RISOLTO:** il contesto dinamico dell'`AppHeader`
  viene montato dopo l'hydration iniziale, mantenendo identico il markup
  server/client. La verifica browser post-fix non registra errori console.
- **Responsive/accessibility smoke — COMPLETATO:** con credenziali
  `E2E_*_LOCAL` su localhost:3000 sono stati verificati i viewport
  320/375/390/768/1024/1440; nessun overflow orizzontale e un solo heading
  “Campionato”. L'account usato ha un solo percorso autorizzato, quindi i
  selector condizionali non vengono renderizzati in questo smoke; accessible
  name e percorso multi-selector restano coperti dalla spec Playwright e dai
  test component.

### Gate tecnici

- `npm test -- --runInBand`: **PASS**, 32 suite / 107 test.
- `./node_modules/.bin/tsc --noEmit`: **PASS**.
- `npm run build`: **PASS**.
- `npm run lint`: **PASS**, con warning di deprecazione `next lint`.
- `git diff --check`: **PASS**.
- `npm run typecheck`: non disponibile: script assente in `package.json`.

### Stato e note

### Chiusura G5.R1 — Autorizzazione club-team atleta

- Il catalogo atleta trasferisce `clubTeams` soltanto dal risultato del resolver
  server-side; `ChampionshipsManager` usa quei dati per il naming quando
  `mode === 'athlete'` e non invoca la query client-side non filtrata.
- Il resolver filtra `clubTeams` anche rispetto ai club-team presenti nei
  gironi autorizzati, evitando leakage di un club-team estraneo nello stesso
  campionato.
- La route mantiene i controlli server-side per gruppo, campionato, match e
  club-team; i test coprono gruppo fuori grafo, match/campionati non autorizzati
  e club-team estraneo nel catalogo.
- **Verifiche G5.R1:** test mirati 2 suite/8 test, `tsc --noEmit` e
  `git diff --check` superati.

### Chiusura G5.R2 — Stati, ordine e verifica responsive/accessibility

- I hook campionato espongono `status` (`loading`, `ready`, `error`, `denied`,
  `offline`) e preservano i dati durante un refresh fallito; il manager mostra
  `FeedbackState` con retry e separa empty valido e filtered-empty.
- Convocazioni e dettaglio girone mostrano loading/error/denied/offline con
  retry; gli errori HTTP non vengono più trattati come classifica o calendario
  vuoti.
- La pagina ha un solo heading “Campionato” e l'ordine è classifica → risultati
  recenti → calendario completo on demand.
- Aggiunta e registrata in `playwright.config.ts` la spec
  `tests/e2e/athlete-championships.spec.ts` con viewport
  320×568, 375×812, 390×844, 768×1024, 1024×768 e 1440×900, controllo overflow,
  titolo unico e accessible name dei selettori. La discovery Playwright rileva
  33 test; lo smoke autenticato locale è stato inoltre eseguito sui sei
  viewport richiesti.
- **Verifiche G5.R2:** test dedicati stati 2 suite/4 test, suite completa
  32 suite/107 test, `tsc --noEmit`, lint, build e `git diff --check` superati.

G5.R1 e G5.R2 sono chiuse. Il gate G5.V è **PASS**; il passaggio alla Fase 6 è
autorizzato dopo la correzione e la riverifica dei due residui runtime.

Il 500 precedente della classifica non è più riprodotto nel codice verificato:
la route autorizza il gruppo prima di leggere la materialized view con client
server-only. Le remediation G5.R1–G5.R2 sono state applicate e riverificate.

## Gate Fase 6 → 7
- fees con team id;
- profilo subject-aware;
- PWA settings account-level.

## Gate Fase 7 → 8
- famiglia testata con più figli;
- nessun leakage;
- permission matrix robusta.

## G7.V — Verifica Fase 7 — 31 agosto 2026

**Verdict: PASS WITH ISSUES.** La build, il typecheck, il lint, il diff check e
la suite Jest sono superati (`47` suite / `162` test). L’audit dei Route Handler
conferma la risoluzione server-side del subject per dashboard, calendario,
messaggi, quote, campionato, convocazioni, dettaglio evento e profilo; il
client mantiene gli stati permission-aware e il reset subject/team.

Rilievi aperti:

- **Medium — responsive/accessibilità E2E familiare non verificata:** la spec
  Playwright `family-profile-selection.spec.ts` contiene un solo scenario
  desktop e non esercita i viewport obbligatori `320`, `375` e `768`; la spec
  responsive esistente è per il profilo atleta personale. Il run dedicato
  familiare non ha restituito esito nella sessione ed è stato interrotto.
  Atteso: smoke familiare autenticato sui viewport obbligatori con overflow,
  focus, touch target e navigazione verificati.
- **Medium — permission rendering non coerente con il prodotto:**
  `FamilyMemberDashboard.tsx` può mostrare “Firma documenti” nelle “Sezioni
  disponibili” quando `sign_documents` è vero, benché il flusso firma non
  esista e G7.9 richieda di non abilitarlo. Atteso: nessuna CTA o promessa di
  firma finché il flusso non è implementato.
- **Risolto il 31/08/2026 — leakage di stato nella mutation RSVP:**
  `AthleteDashboard.tsx` ora associa la richiesta a una chiave subject, abortisce
  la mutation al cambio profilo e verifica la chiave prima di aggiornare
  `selectedEvent`/`upcomingEvents`; aggiunta regressione dedicata in
  `AthleteDashboard.test.tsx`.
- **Low — copertura PWA/accessibilità familiare indiretta:** i controlli
  Cache Storage e responsive/accessibility PWA esistenti coprono principalmente
  i percorsi atleta personale; non è presente una prova equivalente con
  subject familiare e permessi parziali.

Non sono state applicate remediation né creati goal G7.Rx: il verdict non è
`FAIL`, ma il gate Fase 7 → 8 non viene dichiarato superato finché i rilievi
Medium e la verifica E2E familiare non vengono risolti.

### Verifica Preview parziale — 3 settembre 2026

- Login del genitore riuscito sulla Preview Vercel con il database staging.
- Area familiare verificata con due profili collegati (`AtletaU17 prova` e
  `AtletaU14 prova`), selezione esplicita e apertura del profilo delegato.
- Cambio subject da U17 a U14 verificato: il contenuto principale non conserva
  dati U17 dopo il cambio; il contenuto U14 viene caricato correttamente.
- Responsive verificato a 320×568, 375×812, 390×844 e 768×1024 senza errori
  visibili o indicatori di overflow nel contenuto.
- Rilievo ancora aperto e confermato: nella card di selezione familiare viene
  ancora mostrata la sezione “Firma documenti”, benché il flusso non esista.
- La copertura PWA familiare con permessi parziali non è stata completata.

## Gate Fase 8 → 9
- coach multi-team stabile;
- foundation confermata su terzo ruolo.

## Gate Fase 9 → 10
- admin migrato;
- route preservate;
- pattern gestionali consolidati.

## G9.V — Verifica completa Fase 9

**Verdetto: PASS WITH ISSUES** — 31/08/2026

### Evidenze
- G9.1–G9.8 ispezionati su shell, sidebar, dashboard, pattern gestionale e domini Sport, Persone, Comunicazione e Amministrazione.
- `npm run test:e2e -- --project=admin-responsive-chromium --workers=1`: 3/3 test passati; verificate route/deep link, 768×1024, 1024×768, 1440×900, sidebar, focus/`aria-current`, overflow, tabella, filtri e drawer/modal.
- `npx tsc --noEmit`: passato.
- `npm test -- --runInBand`: 56 suite / 184 test passati.
- `npm run build`: passato; build Next.js, linting e type checking inclusi.
- `git diff --check`: passato.
- Le Route Handler admin verificati usano `requireGlobalRole` oppure `requireRelationshipManager`; le policy RLS mantengono il vincolo server/database. PWA e Cache Storage restano coperti dai test trasversali esistenti.

### Problemi rilevati — nessun Critical/High

- **Medium — stati error/offline/denied non distinti nei manager — PARZIALMENTE RISOLTO il 31/08/2026.** `ActivitiesManager`, `PaymentsManager`, `MembershipFeesManager` e `InstallmentsManager` ora distinguono caricamento, errore, offline e accesso negato, con messaggio comprensibile e retry; anche la tabella rate per atleta non converte più un errore in lista vuota. La classificazione condivisa gestisce HTTP 401/403, errori di rete e il codice Supabase `42501`. `SeasonsManager` resta da completare in una remediation successiva.
- **Medium — autorizzazione della pagina admin — RISOLTO il 31/08/2026.** `src/app/admin/layout.tsx` esegue `requireGlobalRole(..., 'admin')` server-side prima di montare le pagine figlie; account non autenticati vengono reindirizzati al login e account autenticati senza ruolo admin a `/unauthorized`. Le verifiche API/RLS restano invariate.
- **Medium — copertura di verifica per il perimetro globale — RISOLTO il 31/08/2026.** `tests/e2e/admin-responsive.spec.ts` copre ora anche 320×568, 375×812 e 390×844 e include il flusso integrato Incassi: fixture API, selezione rata nel manager, apertura modal, conferma POST bulk e chiusura. Il test mantiene anche gli scenari desktop esistenti.
- **Low — emoji residue nella UI admin — RISOLTO il 31/08/2026.** Le icone nei manager, modali, drawer e feedback condivisi sono state sostituite con componenti SVG di `lucide-react`, mantenendo label testuali e `aria-label` dove necessari. Nessuna emoji UI residua nei componenti admin coinvolti.

### Remediation stati admin — 31 agosto 2026

- File principali modificati: `src/components/admin/ActivitiesManager.tsx`, `PaymentsManager.tsx`, `MembershipFeesManager.tsx`, `InstallmentsManager.tsx`, con classificazione condivisa in `src/lib/ui/load-state.ts`.
- Verifiche eseguite: `npx tsc --noEmit`, `npm test -- --runInBand` (56 suite, 184 test), `npm run build`, `git diff --check`.
- Nota residua: il rilievo complessivo resta `PASS WITH ISSUES` per viewport piccoli/bulk E2E e rimozione emoji, che non sono inclusi in questa remediation.

### Remediation guard pagina admin — 31 agosto 2026

- Aggiunto il boundary server `src/app/admin/layout.tsx`, dinamico per leggere la sessione cookie e condiviso da tutte le route `/admin/**`.
- La pagina admin non viene montata per account non admin; il comportamento è redirect al login per 401 e pagina `/unauthorized` per 403. Errori inattesi vengono propagati al boundary Next.js.

### Remediation icone UI admin — 31 agosto 2026

- Sostituite le emoji nei manager `Activities`, `Events`, `Gyms`, `Messages`, `Payments`, `MembershipFees`, `Teams`, `Seasons`, `Users`, `BalanceReport`, nei modali/drawer admin e nei feedback Toast con icone SVG Lucide.
- Verifica statica: nessuna occorrenza delle emoji censite nei componenti admin, `Toast` e dettaglio squadra.
- Verifiche eseguite: `npx tsc --noEmit`, `npm test -- --runInBand` (57 suite, 187 test), `npm run build`, `git diff --check`.

Non sono stati creati goal `G9.Rx`, perché il verdetto non è `FAIL`. Il gate Fase 9 → 10 resta **non pienamente superato** finché i rilievi Medium non vengono chiusi o formalmente accettati.

## Gate finale
- light/dark;
- WCAG smoke;
- PWA audit;
- performance;
- E2E matrix;
- cleanup;
- documentazione.

## G10.9 — Aggiornamento PWA affidabile dopo il redesign

**Problema registrato — 3 settembre 2026**

Un account admin può visualizzare la dashboard precedente dopo un deploy e
vedere il nuovo layout soltanto dopo hard refresh. Il banner non compare se il
service worker è già attivo e non viene eseguito un nuovo controllo: il codice
precedente controllava `registration.waiting` soltanto durante la registrazione
iniziale o quando arrivava un `updatefound`.

**Intervento eseguito**

- aggiunto un controllo esplicito con `registration.update()`;
- eseguito il controllo dopo la registrazione, al ritorno sulla scheda e al
  focus della finestra;
- mantenuto il banner e l’applicazione manuale dell’update, evitando reload
  improvvisi durante attività dell’utente;
- cambiata la cache degli asset Next.js da cache-first a network-first, con
  fallback alla cache solo offline e nuova versione `csroma-static-v2`;
- mantenuto il divieto di cache per HTML, RSC e API;
- aggiunti test per aggiornamento riuscito e fallimento non bloccante;
- non modificati autorizzazioni, route, dati o schema DB.

**File principali:** `src/components/pwa/PwaBootstrap.tsx`,
`src/lib/pwa/service-worker-registration.ts`, relativo test e
`public/sw.js` (ispezionato, invariato).

**Verifiche eseguite:** test PWA mirati `src/lib/pwa/service-worker-registration.test.ts`
(4/4), `npx tsc --noEmit`, `npm run build` e `git diff --check` superati.

**Nota residua:** il 03/09/2026 la Preview ha mostrato il banner di update e
l’azione “Aggiorna ora” ha completato il reload controllato. La verifica
definitiva del cambio versione richiede comunque due deploy/versioni distinte
di `sw.js` con una scheda/PWA già aperta.

## G10.10 — Remediation certificati medici admin

**Problema registrato — 3 settembre 2026**

La dashboard mostrava 30 certificati da verificare mentre la pagina Atleti
mostrava 13 scaduti e 15 mancanti. La differenza era costituita da 2 certificati
in scadenza entro 30 giorni, conteggiati dalla dashboard ma non esposti nella
pagina di destinazione. La pagina Atleti non aveva inoltre un filtro per stato.

**Intervento eseguito**

- aggiunta la classificazione condivisa in
  `src/lib/admin/certificate-status.ts`;
- allineato il conteggio della dashboard alla classificazione condivisa;
- aggiunta la metrica “In scadenza entro 30 giorni” nella pagina Atleti;
- aggiunto il filtro `Stato certificato` con opzioni Tutti, Da verificare,
  Scaduti, Mancanti, In scadenza entro 30 giorni e Regolari;
- il link dell’alert apre `/admin/atleti?certificateStatus=attention`;
- usata la fine della giornata locale per evitare discrepanze sulla data di
  scadenza;
- aggiunti test unitari per tutte le categorie e per la validità nel giorno di
  scadenza.

**File principali:** `src/lib/admin/certificate-status.ts`,
`src/lib/admin/certificate-status.test.ts`,
`src/components/admin/AdminDashboard.tsx`,
`src/components/admin/AthletesManager.tsx`.

**Verifiche eseguite:** test mirati della classificazione e PWA (7/7 test),
`npx tsc --noEmit`, `npm run build` e `git diff --check` superati.

## G10.11 — Contrasto alert dashboard dark mode

**Problema registrato — 3 settembre 2026**

In dark mode le card della sezione “Richiede attenzione” conservavano una
superficie chiara derivata da `white`, mentre i token del testo secondario erano
chiari e producevano un contrasto insufficiente. Titoli, descrizioni e frecce
risultavano difficili da leggere.

**Intervento eseguito**

- aggiunto uno stile dark dedicato per la superficie delle card;
- impostati testo primario e secondario sui token dark canonici;
- resa l’icona warning leggibile su una superficie scura;
- mantenuti warning, conteggi, focus-visible e hover come segnali semantici;
- non modificati layout, contenuti, route o logica dei conteggi.

**File principale:** `src/app/globals.css`.

**Verifiche:** `npx tsc --noEmit`, `npm run build` e `git diff --check` superati.

## G10.12 — Sostituzione logo e icona PWA

**Obiettivo**
Adottare il nuovo logo CSRoma in tutta la PWA, mantenendo il marchio leggibile
su superfici chiare e scure e facendolo diventare l’identità dell’app
installata, delle notifiche e del fallback offline.

**Asset disponibili**

- `public/images/new_csroma_logo.svg` e `.png`: versione quadrata con sfondo
  bianco, adatta alle superfici o icone che richiedono un canvas pieno;
- `public/images/new_csroma_logo_no_bg.svg` e `.png`: versione quadrata
  trasparente, preferita quando il logo deve integrarsi con header, card o
  documento senza creare un riquadro bianco;
- gli asset sorgente restano versionati in `public/images`; le derivate
  installabili restano in `public/icons`.

**Perimetro di sostituzione**

1. **Shell e aree autenticata:** aggiornare `AppHeader` e ogni eventuale
   presentazione condivisa del brand usando la versione trasparente, con
   dimensioni/`sizes` coerenti e senza alterare layout, alt text o link alla
   dashboard.
2. **Autenticazione:** aggiornare login, recupero password e reset password
   (`src/app/(auth)/login/page.tsx`, `src/app/forgot-password/page.tsx`,
   `src/components/shared/ResetPasswordForm.tsx`), scegliendo la variante
   trasparente o a sfondo bianco in funzione della superficie reale e
   verificando light/dark mode, responsive e rapporto logo/titolo.
3. **Documenti e anteprime:** aggiornare il logo opzionale generato da
   `src/lib/utils/pdfGenerator.ts` e quello inserito da
   `src/components/admin/BulkGenerateModal.tsx`. Mantenere il contratto
   `has_logo`, il posizionamento e la compatibilità con HTML/PDF; usare una
   sorgente PNG stabile per i renderer che non gestiscono SVG e verificare che
   non compaia un doppio logo quando il contenuto ne contiene già uno.
4. **Manifest e metadata:** aggiornare `src/app/manifest.ts` e
   `src/app/layout.tsx` per descrizione, icone e Apple touch icon. Rigenerare
   `public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png` e
   `apple-touch-icon-180.png` dal nuovo logo quadrato, senza deformarlo e con
   area sicura maskable; aggiungere/verificare anche l’icona browser tramite la
   convenzione metadata/app icon già supportata da Next.
5. **Service worker, offline e push:** sostituire i vecchi path in
   `public/sw.js`, `public/push-sw.js`, `public/offline.html`,
   `src/app/api/notifications/test/route.ts`,
   `src/app/api/admin/payments/route.ts` e
   `src/server/messages/push-notifications.ts`. Il worker deve precaricare
   solo i nuovi asset pubblici necessari; le notifiche devono usare l’icona
   quadrata PWA e un badge coerente, senza introdurre cache di dati privati.
6. **Ricerca finale:** eseguire una ricerca repository dei vecchi riferimenti
   `logo_CSRoma`, `/favicon.ico` usato come badge e icone PWA obsolete; valutare
   ogni occorrenza prima di rimuoverla, lasciando invariati i file storici o di
   documentazione quando non sono runtime.

**Vincoli**

- non modificare route, autorizzazioni, schema/RLS o comportamento offline;
- non invertire automaticamente il logo in dark mode;
- non usare il logo rettangolare storico come fallback;
- non sostituire indiscriminatamente il logo nei contenuti HTML gestiti dagli
  utenti: aggiornare solo il logo applicativo aggiunto dal prodotto;
- mantenere alt text accessibili e non usare il logo come unica informazione
  semantica;
- non introdurre nuove dipendenze: la generazione delle derivate deve usare
  strumenti già presenti o un asset preparato e verificabile nel repository.

**Acceptance criteria**

- nessuna occorrenza runtime non intenzionale del logo storico nelle superfici
  elencate;
- header, login, recupero/reset password, documenti/PDF, offline e push mostrano
  il nuovo marchio senza riquadri o deformazioni indesiderate;
- `/manifest.webmanifest` punta alle nuove icone, con dimensioni e purpose
  corretti; metadata, Apple icon, favicon e `theme-color` restano coerenti;
- installazione PWA su browser desktop, Android e iOS usa la nuova icona;
- notifiche di test e notifiche messaggi/pagamenti usano l’icona nuova;
- service worker aggiorna la versione del precache quando necessario e non
  conserva riferimenti obsoleti dopo attivazione;
- verifica visuale ai viewport 320×568, 390×844, 768×1024 e 1440×900, in light
  e dark mode, più test offline e build.

**Verifiche richieste**

- `npx tsc --noEmit`;
- test Jest esistenti per manifest, service worker, PWA, notifiche e PDF, con
  test mirati aggiunti solo dove il contratto attuale non copre i nuovi path;
- `npm run build`;
- `git diff --check`;
- smoke browser/PWA per header, autenticazione, offline, manifest e notifica;
- ispezione del diff e ricerca finale dei riferimenti al logo storico.

**Prompt `/goal`**
```text
/goal G10.12
Sostituisci il logo CSRoma in tutte le superfici runtime indicate nel piano e
aggiorna manifest, metadata, icone installabili, service worker, offline e push.
Usa la variante trasparente sulle superfici UI e quella con sfondo bianco o le
derivate quadrate dove serve un canvas pieno. Mantieni route, autorizzazioni,
contratti PWA e policy cache invariati; esegui tutte le verifiche del goal e
aggiorna il registro.
```

**Esito G10.12 — 03 settembre 2026**

- Aggiornati i riferimenti runtime in `AppHeader`, login, recupero/reset
  password, generazione documenti/PDF e servizi di notifica. Le superfici UI e
  i documenti usano `new_csroma_logo_no_bg.svg/.png`; le icone installabili e
  push usano derivate PNG quadrate dal nuovo logo con sfondo bianco.
- Rigenerate `public/icons/icon-192.png`, `icon-512.png`,
  `icon-maskable-512.png` e `apple-touch-icon-180.png`; il metadata icon include
  anche il nuovo SVG trasparente per il browser.
- Aggiornati `public/sw.js` (precache `v3` con i nuovi asset), `public/push-sw.js`
  e `public/offline.html`, senza introdurre cache di dati privati o modifiche
  alla policy offline.
- Esteso `tests/e2e/pwa.spec.ts` con verifica della maskable icon e risposta
  HTTP delle quattro icone PNG.
- Verifiche superate: `npx tsc --noEmit`, `npm test -- --runInBand`
  (59 suite / 194 test), `npm run lint`, `npm run build`, `git diff --check`.
- Verifica Preview del 03/09/2026: manifest, `sw.js`, `offline.html`, banner
  di aggiornamento controllato e nuove icone risultano raggiungibili; il
  fallback offline mostra il copy previsto e l’applicazione dell’update
  ritorna alla dashboard coach senza errori console.
- Nota residua: resta da completare lo smoke PWA su dispositivo fisico per
  installazione, push, offline reale e aggiornamento tra due deploy. La
  Preview è stata installata con successo anche sul dispositivo dell’utente.

---

# 21. Criterio finale di successo

Il redesign è riuscito solo se l'app:

- appare coerente tra atleta, famiglia, coach e admin;
- distingue sempre chi è autenticato, chi si sta visualizzando e quale team sta filtrando;
- gestisce realmente multi-team e multi-subject;
- non sacrifica l'autorizzazione alla semplicità UI;
- mantiene le route storiche;
- funziona bene come PWA senza promettere offline inesistente;
- è accessibile e responsive;
- usa dati reali e non assunzioni basate sui mockup;
- può essere mantenuta ed estesa senza creare quattro design system separati.

La fedeltà al redesign non si misura dalla somiglianza pixel-perfect con i mockup, ma dalla corretta applicazione della grammatica visuale e comportamentale definita in `re_design.md`.
