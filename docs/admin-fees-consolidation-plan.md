# Piano di consolidamento Admin Quote / Incassi Atleti

**Data aggiornamento:** 26 ottobre 2026
**Branch:** `fix-quote`
**Tipo di goal:** analisi e pianificazione; nessuna modifica funzionale, API, schema o dato.
**Stato:** piano basato sul codice presente nel branch e sugli audit storici disponibili. La verifica live di staging non è stata ripetuta: in questo goal si è mantenuta la modalità read-only e si è riutilizzata la baseline storica del 14 ottobre.

## 1. Executive summary

Oggi `/admin/membership-fees` e `/admin/incassi` mostrano rate materializzate nella stessa tabella `fee_installments`, ma non sono due presentazioni equivalenti dello stesso contratto: hanno loader, filtri, paginazione, KPI e mutation distinti. La prima contiene funzioni operative indispensabili che Incassi non espone (modifica importo/scadenza e rettifica motivata dei pagamenti); la seconda è più adatta al monitoraggio (ricerca, filtri multipli, KPI e paginazione), ma la sua esportazione CSV è soltanto grafica e i dati di metodo pagamento raccolti non sono salvati.

La raccomandazione è mantenere **Quote** come catalogo/configurazione dei piani e consolidare in **Incassi** l’intero lavoro sulle rate emesse. Il tab `Atleti` in Quote non è eliminabile finché Incassi non offre le funzioni operative mancanti e finché la suite di equivalenza/sicurezza non dimostra che ricerca, filtri, export, singole mutation, bulk e storico sono coperti.

Il Dettaglio Atleta 360° introdotto il 25 ottobre è ora il punto individuale per identità, stagione/squadre e riepilogo rate per atleta. Rende obsoleto come direzione il drawer finanziario autonomo di Incassi. Il drawer attuale fa query client-side proprie, usa uno storico proiettato da rate pagate e non è scoped alla stagione; va sostituito con apertura del 360° o con una composizione riutilizzabile del relativo contratto dati, non sviluppato come terza implementazione.

La più alta priorità è il **Goal 0 — Financial Safety Hotfix**, prima del refactoring: bloccare la perdita di storico e rilevare le anomalie già presenti senza correggerle automaticamente. In particolare: `DELETE /api/admin/membership-fees` elimina rate assegnate senza controllare se siano pagate; le modifiche dei template ignorano errori di cancellazione/inserimento; generazione rate è un insert non idempotente e include ogni `team_members` della squadra senza filtro ruolo. Il recente endpoint di rimozione quota per singolo atleta è più prudente e blocca la cancellazione se trova evidenze di pagamento, ma non protegge la DELETE del piano.

Nel modello di business una quota è dovuta una sola volta per atleta, attività/disciplina e stagione, anche quando l’atleta appartiene a più squadre della stessa attività con tariffe standard diverse. Il 360° evita la moltiplicazione visuale delle membership, ma non impedisce che siano state emesse rate da due piani distinti: l’anomalia economica reale va distinta dalla duplicazione della stessa rata/query in UI e va segnalata, non deduplicata o corretta automaticamente.

La tabella `payments` non è un ledger degli incassi atleta: audit e codice mostrano pagamenti in uscita, principalmente `coach_payment`. Non introdurre una falsa unificazione con `fee_installments`, né inventare pagamenti parziali. La fonte corrente per rate e importi incassati resta `fee_installments` (con `paid_at` come criterio economico usato da KPI e 360°); il dettaglio del metodo non è registrato nel modello corrente.

## 2. Stato attuale verificato

### Superfici

| Superficie | Route e file | Dati/API principali | Ruolo attuale |
|---|---|---|---|
| Configurazione Quote | `/admin/membership-fees`; `src/components/admin/MembershipFeesManager.tsx` | `GET/POST/PUT/DELETE/PATCH /api/admin/membership-fees`; in più `GET /api/admin/installments` | CRUD piano, template rate, generazione rate, tab Atleti con elenco e mutation operative |
| Incassi | `/admin/incassi`; `src/components/admin/InstallmentsManager.tsx` e `src/components/admin/incassi/*` | `GET /api/admin/incassi/installments`, `GET /api/admin/incassi/kpi`, `POST /api/admin/incassi/payments` | Riepilogo e tabella paginata delle rate, filtri, pagamento bulk |
| Elenco Atleti / 360° | `/admin/atleti`; `AthletesManager.tsx`, `Athlete360Details.tsx` | `GET /api/admin/athletes/[profileId]/details?seasonId=...` | Scheda individuale read-only con profilo, squadre stagionali, piani materializzati e rate |

Le route API admin verificate usano `requireGlobalRole(..., 'admin')`; quelle che usano client privilegiato lo creano dopo il controllo ruolo. Le API di elenco non hanno tuttavia un servizio di dominio condiviso. Incassi usa il client server associato alla sessione/RLS per l’elenco e per le mutation; Quote usa il client privilegiato dopo l’autorizzazione e compone manualmente più query. Qualunque servizio comune futuro deve mantenere identico il gate server-side, il controllo stagione/team e la distinzione fra endpoint pubblico e query privilegiata.

### Baseline storica e aggiornamenti successivi

Sono stati letti `docs/admin-athlete-fees-redesign-audit.md`, `docs/admin-athlete-fees-staging-safety-report-2026-10-14.md` e `tests/fixtures/admin-financial-staging-baseline-2026-10-14.json`. Il file baseline indicato nel goal come `docs/admin-financial-staging-baseline-2026-10-14.json` **non esiste in quel percorso**: la fixture effettivamente presente è sotto `tests/fixtures/`.

La snapshot staging del 14 ottobre (non rinnovata in questo goal) registrava 4 piani, 12 rate, 6 rate pagate, totale pianificato €1.744,50, pagato €900, residuo €844,50 e nessuna anomalia aggregata fra quelle controllate. È una fotografia storica, non prova lo stato staging attuale né la sicurezza di mutation. `payments` conteneva 13 pagamenti `coach_payment`, senza pagamenti entranti-like.

Dall’audit del 14 ottobre, il codice e la documentazione mostrano due cambi rilevanti:

1. È stato aggiunto il Dettaglio Atleta 360° read-only con endpoint stagionale e aggregazione economica basata sulle rate emesse. Le membership multiple non moltiplicano gli importi; piani multipli nella stessa attività vengono segnalati.
2. In Quote > Atleti è stata aggiunta la rettifica di una rata pagata con motivo e audit. La mutation condiziona l’update sullo stato `paid` e non rappresenta un rimborso. È stata inoltre aggiunta la rimozione quota di un singolo atleta che controlla le evidenze di pagamento prima di eliminare le rate.
3. L’invariante business “una quota per atleta, attività e stagione” non risulta applicato dal modello o dalla generazione: il warning 360° individua più piani per attività ma non previene doppie emissioni.
4. L’uso economico di `paid_at` e quello visuale di `status === 'paid'` sono divergenti; serve una diagnostica esplicita prima della normalizzazione.

