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
| G0.1 Baseline route e viewport | [ ] | — | |
| G0.2 Inventario UI/CSS | [ ] | G0.1 | |
| G0.3 Mappa auth e contratti dati | [ ] | G0.1 | |
| G0.4 Baseline verifiche tecniche | [ ] | G0.1 | |
| G1.1 Token tema chiaro | [ ] | G0.2 | |
| G1.2 Tipografia | [ ] | G1.1 | |
| G1.3 Safe area e viewport shell | [ ] | G1.1 | |
| G1.4 Primitive Button/Badge | [ ] | G1.1 | |
| G1.5 Panel/Card/ListRow | [ ] | G1.1 | |
| G1.6 FeedbackState | [ ] | G1.4,G1.5 | |
| G1.7 ResponsiveDetail | [ ] | G1.4,G1.5 | |
| G1.8 Team context state | [ ] | G0.3 | |
| G1.9 SubjectSwitcher e TeamSwitcher | [ ] | G1.4,G1.8 | |
| G1.10 AppHeader | [ ] | G1.3,G1.9 | |
| G1.11 BottomNavigation | [ ] | G1.3,G1.4 | |
| G1.12 Banner PWA | [ ] | G1.3,G1.4 | |
| G1.13 Athlete Foundation integration | [ ] | G1.1–G1.12 | |
| G2.1 Contratto dashboard atleta | [ ] | G0.3,G1.13 | |
| G2.2 Skeleton dashboard | [ ] | G2.1 | |
| G2.3 Prossimo impegno + presenze | [ ] | G2.2 | |
| G2.4 Prossima partita | [ ] | G2.2 | |
| G2.5 Preview messaggi | [ ] | G2.2 | |
| G2.6 Preview quota | [ ] | G2.2 | |
| G2.7 Membership multi-squadra | [ ] | G2.2 | |
| G2.8 Stati dashboard | [ ] | G2.3–G2.7 | |
| G2.9 Test dashboard | [ ] | G2.8 | |
| G3.1 Contratto calendario atleta | [ ] | G2.1 | |
| G3.2 Agenda mobile | [ ] | G3.1 | |
| G3.3 Filtri calendario | [ ] | G3.2,G1.8 | |
| G3.4 Dettaglio evento responsive | [ ] | G3.2,G1.7 | |
| G3.5 Attendance calendar | [ ] | G3.4 | |
| G3.6 Conflitti e deduplica eventi | [ ] | G3.2 | |
| G3.7 Vista desktop calendario | [ ] | G3.2–G3.6 | |
| G3.8 Test calendario | [ ] | G3.7 | |
| G4.1 Contratto messaggi e deduplica | [ ] | G0.3 | |
| G4.2 Lista messaggi | [ ] | G4.1 | |
| G4.3 Filtri unread/team | [ ] | G4.2 | |
| G4.4 Dettaglio e read state | [ ] | G4.2 | |
| G4.5 Allegati e privacy | [ ] | G4.4 | |
| G4.6 Deep link push messaggi | [ ] | G4.4 | |
| G4.7 Test messaggi | [ ] | G4.3–G4.6 | |
| G5.1 Resolver atleta squadra→campionato | [ ] | G0.3 | |
| G5.2 Endpoint championship subject-aware | [ ] | G5.1 | |
| G5.3 Shell campionato atleta | [ ] | G5.1 | |
| G5.4 Prossima partita/convocazione | [ ] | G5.2,G5.3 | |
| G5.5 Classifica | [ ] | G5.2,G5.3 | |
| G5.6 Risultati/calendario | [ ] | G5.2,G5.3 | |
| G5.7 Test campionato | [ ] | G5.4–G5.6 | |
| G6.1 Contratto quote atleta | [ ] | G0.3 | |
| G6.2 UI quote | [ ] | G6.1 | |
| G6.3 Endpoint profilo delegabile | [ ] | G0.3 | |
| G6.4 UI profilo atleta | [ ] | G6.3 | |
| G6.5 Account/PWA settings | [ ] | G6.4,G1.12 | |
| G6.6 Test quote/profilo | [ ] | G6.2,G6.5 | |
| G7.1 Family area resolver/navigation | [ ] | G2–G6 | |
| G7.2 Selezione subject | [ ] | G7.1,G1.9 | |
| G7.3 Cambio subject robusto | [ ] | G7.2 | |
| G7.4 Dashboard familiare | [ ] | G7.3 | |
| G7.5 Calendario familiare | [ ] | G7.3,G3.8 | |
| G7.6 Messaggi famiglia | [ ] | G7.3,G4.7 | |
| G7.7 Quote famiglia | [ ] | G7.3,G6.6 | |
| G7.8 Campionato famiglia | [ ] | G7.3,G5.7 | |
| G7.9 Profilo delegato | [ ] | G7.3,G6.6 | |
| G7.10 Test matrice permessi | [ ] | G7.4–G7.9 | |
| G8.1 Coach foundation | [ ] | G1.13,G7.10 | |
| G8.2 Coach team context | [ ] | G8.1 | |
| G8.3 Coach home aggregata | [ ] | G8.2 | |
| G8.4 Coach presenze | [ ] | G8.3 | |
| G8.5 Coach partite/convocazioni | [ ] | G8.2 | |
| G8.6 Coach messaggi | [ ] | G8.2 | |
| G8.7 Coach pagamenti/profilo | [ ] | G8.1 | |
| G8.8 Test coach | [ ] | G8.3–G8.7 | |
| G9.1 Admin shell | [ ] | G1.13,G8.8 | |
| G9.2 Admin sidebar raggruppata | [ ] | G9.1 | |
| G9.3 Admin dashboard operativa | [ ] | G9.2 | |
| G9.4 Pattern pagina gestionale | [ ] | G9.1 | |
| G9.5 Dominio Sport | [ ] | G9.4 | |
| G9.6 Dominio Persone | [ ] | G9.4 | |
| G9.7 Comunicazione/Amministrazione | [ ] | G9.4 | |
| G9.8 Test admin responsive | [ ] | G9.3–G9.7 | |
| G10.1 Dark mode canonico | [ ] | G9.8 | |
| G10.2 Audit accessibilità | [ ] | G10.1 | |
| G10.3 Audit PWA | [ ] | G10.1 | |
| G10.4 Performance/bundle | [ ] | G10.1 | |
| G10.5 Cleanup legacy | [ ] | G10.2–G10.4 | |
| G10.6 E2E matrice finale | [ ] | G10.5 | |
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
- [ ] Documentare come si risolve l'account.
- [ ] Documentare come vengono letti `account_roles`.
- [ ] Documentare owner profile vs subject profile.
- [ ] Documentare persistenza locale del subject.
- [ ] Documentare invalidazione subject non più accessibile.
- [ ] Per dashboard/calendar/messages/fees/campionati indicare:
  - input;
  - endpoint;
  - query server;
  - autorizzazione;
  - team context disponibile;
  - read state/mutation;
  - limiti per famiglia.
