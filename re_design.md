# CSRoma PWA — Specifica di redesign

> Documento di riferimento per la progettazione e l'implementazione progressiva del nuovo design CSRoma.
>
> Stato: proposta operativa v1
>
> Aggiornato: 27 agosto 2026
>
> Ambito iniziale: area atleta e area familiare, poi coach, infine amministrazione
>
> Stack rilevato: Next.js 15 App Router, React 19, TypeScript strict, Tailwind CSS 4 + CSS custom properties, Supabase, PWA custom service worker

---

## 1. Scopo del documento

Questo documento è la fonte di verità per il redesign dell'app CSRoma. Traduce i mockup Google Stitch e il riferimento visuale “Executive Heritage” in un sistema applicabile al prodotto reale, tenendo conto di:

- ruoli e permessi effettivi;
- atleta presente in più squadre;
- coach assegnato a più squadre;
- familiare/tutore con più profili accessibili;
- account con più ruoli;
- quote, messaggi, calendari e campionati legati a squadre differenti;
- utilizzo da browser e da PWA installata;
- safe area, navigazione mobile, push, stato offline e aggiornamenti del service worker;
- accessibilità, responsive design e performance;
- struttura e contratti API già presenti nel repository.

Il redesign non deve essere una riproduzione letterale dei mockup. I mockup definiscono tono, gerarchia e priorità; il codice e il modello autorizzativo definiscono i comportamenti reali.

### Ordine di implementazione approvato

1. Fondazione visuale e shell PWA.
2. Area atleta.
3. Area familiare, come estensione delegata dell'area atleta.
4. Area coach.
5. Area amministrativa.
6. Consolidamento trasversale, accessibilità e rifinitura.

L'area familiare deve seguire immediatamente l'area atleta: è il test più importante per verificare che il design distingua correttamente account, profilo visualizzato, permessi e squadra.

---

## 2. Fonti analizzate

### Riferimenti visuali

- mockup Google Stitch della dashboard atleta;
- mockup calendario atleta;
- mockup messaggi atleta;
- mockup campionato atleta;
- `DESIGN.md` “Executive Heritage” fornito come riferimento esterno.

### Codice e architettura esistenti

Sono stati analizzati in particolare:

- `src/app/layout.tsx` e `src/app/globals.css`;
- `src/components/navigation/LayoutShell.tsx`;
- `src/components/navigation/RoleSidebar.tsx`;
- `src/components/navigation/AccessibleProfileSelector.tsx`;
- `src/hooks/useAuth.ts`;
- `src/context/AccessibleProfileContext.tsx`;
- `src/server/auth/require-account-context.ts`;
- `src/server/auth/require-subject-profile.ts`;
- dashboard e manager atleta, coach, famiglia e admin;
- Route Handler atleta per dashboard, calendario, messaggi e quote;
- infrastruttura campionati condivisa;
- manifest, service worker, fallback offline, push e installazione PWA;
- piano e test PWA esistenti.

### Vincoli architetturali rilevati

- Le route applicative correnti devono essere mantenute per non interrompere bookmark e deep link push.
- L'autorizzazione è basata su `app_accounts` e `account_roles`; il ruolo legacy del profilo non è fonte autorevole.
- Un account può avere più ruoli.
- Il profilo personale dell'account e il profilo soggetto visualizzato sono concetti distinti.
- L'accesso familiare è autorizzato per singolo profilo e singolo permesso.
- `subjectProfileId` è solo una richiesta di contesto: deve sempre essere verificato lato server.
- Un atleta può essere membro di più squadre; il numero di maglia autorevole è per squadra in `team_members.jersey_number`.
- Un coach può essere assegnato a più squadre tramite `team_coaches`.
- Messaggi ed eventi possono essere associati a più squadre.
- Le quote sono collegate a una squadra e devono restare distinguibili per iscrizione.
- La PWA MVP non salva HTML autenticato, API, RSC o dati Supabase in Cache Storage.
- Le mutazioni non sono accodate offline e non devono essere presentate come se lo fossero.

---

## 3. Visione del prodotto

### Direzione primaria: Executive Heritage, adattata a CSRoma

CSRoma deve apparire come uno strumento sportivo autorevole, concreto e umano. La UI deve ricordare una control room di società sportiva, non una dashboard fintech generica e non un'app fitness consumer.

Parole chiave:

- adulta;
- precisa;
- sportiva senza essere rumorosa;
- calda;
- operativa;
- riconoscibile;
- mobile-first per atleta, famiglia e coach;
- densa ma leggibile per amministrazione.

### Principi non negoziabili

1. **Azione prima della decorazione.** Ogni schermata deve rispondere a una domanda concreta.
2. **Contesto sempre visibile.** L'utente deve sapere per chi e per quale squadra sta leggendo o agendo.
3. **Aggregazione come default.** Chi ha più squadre vede inizialmente una panoramica combinata; filtra soltanto quando serve.
4. **Una sola grammatica visuale.** Atleta, famiglia, coach e admin condividono token, componenti e stati.
5. **Densità per ruolo.** Lo stesso sistema usa una densità più comoda su mobile e più compatta nell'admin.
6. **Rosso con disciplina.** Il rosso identifica brand, azione primaria, selezione e criticità; non colora indiscriminatamente ogni superficie.
7. **Meno card.** Una card è un oggetto o un'azione autonoma, non un contenitore universale.
8. **Stato esplicito.** Il colore non è mai l'unico modo per comunicare un'informazione.
9. **PWA onesta.** Offline, installazione, aggiornamenti e push devono riflettere capacità reali.
10. **Accessibilità integrata.** Non è una fase finale.