Resta da verificare in un goal separato lo schema staging effettivo rispetto alle migration: il report storico segnala divergenze fra colonne/stati usati dal codice e migration versionate. Nessuna query live è stata eseguita per questo documento.

## 3. Matrice comparativa delle funzionalità

Legenda: **presente** = flusso osservabile nel codice; **parziale** = esiste ma ha lacune o semantica diversa; **assente** = non esposto; **non verificato** = presente solo come affordance visiva o mancano dati/prova.

| Funzionalità | Quote → Atleti | Incassi | Duplicazione / coerenza e funzionamento | Collocazione target |
|---|---|---|---|---|
| Visualizzazione quote assegnate agli atleti | Rate filtrabili per stagione/squadra; non è un assignment esplicito | Piano mostrato sulle righe rata | Entrambe leggono `fee_installments`; l’associazione effettiva è dedotta dalle rate. Più righe o squadre non provano da sole una doppia quota: verificare duplicazione della stessa business key rispetto a distinti `membership_fee_id` nella stessa attività/stagione | Incassi per elenco; 360° per vista individuale. Quote resta il catalogo |
| Unica quota per disciplina/stagione | Non applica un vincolo per attività: il piano è team-scoped e può generare rate per i membri della squadra | Filtra per piano/team/stagione; non impedisce emissioni parallele per due team della stessa attività | Invariante business non applicato al modello corrente. Distinguere: duplicato visuale (stessa rata contata due volte per join/membership) da doppia quota reale (due piani e rate distinti per atleta, stessa attività e stagione). Il 360° segnala piani multipli per attività, ma non li risolve né ne dimostra sempre la correttezza | Regola dominio da applicare a preview/generazione e diagnostica. Nel breve: rilevare e segnalare, nessuna deduplica o modifica dati automatica |
| Elenco rate | `GET /api/admin/installments`, layout tabella/card | `GET /api/admin/incassi/installments`, tabella raggruppabile e paginata | Contratti e implementazioni duplicati; Quote carica righe base e arricchisce dopo; Incassi seleziona relazioni annidate | Un solo loader/contratto di dominio; una tabella operativa in Incassi |
| Ricerca | Selettore dipendente da squadra (verificare comportamento completo sul codice UI) | Ricerca testuale per nome, cognome, email | Non equivalenti; Incassi è più efficace per uso operativo. Attenzione ai filtri PostgREST su relazioni annidate | Incassi |
| Filtri squadra | Sì, selezione singola | Sì, multi-select | Contratti diversi; Incassi interseca i team richiesti con i team della stagione | Incassi, con stagione come contesto esplicito |
| Filtri piano | Indiretto via contesto squadra / quota | Sì, multi-select di `membership_fee_id` | Incassi più granulare | Incassi |
| Filtri stato | Sì | Sì, multi-select | Stati e default da uniformare; il tipo `partially_paid` esiste nel codice ma non rappresenta un importo residuo parziale affidabile | Incassi, con definizione server-side condivisa |
| Gestione stagioni | Selettore stagionale; Quote risolve stagione dal team/attività | Selettore stagione e opzione tutte le stagioni | Entrambi risalgono `membership_fees → teams → activities → season`, ma risolvono/filtrano in modo diverso. KPI e 360° hanno default/contesto stagionale distinti | Incassi; la query deve applicare stessa definizione di stagione del 360° |
| Stati rate | Mostra `paid`, `overdue`, `due_soon`, altrimenti `not_due`; ricalcolo massivo disponibile | Filtri e badge includono anche `partially_paid` | Il ricalcolo Quote è una mutation bulk; Incassi non ricalcola. KPI usa `status` se valorizzato, e deriva da data solo se status null | Stato canonico da servizio puro condiviso; ricalcolo esplicito/auditabile |
| Pagamento singolo | `update_installment_status` segna paid, timestamp corrente | Non esposto: solo selezione bulk | Duplicazione concettuale ma differente metadata; Quote scrive attore/source, Incassi consente data scelta. Il percorso singolo non è una vera transazione/ledger | Incassi, azione singola e bulk dallo stesso servizio/mutation |
| Pagamento multiplo | `bulk_update_installments` marca paid con timestamp corrente | `POST /api/admin/incassi/payments`, data e metodo nel form | Entrambi aggiornano rate, ma Incassi raccoglie il metodo e lo scarta senza persisterlo; le mutation non garantiscono atomicità bulk e l’endpoint Incassi può produrre 207 dopo aggiornamenti parziali | Incassi; preservare data, comunicare parziali, non mostrare metodo come dato conservato finché non esiste modello |
| Modifica importo/scadenza rata | `update_installment_details` nel Route Handler Quote | Assente | Feature reale solo in Quote. Non risulta nel handler un divieto di modifica per rata pagata né audit specifico: da mettere in sicurezza prima del trasferimento | Incassi, con guardrail e audit per rate pagate |
| Annullamento/rettifica pagamento | `reverse_installment_payment`, motivo obbligatorio, audit `repair_required`; azione solo per rata `paid` | Assente | Feature recente, critica da trasferire senza cambiare semantica. Se audit fallisce, la rata resta rettificata e viene segnalato `auditRecorded: false` | Incassi, azione per rata singola, motivo e feedback esplicito |
| Rimozione quota da singolo atleta | Azione DELETE dedicata da Quote > Atleti; blocca se esiste stato/evidenza pagamento | Assente | Non è un semplice filtro UI: elimina tutte le rate non pagate di coppia profilo/piano. È separata dalla rimozione membership squadra | Decidere se trasferirla a Incassi come “rimuovi piano non pagato”; non consentirla come cancellazione implicita |
| Generazione rate | Azione contestuale al piano su `/api/admin/membership-fees` | Assente | Inserisce per tutti i `team_members` del team senza filtro `role='athlete'`; insert non idempotente. Deve essere ripensata prima di esporla come azione operativa generale | Conservare in Quote come azione contestuale “genera rate da questo piano”, con preview, idempotenza e controllo ruolo; Incassi può offrire accesso/link |
| CRUD piani e template | Sì: crea/modifica/elimina, template rate predefinite | Assente | Di pertinenza catalogo; PUT cancella e ricrea template senza controllare tutti gli errori e non modifica direttamente rate già emesse | Quote — configurazione |
| Esportazione Excel/CSV | Export Excel presente nel manager, ma esporta il catalogo `fees` (non l’elenco operativo rate); nessun export rate provato | Pulsante “Esporta CSV” presente in `BulkActionsBar`, nessun handler prop o implementazione trovata | Export Incassi è solo visuale/non funzionante; non dichiarare Excel Quote come export rate | Incassi deve avere export CSV/XLSX delle righe filtrate; specificare se tutte le pagine o l’intero risultato |
| KPI e riepiloghi economici | Nessun riepilogo operativo nel tab Atleti | KPI per stati, totale, tasso di incasso | Solo Incassi. `total_paid` e 360° usano `paid_at`; la card “Pagate” conta invece `status='paid'` quando non null | Incassi; derivare importi da un’unica regola e rendere chiaro il perimetro filtri/stagione |
| Dettaglio e storico atleta | Il manager mostra dettagli rata/piano e azioni; niente drawer individuale consolidato | Drawer client-side autonomo con profilo, squadre, rate e finto storico da rate pagate (`method: Registrato`) | Ora duplicato rispetto a 360°. Il drawer non ha filtro stagione; ricava la cronologia dalle rate con `status='paid'`, mentre importi KPI/360° usano `paid_at` | 360° dall’elenco atleti, eventualmente richiamato da Incassi con stagione selezionata; eliminare il drawer solo dopo parity |
| Dettaglio Atleta 360° | Non integrato nel tab, accessibile da `/admin/atleti` | Non integrato; usa drawer legacy | Il 360° è il nuovo dettaglio read-only stagionale; non ha azioni di pagamento/modifica e non carica dati di una stagione se è selezionato “tutte” | Vista individuale read-only e navigazione contestuale; mutation restano in Incassi |
| Navigazione verso piano quota | Il piano è già nel contesto della schermata, con link/espansione da verificare | Piano mostrato come testo; nessuna navigazione al catalogo trovata nei componenti esaminati | Il 360° espone nome piano/team ma nessuna azione; al momento il passaggio fra contesto operativo e configurazione è poco esplicito | Link “Apri configurazione piano” da Incassi, con permesso admin e stagione/team coerenti |

