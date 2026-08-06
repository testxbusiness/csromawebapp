# Audit read-only Supabase produzione

Data estrazione: 23 luglio 2026  
Progetto: `csromawebapp`  
Project ref: `qyiholnatsrvpoqoplje`  
URL: `https://qyiholnatsrvpoqoplje.supabase.co`

## Vincolo operativo

L'estrazione è stata eseguita esclusivamente con operazioni di lettura tramite il plugin Supabase: metadati progetto, tabelle, migrazioni, policy/grant, definizioni di viste e advisor di sicurezza/performance.

Non sono stati eseguiti `INSERT`, `UPDATE`, `DELETE`, `ALTER`, `CREATE`, `DROP`, migrazioni, deploy o altre modifiche sul database di produzione.

## Stato dell'istanza

- Stato: `ACTIVE_HEALTHY`
- Regione: `eu-central-2`
- PostgreSQL: `17.6.1.011`
- Migrazione registrata: `20251007152643 master_migration_fixed`

## Findings prioritari

| Severità | Evidenza | Rischio | Fix da preparare e testare prima in locale/staging |
|---|---|---|---|
| Critica | `public.user_roles` ha RLS disabilitato | I privilegi della tabella non sono protetti da policy RLS | Abilitare RLS e definire policy minime per lettura/modifica amministrativa |
| Critica | `anon` dispone di grant diretti molto ampi sulle relazioni pubbliche, inclusi `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE` e `REFERENCES` | Un client anonimo può potenzialmente raggiungere le tabelle senza che una policy RLS limiti il percorso | Revocare i grant non necessari da `anon`; verificare anche i grant diretti di `authenticated` |
| Critica | Policy pubbliche `ALL USING true WITH CHECK true` su `documents`, `document_templates` e `payments` | Accesso e modifica potenzialmente senza autenticazione | Sostituire con policy basate su ruolo e ownership; rimuovere le policy permissive |
| Alta | Numerose policy usano `user_metadata` per autorizzare utenti | I metadata modificabili dall'utente non sono una fonte sicura per ruoli/permessi | Usare `app_metadata` o una funzione server-side/RLS basata su ruolo autorevole |
| Alta | `public.v_profiles` e `public.championship_standings` sono viste `SECURITY DEFINER` | Le viste possono esporre dati oltre il perimetro RLS della sessione | Valutare `security_invoker` su PostgreSQL 15+ oppure revocare accesso e sostituire con API/funzioni controllate |
| Alta | `public.coach_profiles` ha RLS attivo ma nessuna policy | Gli accessi legittimi possono fallire; eventuali grant/viste alternative possono aggirare l'intento | Definire policy esplicite per admin, coach proprietario e letture necessarie |
| Media | `check_gym_schedule_conflicts` ha `search_path` non esplicito | Rischio di risoluzione non sicura degli oggetti in una funzione privilegiata | Impostare `search_path` esplicito e revocare l'esecuzione pubblica non necessaria |
| Media | `update_updated_at_column` ha `search_path` mutabile | Comportamento dipendente dall'ambiente di esecuzione | Impostare `search_path` esplicito |
| Media | Advisor segnala più policy permissive sovrapposte su varie tabelle | Policy difficili da valutare e possibile ampliamento accidentale dell'accesso | Consolidare le policy per ruolo/azione e aggiungere test SQL negativi |
| Bassa | Advisor segnala indici duplicati su `push_subscriptions` | Spazio e costo di scrittura inutili | Conservare un solo indice dopo verifica dell'utilizzo; non rimuovere nulla senza approvazione |

## Evidenze aggiuntive

Le policy con accesso ampio includono, tra le altre, letture autenticate con `USING true` su attività, palestre e relazioni dei campionati. Sono inoltre presenti grant `anon` sulle principali tabelle applicative, tra cui profili, squadre, eventi, messaggi, pagamenti, documenti e presenze. Questi grant devono essere verificati insieme alle policy effettive e ai ruoli usati dall'applicazione.

## Riferimenti advisor Supabase