### Tre rischi UX principali

- confondere account, profilo delegato e squadra;
- costruire pagine perfette solo per i dati dimostrativi dei mockup;
- frammentare il prodotto in quattro interfacce diverse per ruolo.

---

## 4. Modello mentale e contesto attivo

Il design deve rappresentare tre livelli distinti.

| Livello | Significato | Esempio |
|---|---|---|
| Account | Chi è autenticato | Anna Rossi |
| Area/profilo soggetto | Per chi si stanno consultando i dati | Luca Rossi |
| Squadra | Quale ambito sportivo è attivo | U16 Eccellenza |

### 4.1 Account

L'account appare nel menu profilo e governa:

- identità autenticata;
- ruoli disponibili;
- preferenze tema;
- installazione PWA;
- notifiche push;
- logout.

Non usare l'avatar account come unica indicazione del profilo soggetto quando si opera per un familiare.

### 4.2 Area e profilo soggetto

Le aree possibili sono:

- personale;
- familiare/delegata.

Nell'area familiare il profilo selezionato deve essere persistente e sempre visibile. Il copy canonico è:

> Stai visualizzando Luca Rossi

Non usare formulazioni ambigue come “Il mio profilo” quando l'account è esclusivamente familiare e non possiede un profilo atleta personale.

Il contesto soggetto esistente viene persistito in locale. Qualsiasi redesign deve preservare il comportamento di invalidazione quando la relazione non è più accessibile.

### 4.3 Squadra

Regole:

- se esiste una sola squadra, il filtro non è mostrato;
- con due o più squadre, il default è `Tutte le squadre`;
- la squadra selezionata è visibile vicino al titolo o nell'header contestuale;
- cambiando profilo soggetto, la squadra torna a `Tutte le squadre`;
- un filtro non può concedere accesso: restringe soltanto dati già autorizzati;
- i deep link possono indicare una squadra, ma il server deve verificare l'appartenenza o l'assegnazione.

### 4.4 Matrice dei selettori

| Caso | Selettore profilo | Selettore squadra |
|---|---:|---:|
| Atleta con una squadra | no | no |
| Atleta con più squadre | no | sì |
| Coach con una squadra | no | no |
| Coach con più squadre | no | sì |
| Familiare con un figlio e una squadra | opzionale compatto | no |
| Familiare con più figli | sì, prioritario | se il figlio selezionato ha più squadre |
| Account atleta + familiare | selettore area e soggetto | in base al soggetto attivo |
| Admin | no | filtro contestuale per pagina |

### 4.5 Conflitti e duplicati

- Eventi appartenenti a più squadre devono comparire una sola volta, con tutte le squadre pertinenti.
- Messaggi ricevuti tramite più destinatari/squadre devono comparire una sola volta.
- Due eventi sovrapposti devono mostrare un avviso di conflitto, senza stabilire automaticamente una priorità.
- Quote, numeri di maglia e convocazioni non vanno deduplicati tra squadre perché sono dati specifici della relazione atleta-squadra.

---

## 5. Architettura dell'informazione

### 5.1 Rotte esistenti da preservare

Area atleta:

- `/dashboard`;
- `/athlete/calendar`;
- `/athlete/campionati`;
- `/athlete/messages`;
- `/athlete/fees`;
- `/athlete/profile`.

Area coach:

- `/dashboard`;
- `/coach/calendar`;
- `/coach/campionati`;
- `/coach/messages`;
- `/coach/payments`;
- `/coach/profile`.

Area admin: mantenere le route attuali, anche se la navigazione visiva viene raggruppata.

### 5.2 Navigazione atleta mobile

Bottom navigation canonica, massimo cinque destinazioni:

1. Oggi → `/dashboard`
2. Calendario → `/athlete/calendar`
3. Campionato → `/athlete/campionati`
4. Messaggi → `/athlete/messages`
5. Profilo → `/athlete/profile`

Le quote sono raggiungibili dalla dashboard e dal profilo. Se i test d'uso dimostrano che le quote sono più frequenti del campionato, la quarta/quinta voce può essere rivalutata, ma non si deve superare il limite di cinque destinazioni.

### 5.3 Navigazione familiare mobile

Riutilizza la shell atleta e mostra solo le destinazioni consentite:

- Oggi;
- Calendario se `view_schedule`;
- Campionato solo dopo l'introduzione di un resolver delegato dedicato;
- Messaggi se `receive_messages`;
- Quote se `view_payments`;
- Profilo/contesto familiare.

Se le destinazioni disponibili superano cinque, utilizzare una voce `Altro`, non una bottom bar compressa.

### 5.4 Navigazione coach mobile

1. Oggi
2. Calendario
3. Convocazioni
4. Messaggi
5. Altro

Il selettore squadra vive nell'header contestuale e include `Tutte le squadre`.

### 5.5 Navigazione admin desktop

La sidebar deve essere raggruppata:

- **Panoramica**
  - Dashboard
  - Calendario
- **Sport**
  - Stagioni
  - Attività
  - Squadre
  - Campionati
  - Palestre
- **Persone**
  - Anagrafica
  - Atleti
  - Collaboratori
  - Account e accessi
- **Comunicazione**
  - Messaggi
  - Documenti
- **Amministrazione**
  - Quote
  - Incassi
  - Uscite
  - Bilancio

Profilo, impostazioni e logout stanno nella zona account, non nella navigazione operativa.

---

## 6. Design system canonico

La definizione seguente sostituisce le ambiguità cromatiche presenti nel riferimento Stitch. I nomi dei token possono essere adattati alla convenzione esistente `--cs-*`, ma i ruoli semantici devono restare stabili.