### Collocazione della generazione

La generazione è un’operazione sul piano/template, non una registrazione d’incasso. Raccomando di mantenerla in Quote, vicina al piano, ma con anteprima dei profili interessati, conteggio delle rate già emesse e scelta esplicita dei soli atleti (no coach/altre membership). Deve essere idempotente e rifiutare o segnalare in modo deterministico i conflitti. Incassi può mostrare l’esito/collegamento alla configurazione senza duplicare la logica di generazione.

## 4. Calcoli e fonti economiche

### Fonte attuale

- Quote e Incassi leggono/scrivono `fee_installments`.
- L’importo dovuto corrente è la somma di `fee_installments.amount` nel perimetro selezionato.
- KPI Incassi considera pagato un importo rata intero se `paid_at` è valorizzato; il residuo aggregato è quindi `total_amount - total_paid`.
- Il 360° usa la stessa regola `paid_at` per calcolare `totale pagato` e `residuo`.
- La tabella Incassi mostra residuo zero quando `status === 'paid'`, altrimenti l’intero importo. Quindi una discordanza fra `status` e `paid_at` può creare una terza cifra visibile.
- Il drawer Incassi calcola il pagato con `status === 'paid'` e costruisce lo storico da rate con quello status; non è coerente con KPI/360° se i campi sono discordanti.
- `partially_paid` è una categoria nominale: non c’è importo pagato parziale memorizzato e il 360° esplicita che non stima un importo. Non va usata per sottrarre un valore ipotetico.

### Regola da consolidare e diagnostica obbligatoria

Nel primo consolidamento mantenere l’attuale semantica economica (`paid_at` valorizzato = importo rata intero incassato), ma prima di ogni migrazione UI/API generare e conservare un controllo diagnostico obbligatorio delle incoerenze, senza correzioni automatiche. Includere almeno: `paid_at IS NOT NULL AND status <> 'paid'`, `status = 'paid' AND paid_at IS NULL`, residuo/tabella/KPI divergenti e stati non riconosciuti. Il report deve indicare conteggio e identificativi delle rate da esaminare, con accesso admin, senza esporre dati non necessari. La normalizzazione di stato resta separata dalla regola degli importi.

Non trattare `payments` come registro entrate: nel codice e nella snapshot storica rappresenta pagamenti in uscita, prevalentemente ai coach. Il metodo raccolto dal PaymentModal non è persistito; l’interfaccia non deve promettere uno storico di metodo che il modello non conserva. La costruzione futura di un ledger entrate/ricevute richiederebbe un goal di dominio separato.

## 5. Mappa duplicazioni: componenti, API, query

| Dominio | Implementazione Quote | Implementazione Incassi / 360° | Azione nel consolidamento |
|---|---|---|---|
| Lista rate | `MembershipFeesManager.tsx` → `loadFlatInstallments()` → `/api/admin/installments` | `InstallmentsManager.tsx` → `loadInstallments()` → `/api/admin/incassi/installments` | Un servizio query comune e un DTO tipizzato; mantenere temporaneamente entrambi gli endpoint come adapter compatibili |
| Join atleta/piano/team | API Quote fa query multiple su `fee_installments`, `membership_fees`, `teams`, `profiles`, poi arricchisce e pagina in memoria | API Incassi usa relazione Supabase annidata e filtri/paginazione PostgREST | Una definizione di projection/contract comune; verificare comportamento dei filtri relazionali e ordinamento stabile |
| KPI | Non presenti nella tab Atleti | `/api/admin/incassi/kpi` effettua query aggregata e conteggi client-side | Estrarre aggregazione economica/status; chiarire che i KPI sono di stagione, non seguono tutti i filtri tabella |
| Pagamento | PATCH membership-fees per singolo/bulk | POST incassi/payments per bulk | Un servizio/mutation controllato con condizione sullo stato iniziale, attore, timestamp e risposta parziale definita |
| Rettifica | PATCH membership-fees con audit | Non disponibile | Trasferire comportamento e audit, non duplicarlo |
| Modifica rata | PATCH membership-fees | Non disponibile | Trasferire con regole/audit e test; mantenere route adapter finché i client vecchi esistono |
| Piano/template | CRUD + PATCH su membership-fees | Nessuna | Restare nel dominio Quote; non inglobare nel servizio Incassi |
| Dettaglio atleta | Dati parziali nel manager Quote | `incassi/AthleteDetailDrawer.tsx` query client-side indipendenti; nuovo `Athlete360Details.tsx` usa API dedicata | 360° come unico drawer/pattern; dettaglio economico va estratto/riutilizzato senza query parallele |
| Status | helper `getUnpaidInstallmentStatus` usato dalla rettifica; ricalcolo nella route | duplicazione nella KPI se status null; badge usa il campo status | Definire un helper canonico con test di date/status; la KPI non deve reimplementare logiche diverse |

Servizio candidato (solo server, senza nuovo endpoint o schema in questa fase): funzioni query con parametri espliciti stagione/team/piano/stato/date/ricerca/paginazione, aggregazione, registrazione pagamento, rettifica e modifica rata. Il servizio non deve essere una nuova fonte di verità: legge e muta le stesse `fee_installments`, mantiene i check di ruolo nelle Route Handler e non usa cache client come autorizzazione. Prima si crea il servizio senza cambiare payload o comportamento osservabile; poi si migra un endpoint per volta.

## 6. Rischio di perdita funzionale se si rimuove Quote → Atleti ora

