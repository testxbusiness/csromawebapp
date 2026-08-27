# CSRoma WebApp

![Logo CSRoma](public/images/logo_CSRoma.svg)

Piattaforma gestionale per la società sportiva CSRoma: un’unica applicazione per amministrare stagioni, attività, squadre, iscritti, pagamenti e comunicazioni. L’app è multi–ruolo (admin, allenatori, atleti) e si appoggia a Supabase per auth, database e storage.

## Cosa offre
- Dashboard differenziate per admin, coach e atleti, con login/password reset e protezione delle route.
- Gestione stagioni, palestre, attività e squadre con assegnazione di coach e atleti, calendari eventi (allenamenti, partite, tornei) e integrazione Google Calendar.
- Quote associative, rate, pagamenti e incassi allenatori, con reportistica di bilancio e forecast.
- Messaggistica interna con allegati, notifiche push e reminder automatici (rate in scadenza, certificati medici, eventi imminenti).
- Documenti e template personalizzabili (PDF, merge di variabili) con generazione singola o massiva.
- Import/export Excel per utenti, eventi e iscrizioni; operazioni bulk e filtri avanzati su elenchi.
- UI responsive con tema chiaro/scuro, componenti accessibili e supporto offline per le notifiche.

## Stack tecnico
- **Frontend**: Next.js (App Router), React, TypeScript.
- **UI/Style**: Tailwind CSS 4, componenti custom (shadcn-like), Lucide Icons, motion.
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime), API Routes Next.js.
- **Testing**: Jest + Testing Library, Playwright per E2E.

## Prerequisiti
- Node.js 18+ (consigliato 20) e npm.
- Docker Desktop se vuoi avviare Supabase in locale.
- Account/istanza Supabase con chiavi `anon` e `service_role`.
- Coppia di chiavi VAPID per le notifiche push (pubblica/privata).

## Configurazione ambiente
Copia `.env.local` (non committare) e imposta le variabili chiave:

```
NEXT_PUBLIC_SUPABASE_URL=...           # URL del progetto Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=...      # chiave anon per il client
SUPABASE_SERVICE_ROLE_KEY=...          # chiave service role per API server-side
NEXT_PUBLIC_APP_URL=http://localhost:3000  # base URL usata nelle email/reset
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...       # chiave pubblica VAPID per push
VAPID_PRIVATE_KEY=...                  # chiave privata VAPID per push
VAPID_SUBJECT=mailto:info@csroma.it    # opzionale, subject per web-push
```

Altri script facoltativi usano variabili come `SUPABASE_DB_URL` (backup locale). Mantieni le credenziali fuori dal versionamento.

## Avvio in locale
1) Installazione dipendenze  
```bash
npm install
```

2) Avviare Supabase (locale, via Docker)  
```bash
./start-supabase.sh
# oppure: docker compose up -d supabase-db supabase-studio supabase-auth supabase-realtime
```
Le migration iniziali sono montate in `supabase/migrations` e vengono applicate al primo avvio del container Postgres. Studio è disponibile su `http://localhost:54323`.

3) Avvio dell’app Next.js  
```bash
npm run dev
```
L’app risponde su `http://localhost:3000` (login → dashboard).

4) Build/produzione  
```bash
npm run build
npm start
```

## Script utili
- `npm run lint` – linting del codice.
- `npm test` / `npm run test:coverage` – test unitari con Jest.
- `npm run test:e2e` – test end-to-end Playwright (installare i browser con `npx playwright install` se richiesto).

## Funzionalità per ruolo
- **Admin**: onboarding con creazione stagione iniziale, gestione stagioni/palestre/attività/squadre, import/export utenti via Excel, assegnazione membri e coach, calendario eventi, messaggi broadcast con allegati, gestione quote associative e rate, pagamenti e incassi allenatori, report di bilancio, documenti e template PDF, operazioni bulk e monitoraggio.
- **Coach**: dashboard con squadre assegnate, calendario eventi, messaggi e allegati verso gli atleti, gestione pagamenti a loro destinati e promemoria.
- **Atleta**: calendario personale/squadra, stato quote e rate, messaggistica, documenti disponibili, dati profilo e taglia maglia.

## Struttura principale
- `src/app` – App Router, pagine protette per ruolo e API routes (`/api/*`).
- `src/components` – UI e moduli di dominio (admin/coach/athlete).
- `src/lib` – client Supabase, utilità (email, push, excel, notifiche).
- `public` – manifest asset offline e service worker unificato (`sw.js`).
- `supabase/migrations` – schema iniziale del database.

## Note operative
- Il login richiede account creati in Supabase (registrazioni aperte disabilitate). Il reset password passa da `/reset-password`.
- Le notifiche push funzionano solo con HTTPS o `localhost` e richiedono chiavi VAPID valide.
- Per ambienti cloud, esponi le variabili come secret/ENV e aggiorna `NEXT_PUBLIC_APP_URL` con il dominio pubblico.

## PWA e runbook operativo

La PWA CSRoma usa un unico service worker (`/sw.js`) per caching pubblico, fallback offline e notifiche push. Non vengono memorizzati in Cache Storage dati autenticati, risposte `/api`, richieste Supabase, RSC o pagine protette.

### Installazione e verifica

- **Android/Chrome**: apri il dominio HTTPS, scegli “Installa app” e avvia CSRoma dalla schermata Home.
- **iPhone/iPad**: apri il sito in Safari, scegli Condividi → “Aggiungi alla schermata Home”.
- **Desktop Chrome/Edge**: usa l’icona di installazione nella barra degli indirizzi.

Per verificare il worker in Chrome: `F12` → **Application** → **Service Workers**. Deve esserci una sola registrazione con script `/sw.js`, scope `/` e stato `activated and is running`.

### Test offline

Con l’app già caricata, attiva la modalità aereo o disabilita la rete e apri una nuova pagina. Deve apparire il fallback “Connessione assente” con logo CSRoma. Dopo il ripristino della rete, il pulsante “Riprova” deve riportare alla pagina richiesta.

Le mutazioni (messaggi, eventi, presenze, pagamenti, upload e profili) restano online-only: non devono essere ritentate automaticamente offline.

### Aggiornamento del service worker

Dopo un deploy, il worker nuovo può mostrare il banner “È disponibile una nuova versione”. Premendo **Aggiorna**, il worker in attesa viene attivato e l’app ricaricata. Se il banner non compare, chiudi e riapri la PWA con connessione attiva; come ultima risorsa elimina i dati del solo dominio dalle impostazioni del browser e reinstalla.

### Push: configurazione e debug

Le notifiche richiedono HTTPS (oppure `localhost` in sviluppo), permesso del browser e chiavi VAPID configurate in Vercel (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`). Il test diagnostico è disponibile nell’area amministrativa/API notifiche: controllare subscription presenti, risposta di invio e eventuali subscription revocate. Non inserire mai chiavi private o service role nel client o nel repository.

### Deploy e rollback

Prima del deploy eseguire:

```bash
npx tsc --noEmit
npm test
npm run build
npm run test:e2e -- --project=pwa-chromium
```

Dopo il deploy verificare manifest, `/sw.js`, installazione e push su almeno un dispositivo iOS e Android. In caso di regressione, promuovere su Vercel l’ultimo commit noto funzionante; quindi riaprire l’app online per consentire l’aggiornamento del worker. Per un dispositivo bloccato, rimuovere i dati del solo dominio e reinstallare la PWA.

---

Per dubbi o setup custom (es. import massivi, template documenti, policy RLS), fare riferimento ai file in `implementazione.md` e `SECURITY_AUDIT_RLS_20251130.md`.
