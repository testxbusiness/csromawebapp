# CSRoma — Athlete Analytics (PostHog)

## Stato e confini

Integrazione client-side limitata all’esperienza personale di un account atleta.
La cattura richiede contemporaneamente: flag abilitato, build non-production,
sessione Supabase risolta, account e UUID autenticato coerenti, ruolo account
atleta, area `personal`, nessun profilo delegato selezionato e consenso esplicito
salvato per quello stesso account. Coach, admin e staff sono
esclusi anche quando l’account ha più ruoli. L’area familiare/delegata è esclusa.
Logout, cambio account, ruolo/area o profilo disattivano e resettano la sessione
PostHog; un cambio account richiede il consenso già registrato per quell’account.
Il ruolo effettivo viene dalla `AccountSummary.roles` in `useAuth`; la modalità
personale/familiare e il soggetto selezionato vengono da
`AccessibleProfileContext`. Nel repository non esisteva un CMP o un consenso
analytics riutilizzabile. RSVP e assenze sono attualmente inviate con `fetch`
nei manager atleta, non con `useMutation` TanStack Query: gli eventi si agganciano
ai rami di risposta riuscita senza cambiare query, cache o comportamento delle
mutation.

Il consenso in questa versione è un opt-in tecnico per account sul dispositivo,
con scelta di rifiuto e revoca. Per gli account di minorenni l’interfaccia chiede
che la scelta provenga da chi è autorizzato, ma non verifica l’identità del
tutore né sostituisce CMP, informativa o valutazione della base giuridica. La
raccolta in produzione è bloccata nel codice fino a una revisione privacy e a
un’approvazione esplicita. Non attivare production prima di questi passaggi.

La richiesta iniziale di consenso appare in cima alla Dashboard solo finché
l’account non ha espresso una scelta. Stato, modifica e revoca del consenso sono
gestiti in `Profilo > Account e app`, subito dopo le impostazioni delle notifiche
push. La preferenza resta associata all’account sul dispositivo.

PostHog è inizializzato soltanto dopo consenso e verifica del contesto. Il
progetto EU usa `https://eu.i.posthog.com`; Replay, autocapture, pageview
automatiche, pageleave, eccezioni, GeoIP, surveys e dipendenze runtime esterne
sono disabilitati. Il filtro `before_send` applica una allowlist stretta di
eventi e proprietà e aggiunge `$geoip_disable`. Nel progetto PostHog va inoltre
abilitato **Discard client IP data** nelle impostazioni IP data capture prima di
qualsiasi rollout: l’SDK browser non può impedire al server di ricevere l’IP
necessario alla richiesta HTTP. Le pageview manuali inviano soltanto la sezione
e l’ambiente; URL, query string e referrer vengono rimossi. Gli ID
messaggio, evento, profilo atleta e account non sono proprietà degli eventi.
L’identificativo PostHog è SHA-256 dell’UUID Supabase Auth e non sono inviati
nomi o email.

## Eventi implementati

| Evento | Punto di emissione | Proprietà |
| --- | --- | --- |
| `$pageview` | Navigazione a una route atleta o Dashboard personale dopo opt-in | `page` (sezione), `environment`; nessun URL |
| `athlete_attendance_response_saved` | Dopo la risposta RSVP salvata dal calendario o Dashboard | `response`: `going`, `maybe`, `declined`; `environment` |
| `athlete_absence_reported` | Dopo il POST riuscito per assenza singola o dal modal di periodo | `scope`: `single` o `period`; `environment` |
| `athlete_message_opened` | Apertura esplicita da Messaggi o preview Dashboard | `source`: `messages` o `dashboard`; `environment` |

Gli eventi delle mutation vengono registrati dopo risposta HTTP positiva e
verifica che il contesto soggetto non sia cambiato; l’apertura messaggi viene
registrata sull’azione esplicita o sul deep link caricato una sola volta. Gli
eventi non dipendono da query/refetch e non includono contenuti, motivazioni,
date, ID o conteggi degli elementi.
Le sezioni Quote e Profilo sono misurate dalle pageview delle route `/athlete/fees`
e `/athlete/profile`. I flussi familiari delegati non vengono conteggiati.

## Variabili Vercel

| Variabile | Valore | Target |
| --- | --- | --- |
| `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` | Project token pubblico del progetto PostHog Cloud EU | Preview; in Production non valorizzare prima dell’approvazione |
| `NEXT_PUBLIC_POSTHOG_HOST` | `https://eu.i.posthog.com` | Preview; stesso host solo dopo approvazione Production |
| `NEXT_PUBLIC_POSTHOG_ENABLED` | `true` per Preview di verifica; `false`/assente altrove | Preview e Development |