- [ ] Verificare dove il client usa direttamente `ownerProfileId`.
- [ ] Verificare dove `teamId` è nome/codice soltanto e manca l'ID.
- [ ] Non modificare auth/RLS.

**Definition of Done**
- è chiaro quali endpoint sono già subject-aware;
- è chiaro quali endpoint devono essere arricchiti;
- sono evidenziati i prerequisiti per Campionato e Profilo familiare.

**Prompt `/goal`**
```text
/goal G0.3
Mappa autorizzazioni e contratti dati senza cambiare comportamento. Concentrati su account, subjectProfileId, team membership, famiglia e Route Handler atleta. Documenta i gap indicati in re_design.md.
```

---

## G0.4 — Baseline dei controlli tecnici

**Obiettivo**  
Stabilire quali verifiche automatiche sono realmente affidabili.

**Task**
- [ ] Leggere `package.json`.
- [ ] Elencare script typecheck/lint/test/build/E2E.
- [ ] Verificare quale comando lint è compatibile con Next.js 15.
- [ ] Eseguire i controlli non distruttivi già disponibili.
- [ ] Annotare errori preesistenti separatamente.
- [ ] Non correggere errori estranei al redesign.
- [ ] Definire una matrice “controllo minimo per goal”.

**Definition of Done**
- i goal successivi non dovranno inventare comandi;
- gli eventuali failure preesistenti sono distinti dalle regressioni.

**Prompt `/goal`**
```text
/goal G0.4
Stabilisci la baseline di typecheck, lint, test, build ed E2E. Non correggere problemi estranei: documentali come baseline.
```

---

# 3. Fase 1 — Athlete Foundation

## G1.1 — Token canonici del tema chiaro

**Obiettivo**  
Introdurre i token semantici del redesign senza migrare tutte le pagine.