- [RLS abilitato senza policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- [Vista SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view)
- [Search path di funzione mutabile](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)
- [RLS disabilitato nello schema pubblico](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public)
- [Policy che usano user_metadata](https://supabase.com/docs/guides/database/database-linter?lint=0015_rls_references_user_metadata)
- [Policy permissive multiple](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies)
- [Indice duplicato](https://supabase.com/docs/guides/database/database-linter?lint=0009_duplicate_index)

## Prossimo passo sicuro

Preparare una migrazione separata per la produzione partendo dallo snapshot sopra, applicarla prima al database locale e testare i casi anonimo, atleta, coach e admin. Questa estrazione non autorizza l'applicazione della migrazione su prod.

## Advisor aggiuntivi forniti il 23 luglio 2026

Gli export aggiuntivi confermano i finding precedenti e aggiungono questi elementi:

| Severità | Finding | Ambito | Azione prevista |
|---|---|---|---|
| Critica | 41 policy RLS referenziano `user_metadata` | `messages`, `document_recipients`, `event_teams`, `events`, `fee_installments`, `membership_fees` e altre tabelle | Ricostruire le policy usando `app_metadata`/ruolo autorevole e verificare ogni tabella con test negativi |
| Alta | `public.v_profiles` e `public.championship_standings` sono viste `SECURITY DEFINER` | Viste esposte via schema pubblico | Valutare `security_invoker = true`; in alternativa revocare accesso API e sostituire con accesso server controllato |
| Alta | `public.user_roles` senza RLS | Tabella ruoli | Abilitare RLS e consentire accesso solo secondo il modello ruoli definito |
| Alta | Policy sempre vere | `document_templates`, `documents`, `payments` e altre relazioni segnalate | Rimuovere `USING true`/`WITH CHECK true` non necessari e definire policy per ruolo/ownership |
| Alta | Funzioni `SECURITY DEFINER` eseguibili da `anon` o `authenticated` | 16 funzioni eseguibili da anon e 16 da authenticated | Revocare `EXECUTE` dove non serve; mantenere solo funzioni necessarie con controllo interno e `search_path` fisso |
| Media | `search_path` mutabile | `check_gym_schedule_conflicts`, `update_updated_at_column` | Impostare `search_path` esplicito e qualificare gli oggetti SQL |
| Media | Materialized view esposta all'API | `public.championship_standings` | Rimuoverla dallo schema esposto o proteggerla con accesso server controllato |
| Media | Indici/policy permissivi segnalati dagli advisor | Push subscriptions e varie tabelle | Verificare duplicati e consolidare policy dopo i test, senza rimuovere alla cieca |
| Media | Protezione password compromesse disabilitata | Supabase Auth | Abilitare Leaked Password Protection nel progetto, dopo verifica dell'impatto sugli utenti esistenti |

Questi advisor sono stati letti come evidenza di produzione, ma non autorizzano alcuna modifica. Il prossimo deliverable sarà una migrazione locale separata con test di accesso anonimo, atleta, coach e admin.

## Hardening locale eseguito il 23 luglio 2026

Per verificare il percorso di correzione senza toccare la produzione è stata creata e applicata solo al database Docker locale la migrazione `supabase/migrations/20260723140557_local_rls_hardening.sql`.

Risultati verificati:

- RLS abilitato su `public.user_roles`.
- Grant diretti di `anon` revocati dallo schema applicativo pubblico.
- Policy unconditional rimosse da `documents`, `document_templates` e `payments`.
- Le policy che usavano `user_metadata` sono state riscritte per usare la stessa chiave `app_metadata` senza cambiare i predicati di ownership/team.
- `SECURITY DEFINER` non più eseguibili anonimamente; le funzioni necessarie alle policy restano disponibili ad `authenticated`.
- `search_path` fissato a `public` per le funzioni segnalate.
- Viste `v_profiles` e `championship_standings` impostate come `security_invoker` e non esposte ai ruoli client, perché non risultano usate dal codice locale.
- Test anonimo su `documents` e `user_roles`: accesso negato per privilegi.

Questo risultato è valido solo per il database locale. Prima di una eventuale applicazione in staging o produzione occorre confrontare le definizioni effettive, verificare i flussi atleta/coach/admin e predisporre una finestra di rilascio separata. Nessun comando di scrittura è stato eseguito su produzione.