Se il token è assente o il flag non è esattamente `true`, non avviene alcuna
cattura. Anche con flag `true`, `NEXT_PUBLIC_ANALYTICS_ENV=production` mantiene
la cattura disabilitata. Questo valore è derivato in build da `VERCEL_ENV`.
Configurare le variabili Preview e creare un nuovo deployment preview per
incorporarle. Non aggiungere il token al repository.

## Configurazione PostHog Cloud EU

1. Usare il project token del progetto EU, mai una Personal API Key nel client.
2. In Project Settings, impostare la regione/host EU e verificare che session
   recordings e autocapture siano disabilitati anche nelle impostazioni progetto.
3. Non aggiungere URL di staging con query string sensibili o dati personali agli
   eventi o alle proprietà.
4. In PostHog Live Events, filtrare `environment = preview` durante la prova.
5. Verificare la ricezione dal browser Network: le richieste di ingestione devono
   andare a `eu.i.posthog.com`, con eventi della allowlist e sole proprietà
   documentate. Nessuna richiesta di evento deve apparire prima del consenso.

## Dashboard operativa: `CSRoma — Athlete Analytics`

Creare dashboard con filtro globale `environment` e valori `preview` / `production`;
non combinare i due ambienti nella vista usata per decisioni operative.

1. **DAU / WAU / MAU** — Trends, unique users, evento `$pageview`,
   intervalli giornaliero / settimanale / mensile.
2. **Frequenza sezioni** — Trends, conteggio `$pageview`, breakdown `page`
   (dashboard, championships, calendar, messages, fees, profile).
3. **RSVP** — Trends, conteggio `athlete_attendance_response_saved`, breakdown
   `response`.
4. **Assenze** — Trends, conteggio `athlete_absence_reported`, breakdown `scope`.
5. **Apertura messaggi** — Trends, conteggio `athlete_message_opened`, breakdown
   `source`.
6. **Retention 7/30 giorni** — Retention con `$pageview` come evento
   iniziale e `$pageview` come evento di ritorno, finestre a 7 e 30
   giorni; usare utenti distinti pseudonimi e separare l’ambiente.

Non etichettare gli utenti PostHog come percentuale degli iscritti: manca un
denominatore attendibile in questo flusso. DAU/WAU/MAU sono utenti osservati che
hanno consentito il tracking, non tutti gli atleti iscritti.

## Verifica Preview e checklist privacy

Richiede un Preview deployment con le variabili configurate e l’accesso al
progetto PostHog. Eseguire questi scenari in un account di test autorizzato:

- atleta personale senza consenso: nessuna chiamata di ingestione;
- atleta personale dopo opt-in: pageview e azione RSVP/assenza/apertura messaggio
  ricevute in Live Events;
- rifiuto e revoca: eventi successivi assenti e identità resettata;
- anonimo, coach, admin, staff, account multi-ruolo admin/coach e area delegata:
  nessun evento;
- cambio account: nuova identità hash e consenso richiesto/letto per account;
- navigazione singola: una coppia `$pageview`/`athlete_page_viewed` per route;
- refetch e rerender: nessun nuovo evento azione;
- payload: nessun nome, email, ID di dominio, URL con query, testo, date,
  motivazione, dato sanitario o finanziario;
- test Sentry già presenti: restano invariati e continuano a essere il sistema
  per errori tecnici.

La dashboard non è stata creata via API: nell’ambiente non è disponibile un
connettore PostHog autenticato e non va usata una Personal API Key nel browser.
La verifica di ricezione in Live Events/Network non è completabile dal solo
workspace senza Preview deploy e accesso PostHog; va registrata prima di
considerare l’obiettivo operativo completo.

## Questioni necessarie prima della produzione

- Approvare informativa, finalità, retention, base giuridica e flusso di consenso
  per utenti minorenni con il referente privacy.
- Definire un modo affidabile per acquisire/gestire il consenso del genitore o
  tutore, se necessario, oltre all’autodichiarazione tecnica.
- Verificare requisiti cookie/ePrivacy applicabili, CMP e durata della scelta.
- Dopo approvazione esplicita, rimuovere il blocco production nel modulo
  `athlete-analytics-policy.ts`, configurare le variabili Production e fare un
  deploy separato sottoposto a review. Questa modifica non fa parte della prima
  attivazione Preview.

## Documentazione SDK

- [PostHog per Next.js](https://posthog.com/docs/libraries/next-js)
- [Riferimento SDK JavaScript](https://posthog.com/docs/references/posthog-js)
- [Impostazioni di conservazione e IP](https://posthog.com/docs/privacy/data-storage)
