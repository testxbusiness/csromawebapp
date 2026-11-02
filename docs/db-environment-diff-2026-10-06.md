# Confronto database staging/produzione — 6 ottobre 2026

## Perimetro

Confronto read-only dei progetti Supabase:

- produzione: `csromawebapp` (`qyiholnatsrvpoqoplje`)
- staging: `csromawebapp-staging` (`kibtvkuiedoxgppnnxkf`)

L'analisi separa la migration history dagli oggetti realmente presenti nel
database e dallo stato applicativo. In questa fase non sono state applicate
migration e non sono stati modificati dati.

## Sintesi

I database non sono equivalenti, ma la divergenza strutturale è circoscritta:

1. produzione contiene la funzionalità di attivazione atomica della stagione;
   staging non contiene ancora i relativi oggetti;
2. la funzionalità di domanda di iscrizione è presente in entrambi i database,
   con history registrata sotto timestamp diversi;
3. le altre differenze rilevate nei `CHECK` sono solo differenze testuali di
   cast PostgreSQL;
4. i dati di stagione divergono per la bozza `2027/2028`, per gli UUID e per
   una data storica; produzione contiene inoltre l'audit dell'attivazione reale
   del 4 ottobre.

## Migration history

| Ambiente | Record | Versioni solo ambiente |
|---|---:|---|
| Produzione | 67 | `20260928092236` season activation; `20261004115227` e `20261004115239` enrollment application |
| Staging | 70 | `20260723140557`, `20260723152000`, `20260725162041`, `20260729170829` hardening/storage; `20261001170700` e `20261001170720` enrollment application |

Le due coppie di migration enrollment rappresentano la stessa funzionalità
presente nei database; il timestamp diverso è una divergenza di history, non
un'assenza dell'oggetto runtime.

## Differenze dello schema runtime

Il confronto di tabelle e colonne ha restituito 535 elementi in produzione e
528 in staging. L'unica tabella/insieme di colonne presente solo in produzione
è:

- `public.season_activation_audit`
  (`activation_key`, `created_at`, `id`, `performed_by_auth_user_id`,
  `source_season_id`, `target_season_id`);
- `private.prevent_season_activation_audit_mutation()`;
- trigger `season_activation_audit_immutable`;
- `public.activate_season_atomically(uuid, uuid, uuid, uuid)`.

La funzione è `SECURITY DEFINER` ed è eseguibile solo da `service_role`; la
tabella è accessibile solo a `service_role` oltre al proprietario. In
produzione l'audit contiene una riga.

Sono inoltre presenti in entrambi gli ambienti:

- `season_profiles.enrollment_application_delivered`;
- `set_athlete_enrollment_application_delivered_atomically(...)`;
- `rollover_profiles_batch(...)`.

Le definizioni delle funzioni condivise hanno lo stesso contenuto dopo la
normalizzazione di commenti e whitespace. Nove
differenze nei `CHECK` sono soltanto cast espliciti impliciti/espliciti (`text`
vs `character varying`), senza differenza semantica osservata.

Il confronto mirato di sicurezza/runtime ha restituito 139 policy con digest
identico nei due ambienti. Gli indici sono 179 in produzione e 177 in staging;
i due indici aggiuntivi sono quelli della tabella
`season_activation_audit`, quindi coerenti con l'unico oggetto strutturale
extra già rilevato.

## Uso nel codice

La divergenza season activation è attiva e non obsoleta:

- `src/server/admin/season-activation.ts` invoca
  `activate_season_atomically`;
- `src/app/api/admin/season-activation/route.ts` espone l'operazione admin;
- `src/components/admin/SeasonsManager.tsx` invoca l'endpoint dal flusso
  “Attiva”.

Di conseguenza, se lo stesso codice è deployato su staging, il flusso di
attivazione fallisce perché la RPC non esiste. La RPC rollover e quella per la
domanda di iscrizione sono invece usate dal codice e risultano presenti in
entrambi gli ambienti.

## Divergenze dati osservate

| Aspetto | Produzione | Staging |
|---|---|---|
| stagioni | 2 | 3 |
| stagione attiva | `2026/2027` | `2026/2027` |
| bozza `2027/2028` | assente | presente |
| audit attivazione | 1 riga, attivazione `2025/2026` → `2026/2027` del 4/10 | tabella assente |
| `2025/2026` | termina il 30/06/2026 | termina il 31/08/2026 |

Gli UUID delle stagioni non sono confrontabili tra ambienti e non vanno
riallineati copiando dati alla cieca. La bozza staging è già documentata nel
piano di implementazione come fixture/dato di test da mantenere separato dai
dati operativi di produzione.

## Decisioni ancora da prendere

1. adottare la history del repository come history canonica, mantenendo una
   migration di riconciliazione per gli ambienti che hanno timestamp diversi;
2. portare in staging la migration `20260928092236` per rendere disponibile il
   flusso di attivazione, dopo aver confermato che staging deve supportare lo
   stesso codice;
3. non correggere automaticamente la differenza dati delle stagioni: prima
   classificare la bozza `2027/2028` e definire se staging è una replica
   funzionale o un ambiente di test con dati propri;
4. completare un secondo passaggio con confronto mirato di indici, policy,
   grants e conteggi delle tabelle applicative più sensibili prima di definire
   la procedura di riallineamento.