1. Modifica manuale dell’importo e della scadenza per una rata emessa.
2. Rettifica singola di pagamento con motivo obbligatorio e registrazione audit.
3. Marcatura singola di una rata come pagata.
4. Rimozione controllata delle rate non pagate di un atleta da uno specifico piano.
5. Filtri semplici usati dal tab Quote e possibilità di osservare l’elenco completo senza la paginazione Incassi.
6. Azione esplicita di ricalcolo degli stati rate.
7. Contesto piano/template e azione di generazione (che deve restare accessibile in Quote anche dopo rimozione tab).
8. Dati ricevuti/data registrazione del pagamento: Incassi consente scegliere una data, Quote usa timestamp corrente; va definita e mantenuta una semantica unica.
9. Dati metodo pagamento: il modal Incassi li chiede ma backend non li salva; nessuna funzione esistente affidabile deve essere descritta come storico di metodo.
10. Possibilità di correggere errori storici: la rettifica è un’operazione amministrativa auditata e non va confusa con rimborso/cancellazione economica.

## 7. Architettura target raccomandata

### A. Quote — configurazione

Mantenere in `/admin/membership-fees`:

- catalogo piani associati a squadre e stagione derivata;
- configurazione importi e rate predefinite;
- creazione/modifica dei piani;
- generazione rate contestuale al piano, dopo averla resa filtrata agli atleti, idempotente, verificabile e sicura rispetto alle rate esistenti;
- report/avvisi sul numero di rate già emesse quando si modifica un template.

Eliminare il tab operativo `Atleti` solo dopo parity funzionale in Incassi e al superamento dei gate di accettazione del Goal 7. Non cancellare l’endpoint `/api/admin/membership-fees`: contiene operazioni del catalogo oltre a mutation rate che dovranno essere migrate separatamente.

### B. Incassi — operatività unica

Rendere `/admin/incassi` il solo luogo per:

- rate emesse, pagato/residuo, scadenze/arretrati;
- ricerca, stagione, squadre, piani, stato, intervallo date e paginazione;
- registrazione pagamento singolo e multiplo con data esplicita;
- modifica scadenza/importo con permessi/guardrail;
- rettifica singola motivata e auditata;
- eventuale rimozione di una quota atleta non pagata, con conferma esplicita e regole di Quote attuali;
- export effettivo del risultato filtrato;
- riepilogo economico e KPI.

Per ridurre la densità: intestazione compatta con selettore stagione e ricerca; riepilogo KPI in una sezione collassabile/secondaria o una fascia sintetica che espone totale dovuto, incassato, residuo e scaduto; filtri avanzati in pannello richiudibile; tabella come area primaria; barra bulk visibile solo a selezione. I KPI devono dichiarare il loro perimetro (stagione e filtri applicati o non applicati) e non confondere conteggi con importi. L’export deve dichiarare se copre la pagina corrente o l’intero dataset filtrato; raccomandato l’intero risultato filtrato con limiti/streaming gestiti server-side se i volumi lo richiedono.

### C. Dettaglio Atleta 360° — vista individuale

Mantenere `/admin/atleti` come punto di accesso alla scheda 360° per identità/account, stagione, squadre, quote/rate effettivamente emesse e dati documentali disponibili. Dal clic atleta in Incassi si deve aprire il 360° con stagione corrente e profilo già selezionati, oppure un pannello composito che riusa lo stesso contratto/servizio; evitare query autonome e un terzo calcolo economico.

Il 360° attuale è read-only e non deve assorbire le mutation operative. Aggiungere azioni amministrative lì solo se un goal dedicato ne giustifica il contesto e se chiamano il servizio centrale. Conservare il fatto che le quote nel dettaglio sono piani dedotti da rate esistenti, non assegnazioni esplicite persistite.

### Backend e schema

- Un servizio di dominio condiviso può alimentare Incassi e 360° e mantenere adapter API durante la transizione.
- Non aggiungere endpoint né schema nel presente goal.
- Non proporre una tabella `payments` come ledger entrate; nessuna relazione ricevuta-rata è dimostrata.
- Un assignment storico atleta-piano resta una decisione architetturale separata: è necessario per un vero cambio quota/assegnazione esplicita, ma non è un prerequisito per consolidare le due viste senza cambiare il modello attuale. Non confondere `team_members` con assignment economico.
- Qualunque query di stagione deve usare la stagione della squadra/piano e rispettare `fee_installments` come storico anche quando la membership corrente cambia.

## 8. Operazioni rischiose e contromisure proposte

| Operazione attuale | Rischio verificato nel codice | Protezione prima/durante il consolidamento |
|---|---|---|
| DELETE piano (`membership-fees` DELETE) | Cancella template e tutte le rate associate senza controllare errori intermedi o stato pagato; può distruggere storico economico. Le FK possono cascatare ulteriormente | Sospendere/eliminare la cancellazione fisica come requisito di prodotto; introdurre archivio/soft-delete o blocco con preview e policy esplicita. Prima di ogni rollout acquisire baseline e testare rate paid; rollback dati da backup, non da UI |
| Modifica piano/template (PUT) | Elimina e reinserisce template; errori delete/insert vengono ignorati e il successo può riferire un aggiornamento parziale. Rate emesse non vengono ricalcolate | Separare modifica catalogo da rate emesse; controllare errori e atomicità. Mostrare impatto; non aggiornare retroattivamente rate o importi già incassati |
| Generazione rate (`PATCH generate_installments`) | Insert non idempotente; unique conflict può fallire; legge tutti i membri team senza filtro ruolo | Preflight/preview dei candidati, soli athlete, chiave business univoca, idempotenza e reporting dei conflitti; test per team/season multipli |
| Assegnazione massiva atleta-team (`athletes/bulk`) | Elimina rate del piano selezionato prima di reinserirle; rischio perdita se rate pagate o errore successivo; può produrre coesistenza di più piani | Separare membership sportiva da assegnazione economica; vietare delete di rate pagate; operazione transazionale con preflight e audit prima di esporre cambio piano |
| DELETE quota singolo atleta | Il nuovo handler verifica evidenze pagamento e blocca; cancella però le rate non pagate una coppia profilo/piano alla volta | Mantenere guardia server-side, aggiungere count/preview e audit di cancellazione; test concorrenza e stati ambigui |
| Pagamento bulk Incassi | Aggiorna una rata alla volta, può restituire 207 e lasciare subset aggiornato; non condiziona l’update sullo stato iniziale; metodo non persistito | Definire atomico vs per-item esplicito; aggiornare solo rate non paid con condizione; riportare IDs aggiornati/falliti; test retry/idempotenza e doppio invio |
| Pagamento singolo/bulk Quote | Sovrascrive stato e timestamp senza condizione per stato iniziale; timestamp corrente invece di data scelta | Servizio comune con guardia stato, attore e timestamp espliciti; audit di rettifica separato da registrazione ordinaria |
| Rettifica pagamento | Update rata e scrittura audit non sono atomici; se audit fallisce la rettifica è già avvenuta (UI lo segnala) | Migrare senza cambiare comportamento subito; poi RPC/transazione o coda affidabile; evidenziare stato audit mancante e fornire report riparabile |
| Modifica importo/scadenza | Aggiorna senza controllo stato pagato/attore/audit; può alterare un importo storico | Consentire con policy definita; rate pagate immutabili per impostazione predefinita o richiedere rettifica/audit specifico; test storico |
| Ricalcolo status | Aggiornamenti bulk su tutte le rate non pagate; sequenza di query non atomica e condizioni solo sullo status | Funzione pura + mutation idempotente, protezione `paid_at IS NULL`, snapshot prima/dopo e test confini date/timezone |
| Pagamento `partially_paid` | Stato senza importo parziale registrato; residuo e incasso non dimostrabili | Non generare pagamenti parziali fittizi; conservare stato storico con avviso e residuo rata intera finché il modello non supporta importi |