**Task**
- [ ] Definire in `:root` i token per:
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
- [ ] Mantenere naming coerente con `--cs-*` se già usato.
- [ ] Mappare i token in Tailwind 4 tramite `@theme` quando utile.
- [ ] Definire token per radius, border, elevation e motion.
- [ ] Aggiungere utility per `font-variant-numeric: tabular-nums`.
- [ ] Non eliminare i token legacy ancora referenziati.
- [ ] Non implementare ancora dark mode definitivo.

**Acceptance**
- i nuovi componenti possono usare solo token semantici;
- nessuna regressione sulle pagine non migrate;
- niente mix di hardcoded color + token nello stesso nuovo componente.

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
- [ ] Verificare se il font è già disponibile localmente nel repository.
- [ ] Se disponibile, integrarlo tramite `next/font/local`; altrimenti usare una modalità compatibile con le regole del progetto senza introdurre richieste runtime bloccanti.
- [ ] Definire scale:
  - Display;
  - H1;
  - H2;
  - H3;
  - Body;
  - Body small;
  - Label.
- [ ] Applicare fallback system.
- [ ] Non cambiare indiscriminatamente tutti i componenti legacy.
- [ ] Applicare la nuova base alla shell/foundation.
- [ ] Verificare 320 px e zoom 200%.

**Acceptance**
- nessun layout shift significativo dovuto al font;
- testo informativo persistente ≥13px;
- numeri KPI/importi/orari possono usare tabular nums.

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
- [ ] Introdurre utility/variabili per:
  - `env(safe-area-inset-top)`;
  - `env(safe-area-inset-bottom)`;
  - inset laterali se necessari.
- [ ] Usare `100dvh` nella nuova shell.
- [ ] Definire spazio riservato alla bottom navigation.
- [ ] Evitare che banner PWA, CTA fixed e sheet siano coperti.
- [ ] Verificare standalone e browser normale.
- [ ] Non alterare ancora tutte le pagine.

**Acceptance**
- shell testabile a 320×568 e 375×812;
- nessun elemento foundation finisce sotto home indicator/notch.

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
- [ ] Riutilizzare componenti esistenti se possibile.
- [ ] Touch target ≥44 px per azioni.
- [ ] Loading senza cambio larghezza.
- [ ] Disabled accessibile, non solo opacity.
- [ ] `aria-label` icon-only.
- [ ] Icone decorative `aria-hidden`.
- [ ] Nessuna emoji.

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
- [ ] Creare/adattare:
  - `Panel`;
  - `Card`;
  - `ListRow`.
- [ ] `Card` per oggetti autonomi/cliccabili.
- [ ] `Panel` per raggruppamento di sezione.
- [ ] `ListRow` per contenuto ripetuto.
- [ ] Supportare leading/trailing content.
- [ ] Supportare link/button semantici per riga interamente cliccabile.
- [ ] Evitare card annidate.
- [ ] Nessun hover con spostamento del layout.
- [ ] Rigature/separatori con token border.

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
- [ ] Creare API semplice e tipizzata.
- [ ] Distinguere loading bloccante da refresh non bloccante.
- [ ] Rendere denied e offline semanticamente diversi.
- [ ] Usare `aria-live` solo quando utile.
- [ ] Evitare skeleton aggressivi.
- [ ] Rispettare reduced motion.

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
- [ ] Verificare primitive Radix già presenti.
- [ ] Implementare un wrapper responsive:
  - mobile → bottom sheet o fullscreen;
  - desktop → drawer laterale;
  - dialog centrato solo per conferme brevi.
- [ ] Focus trap.
- [ ] Restore focus.
- [ ] Escape desktop.
- [ ] Safe-area completa.
- [ ] Footer sticky opzionale.
- [ ] Hook/guard per modifiche non salvate, senza introdurre wizard non richiesti.

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
- [ ] Ispezionare `AccessibleProfileContext`.
- [ ] Non fondere subject e team in un singolo stato ambiguo.
- [ ] Definire `TeamContext` o hook equivalente con:
  - `selectedTeamId | null`;
  - `null` = Tutte le squadre;
  - lista team autorizzati fornita dalla feature/server;
  - reset quando cambia subject;
  - reset se team selezionato non è più valido.