### 6.1 Palette chiara

| Token | Valore | Uso |
|---|---|---|
| Canvas | `#F5F4F1` | sfondo principale |
| Surface | `#FFFFFF` | pannelli e card |
| Surface subdued | `#EFEEEB` | segmenti, toolbar, righe secondarie |
| Surface selected | `#FDECEE` | selezione CSRoma leggera |
| Ink | `#171A21` | testo principale |
| Ink muted | `#667085` | testo secondario |
| Ink faint | `#8A8F9B` | metadata non essenziali |
| Border | `#E2E0DC` | separatori e bordi |
| Brand red | `#D71920` | CTA e navigazione attiva |
| Brand red dark | `#B3121A` | hover, pressed, testo rosso accessibile |
| Navy | `#243149` | sidebar admin e superfici inverse |
| Success | `#12B76A` | pagato, confermato, completato |
| Warning | `#F79009` | scadenza, da verificare, forse |
| Danger | `#B42318` | scaduto, errore, non partecipa |
| Info | `#2E90FA` | informazione neutra |
| Gold | `#F5CE3F` | medaglie o micro-accenti, mai struttura |

### 6.2 Tema scuro

Il repository supporta già un tema scuro. Il redesign deve conservarlo, ma implementarlo dopo la stabilizzazione del tema chiaro.

Regole:

- canvas quasi nero blu, non nero puro;
- superfici distinte tramite luminosità e bordi;
- brand red leggermente più luminoso per mantenere contrasto;
- nessuna inversione automatica delle immagini del logo;
- stati semantici verificati separatamente;
- correggere la doppia convenzione di storage tema esistente prima di dichiarare il tema completato.

### 6.3 Tipografia

Direzione preferita: **Hanken Grotesk** per l'interfaccia. Introdurla tramite `next/font` o asset locale, senza caricamenti bloccanti e senza dipendenza runtime da font remoti.

Fallback iniziale: stack system già presente.

| Stile | Mobile | Desktop | Peso |
|---|---:|---:|---:|
| Display | 24/32 | 32/40 | 700 |
| H1 | 24/32 | 28/36 | 700 |
| H2 | 20/28 | 22/30 | 600–700 |
| H3 | 17/24 | 18/26 | 600 |
| Body | 15/22 | 15–16/24 | 400 |
| Body small | 13/18 | 13/18 | 400–500 |
| Label | 12/16 | 12/16 | 700 |

Regole:

- usare maiuscolo spaziato solo per label brevi;
- non usare monospace come linguaggio decorativo diffuso;
- usare `font-variant-numeric: tabular-nums` per importi, orari, classifiche e KPI;
- evitare pesi bold su interi paragrafi;
- lunghezza minima leggibile 13 px per testo informativo persistente.

### 6.4 Spaziatura e griglia

- baseline: 4 px;
- spazi interni: 8, 12, 16, 20, 24, 32, 40;
- gutter mobile: 16 px;
- gutter tablet: 20–24 px;
- gutter desktop: 24–32 px;
- separazione tra sezioni: 24 px mobile, 32–40 px desktop;
- container admin massimo: 1440 px;
- contenuto lettura atleta desktop: massimo 960–1080 px, centrato;
- altezza minima touch target: 44 px;
- righe tabella: almeno 48 px.

### 6.5 Radius, bordi ed elevazione

- controlli: 10 px;
- card piccole: 12 px;
- pannelli: 14 px;
- bottom sheet/dialog mobile: 18–20 px solo sugli angoli superiori;
- pill: esclusivamente badge, status e chip filtro;
- bordo standard: 1 px;
- shadow standard: nessuna;
- popover/modal: `0 8px 24px rgba(23, 26, 33, 0.06)`;
- hover non deve sollevare o spostare il layout.

### 6.6 Motion

- durata breve: 120 ms;
- durata standard: 180 ms;
- durata sheet/dialog: 220 ms;
- proprietà preferite: opacity, transform, background-color, border-color;
- rispettare `prefers-reduced-motion`;
- nessuna animazione continua decorativa;
- skeleton discreti e senza lampi ad alto contrasto.

---

## 7. Shell e responsive design

### 7.1 Mobile PWA

Struttura:

```text
safe-area top
app header
subject/team context bar, se necessaria
main scroll container
bottom navigation
safe-area bottom
```

Requisiti:

- usare `100dvh`, non affidarsi solo a `100vh`;
- applicare `env(safe-area-inset-top)` e `env(safe-area-inset-bottom)` in modalità standalone;
- il contenuto deve avere padding inferiore pari a bottom navigation + safe area;
- banner offline e update non devono coprire header, CTA o bottom navigation;
- modal lunghi diventano bottom sheet o fullscreen;
- nessun overflow orizzontale a 375 px;
- supportare almeno 320 px senza perdita delle azioni essenziali.

### 7.2 Tablet

- atleta/famiglia/coach mantengono una shell mobile ampliata fino a circa 767 px;
- da 768 px possono usare due colonne per sezioni compatibili;
- bottom navigation può restare finché l'uso touch è predominante;
- evitare di mostrare contemporaneamente sidebar e bottom navigation.

### 7.3 Desktop

- admin: sidebar fissa + topbar + workspace;
- coach: sidebar compatta o rail, con selettore squadra persistente;
- atleta/famiglia: contenuto centrato; evitare una sidebar amministrativa sovradimensionata;
- detail panel preferibilmente laterale su desktop;
- dialog centrati soltanto per conferme e operazioni brevi.

### 7.4 Header mobile atleta/famiglia

Contenuto canonico:

