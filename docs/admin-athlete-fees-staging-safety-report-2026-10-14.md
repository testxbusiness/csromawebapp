# Admin Quote / Incassi / Atleti — staging safety report

Data rilevata il 2026-10-14 sul progetto Supabase `csromawebapp-staging` (`kibtvkuiedoxgppnnxkf`), con query esclusivamente read-only.

## Verifica dell'ambiente reale

- Stato progetto: `ACTIVE_HEALTHY`, regione `eu-central-1`.
- PostgreSQL reale: `17.6.1.147` / engine 17.
- Migrazioni registrate: 70.
- Ultima migrazione rilevante: `20261001170720 athlete_enrollment_application_bulk`.
- RLS risultata attiva sulle tabelle finanziarie e sulle tabelle di relazione analizzate.
- Gli amministratori finanziari sono autorizzati tramite `private.has_account_role('admin')` sulle policy di `membership_fees`, `predefined_installments`, `fee_installments` e `payments`.

## Baseline aggregata

| Area | Conteggio / valore |
|---|---:|
| Profili / atleti | 15 / 5 |
| Season profiles | 18 |
| Stagioni / attività / squadre | 3 / 4 / 13 |
| Team memberships | 10 |
| Piani quota | 4 |
| Rate predefinite | 12 |
| Rate emesse | 12 |
| Pagamenti | 13 |
| Documenti ricevute | 0 |
| Relazioni profilo | 8 |
| Audit lifecycle account | 39 |

Stagioni:

- 2025/2026: 2 attività, 6 squadre, 3 piani quota, 9 rate, 12 season profiles; non attiva.
- 2026/2027: 1 attività, 4 squadre, 1 piano quota, 3 rate, 6 season profiles; attiva.
- 2027/2028: 1 attività, 3 squadre, nessun piano quota/rata/season profile; non attiva.

Stato rate: 6 `paid`, 5 `not_due`, 1 `overdue`. Totale pianificato `€1.744,50`, pagato `€900,00`, residuo non pagato `€844,50`.

Pagamenti presenti: 13 `coach_payment`, di cui 2 `paid` per `€200,00` e 11 `pending` per `€1.100,00`. Non sono stati rilevati pagamenti entranti nel modello `payments`.

## Vincoli e punti strutturali rilevanti

- `fee_installments` ha unicità reale su `(membership_fee_id, profile_id, installment_number)`.
- `predefined_installments` ha unicità reale su `(membership_fee_id, installment_number)`.
- `team_members` espone due indici unici equivalenti su `(profile_id, team_id)` e `(team_id, profile_id)`.
- `membership_fees` è collegata alla squadra; l'assegnazione all'atleta è materializzata in `fee_installments.profile_id`, non in una relazione esplicita piano-atleta.
- `documents` è vuota nello staging e non esiste ancora una baseline reale di ricevute finanziarie.

## Anomalie finanziarie osservate

Non risultano anomalie referenziali o di stato nei dati acquisiti:

- nessun piano senza rate predefinite o rate emesse;
- nessuna rata orfana, duplicata o senza profilo/piano;
- nessuna rata `paid` senza attore, timestamp o `payment_source`;
- nessuna rata non pagata con `paid_at` valorizzato;
- nessuna rata associata a un atleta senza membership corrente nella squadra;
- nessun profilo con più piani quota per la stessa squadra;
- nessuna ricevuta/documento finanziario orfano o presente;
- nessun mismatch tra `membership_fees.total_amount`, numero rate e somma dei template.

`not_due` non è classificato come anomalia: è uno stato legittimo, ma resta monitorato esplicitamente nella suite di baseline.

## Anomalie di schema/policy da tenere sotto controllo

1. Esiste una doppia generazione di policy: alcune policy legacy usano il ruolo `public` e `is_admin()`, mentre le policy finanziarie usano `authenticated` e `private.has_account_role('admin')`. Non ha prodotto un'anomalia sui dati, ma aumenta il rischio di divergenza e va normalizzato in un goal separato.
2. `documents` non contiene dati di ricevute nello staging; quindi la sicurezza del percorso upload/associazione ricevuta non è validata da dati reali.
3. La baseline non dimostra ancora la sicurezza del ciclo di vita di un piano quota: modifica/delete del piano, storicizzazione delle rate pagate e upload ricevuta devono essere coperte da test autorizzati dedicati.
4. La tabella `payments` attuale rappresenta pagamenti verso coach (`coach_payment`), non incassi atleta; il redesign Incassi non può assumere che sia già un ledger entrante.

## Safety regression suite

Aggiunta `tests/admin-financial-safety-baseline.test.ts` con fixture aggregata non sensibile. La suite verifica:

- coerenza della baseline staging catturata;
- quadratura rate pianificate/pagate/non pagate;
- assenza delle anomalie osservate;
- distinzione esplicita tra `not_due` e anomalie.

Sono lasciati come `todo` i controlli che richiedono una connessione live o comportamenti applicativi non dimostrabili con la sola snapshot: preservazione delle rate pagate durante delete/edit, vincolo piano-team in assegnazione, atomicità ricevuta-documento.

## Limiti

La verifica è stata read-only e aggregata: non sono stati modificati dati, schema, RLS, auth o storage. Non sono stati eseguiti test mutativi su staging per evitare effetti collaterali finanziari.