Il servizio admin privilegiato deve essere creato solo dopo il controllo admin, e ogni route deve continuare a validare input e ownership/ambito di stagione. Gli update client non devono diventare autorizzazione. No modifica a schema, RLS o dati nello scope di questo piano.

## 9. Piano incrementale di implementazione

La sequenza seguente mette in sicurezza prima i dati economici e separa ogni gruppo di mutation. Ogni goal lascia l’applicazione utilizzabile, non cancella automaticamente dati esistenti e non introduce un ledger, assignment table o migrazione a TanStack Query. Aggiornare il piano a ogni goal completato.

### Goal 0 — Financial Safety Hotfix (priorità alta)

**Scopo:** impedire perdita o alterazione accidentale di dati economici prima del refactoring, senza redesign né modifica automatica delle righe esistenti.

- **Modifiche:** bloccare la DELETE fisica di un piano se esistono rate associate (in particolare pagate o con qualsiasi evidenza di pagamento); per prudenza raccomandare il blocco di ogni piano con rate emesse e mantenere eliminabile solo un piano mai usato. Proteggere assegnazione massiva e generazione da delete/reinsert delle rate già esistenti; non sovrascrivere né ricreare rate pagate. Aggiungere preflight e feedback esplicito dei conflitti. Rilevare duplicati reali atleta-attività-stagione e incoerenze `paid_at`/`status`, solo read-only.
- **File coinvolti:** `src/app/api/admin/membership-fees/route.ts`, `src/app/api/admin/athletes/bulk/route.ts`, `src/app/api/admin/athletes/[profileId]/membership-fees/[membershipFeeId]/route.ts`, helper server-side e test mirati. UI minima di errore/conferma solo se necessaria.
- **DB/staging:** nessuna modifica schema o dati; staging resta read-only. Aggiungere test applicativi locali/unit/integration usando fixture, non eseguire mutation staging.
- **Dipendenze:** nessuna; partire da codice attuale e fixture storica.
- **Rischi:** assegnazione esistente può dipendere dal comportamento distruttivo; bloccarla può richiedere intervento manuale. Il report deve distinguere rate identiche duplicate da piani diversi realmente emessi nella stessa attività/stagione.
- **Test:** DELETE piano senza rate (consentita); DELETE con rate unpaid/paid/evidenza di pagamento (bloccata); assignment ripetuto e piani distinti; preservazione byte-per-byte dei dati esistenti in caso di conflitto; ruoli non-admin; diagnostica anomalie senza scritture.
- **Accettazione:** nessuna operazione del percorso protetto elimina o riscrive rate pagate/esistenti; admin riceve un esito comprensibile; staging e dati non sono cambiati; report anomalie distingue doppio conteggio visuale da doppia emissione economica.
- **Rollback:** revert del solo guard/validation mantenendo i test; il rollback non richiede ripristino dati perché il goal non esegue cancellazioni né corregge record. Non ripristinare mai il comportamento di delete rate pagate senza una decisione esplicita.

### Goal 1 — Servizio economico condiviso e baseline read-only

**Scopo:** unificare lettura, aggregazione, calcolo economico e diagnostica senza cambiare il comportamento osservabile degli endpoint.

- **Modifiche:** estrarre DTO e servizi server-side per lista/enrichment, filtri, KPI, riepilogo 360° e lettura economica usata dal Bilancio; mantenere endpoint e payload attuali come adapter. Aggiungere report diagnostico per incoerenze `paid_at`/`status` e per possibili doppie quote atleta-attività-stagione, senza correzioni. Aggiornare baseline aggregata staging in sola lettura includendo i valori del Bilancio.
- **File coinvolti:** `src/app/api/admin/installments/route.ts`, `src/app/api/admin/incassi/installments/route.ts`, `src/app/api/admin/incassi/kpi/route.ts`, `src/app/api/admin/balance/route.ts`, route dettagli atleta, nuovo `src/server/admin/fee-installments/*` e test, incluso un test della route Bilancio.
- **DB:** nessuna modifica; interrogazioni staging solo SELECT/lettura schema.
- **Dipendenze:** Goal 0; disponibilità di accesso staging in sola lettura già autorizzato/configurato, senza eseguire scritture.
- **Rischi:** drift nel join, nei filtri o nella definizione della stagione; scambiare più piani per duplicato senza guardare activity/team; cambiare involontariamente le cifre Bilancio, che oggi classifica consuntivo/previsioni/arretrati usando `status` (non `paid_at`). Verificare e documentare il perimetro `profile_id` del Bilancio: non modificarlo in questo goal senza un goal dedicato.
- **Test:** parity endpoint su fixture, conteggi/somme, permessi, filtri e paginazione; parity del Bilancio su entrate effettive/previste/scadute, uscite e totali; mantenimento del criterio corrente `status` per i numeri del Bilancio; casi con mismatch `paid_at`/`status`; verifica del perimetro delle rate incluso; diagnostica dei due tipi di anomalia e prova che non scrive.
- **Accettazione:** payload e risultati normali di Quote, Incassi, 360° e Bilancio invariati; report staging datato e comparabile con baseline 14 ottobre, con aggregati Bilancio; mismatch enumerati senza fix automatici. Nessun cambiamento alla regola del Bilancio in questo goal.
- **Rollback:** ripristino degli handler legacy; nessuna migrazione o scrittura da annullare.

### Goal 2 — Mutation pagamenti (singolo e bulk)

**Scopo:** rendere coerente la registrazione pagamenti e definire in modo esplicito i fallimenti parziali.