- back button solo nelle pagine di dettaglio, non in ogni root tab;
- logo/nome `CSRoma`;
- azione account/profilo;
- titolo pagina nel contenuto o seconda riga, non duplicato;
- selettore profilo prioritario nell'area familiare;
- selettore squadra solo se necessario.

Non mostrare un'icona impostazioni su ogni schermata root: le impostazioni appartengono al profilo.

---

## 8. Componenti condivisi

### 8.1 AppHeader

Varianti:

- mobile root;
- mobile detail con back;
- desktop role shell;
- family subject context.

### 8.2 BottomNavigation

- massimo cinque voci;
- icona Lucide + label sempre visibile;
- stato attivo derivato dalla route, non dallo scroll;
- indicatore non letto testuale/accessibile;
- safe-area integrata;
- badge messaggi senza spostare la label.

### 8.3 ContextSwitcher

Un componente con due modalità distinte:

- `SubjectSwitcher`: cambia profilo delegato;
- `TeamSwitcher`: filtra per squadra.

Non usare un unico controllo ambiguo. Ogni opzione deve includere nome, eventuale attività e stato rilevante.

### 8.4 PageHeader

Deve supportare:

- eyebrow/breadcrumb;
- titolo;
- descrizione significativa;
- context switcher;
- azione primaria;
- azioni secondarie;
- toolbar filtri separata.

Eliminare sottotitoli generici ripetuti come “Area Atleta” o “Amministrazione CSRoma”.

### 8.5 Button

Varianti:

- primary;
- secondary;
- ghost;
- danger;
- icon.

Regole:

- una sola primary action per regione;
- stato loading mantiene larghezza;
- stato disabled non usa soltanto opacity insufficiente;
- `aria-label` per icon-only;
- nessun emoji come icona.

### 8.6 Card, Panel e ListRow

- `Card`: elemento autonomo e spesso cliccabile;
- `Panel`: raggruppamento di una sezione;
- `ListRow`: contenuto ripetuto e ad alta densità;
- non annidare card dentro card senza necessità;
- l'intera riga cliccabile usa semantica button/link corretta.

### 8.7 Badge e status

Ogni stato usa:

- testo;
- colore;
- opzionalmente icona;
- background leggero.

Status canonici presenze:

- `going` → Partecipo;
- `maybe` → Forse;
- `declined` → Non partecipo;
- assente → Da confermare.

### 8.8 Modal, drawer e sheet

- conferme brevi → dialog;
- dettagli su desktop → drawer;
- dettagli su mobile → bottom sheet/fullscreen;
- form lunghi → pagina o wizard;
- focus trap e restore focus;
- chiusura con Escape su desktop;
- footer sticky nei flussi lunghi;
- conferma prima di perdere modifiche non salvate.

### 8.9 FeedbackState

Ogni superficie dati deve prevedere:

- initial loading;
- refreshing non bloccante;
- empty autentico;
- filtered empty;
- permission denied;
- offline;
- unexpected error;
- success mutation;
- optimistic state con rollback, quando sicuro.

---

## 9. Area atleta — specifica funzionale e visuale

### 9.1 Dashboard `/dashboard`

Obiettivo: rispondere a “Cosa devo sapere o fare adesso?”.

Ordine dei contenuti:

1. prossimo impegno che richiede attenzione;
2. prossima partita;
3. messaggi non letti;
4. prossima quota/scadenza;
5. squadre e numeri di maglia.

#### Prossimo impegno

Mostrare:

- tipo evento;
- titolo;
- data e ora;
- luogo;
- squadra/e;
- deadline di conferma;
- risposta attuale.

Se `requires_confirmation` è falso, non mostrare i tre pulsanti.

Se l'utente è delegato e non ha `confirm_attendance`, mostrare lo stato in sola lettura e non renderizzare controlli disabilitati ambigui.

#### Prossima partita

Mostrare la prima partita futura pertinente alle squadre del soggetto. Se più squadre hanno partite ravvicinate, mostrare la prima e un link `Vedi tutte`.

#### Messaggi

- massimo due o tre righe;
- deduplicati per messaggio;
- mittente e squadra;
- indicatore non letto;
- apertura detail con marcatura lettura per account + subject profile.

#### Quote

- mostrare la rata più urgente;
- importo con cifre tabellari;
- squadra/attività;
- stato e scadenza;
- non presentare un pulsante “Paga” finché non esiste un flusso di pagamento effettivo.

#### Squadre

Mostrare una riga per membership:

- squadra;
- attività;
- codice;
- numero di maglia specifico;
- accesso al dettaglio.

#### Elementi da rimuovere dall'attuale dashboard

- hero fotografica dominante;
- contatori generici senza azione;
- duplicazione tra welcome card e shell;
- eccesso di card `primary` bordate di rosso;
- tour come CTA primaria persistente.

Il tour rimane accessibile dal profilo o da un menu help.

### 9.2 Calendario `/athlete/calendar`

Obiettivo: consultare rapidamente allenamenti, partite, riunioni e rispondere alle presenze.

#### Mobile default

- vista agenda/lista;
- segmenti `Tutti`, `Allenamenti`, `Partite` o equivalente compatto;
- raggruppamento per giorno;
- primo evento rilevante espandibile;
- team badge quando necessario;
- dettaglio in bottom sheet;
- risposta inline per l'evento prioritario.

La vista mese non è il default mobile. Può essere una vista secondaria.

#### Desktop

- agenda/settimana come default;
- vista mese disponibile;
- filtro tipo e squadra;
- eventuale export come azione secondaria, non primaria nell'area atleta.

#### Dati e prerequisiti