- [ ] Persistenza locale con chiave separata, idealmente per area/subject.
- [ ] Non persistire payload team completi o dati personali.
- [ ] Non usare il team context come controllo autorizzativo.

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
- [ ] Non creare un mega-switcher unico.
- [ ] Keyboard navigation.
- [ ] Touch target ≥44 px.
- [ ] Label accessibile.
- [ ] Stato selezionato non solo tramite colore.
- [ ] Compatibile con header e PageHeader.

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
- [ ] Logo/nome CSRoma.
- [ ] Account/profile action.
- [ ] Back solo nei detail.
- [ ] Nessuna icona impostazioni ripetuta nelle root.
- [ ] Slot per subject/team context.
- [ ] Evitare duplicazione titolo nel header e nel contenuto.
- [ ] Safe-area.
- [ ] Screen reader semantics.

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
- [ ] Icona Lucide + label sempre visibile.
- [ ] Route-aware active state.
- [ ] `aria-current="page"`.
- [ ] Badge unread senza layout shift.
- [ ] Safe-area bottom.
- [ ] Padding main coerente con altezza nav.
- [ ] Nessuna sesta voce.
- [ ] Quote non in bottom bar.

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
- [ ] Individuare banner offline e update esistenti.
- [ ] Applicare token canonici.
- [ ] Posizionarli senza coprire header/bottom nav.
- [ ] Offline copy:
  `Sei offline. Alcuni contenuti potrebbero non essere aggiornati e le modifiche non sono disponibili.`
- [ ] `role="status"` e `aria-live="polite"`.
- [ ] Rientro online: feedback breve.
- [ ] Update:
  - mobile banner/sheet;
  - desktop toast persistente;
  - `Aggiorna ora`;
  - `Più tardi` se necessario.
- [ ] Non reload automatico con form dirty.
- [ ] Un solo reload dopo `controllerchange`.
- [ ] Non introdurre background sync.

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
- [ ] Integrare AppHeader + BottomNavigation + main scroll container.
- [ ] Integrare team context dove disponibile senza forzare selector su ogni pagina.
- [ ] Conservare desktop autenticato funzionante.
- [ ] Nessun overflow a 320/375.
- [ ] Nessuna doppia navigazione sidebar + bottom bar sui breakpoint touch.
- [ ] Contenuto desktop atleta centrato max 960–1080 px.
- [ ] Verificare deep link diretti alle route atleta.
- [ ] Verificare banner PWA + nav.

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
- [ ] Ispezionare Route Handler/service dashboard attuale.
- [ ] Mantenere compatibilità con consumer esistenti.
- [ ] Per eventi dashboard includere contesto team strutturato:
  `{ id, name, code }[]` o shape coerente.