- **Decisione bulk:** mantenere esito **per rata**, non atomicità globale. Ogni rata viene condizionata sullo stato osservato/non pagato; risposta riporta separatamente aggiornate, già pagate/conflitto e fallite. HTTP/status e UI non devono dichiarare successo totale quando solo un sottoinsieme è stato aggiornato. Il retry è idempotente e non cambia timestamp/attore delle rate già pagate. Questa scelta evita una transazione cross-row/schema nuova e rende i risultati parziali affidabili e ripetibili.
- **Modifiche:** consolidare pagamento singolo e bulk in un servizio; accettare la data pagamento esplicita; mantenere audit/actor/source già supportati. Non salvare o promettere il metodo se schema non lo supporta.
- **File coinvolti:** route `/api/admin/incassi/payments`, PATCH membership-fees, manager/PaymentModal e validazioni pertinenti.
- **DB:** nessuna modifica.
- **Dipendenze:** Goal 1; mantenere il tab Quote disponibile.
- **Rischi:** concorrenza e retry possono restituire conflitto anziché successo; UI deve spiegare esiti per-riga.
- **Test:** singolo, bulk multi-atleta, una riga già paid, errore su una riga, concorrenza, retry, attore/data, nessun update su `paid_at` incoerente già presente.
- **Accettazione:** risposta enumera ogni ID e relativo esito; nessun pagamento già registrato viene sovrascritto; comportamento equivalente in entrambe le UI durante la convivenza.
- **Rollback:** mantenere endpoint legacy e possibilità di usare la mutation Quote, con le stesse guardie conservative.

### Goal 3 — Rettifiche e gestione rate

**Scopo:** spostare in Incassi le mutation critiche non relative alla registrazione ordinaria.

- **Modifiche:** separare e trasferire rettifica pagamento motivata/auditata; modifica importo/scadenza con regole esplicite e audit; rimozione piano da singolo atleta con preflight, conferma e divieto di cancellare evidenze pagate. Definire audit failure e gestione dei conflitti prima di migrare la UI.
- **File coinvolti:** route `/api/admin/membership-fees`, nuovo servizio mutation, route Incassi, componenti tabella/dialog Quote e Incassi.
- **DB:** nessuna modifica in questo goal; se l’atomicità audit non è ottenibile senza transazione/schema, mantenere esito `auditRecorded` visibile e report riparabile, senza mascherare il successo parziale.
- **Dipendenze:** Goal 0–2.
- **Rischi:** modifica di importi storici, audit non scritto, delete di rate unpaid con storico amministrativo incompleto.
- **Test:** rettifica con motivo/status/concorrenti, audit success/failure, modifica pagata/non pagata, importi/date invalidi, rimozione e preservazione rate paid, permessi.
- **Accettazione:** Incassi offre tutte le operazioni necessarie con guardie/audit; Quote resta disponibile; nessuna mutation altera importo già incassato senza percorso auditato.
- **Rollback:** mantenere mutation legacy e riattivare UI Quote; nessun cleanup di endpoint finché Incassi non passa parity.

### Goal 4 — Mock e gerarchia operativa Incassi (solo design)

**Scopo:** concordare densità e gerarchia prima di cambiare la UI. Nessuna mutation/backend in questo goal.

- **Gerarchia proposta:** 1) titolo e contesto stagione; 2) azione principale “Registra pagamento” solo quando ci sono selezioni; 3) riga riepilogo economico compatta con dovuto/incassato/residuo/scaduto e perimetro dichiarato; 4) ricerca immediata sempre visibile; 5) filtri avanzati chiudibili per squadra, piano, stato e scadenza; 6) tabella rate come area primaria; 7) selezione bulk e export come strumenti contestuali; 8) accesso al 360° dall’atleta e alla configurazione dal piano. Il riepilogo generale resta distinto dai risultati filtrati, salvo che il mock espliciti una scelta diversa.
- **Deliverable:** mock/wireframe desktop e mobile con stati normale, filtri espansi, selezione bulk, nessun risultato e viewport stretto; note su azioni distruttive e focus.
- **File:** documento/mock UX e, se necessario, superficie Figma in goal dedicato; nessun file funzionale.
- **Dipendenze:** osservare la UI corrente e requisiti dei Goal 2–3; non richiede schema.
- **Accettazione:** gerarchia comprensibile, densità ridotta senza perdita di azioni; approvazione del mock prima della fase di implementazione.
- **Rollback:** non applicabile al prodotto; scartare o iterare il mock senza impatto applicativo.

### Goal 5 — Implementazione redesign Incassi ed export

**Scopo:** implementare esclusivamente il mock approvato e un export realmente funzionante.

- **Modifiche:** adottare la gerarchia approvata, export dell’intero risultato filtrato con ambito esplicito, accesso alla configurazione piano e tutte le funzioni operative già completate nei Goal 2–3.
- **File coinvolti:** `InstallmentsManager.tsx`, componenti `incassi/*`, route export solo se necessaria; nessuna nuova logica economica.
- **DB:** nessuna modifica.
- **Dipendenze:** Goal 2–4; mock approvato.
- **Rischi:** export non corrispondente a filtri/KPI o regressioni responsive.
- **Test:** export rispetto ai filtri/paginazione dichiarati, permessi, accessibilità, desktop/mobile, flussi pagamenti/rettifiche già coperti.
- **Accettazione:** pagina meno densa e azioni ordinate secondo mock; export contiene tutte e solo le righe del perimetro dichiarato.
- **Rollback:** ripristinare componenti precedenti; mutation/API restano invariate.

### Goal 6 — Integrazione Dettaglio Atleta 360°

**Scopo:** rimuovere il drawer finanziario duplicato mantenendo atleta, stagione e contesto selezionati.

- **Modifiche:** apertura 360° da Incassi usando atleta e stagione corrente; riuso del servizio/DTO comune; nessuna mutation dentro il dettaglio read-only. Se la stagione è “tutte”, chiedere/selezionare un contesto o mostrare un overview esplicito, senza mescolare stagioni.
- **File coinvolti:** `Athlete360Details.tsx`, route dettaglio atleta, helper `athlete-detail.ts`, `InstallmentsManager.tsx`, drawer legacy rimosso solo dopo parity.
- **Dipendenze:** Goal 1–5.
- **Test:** più squadre stessa attività, discipline diverse, più piani, assenza quota, stagione e contesto atleta preservati, mismatch paid_at/status.
- **Accettazione:** singola implementazione di dettaglio individuale; nessun doppio conteggio e nessuna perdita di contesto.
- **Rollback:** riaprire temporaneamente il drawer legacy senza cancellare API o dati.

### Goal 7 — Cleanup e rimozione Quote → Atleti

**Scopo:** rimuovere duplicazioni solo dopo piena equivalenza e controlli.

- **Modifiche:** rimuovere tab, UI e API usate esclusivamente dalla vista Atleti; separare le route miste mantenendo CRUD/template/generazione piano in Quote.
- **Dipendenze:** Goal 0–6, suite completa verde, baseline staging read-only aggiornata, nessuna anomalia non spiegata che falsi il confronto.
- **Accettazione:** nessuna feature indispensabile resta solo in Quote > Atleti; KPI/importi e risultati aggregati equivalenti; tutti i consumer censiti.
- **Rollback:** ripristino del tab e degli adapter dalla revisione precedente; nessun rollback dati perché non si effettuano delete economiche.