L'API attuale restituisce nomi squadra per evento. Per un filtro robusto deve restituire anche ID e codice squadra, mantenendo compatibilità con il payload esistente.

La risposta presenze deve continuare a usare il subject profile verificato lato server.

#### Casistiche

- nessuna squadra;
- squadra senza eventi;
- eventi ricorrenti;
- più squadre sullo stesso evento;
- conflitto temporale;
- confirmation deadline superata;
- familiare senza `view_schedule`;
- familiare con `view_schedule` ma senza `confirm_attendance`;
- errore di salvataggio con rollback visibile.

### 9.3 Messaggi `/athlete/messages`

Obiettivo: leggere comunicazioni amministrative e di squadra senza ambiguità.

#### Layout

- titolo `Messaggi`;
- conteggio non letto;
- filtro `Tutti / Non letti`;
- team filter solo con più squadre;
- lista unica con separatori, non card isolate per ogni messaggio;
- preview massimo due righe;
- allegato indicato con icona e conteggio;
- timestamp relativo recente e data completa nel dettaglio.

#### Riga messaggio

- indicatore non letto;
- avatar o iniziali;
- mittente;
- ruolo del mittente;
- squadra/destinatario;
- oggetto;
- preview;
- data.

#### Dettaglio

- subject;
- mittente e ruolo;
- data completa;
- destinatari pertinenti;
- contenuto;
- allegati;
- stato di lettura aggiornato senza full reload.

#### Privacy e deduplica

- non mostrare destinatari non pertinenti al soggetto delegato;
- deduplicare messaggi ricevuti direttamente e tramite una o più squadre;
- il read state è per account e subject profile, coerente con il modello già presente;
- signed URL degli allegati non devono essere persistiti nella cache PWA.

### 9.4 Campionato `/athlete/campionati`

Obiettivo: mostrare il contesto competitivo della squadra selezionata.

Ordine:

1. selettore squadra/campionato se necessario;
2. prossima partita;
3. convocazione personale/pubblicata;
4. posizione in classifica;
5. risultati recenti;
6. calendario completo su richiesta.

#### Multi-squadra

Il campionato non può partire da “primo campionato disponibile”. Deve derivare dalle squadre del soggetto e mostrare soltanto campionati pertinenti.

Ogni selezione deve mantenere la gerarchia:

`Squadra → Campionato → Girone`.

Girone e campionato possono essere impliciti quando univoci.

#### Prossima partita

Mostrare:

- giornata;
- casa/trasferta;
- avversario;
- data e orario;
- luogo;
- stato convocazione;
- orario ritrovo, se disponibile;
- CTA contestuale `Vedi convocazione`.

#### Classifica

- evidenziare CSRoma con testo, marker e superficie;
- numeri allineati;
- non affidarsi solo al rosso;
- top 5 iniziale e classifica completa espandibile;
- non imporre evidenziazione top-three se non ha significato nel regolamento.

#### Prerequisito tecnico rilevato

L'implementazione atleta corrente carica le squadre campionato usando `account.ownerProfileId` direttamente dal client e l'endpoint classifica autorizza l'atleta personale. Non è sufficiente per un familiare che visualizza un soggetto delegato.

Prima di abilitare Campionato nell'area familiare occorre:

- introdurre Route Handler subject-aware per catalogo, classifica, partite e convocazioni;
- accettare `subjectProfileId` solo come input da validare con `requireSubjectAthleteContext`;
- eliminare la dipendenza dal solo owner profile per la modalità atleta;
- verificare che ogni squadra/campionato richiesto appartenga al subject autorizzato.

Finché questo prerequisito non è completato, la navigazione familiare non deve mostrare Campionato.

### 9.5 Quote `/athlete/fees`

Obiettivo: capire cosa è dovuto, cosa è pagato e a quale squadra si riferisce.

Layout:

- riepilogo totale dovuto, pagato e residuo;
- gruppi per squadra;
- filtri `Tutte`, `Da pagare`, `Pagate`, `Scadute`;
- righe rata compatte;
- dettaglio quota espandibile;
- importi a destra con cifre tabellari.

Con più squadre, nessun totale deve nascondere il dettaglio per squadra.

Stati canonici:

- non ancora dovuta;
- in scadenza;
- scaduta;
- parzialmente pagata;
- pagata.

L'API deve includere `team.id` oltre a nome e codice per consentire filtro coerente e deep link.

### 9.6 Profilo `/athlete/profile`

Sezioni:

- identità e avatar;
- dati di contatto;
- tesseramento;
- certificato medico;
- squadre e numeri di maglia;
- preferenze;
- notifiche push;
- installazione PWA;
- sicurezza/account.

Il numero di maglia non può essere riassunto con il primo valore disponibile: deve essere mostrato per squadra.

Per un profilo delegato:

- mostrare solo i dati autorizzati;
- l'account del familiare resta distinto dal profilo atleta;
- impostazioni push e installazione appartengono all'account, non al figlio;
- dati medici solo con `view_medical_status`;
- documenti solo con `view_documents`.

L'attuale pagina profilo è centrata sull'owner profile e su query client dirette. La modalità delegata richiede viste/endpoint dedicati prima di essere esposta.

---

## 10. Area familiare

### 10.1 Selezione iniziale

Se esiste un solo profilo accessibile, può essere selezionato automaticamente solo se l'area familiare è esplicitamente attiva. Se ne esistono più di uno, mostrare una lista profili.

Ogni profilo mostra:

- nome completo;
- relazione;
- attività/squadre principali, se disponibili;
- sezioni autorizzate in linguaggio semplice;
- CTA `Apri profilo`.

