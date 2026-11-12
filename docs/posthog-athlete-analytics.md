# CSRoma — Athlete Analytics (PostHog)

## Stato e confini

Integrazione client-side limitata all’esperienza personale di un account atleta.
La cattura richiede contemporaneamente: flag abilitato, sessione Supabase
risolta, account e UUID autenticato coerenti, ruolo account
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
con scelta di rifiuto e revoca. L’utente riferisce che la domanda d’iscrizione,
firmata da un genitore per tutti gli iscritti, illustra le tutele GDPR. Il testo
non è stato revisionato in questo repository: va verificato che descriva anche
in modo specifico l’analytics facoltativa PostHog e la relativa scelta/revoca.
Per gli account di minorenni l’interfaccia chiede una conferma di autorizzazione;
la società raccoglie inoltre una domanda d’iscrizione firmata da un genitore,
secondo quanto riferito dall’utente. Il 12 novembre 2026 l’utente ha confermato
la compliance GDPR e ha autorizzato l’attivazione del tracking PostHog in
produzione. L’opt-in analytics in-app resta necessario e facoltativo.

La richiesta iniziale di consenso appare in cima alla Dashboard solo finché
l’account non ha espresso una scelta. Stato, modifica e revoca del consenso sono
gestiti in `Profilo > Account e app`, subito dopo le impostazioni delle notifiche
push. La preferenza resta associata all’account sul dispositivo.

PostHog è inizializzato soltanto dopo consenso e verifica del contesto. Il
progetto EU usa `https://eu.i.posthog.com`; Replay, autocapture, pageview
automatiche, pageleave, eccezioni, GeoIP, surveys e dipendenze runtime esterne
sono disabilitati. Il filtro `before_send` applica una allowlist stretta di
eventi e proprietà e aggiunge `$geoip_disable`. L’utente ha verificato che
**Discard client IP data** è attivo nelle impostazioni IP data capture del
progetto PostHog (screenshot 2026-11-12); l’SDK browser da solo non può impedire
al server di ricevere l’IP necessario alla richiesta HTTP. Le pageview manuali
inviano la sezione e l’ambiente, più `$current_url` ricostruito con l’origine
del sito e `/analytics/<sezione>` e `$pathname` con lo stesso percorso
semantico. Route originali, query string e referrer vengono rimossi. Gli ID
messaggio, evento, profilo atleta e account non sono proprietà degli eventi.
L’identificativo PostHog è SHA-256 dell’UUID Supabase Auth e non sono inviati
nomi o email.

## Eventi implementati

| Evento | Punto di emissione | Proprietà |
| --- | --- | --- |
| `$pageview` | Navigazione a una route atleta o Dashboard personale dopo opt-in | `page` (sezione), `environment`, `$current_url` e `$pathname` normalizzati |
| `athlete_attendance_response_saved` | Dopo la risposta RSVP salvata dal calendario o Dashboard | `response`: `going`, `maybe`, `declined`; `environment` |
| `athlete_absence_reported` | Dopo il POST riuscito per assenza singola o dal modal di periodo | `scope`: `single` o `period`; `environment` |
| `athlete_message_opened` | Apertura esplicita da Messaggi o preview Dashboard | `source`: `messages` o `dashboard`; `environment` |

Gli eventi delle mutation vengono registrati dopo risposta HTTP positiva e
verifica che il contesto soggetto non sia cambiato; l’apertura messaggi viene
registrata sull’azione esplicita o sul deep link caricato una sola volta. Gli
eventi vengono richiesti con `send_instantly` per evitare che il basso volume di
traffico lasci gli invii in attesa del batch. Non dipendono da query/refetch e
non includono contenuti, motivazioni, date, ID o conteggi degli elementi.
Le sezioni Quote e Profilo sono misurate dalle pageview delle route `/athlete/fees`
e `/athlete/profile`. I flussi familiari delegati non vengono conteggiati.

## Variabili Vercel

| Variabile | Valore | Target |
| --- | --- | --- |
| `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` | Project token pubblico del progetto PostHog Cloud EU | Production e Preview |
| `NEXT_PUBLIC_POSTHOG_HOST` | `https://eu.i.posthog.com` | Production e Preview |
| `NEXT_PUBLIC_POSTHOG_ENABLED` | `true` | Production e Preview |

Se il token è assente o il flag non è esattamente `true`, non avviene alcuna
cattura. `NEXT_PUBLIC_ANALYTICS_ENV` viene valorizzata in build da `VERCEL_ENV`
e distingue i dati `preview` da `production`, ma non disabilita la raccolta.
Le variabili `NEXT_PUBLIC_*` sono incorporate nel bundle client: ogni modifica
richiede un nuovo deployment nell’ambiente interessato. Non aggiungere il token
al repository; usare il project token pubblico, mai una Personal API Key.

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

L’utente conferma di aver già testato l’integrazione su Preview. I casi specifici
e un report di esecuzione non sono registrati nel repository; la checklist
seguente resta il riferimento per le regressioni e per future verifiche in un
account di test autorizzato:

- atleta personale senza consenso: nessuna chiamata di ingestione;
- atleta personale dopo opt-in: pageview e azione RSVP/assenza/apertura messaggio
  ricevute in Live Events;
- rifiuto e revoca: eventi successivi assenti e identità resettata;
- anonimo, coach, admin, staff, account multi-ruolo admin/coach e area delegata:
  nessun evento;
- cambio account: nuova identità hash e consenso richiesto/letto per account;
- navigazione singola: un solo `$pageview` per route supportata;
- refetch e rerender: nessun nuovo evento azione;
- payload: nessun nome, email, ID di dominio, URL con query, testo, date,
  motivazione, dato sanitario o finanziario;
- test Sentry già presenti: restano invariati e continuano a essere il sistema
  per errori tecnici.

La dashboard non è stata creata via API: nell’ambiente non è disponibile un
connettore PostHog autenticato e non va usata una Personal API Key nel browser.
La ricezione su Preview è stata testata dall’utente; il repository non contiene
ancora i dettagli degli scenari verificati o uno screenshot/report di Live
Events/Network.

## Attivazione production

- Il gate software che escludeva `production` è stato rimosso. La raccolta
  richiede ancora `NEXT_PUBLIC_POSTHOG_ENABLED=true`, un project token valido,
  il contesto atleta personale idoneo e il consenso analytics esplicito.
- L’utente riferisce che token, host EU e flag sono configurati in Vercel per
  Production e Preview; il valore del token resta segreto e non è verificabile
  dal repository.
- L’utente ha verificato che **Discard client IP data** è attivo nel progetto
  PostHog. L’attestazione e la conferma GDPR sono state fornite dall’utente il
  12 novembre 2026; non costituiscono una verifica indipendente del contenuto
  della domanda d’iscrizione.
- Questa modifica non effettua un deploy. La raccolta production inizierà con
  un deployment che contiene il gate rimosso; gli account devono comunque
  accettare l’opt-in in-app.

## Documentazione SDK

- [PostHog per Next.js](https://posthog.com/docs/libraries/next-js)
- [Riferimento SDK JavaScript](https://posthog.com/docs/references/posthog-js)
- [Impostazioni di conservazione e IP](https://posthog.com/docs/privacy/data-storage)