### Goal operativi pronti per Codex Luna Medium

1. **Goal 0 — Financial Safety Hotfix.** Ispeziona delete piano, assegnazione bulk e generazione. Blocca le operazioni che possono cancellare/sovrascrivere rate già emesse o pagate; consenti cancellazione fisica soltanto per piani senza rate, salvo policy più conservativa. Non modificare automaticamente righe esistenti e non scrivere su staging. Aggiungi test per paid/unpaid/conflict/admin e diagnostica read-only delle doppie quote atleta-attività-stagione e degli mismatch `paid_at`/`status`; distingui duplicati visuali da doppia emissione reale. Aggiorna il piano e fermati.
2. **Goal 1 — Servizio economico condiviso e baseline.** Estrai query, DTO, aggregazioni e diagnostica comuni mantenendo invariati i payload delle API di Quote, Incassi, 360° e Bilancio. Includi `/api/admin/balance` nei test di parity: conserva il calcolo attuale basato su `status` e verifica il perimetro delle rate senza modificarlo. Leggi staging solo in modalità read-only e aggiorna snapshot/report con aggregati del Bilancio; non correggere anomalie. Testa parity e assenza di scritture.
3. **Goal 2 — Mutation pagamenti.** Unifica pagamento singolo e bulk con esito per-rata, guardia stato, attore e data; applica la decisione di fallimento parziale riportata nel piano. Testa concorrenza, retry e una selezione mista di rate eleggibili/conflittuali. Lascia intatta la UI Quote.
4. **Goal 3 — Rettifiche e gestione rate.** Trasferisci rettifica auditata, modifica importo/scadenza e rimozione atleta-piano con preflight e guardie. Non alterare rate pagate senza audit esplicito; mantieni le UI legacy e tratta l’audit failure in modo visibile. Non modificare schema/dati.
5. **Goal 4 — Mock Incassi.** Produci wireframe desktop/mobile seguendo la gerarchia specificata, includendo tabella, KPI, ricerca, filtri richiudibili, azioni bulk/export e stati vuoti. Nessun codice prodotto; fermati al mock e annota decisioni aperte.
6. **Goal 5 — Redesign Incassi ed export.** Implementa solo il mock approvato e export completo del perimetro dichiarato. Non cambiare contratti economici; testa export, responsive, accessibilità e flussi già migrati. Mantieni Quote > Atleti.
7. **Goal 6 — Dettaglio 360°.** Integra Incassi col 360° riusando stagione e atleta selezionati; rimuovi drawer legacy solo dopo parity, senza portare mutation nel 360°.
8. **Goal 7 — Cleanup controllato.** Rimuovi tab/codice legacy solo dopo criteri di equivalenza, test e nuova baseline read-only; preserva Quote configurazione/template/generazione. Se restano anomalie inspiegate o funzioni senza parity, non fare cleanup.

Eseguire un goal per volta; non saltare i gate e non raggruppare le fasi mutation o UI.

## 10. Strategia di test e rollback

### Regression suite richiesta prima del cleanup

- Snapshot di conteggi, somma rate pianificate, pagato e residuo per stagione/team/piano prima e dopo; confronto zero-diff per refactor senza comportamento. Includere perimetro e riepiloghi Bilancio: entrate effettive/previste/scadute, uscite e saldi per stagione e filtri principali.
- Diagnostica obbligatoria per `paid_at` discordante da `status`, stati sconosciuti e differenze fra importi KPI/tabella/360°/Bilancio; solo report, nessuna correzione automatica. Il Bilancio usa attualmente `status` per consuntivo, previsioni e arretrati: fixture e test devono fissare questo comportamento nel Goal 1.
- Doppie quote: distinguere raddoppio visuale (stessa business key duplicata da join/aggregazione) da doppia emissione reale (piani/rate differenti dello stesso atleta nella stessa attività e stagione); verificare disciplina/attività e non deduplicare automaticamente.
- Pagamento singolo e bulk, multi-atleta, retry, doppia submission, rate già pagate, esito parziale per-riga e attore admin; ogni ID deve avere risultato esplicito.
- Data pagamento selezionata rispetto al timestamp; metodo visibile come scelta non persistita/non storico.
- Rettifica: motivo obbligatorio, stato paid richiesto, concorrenza, ricalcolo stato scadenza, audit presente e audit fallito, nessuna semantica di rimborso.
- Modifica importo e scadenza: rata non pagata, rata pagata, importo zero/valore invalido, audit e immutabilità del pagato già riconosciuto.
- Atleta con più squadre nella stessa attività: nessuna moltiplicazione; più discipline: piani indipendenti; più piani stessa attività: warning, no dedup silenziosa.
- Atleta senza quota/rate; atleta con rate paid, overdue, due_soon e partially_paid nominale; residuo parziale non simulato.
- Cambio stagione: filtro team e piano coerente, profilo senza season_profile, piano di altra stagione non visibile nel 360°.
- Generazione ripetuta, membership ruolo non-atleta, piani/team multipli, conflitti unique e preservazione rate pagate.
- Permessi: admin, non-admin, sessione assente; ogni route/service privileged raggiungibile solo dopo `requireGlobalRole`.
- Ricerca email/nome, filtri combinati, paginazione e totale stabile; export include stesso perimetro filtrato, nessuna riga fuori stagione.
- Regressione storico: DELETE piano e cancellazioni bulk provate in staging solo con fixture isolata e autorizzazione dedicata futura; in questo goal staging resta read-only.
- UI: mock desktop/mobile prima del redesign; gerarchia KPI, filtri, tabella e azioni; Incassi → 360° preserva atleta/stagione; keyboard/focus drawer; errori loading/empty/denied distinti.

### Rollback

Per Goal 0–6 mantenere endpoint/componenti legacy in parallelo quando previsto, senza migration. Ogni passaggio deve poter ripristinare l’adapter/route e la UI da commit precedente; le mutation devono avere preflight/audit e non fare delete fisica di rate già emesse. Per Goal 7 il rollback è codice-only se nessun dato o schema viene modificato. Per qualsiasi successivo rollout di schema/dati, definire prima backup, snapshot economica, reversibilità della migration e procedura manuale di riparazione; il solo rollback Git non ripristina dati cancellati.

## 11. Rischi e decisioni aperte