Non mostrare copy tecnico sui permessi.

### 10.2 Profilo attivo

L'header deve rendere evidente:

```text
Area familiare
Stai visualizzando Luca Rossi ▾
Tutte le squadre ▾
```

Il selettore squadra appare solo se Luca è in più squadre.

### 10.3 Permessi

| Permesso | Effetto UI |
|---|---|
| `view_schedule` | mostra calendario e prossimi eventi |
| `confirm_attendance` | abilita risposta presenze |
| `view_payments` | mostra quote |
| `view_medical_status` | mostra stato certificato, non necessariamente dettagli clinici |
| `view_documents` | mostra documenti disponibili |
| `sign_documents` | abilita flussi di firma quando implementati |
| `receive_messages` | mostra messaggi del soggetto |

Una funzione non autorizzata viene generalmente omessa dalla navigazione. Se raggiunta da deep link, mostrare un denied state chiaro e una via di ritorno.

### 10.4 Cambio profilo

Quando cambia il subject:

- chiudere drawer e dialog aperti;
- annullare richieste precedenti;
- azzerare il filtro squadra;
- ricalcolare destinazioni consentite;
- aggiornare read state e badge;
- non conservare dati visivi del soggetto precedente;
- mostrare un breve stato di transizione senza pagina bianca.

---

## 11. Area coach — direzione successiva

Obiettivo home: rispondere a quattro domande.

1. Cosa ho oggi?
2. Chi sarà presente?
3. Qual è la prossima partita?
4. Cosa devo comunicare?

### Vista aggregata

Default `Tutte le squadre`:

- agenda combinata con badge squadra;
- presenze per prossimo allenamento;
- partite prossime ordinate;
- convocazioni incomplete;
- comunicazioni da inviare o con letture mancanti;
- conflitti tra eventi delle squadre assegnate.

### Vista squadra

Il selettore squadra filtra calendario, presenze, campionato, convocazioni e messaggi. Le azioni ereditano il contesto, ma prima dell'invio mostrano sempre destinatari e quantità.

### Azioni contestuali partita

- Prepara convocazioni;
- Pubblica convocazioni;
- Sollecita risposte;
- Registra risultato;
- Consulta risultato.

La CTA dipende dallo stato, non è sempre `Gestisci convocazioni`.

---

## 12. Area admin — direzione successiva

### Dashboard

Priorità:

1. Richiede attenzione;
2. Oggi;
3. Incassi;
4. squadre con anomalie;
5. comunicazioni;
6. attività recente.

Esempi di eccezioni azionabili:

- rate scadute;
- certificati in scadenza;
- inviti non accettati;
- eventi senza impianto;
- conflitti di calendario;
- messaggi non letti;
- convocazioni incomplete.

I contatori generici di stagioni, squadre e persone diventano riepilogo secondario.

### Pagine gestionali

Schema comune:

1. titolo e contesto;
2. azione primaria;
3. ricerca e filtri;
4. indicatori utili;
5. tabella/lista;
6. selezione multipla;
7. drawer dettaglio;
8. stati completi.

Persone, account, atleti, collaboratori e relazioni devono apparire come parti dello stesso dominio, pur preservando route e responsabilità tecniche esistenti.

---

## 13. PWA e comportamento applicativo

### 13.1 Capacità attuali da preservare

- manifest installabile;
- display standalone;
- icone standard e maskable;
- service worker unico;
- fallback offline;
- cache limitata ad asset pubblici;
- banner offline;
- aggiornamento controllato;
- Web Push;
- install prompt e istruzioni iOS;
- pulizia cache runtime pubbliche al logout.

### 13.2 Offline: linguaggio e limiti

L'app non offre al momento sincronizzazione dati o Background Sync. Quindi:

- non mostrare “salvato offline”;
- non consentire submit che sembri completato senza rete;
- non accodare presenze, pagamenti, messaggi, upload o modifiche;
- una schermata già aperta può mostrare dati già in memoria, ma deve indicarli come potenzialmente non aggiornati;
- una nuova navigazione senza rete usa il fallback offline generico;
- il banner non deve suggerire che una modifica sia stata registrata per il futuro.

Copy consigliato:

> Sei offline. Alcuni contenuti potrebbero non essere aggiornati e le modifiche non sono disponibili.

### 13.3 Banner offline

- posizione sotto la safe area e sopra l'app header, oppure integrata nella shell;
- non coprire la bottom navigation;
- `role="status"` e `aria-live="polite"`;
- nessun colore giallo ad alto impatto su tutta la sessione: usare un tono warning leggibile ma compatto;
- al ritorno online, mostrare feedback breve `Connessione ripristinata` e aggiornare i dati quando sicuro.

### 13.4 Aggiornamento applicazione

- prompt esplicito;
- mobile: banner o sheet sopra la bottom navigation;
- desktop: toast persistente;
- non ricaricare automaticamente mentre un form è dirty;
- CTA `Aggiorna ora` e, se necessario, `Più tardi`;
- dopo `controllerchange`, un solo reload.

### 13.5 Installazione

- comando nel profilo/account;
- nessun popup al primo login;
- nascondere se standalone;
- istruzioni iOS specifiche;
- spiegare il beneficio: accesso rapido e notifiche, non “funziona completamente offline”.

### 13.6 Push

- permesso richiesto solo dopo un gesto esplicito;
- preferenze per dispositivo nel profilo account;
- deep link same-origin;
- il click deve aprire la route esistente e lasciare che l'app risolva il contesto autorizzato;
- non inserire subject profile arbitrario senza verifica server;
- badge non letti come miglioramento, non fonte autorevole;
- fallback per piattaforme senza Badging API.