- [ ] Assicurare che memberships includano jersey number per team.
- [ ] Identificare prossima partita pertinente senza assumere “prima squadra”.
- [ ] Assicurare preview messaggi deduplicata.
- [ ] Assicurare quota urgente con team/activity.
- [ ] Validare input subject tramite helper server esistente.
- [ ] Nessuna modifica schema DB.

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
- [ ] Rimuovere/accantonare hero fotografica dominante.
- [ ] Rimuovere contatori generici non azionabili.
- [ ] Eliminare duplicazione welcome/shell.
- [ ] Tour non più CTA primaria persistente.
- [ ] Usare Panel/ListRow, non card per ogni frammento.
- [ ] Preparare placeholder reali per le cinque sezioni.
- [ ] Non inventare dati.

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
- [ ] Estrarre/consolidare `AttendanceControl`.
- [ ] `aria-pressed`.
- [ ] Stato pending.
- [ ] Evitare doppio submit.
- [ ] Mantenere mutation subject-aware.

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
- [ ] Visualizzare team, avversario, data, ora, luogo e casa/trasferta se disponibili.
- [ ] Se partite ravvicinate di team diversi, mostrare la prima + `Vedi tutte`.
- [ ] CTA verso campionato/match coerente con route esistente.
- [ ] Empty state specifico se nessuna partita.
- [ ] Non inventare convocazione se non presente.

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
- [ ] Massimo 2–3 righe.
- [ ] Mittente.
- [ ] Squadra/contesto.
- [ ] Unread marker accessibile.
- [ ] Deduplica messaggio ricevuto via più team/destinatari.
- [ ] Apertura dettaglio verso route messaggi.
- [ ] Non mostrare destinatari irrilevanti al subject.

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
- [ ] Importo con tabular nums.
- [ ] Team/activity.
- [ ] Stato.
- [ ] Scadenza.
- [ ] Link a `/athlete/fees`.
- [ ] Nessun pulsante `Paga` se non esiste un flusso reale.
- [ ] Empty state se nessuna quota.

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
- [ ] Una riga per membership.
- [ ] Team.
- [ ] Attività.
- [ ] Codice.
- [ ] `team_members.jersey_number`.
- [ ] Non usare il primo jersey number come valore globale.
- [ ] Link dettaglio coerente, se già esiste.

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
- [ ] initial loading;
- [ ] refresh;
- [ ] nessuna squadra;
- [ ] nessun evento;
- [ ] errore dashboard;
- [ ] offline con dati in memoria;
- [ ] denied se contesto non autorizzato;
- [ ] mutation success/error;
- [ ] nessun flash di dati del subject precedente.

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
- [ ] Segmenti tipo: Tutti / Allenamenti / Partite o equivalente compatto.
- [ ] TeamSwitcher solo con ≥2 team.
- [ ] Default Tutte le squadre.
- [ ] Filtered empty distinto da empty autentico.
- [ ] `aria-pressed` o semantica appropriata.
- [ ] Reset team su cambio subject tramite foundation.

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
- [ ] Mobile → bottom sheet/fullscreen.
- [ ] Desktop → drawer.
- [ ] Titolo, data, ora, luogo, team, note disponibili.
- [ ] Stato presenza.
- [ ] Deadline.
- [ ] Chiusura accessibile.
- [ ] Deep link esistente preservato se presente.

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
- [ ] Riutilizzare `AttendanceControl`.
- [ ] Inline sull'evento prioritario.
- [ ] Nel detail sugli altri eventi quando applicabile.
- [ ] Deadline superata.
- [ ] Read-only delegato.
- [ ] Rollback.
- [ ] No mutation offline.

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
- [ ] Evento associato a più team → una sola occorrenza con tutti i team.
- [ ] Eventi distinti sovrapposti → entrambi visibili.
- [ ] Evidenziare conflitto con testo/icona, non solo colore.
- [ ] Non stabilire priorità automatica.
- [ ] Evitare falsi duplicati basati solo su titolo/orario.

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
- [ ] Agenda/settimana default desktop.
- [ ] Vista mese disponibile.
- [ ] Filtri tipo/team.
- [ ] Detail laterale.
- [ ] Export solo secondario se esiste già.
- [ ] Contenuto atleta max-width coerente.

**Prompt `/goal`**
```text
/goal G3.7
Completa la vista desktop del calendario atleta con agenda/settimana default e dettaglio laterale.
```

---

## G3.8 — Test e gate calendario

**Scenari**
- zero eventi;
- eventi ricorrenti;
- multi-team same event;
- overlapping events;
- deadline;
- mutation failure;
- family permission permutations da simulare a livello component/server se possibile;
- responsive obbligatori;
- tastiera/screen reader smoke.

**Prompt `/goal`**
```text
/goal G3.8
Completa test e verifiche del calendario atleta sui casi multi-team, conflitti, presenze, responsive e accessibilità.
```

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
- [ ] Includere `team.id`.
- [ ] Includere `activity.id`.
- [ ] Mantenere nome/codice.
- [ ] Definire importi dovuto/pagato/residuo in modo coerente.
- [ ] Stati:
  - non ancora dovuta;
  - in scadenza;
  - scaduta;
  - parziale;
  - pagata.
- [ ] Subject auth server.
- [ ] Nessun pagamento online inventato.

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
- [ ] Totali non nascondono il breakdown team.
- [ ] Importi a destra, tabular.
- [ ] Filtered empty.
- [ ] Nessun `Paga`.
- [ ] Responsive 320→desktop.

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
- [ ] Separare dati account da dati subject.
- [ ] Endpoint/service profilo subject-aware.
- [ ] Restituire solo dati necessari alla UI.
- [ ] Predisporre permission flags per:
  - medical status;
  - documents.
- [ ] Membership con jersey per team.
- [ ] Non restituire dati medici dettagliati se la specifica autorizza solo stato.
- [ ] Nessuna modifica delle regole di permission.

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
- [ ] Separare visivamente dati subject da impostazioni account.
- [ ] Jersey per team.
- [ ] Nessun “primo jersey”.
- [ ] Dati medical/document permission-aware.
- [ ] Nessuna duplicazione impostazioni in header.

**Prompt `/goal`**
```text
/goal G6.4
Ridisegna il profilo atleta separando chiaramente identità sportiva del subject e impostazioni dell'account.
```

---