1. **Baseline staging attuale:** snapshot e report sono del 14 ottobre; nessun dato live è stato ricontrollato. Prima di goal mutativi o cleanup serve nuova lettura read-only di schema, migration e aggregati.
2. **File baseline atteso:** il goal cita `docs/admin-financial-staging-baseline-2026-10-14.json`, ma la fixture è in `tests/fixtures/admin-financial-staging-baseline-2026-10-14.json`. Decidere se aggiungere un alias/documento in una fase documentale; non duplicare snapshot senza necessità.
3. **Delete piano:** decisione di prodotto necessaria fra blocco, archiviazione e cancellazione con policy di conservazione; allo stato non è sicura.
4. **Assignment atleta-piano:** modello attuale dedotto da rate; un vero cambio piano e una storia di assignment richiedono decisione architetturale dedicata. Non blocca la sola rimozione della vista duplicata se non si cambia la semantica di assegnazione.
5. **Metodo pagamento/ledger incassi:** il campo UI non è conservato; `payments` è uscita. Non promettere storico metodo o ricevute collegate senza modello/contratto dedicato.
6. **Stati legacy:** il report staging e le migration non chiariscono completamente gli status supportati; verificare schema effettivo prima di scrivere logica o migration.
7. **KPI e filtri:** Incassi KPI sono legati alla stagione ma non ai filtri di tabella. Conservare e comunicare chiaramente il perimetro o modificare intenzionalmente il comportamento con test e copy.
8. **Esiti parziali:** per i pagamenti bulk è stata scelta una risposta per rata con conflitti/errori espliciti e retry idempotente, senza atomicità globale. Per l’audit rettifica resta la limitazione attuale: se fallisce dopo la mutation, segnalare e rendere riparabile; eventuale transazione/RPC è fuori dal consolidamento senza decisione dedicata.
9. **Rimozione rate non pagate:** definire conservazione/audit anche per la rimozione atleta-piano, che oggi è distruttiva benché protetta sulle evidenze paid.
10. **Generazione piano:** confermare che includa solo atleti e stabilire come trattare già emesse, rate obsolete e piani duplicati della stessa attività.
11. **Quota unica attività/stagione:** regola di dominio definita; restano da decidere l’eccezione amministrativa per tariffe differenti fra team e come disambiguare discipline/attività equivalenti nei dati storici. Il primo hotfix deve solo segnalare.
12. **Mock UI:** la gerarchia proposta è specifica ma richiede validazione visuale desktop/mobile prima di implementare; il Goal 4 è un gate di design, non una fase di codice.

## 12. Risposte alla Definition of Done

- **Possiamo eliminare il tab Atleti da Quote?** Sì, come obiettivo finale, ma non adesso. Prima servono parity per modifica rata, rettifica, pagamento singolo/bulk, rimozione controllata, filtri e export; Incassi deve avere il 360° senza drawer duplicato.
- **Quali funzioni trasferire?** Modifica scadenza/importo, rettifica motivata con audit, pagamento singolo, ricalcolo stato se mantenuto, rimozione sicura atleta-piano; rendere l’export Incassi realmente operativo e mantenere navigazione verso piano. Il catalogo e la generazione contestuale restano in Quote.
- **Quali servizi/backend unificare?** Proiezione/enrichment rate, filtri/stagione, status, KPI/aggregazioni, registrazione pagamento, rettifica e modifica rata. Conservare adapter API durante migrazione.
- **Come mantenere una fonte di verità?** `fee_installments` resta la fonte corrente per rate/importi e `paid_at` la convenzione di pagamento economico verificata; `membership_fees`/`predefined_installments` restano catalogo/template. `payments` non è il registro entrate. Assignment esplicito è un problema separato.
- **Sequenza sicura?** Safety Hotfix e diagnostica → servizio condiviso + baseline staging read-only → mutation pagamenti → rettifiche/gestione rate → mock e redesign Incassi/export → integrazione 360° → cleanup con gate di equivalenza.
- **Test prima di cleanup?** Integrità importi e status in Quote, Incassi, 360° e Bilancio; mutation singole/bulk/rettifica/modifica; multi-team/multi-disciplina; senza quota; stagione; permessi; export/filtri; generation idempotente; assenza di cancellazione storico; parity del consuntivo/previsioni/arretrati Bilancio.

## 13. Esito del goal

Piano aggiornato sul branch `fix-quote` con le priorità di safety, anomalia quota unica, diagnostica economica obbligatoria, separazione delle mutation e mock UI come gate. Nessuna funzionalità, componente applicativo, route API, schema o dato staging è stato modificato. Restano da eseguire in goal successivi Goal 0–7; la baseline staging aggiornata richiede una lettura live esclusivamente read-only.

### Implementazione Goal 0 — 2026-10-29

**Stato:** implementato localmente; nessuna modifica schema o dati staging.

- `DELETE /api/admin/membership-fees` verifica prima l’esistenza di rate emesse e rifiuta con HTTP 409 (`FEE_HAS_ISSUED_INSTALLMENTS`) qualsiasi piano usato. Elimina il piano soltanto se non esistono rate materializzate; verifica anche gli errori nella rimozione dei template.
- Verifica successiva ha trovato che il pulsante Quote eliminava direttamente `membership_fees` via client Supabase e aggirava la route (e la FK `ON DELETE CASCADE` poteva cancellare le rate). `MembershipFeesManager` ora usa la DELETE API e mostra il testo di conflitto restituito.
- Generazione rate fa preflight sulle rate esistenti e rifiuta con HTTP 409 (`INSTALLMENTS_ALREADY_EXIST`) senza cambiarle. Nell’assegnazione massiva, le membership sportive vengono salvate anche se il piano selezionato ha rate già emesse; il risultato HTTP 409 distingue esplicitamente `teamAssigned: true` e `feeAssignmentBlocked: true`, senza riscrivere le rate. Il dry-run segnala il conflitto senza mutazioni.
- La UI ricarica gli atleti e azzera la selezione quando riceve questo esito parziale, così la membership appena salvata è visibile subito.
- La route di rimozione quota singolo atleta mantiene il guard esistente su status e metadati di pagamento; non è stata cambiata la policy di rimozione delle sole rate unpaid.
- Aggiunto `GET /api/admin/membership-fees/diagnostics`, protetto admin e sola lettura: segnala mismatch `paid_at`/`status`, possibili più piani emessi nella stessa chiave atleta-attività-stagione e righe duplicate identiche dello stesso piano. Rate diverse dello stesso piano non sono segnalate come anomalia. `multiple_issued_plans` è una doppia emissione potenziale da esaminare, distinta dalla duplicazione di una singola rata.
- Aggiunti test unitari della diagnostica. La fixture staging del 14 ottobre resta invariata e storica; nessuna connessione o scrittura staging eseguita.
- **Limite residuo:** i preflight e le delete non sono transazionali; una creazione concorrente esattamente tra controllo e DELETE richiederebbe un vincolo/RPC o lock DB, fuori scope senza schema change. Il nuovo blocco riduce il rischio nel normale percorso applicativo ma non offre serializzazione DB.

**File modificati:** route membership-fees, route athletes/bulk, nuova route diagnostics, helper/test fee-safety e questo piano.

**Verifica:** in seguito al test manuale del conflitto bulk, aggiunta regressione che verifica l’upsert della squadra e il blocco della rigenerazione delle rate. `npx jest --runInBand --runTestsByPath src/app/api/admin/athletes/bulk/route.test.ts` (6 test pass); ESLint sui file modificati, `npx tsc --noEmit` e `git diff --check` pass.