### 13.7 Safe area e standalone

Il redesign deve completare l'attività ancora aperta nel piano PWA:

- header e banner: `padding-top: env(safe-area-inset-top)`;
- bottom navigation: `padding-bottom: env(safe-area-inset-bottom)`;
- drawer e fullscreen sheet: inset completi;
- CTA fisse: distanza da bottom navigation + safe area;
- verificare iPhone con notch/Dynamic Island e Android gesture navigation.

### 13.8 Theme color

Aggiornare manifest, metadata, offline fallback e shell allo stesso canvas/brand del redesign. Il passaggio da `#F7F7FB` a `#F5F4F1` deve essere coordinato e testato, non applicato isolatamente.

---

## 14. Accessibilità

### Requisiti

- WCAG 2.2 AA come obiettivo;
- focus sempre visibile;
- navigazione completa da tastiera;
- touch target minimo 44×44 px;
- label reali per form;
- errori vicino al campo e collegati semanticamente;
- `aria-current="page"` sulla navigazione;
- `aria-pressed` per filtri e risposta presenze;
- `aria-expanded` per contenuti espandibili;
- dialog con nome accessibile, focus trap e restore focus;
- nessun significato affidato unicamente a colore o posizione;
- date e orari comprensibili dai lettori di schermo;
- contatori non letti annunciati senza rumore eccessivo;
- supporto zoom fino al 200%;
- rispetto di reduced motion;
- contrasto verificato anche in dark mode.

### Icone

- usare Lucide già presente nel progetto;
- nessun emoji come icona UI;
- `aria-hidden="true"` per icone decorative;
- label testuale o `aria-label` per azioni icon-only;
- non esportare nel prodotto nomi Material Symbols come testo.

---

## 15. Architettura di implementazione

### 15.1 Principi Next.js

- mantenere App Router;
- usare Server Components per composizione e dati iniziali quando la migrazione è ragionevole;
- mantenere Client Components soltanto per interazione, browser API e stato locale;
- non trasformare l'intero redesign in un singolo Client Component;
- non spostare logica autorizzativa nel client;
- non esporre admin client o service role;
- Route Handler sottili, validazione Zod e servizi server dedicati;
- mantenere confini di errore e stati prevedibili;
- non introdurre una nuova UI library: Radix, Lucide, Tailwind e componenti esistenti sono sufficienti.

### 15.2 Struttura target suggerita

```text
src/
  components/
    ui/                  # primitive condivise
    navigation/          # shell, header, bottom nav, switcher
    athlete/             # composizione e componenti di dominio atleta
    family/              # selezione e decorazione del contesto delegato
    coach/
    admin/
    pwa/
  features/
    athlete/
      data/              # contratti/query server quando introdotti
      types/
      schemas/
    championships/
    messages/
    calendar/
  server/
    auth/
    messages/
```

Non è obbligatorio creare subito tutte le cartelle. La migrazione deve essere incrementale e feature-driven.

### 15.3 Componenti da consolidare prima delle pagine

- `AppHeader`;
- `BottomNavigation`;
- `SubjectSwitcher`;
- `TeamSwitcher`;
- `PageHeader`;
- `Panel`;
- `ListRow`;
- `StatusBadge`;
- `EventCard` / `EventRow`;
- `AttendanceControl`;
- `MessageRow`;
- `MatchCard`;
- `FeeRow`;
- `BottomSheet` / `ResponsiveDetail`;
- stati di feedback.

### 15.4 Migrazione CSS

- definire token canonici in `:root` e `.theme-dark`;
- mappare i token in Tailwind 4 tramite `@theme`;
- evitare nuovi inline style;
- sostituire gradualmente classi legacy `cs-*`, senza big-bang rewrite;
- rimuovere duplicazioni e varianti non semantiche solo dopo la migrazione delle pagine interessate;
- non mescolare nello stesso componente colori hardcoded Tailwind e token semantici;
- aggiungere safe-area utilities e standalone media query.

### 15.5 Contratti dati da arricchire

Senza rimuovere campi esistenti:

- calendario atleta: includere team `{ id, name, code }` per evento;
- quote atleta: includere `team.id` e `activity.id`;
- dashboard atleta: associare team agli eventi, non solo alle membership;
- messaggi: fornire read state aggregato esplicito e contesto squadra deduplicato;
- campionati: endpoint subject-aware per famiglia e multi-squadra;
- profilo delegato: endpoint separato e permission-aware;
- deep link: parametri validati, mai usati come autorizzazione.

### 15.6 Stato locale

- il subject profile può continuare a essere persistito con la chiave esistente;
- introdurre una chiave separata per team context, idealmente per subject/area;
- non persistire dati personali o payload completi in localStorage;
- resettare team context se non più valido;
- cancellare cache UI sensibili al logout e al cambio account;
- abortire fetch quando cambia subject o squadra.

---

## 16. Roadmap di implementazione

### Fase 0 — Baseline

- screenshot delle viste correnti a 375, 768, 1024 e 1440 px;
- test smoke delle route atleta;
- test famiglia con più profili;
- inventario componenti e classi usate;
- conferma dei contratti API esistenti;
- nessuna modifica visuale in questa fase.

### Fase 1 — Foundation

- token chiari canonici;
- tipografia;
- safe area;
- shell atleta mobile;
- bottom navigation;
- header;
- context switcher;
- feedback states;
- primitive panel/list/card;
- adattamento PWA banner/update.

Gate: nessun overflow a 375 px, focus completo, nessuna regressione desktop autenticata.

### Fase 2 — Dashboard atleta