## G6.5 — Installazione PWA, push e preferenze account

**Task**
- [ ] Comando installazione nel profilo.
- [ ] Nascondere se standalone.
- [ ] iOS instructions dedicate.
- [ ] Copy beneficio: accesso rapido + notifiche.
- [ ] Non promettere offline completo.
- [ ] Push permission solo dopo gesto.
- [ ] Preferenze per device/account.
- [ ] Compatibilità piattaforme senza Badging API.
- [ ] Verificare doppia convenzione storage tema, documentando il fix da fare in G10.1 se non necessario ora.

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
- [ ] Risolvere la doppia convenzione storage tema identificata nella baseline.
- [ ] Definire `.theme-dark`.
- [ ] Canvas quasi nero-blu, non nero puro.
- [ ] Superfici distinte per luminosità/bordi.
- [ ] Red più luminoso se necessario al contrasto.
- [ ] Stati semantic contrast.
- [ ] Logo non invertito automaticamente.
- [ ] Manifest/metadata/theme-color coerenti quando il browser lo supporta.
- [ ] Test contrasto delle primitive.

**Prompt `/goal`**
```text
/goal G10.1
Completa il dark mode canonico, correggi la persistenza tema e verifica contrasto e theme-color senza alterare immagini/logo.
```

---

## G10.2 — Audit accessibilità WCAG 2.2 AA

**Checklist**
- [ ] focus visibile;
- [ ] keyboard completa;
- [ ] 44×44;
- [ ] label reali;
- [ ] error association;
- [ ] aria-current;
- [ ] aria-pressed;
- [ ] aria-expanded;
- [ ] dialog names/focus trap/restore;
- [ ] no color-only;
- [ ] date/time SR;
- [ ] unread announcements non rumorosi;
- [ ] zoom 200%;
- [ ] reduced motion;
- [ ] contrast light/dark;
- [ ] screen reader smoke su dashboard/calendar/messages/family/admin.

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
- [ ] no authenticated HTML;
- [ ] no API;
- [ ] no RSC;
- [ ] no Supabase payload;
- [ ] no signed URL privati;
- [ ] public runtime cache pulita logout;
- [ ] fallback offline generico;
- [ ] nessuna queue mutation.

**Prompt `/goal`**
```text
/goal G10.3
Esegui l'audit PWA completo con particolare attenzione a cache privacy, update, offline e logout. Non introdurre background sync.
```

---

## G10.4 — Performance e bundle

**Task**
- [ ] Analizzare bundle delle aree principali.
- [ ] Cercare Client Components eccessivamente grandi.
- [ ] Spostare composizione/dati iniziali a Server Components quando ragionevole e senza riscrittura.
- [ ] Lazy-load detail pesanti quando utile.
- [ ] Evitare richieste duplicate su subject/team switch.
- [ ] AbortController dove necessario.
- [ ] Verificare font e immagini.
- [ ] Nessun refactor prematuro fuori dai colli di bottiglia misurati.

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
- [ ] Cercare componenti `cs-*`/legacy non più referenziati.
- [ ] Rimuovere solo codice sicuramente morto.
- [ ] Eliminare token/classi non usati.
- [ ] Eliminare duplicazioni introdotte dalla migrazione.
- [ ] Nessuna rinomina massiva.
- [ ] Build dopo ogni gruppo di rimozioni.

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

## Gate Fase 2 → 3
- dashboard usa dati reali multi-team;
- attendance robusta;
- jersey per team;
- states completi.

## Gate Fase 3 → 4
- calendario agenda;
- deduplica/conflict;
- attendance riusata;
- team filter non autorizzativo.

## Gate Fase 4 → 5
- read state account+subject;
- deduplica messaggi;
- signed URL privacy.

## Gate Fase 5 → 6
- championship subject-aware;
- nessun owner-only nella nuova feature;
- selector team/championship robusto.

## Gate Fase 6 → 7
- fees con team id;
- profilo subject-aware;
- PWA settings account-level.

## Gate Fase 7 → 8
- famiglia testata con più figli;
- nessun leakage;
- permission matrix robusta.

## Gate Fase 8 → 9
- coach multi-team stabile;
- foundation confermata su terzo ruolo.

## Gate Fase 9 → 10
- admin migrato;
- route preservate;
- pattern gestionali consolidati.

## Gate finale
- light/dark;
- WCAG smoke;
- PWA audit;
- performance;
- E2E matrix;
- cleanup;
- documentazione.

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