- nuovo ordine informativo;
- prossimo impegno;
- attendance control;
- prossima partita;
- messaggi;
- quote;
- memberships multi-squadra;
- loading/empty/error/permission/offline.

### Fase 3 — Calendario atleta

- agenda mobile;
- filtri tipo e squadra;
- eventi espandibili;
- detail responsive;
- conflitti;
- risposta presenze;
- vista desktop/settimana.

### Fase 4 — Messaggi atleta

- lista;
- unread filter;
- team context;
- detail;
- read state;
- allegati;
- push/deep link.

### Fase 5 — Campionato atleta

- resolver squadre/campionati;
- prossima partita;
- convocazione;
- classifica;
- risultati;
- calendario completo;
- multi-squadra.

### Fase 6 — Quote e profilo atleta

- riepilogo finanziario;
- gruppi squadra;
- tesseramento;
- certificato;
- maglie per squadra;
- push;
- installazione.

### Fase 7 — Area familiare

- selettore profilo;
- permessi dinamici;
- subject-aware dashboard/calendar/messages/fees;
- campionato delegato dopo il prerequisito API;
- profilo delegato permission-aware;
- test con più figli e più squadre.

### Fase 8 — Coach

- shell mobile coach;
- team context;
- agenda;
- presenze;
- partite e convocazioni;
- comunicazione;
- pagamenti personali.

### Fase 9 — Admin

- shell desktop;
- navigazione raggruppata;
- dashboard operativa;
- pagine gestionali per dominio;
- tabelle, filtri, drawer e azioni massive;
- adattamento tablet/mobile per emergenze operative.

### Fase 10 — Consolidamento

- dark mode completo;
- rimozione legacy non usato;
- performance e bundle;
- test accessibilità;
- audit PWA;
- test dispositivi reali;
- documentazione componenti.

---

## 17. Strategia di verifica

### Viewport obbligatori

- 320×568;
- 375×812;
- 390×844;
- 768×1024;
- 1024×768;
- 1440×900.

### Scenari atleta

- nessuna squadra;
- una squadra;
- più squadre;
- numeri di maglia differenti;
- nessun evento;
- evento da confermare;
- deadline scaduta;
- eventi sovrapposti;
- nessun messaggio;
- messaggio duplicato per due squadre;
- allegato;
- nessuna quota;
- quota scaduta e quota pagata;
- uno e più campionati.

### Scenari famiglia

- un figlio;
- più figli;
- figlio in più squadre;
- permessi completi;
- solo calendario;
- calendario senza conferma presenze;
- solo quote;
- relazione rimossa durante una sessione;
- deep link verso sezione negata;
- cambio figlio con dialog aperto.

### Scenari PWA

- browser normale;
- standalone;
- installazione disponibile;
- iOS senza `beforeinstallprompt`;
- offline su pagina aperta;
- navigazione offline;
- ritorno online;
- update waiting;
- form dirty durante update;
- push con app aperta;
- push con app chiusa;
- logout e cambio account.

### Verifiche tecniche per ogni fase

- TypeScript;
- test unitari interessati;
- build;
- E2E mirati;
- review visuale responsive;
- tastiera e screen reader smoke test;
- verifica Cache Storage senza dati privati;
- review del diff per evitare refactor non necessari.

Lo script `npm run lint` deve essere rivalutato perché il progetto usa Next.js 15 e l'attuale comando `next lint` non è un fondamento futuro affidabile. Non dichiarare controlli superati se non sono stati realmente eseguiti.

---

## 18. Definition of Done visuale

Una schermata è completata quando:

- usa token canonici;
- condivide la shell corretta;
- gestisce il contesto multi-profilo/multi-squadra;
- non duplica titolo e navigazione;
- mostra loading, empty, filtered empty, error, denied e success;
- non usa emoji come icone;
- non usa il colore come unico segnale;
- non ha overflow ai viewport obbligatori;
- non viene coperta da safe area, bottom navigation o banner PWA;
- funziona con tastiera;
- mantiene touch target di almeno 44 px;
- rispetta reduced motion;
- non introduce dati o azioni non supportati dal backend;
- non indebolisce i controlli server/RLS;
- conserva le route e i deep link esistenti;
- supera i controlli tecnici pertinenti.

---

## 19. Non-obiettivi

Questa specifica non autorizza automaticamente:

- modifica dello schema database;
- nuova libreria UI;
- sostituzione di Supabase;
- riscrittura completa dell'architettura;
- operatività completa offline;
- background sync di mutazioni;
- pagamento online delle quote;
- firma documenti se il flusso non è già disponibile;
- cambiamento delle regole autorizzative;
- eliminazione immediata delle route legacy;
- redesign simultaneo di tutte le aree.

Ogni estensione funzionale deve essere approvata e progettata separatamente.

---

## 20. Decisione finale

Il redesign deve partire dall'area atleta, ma la prima unità di lavoro non è una singola pagina: è la **Athlete Foundation**, composta da design token, shell PWA, header, bottom navigation, contesto soggetto/squadra, componenti di lista/card e stati.

La dashboard atleta è la prima schermata da migrare perché combina quasi tutti i pattern. Seguono calendario, messaggi, campionato, quote e profilo. L'area familiare viene subito dopo e convalida l'intero modello di contesto e permessi. Solo a quel punto il sistema viene esteso a coach e admin con densità e navigazione appropriate.

La qualità del risultato non sarà misurata dalla somiglianza pixel-perfect con Stitch, ma dalla capacità del sistema di gestire dati reali, più squadre, più figli, più ruoli, permessi parziali, PWA standalone e stati di rete senza perdere chiarezza o identità CSRoma.
