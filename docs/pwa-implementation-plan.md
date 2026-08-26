# Piano operativo per trasformare CSRoma WebApp in PWA

## 1. Obiettivo e risultato atteso

Trasformare l'applicazione Next.js in una Progressive Web App installabile e affidabile, senza ridurre le garanzie di autenticazione e autorizzazione già presenti.

La prima release PWA deve offrire:

- installazione su Android, iOS/iPadOS e desktop dai browser compatibili;
- avvio in modalità `standalone` con identità visiva CSRoma;
- un solo service worker, responsabile sia del ciclo di vita PWA sia delle notifiche push già esistenti;
- fallback offline esplicito per le navigazioni;
- cache degli asset pubblici e immutabili, ma non di HTML, RSC, API o dati autenticati;
- indicazione visibile dello stato offline e gestione controllata degli aggiornamenti;
- test automatici di manifest, service worker e fallback offline;
- rollout reversibile e documentato.

La PWA MVP non deve promettere operatività completa senza rete. In particolare, creazione o modifica di eventi, presenze, messaggi, profili, quote, incassi, pagamenti e documenti rimangono funzioni online-only.

## 2. Baseline rilevata nel repository

### Stack e architettura

- Next.js `15.5.x`, React 19, TypeScript strict e App Router.
- Package manager: npm (`package-lock.json`, lockfile v3).
- UI prevalentemente client-side: 132 file TSX su 148 dichiarano `use client`.
- Supabase gestisce autenticazione, database e storage; il middleware aggiorna/verifica la sessione e protegge le route applicative.
- I dati vengono letti sia tramite Route Handler Next (`/api/**`) sia direttamente dal browser con `@supabase/supabase-js`.
- Le API restituiscono dati specifici per account, ruolo e, nel caso dei familiari, profilo selezionato.
- Playwright è già configurato, ma i progetti correnti selezionano solo specifici file di test; un test PWA richiede un progetto dedicato.

### PWA e push già presenti

- `public/push-sw.js` è un service worker a scope root, registrato da `src/components/navigation/LayoutShell.tsx` tramite `src/hooks/usePush.ts`.
- Il worker gestisce `install`, `activate`, `push` e `notificationclick`, ma volutamente non intercetta `fetch`.
- Le sottoscrizioni push sono salvate e revocate tramite `/api/notifications/subscribe` e `/api/notifications/unsubscribe`.
- Non sono presenti manifest, icone PWA quadrate/maskable, pagina offline, install prompt, indicatore di connettività o strategia di cache.
- Il logo PNG esistente è rettangolare (`859x290`) e non è adatto direttamente alle icone installabili.
- `src/app/layout.tsx` espone metadata di base e viewport, ma `lang` è impostato a `en` nonostante l'interfaccia sia italiana.

### Vincoli che influenzano il disegno

1. Due service worker con scope `/` non devono convivere. Il worker push va evoluto/migrato, non affiancato da un secondo worker PWA.
2. Le route `/api/**`, le richieste Supabase e le risposte RSC possono contenere dati personali, sanitari, economici o autorizzativi. Non devono essere messe in Cache Storage nell'MVP.
3. Il middleware intercetta oggi tutto salvo `_next`, favicon, immagini, font e `push-sw.js`. Manifest, nuovo worker, icone e fallback offline devono essere esclusi esplicitamente.
4. Il login e il profilo usano `sessionStorage`; una cache persistente condivisa tra account introdurrebbe un rischio di esposizione su dispositivi condivisi.
5. Il click su una push, quando esiste già una finestra aperta, invia oggi un messaggio `navigate` per il quale non risulta un listener. La migrazione deve correggere anche questo flusso.

## 3. Decisioni architetturali

### 3.1 Strategia scelta per l'MVP

Usare un service worker custom, senza aggiungere una dipendenza PWA/Workbox nella prima release.

Motivazioni:

- esiste già un worker push custom semplice e funzionante;
- il requisito di cache iniziale è volutamente limitato;
- si evita una seconda pipeline di build e il rischio di collisione con il worker push;
- la soluzione resta trasparente, verificabile e facile da disattivare.

Rivalutare Serwist/Workbox soltanto quando viene approvato uno scope offline dati con precache generata dal build, strategie complesse o background sync.

### 3.2 Confine offline dell'MVP

| Risorsa/richiesta | Strategia | Persistenza | Note |
|---|---|---:|---|
| `offline.html`, icone PWA e asset minimi del fallback | precache durante `install` | sì | cache versionata |
| `/_next/static/**` | cache-first dopo la prima richiesta | sì | file hashati e immutabili |
| immagini locali sotto `/images/**` | stale-while-revalidate con limite | sì | non precacheare le immagini sportive più pesanti |
| navigazioni HTML, route protette e login | network-only con fallback a `offline.html` | no | mai salvare HTML personalizzato |
| richieste RSC (`?_rsc=`, header RSC/Next Router) | network-only | no | evitare cache incoerente tra route e utente |
| `/api/**` con qualsiasi metodo | network-only | no | dati autenticati e mutazioni |
| domini Supabase Auth/REST/Storage/Realtime | network-only | no | inclusi avatar e signed URL |
| richieste non `GET` | network-only | no | nessuna coda o replay automatico |

### 3.3 Aggiornamenti del worker

- Non attivare un aggiornamento distruttivo mentre l'utente sta compilando un form.
- Il nuovo worker segnala `update-available` alla pagina.
- L'interfaccia mostra un toast/banner “Nuova versione disponibile” con azione esplicita “Aggiorna”.
- Solo dopo l'azione utente la pagina invia `SKIP_WAITING`; al `controllerchange` esegue un singolo reload.
- Il primo worker può usare `skipWaiting()` soltanto se non esiste un controller precedente. Le release successive seguono il flusso controllato.

### 3.4 Sicurezza delle URL push

Il worker deve accettare come destinazione delle notifiche soltanto path same-origin che iniziano con `/`. URL assolute esterne, `//host`, schemi non HTTP(S) o valori non validi ricadono su `/dashboard`.

Per una finestra già aperta usare `WindowClient.navigate(safeUrl)` seguito da `focus()`. Usare `openWindow(safeUrl)` soltanto se non esistono client navigabili.

## 4. Struttura file target

```text
src/
  app/
    layout.tsx                         # metadata PWA, lingua e bootstrap
    manifest.ts                       # Web App Manifest tipizzato
  components/
    pwa/
      PwaBootstrap.tsx                # registrazione, update lifecycle, online/offline
      ConnectivityBanner.tsx          # stato offline accessibile
      InstallPwaButton.tsx             # prompt installazione e fallback iOS
  hooks/
    usePush.ts                        # usa la registrazione unica, solo logica push
  lib/
    pwa/
      service-worker-registration.ts  # helper client condiviso e tipizzato
public/
  sw.js                               # fetch caching + push + notification click
  offline.html                        # fallback autonomo, senza bundle Next
  icons/
    icon-192.png
    icon-512.png
    icon-maskable-512.png
    apple-touch-icon-180.png
tests/
  e2e/
    pwa.spec.ts
```

Non creare un secondo provider globale. `PwaBootstrap` deve essere un piccolo Client Component montato una volta nel root layout, con il confine client più basso possibile.

## 5. Piano di implementazione per fasi

> Stato aggiornato al 26/08/2026. `[x]` indica implementazione o verifica completata; `[ ]` indica attività ancora da eseguire o da validare su staging/dispositivi reali.

### Fase 0 — Baseline e criteri di prodotto

**Obiettivo:** fissare comportamento corrente e perimetro della release.

- [x] Creare un branch `codex/pwa` o equivalente e pubblicarlo su GitHub.
- [x] Eseguire e salvare l'esito baseline di `npm test`, `npx tsc --noEmit` e `npm run build`.
- [x] Verificare separatamente `npm run lint`: con Next.js 15 lo script è deprecato ma nel repository passa senza errori.
- [x] Confermare i colori installazione: `theme_color` CSRoma rosso `#d71920`, `background_color` chiaro `#f7f7fb`.
- [x] Confermare naming: nome esteso `CSRoma Control Center`, nome breve `CSRoma`.
- [x] Concordare che l'MVP è “installabile + fallback offline”, non “gestionale completamente utilizzabile offline”.
- [ ] Acquisire screenshot Lighthouse/PWA e misure iniziali su staging HTTPS.

**Uscita:** baseline riproducibile e scope firmato.

### Fase 1 — Manifest, icone e metadata

**File:** `src/app/manifest.ts`, `src/app/layout.tsx`, `public/icons/*`.

- [x] Creare `src/app/manifest.ts` usando il tipo `MetadataRoute.Manifest`.
- [x] Configurare nel manifest:
  - `id: "/"`;
  - `name: "CSRoma Control Center"`;
  - `short_name: "CSRoma"`;
  - `description` coerente con il gestionale;
  - `start_url: "/dashboard?source=pwa"`;
  - `scope: "/"`;
  - `display: "standalone"`;
  - `orientation: "any"`;
  - `background_color: "#f7f7fb"`;
  - `theme_color: "#d71920"`;
  - icone 192, 512 e maskable 512 con `purpose` corretto.
- [x] Generare le icone da una tavola quadrata, non deformando il logo rettangolare. Lasciare area sicura di almeno il 20% per l'icona maskable.
- [ ] Controllare visivamente le icone su sfondo chiaro, scuro e con crop circolare/squircle.
- [x] Aggiornare `src/app/layout.tsx`:
  - cambiare `<html lang="en">` in `<html lang="it">`;
  - aggiungere `applicationName`, `manifest`, `appleWebApp` e icone Apple;
  - impostare `themeColor` nel viewport per tema chiaro/scuro;
  - mantenere `viewportFit: "cover"`.
- [ ] Aggiungere in `globals.css` padding con `env(safe-area-inset-*)` per navbar, drawer e contenuti in modalità standalone, verificando di non duplicare il padding browser normale.

**Criteri di accettazione:**

- `/manifest.webmanifest` risponde `200` con MIME manifest/JSON e senza redirect al login;
- Chrome/Edge riconoscono l'app come installabile;
- Safari usa l'icona 180x180 e apre senza viewport tagliato;
- nome, colori e icone risultano corretti nell'home screen/app launcher.

### Fase 2 — Worker unico e migrazione push

**File:** `public/sw.js`, `public/push-sw.js`, `src/lib/pwa/service-worker-registration.ts`, `src/components/pwa/PwaBootstrap.tsx`, `src/hooks/usePush.ts`, `src/components/navigation/LayoutShell.tsx`.

- [x] Copiare nel nuovo `public/sw.js` i listener `push` e `notificationclick` esistenti prima di aggiungere logica cache.
- [x] Definire nomi cache versionati e separati (`csroma-precache-v2`, `csroma-static-v1`, `csroma-images-v1`).
- [x] Precacheare soltanto `offline.html`, icone essenziali e loghi CSRoma. Non precacheare `/dashboard`, `/login`, bundle Next o immagini grandi.
- [x] Implementare `fetch` con guard clause, nell'ordine:
  1. ignorare richieste non `GET`;
  2. lasciare network-only `/api/**`;
  3. lasciare network-only richieste cross-origin, incluse quelle Supabase;
  4. lasciare network-only RSC e richieste Next Router;
  5. per `request.mode === "navigate"`, tentare la rete e restituire `offline.html` solo in caso di errore di rete;
  6. applicare cache-first a `/_next/static/**`;
  7. applicare stale-while-revalidate alle sole immagini locali.
- [x] Limitare la cache immagini a 30 entry ed eliminare le entry più vecchie quando si supera il limite.
- [x] Durante `activate`, eliminare solo cache CSRoma con versione precedente; non eliminare cache di altri software/origini.
- [x] Implementare la validazione same-origin delle URL push e correggere la navigazione dei client già aperti.
- [x] Creare un helper singleton per la registrazione del service worker che:
  - ritorna `null` fuori dal browser o se il browser non supporta i worker;
  - registra `/sw.js` con scope `/` una sola volta;
  - espone errori diagnostici senza bloccare il rendering.
- [x] Montare `PwaBootstrap` in `src/app/layout.tsx`.
- [x] Rimuovere la registrazione del worker da `LayoutShell`; il layout non deve conoscere i dettagli push/PWA.
- [x] Modificare `usePush` perché recuperi la stessa registrazione `/sw.js` ed eliminare il cast `any` delle chiavi della subscription.
- [ ] Dopo almeno una release di migrazione, rimuovere `public/push-sw.js`. Prima della rimozione verificare che registrare `/sw.js` sullo stesso scope aggiorni effettivamente la registrazione esistente su un browser che aveva già `/push-sw.js`.

**Criteri di accettazione:**

- DevTools mostra una sola registration con scope `/` e script `/sw.js`;
- una sottoscrizione push esistente continua a funzionare dopo l'upgrade;
- una nuova sottoscrizione viene salvata e può essere revocata;
- click su push porta alla route corretta sia con app chiusa sia con app già aperta;
- nessuna risposta `/api/**`, RSC o Supabase compare in Cache Storage.

### Fase 2.5 — Badge notifiche non lette (incremento post-MVP)

**Obiettivo:** mostrare sull’icona della PWA il numero di messaggi non letti, mantenendolo coerente con l’account attivo senza considerarlo una fonte autorevole.

- [ ] Calcolare lato server il conteggio non letto per account, includendo destinatari diretti, squadre e profili familiari autorizzati.
- [ ] Estendere il payload push con un campo numerico `unreadCount` personalizzato per ogni account destinatario. Non raggruppare invii con conteggi diversi nello stesso payload.
- [ ] Nel service worker, usare `setAppBadge(unreadCount)` quando la Badging API è disponibile; usare `clearAppBadge()` quando il conteggio è zero.
- [ ] Ricalcolare il conteggio quando la PWA torna in foreground o diventa visibile, così da correggere push perse o letture effettuate da un altro dispositivo.
- [ ] Aggiornare/azzerare il badge dopo la lettura dei messaggi e gestire il logout senza usare il badge come meccanismo di autorizzazione.
- [ ] Prevedere fallback silenzioso per browser, launcher o versioni iOS che non espongono la Badging API.
- [ ] Testare separatamente: iOS PWA Home Screen, Android PWA installata, browser desktop, più dispositivi dello stesso account e cambio account sullo stesso dispositivo.

**Criteri di accettazione:**

- il conteggio visualizzato è specifico per account e non espone dati di altri utenti;
- dopo una push il badge viene aggiornato quando la piattaforma lo supporta;
- aprendo l’app il badge viene riallineato al conteggio server-side;
- leggendo tutti i messaggi il badge viene azzerato;
- se la Badging API non è disponibile, l’app continua a funzionare senza errori né regressioni sulle push.

### Fase 3 — Routing, middleware e header HTTP

**File:** `src/middleware.ts`, `next.config.js`.

- [x] Trattare come pubblici/bypass nel middleware:
  - `/manifest.webmanifest`;
  - `/sw.js`;
  - `/offline.html`;
  - `/icons/**`.
- [x] Aggiornare anche `config.matcher`, non soltanto le guard clause interne, per evitare lavoro SSR e redirect sugli asset PWA.
- [x] Conservare temporaneamente l'eccezione `/push-sw.js` durante la release di migrazione.
- [x] Aggiungere `headers()` in `next.config.js`:
  - `/sw.js`: `Cache-Control: no-cache, no-store, must-revalidate`;
  - `/manifest.webmanifest`: cache breve con revalidation;
  - `/icons/**`: cache lunga e immutable quando i filename sono versionati;
  - `X-Content-Type-Options: nosniff` almeno per worker e manifest.
- [ ] Verificare che `/sw.js` risponda con JavaScript e non con una pagina HTML/redirect autenticazione su Preview Vercel.
- [ ] Verificare HTTPS in staging/produzione; in sviluppo il service worker è consentito su `localhost`.

**Criteri di accettazione:** `curl -I` su manifest, worker, fallback e icone restituisce `200`, content type corretto e nessun `Location: /login`.

### Fase 4 — Esperienza offline, installazione e aggiornamenti

**File:** `public/offline.html`, `src/components/pwa/ConnectivityBanner.tsx`, `src/components/pwa/InstallPwaButton.tsx`, `src/components/pwa/PwaBootstrap.tsx`, `src/components/shared/UserProfile.tsx`, `src/app/globals.css`.

- [x] Creare `offline.html` autonomo: CSS inline minimo, logo/icona locale, testo in italiano, pulsante “Riprova” e nessuna informazione utente.
- [x] Inserire un banner globale quando `navigator.onLine === false`; usare `role="status"`/`aria-live="polite"` e un testo che chiarisca che le modifiche non sono disponibili.
- [x] Al ritorno online, nascondere il banner e lasciare ai moduli esistenti il normale refresh su focus/visibility.
- [x] Non intercettare o accodare automaticamente submit, upload, DELETE/PATCH/POST. Un retry non idempotente potrebbe duplicare pagamenti, messaggi, presenze o eventi.
- [x] Implementare `InstallPwaButton` nel profilo utente:
  - catturare `beforeinstallprompt` dove supportato;
  - nascondere il comando se l'app è già standalone;
  - su iOS mostrare istruzioni “Condividi → Aggiungi alla schermata Home”;
  - non mostrare popup automatici al primo accesso.
- [x] Gestire l'evento `appinstalled` per aggiornare lo stato UI.
- [x] Mostrare l'update prompt soltanto quando un worker nuovo è `waiting`; al click inviare `SKIP_WAITING` e ricaricare una sola volta.
- [ ] Aggiungere CSS `@media (display-mode: standalone)` soltanto per adattamenti realmente necessari (safe area, altezza e spaziature).

**Criteri di accettazione:**

- offline, una nuova navigazione mostra il fallback CSRoma senza loop o schermata bianca;
- una pagina già aperta mostra lo stato offline;
- i comandi di installazione compaiono solo quando appropriato;
- l'aggiornamento non ricarica automaticamente un form con modifiche non salvate.

### Fase 5 — Sicurezza, privacy e logout

**File:** `src/hooks/useAuth.ts`, `src/components/navigation/LayoutShell.tsx`, worker e registrazione PWA.

- [ ] Documentare con un test eseguito che Cache Storage non contiene URL `/api/`, query `_rsc`, URL Supabase, signed URL o HTML di route protette (test Playwright scritto, esecuzione ancora da completare).
- [x] Su logout continuare a rimuovere `csroma_profile_cache` da `sessionStorage` e inviare al worker un messaggio `CLEAR_RUNTIME_CACHES`.
- [x] `CLEAR_RUNTIME_CACHES` svuota solo cache runtime pubbliche CSRoma e non disiscrive automaticamente le push.
- [x] Non includere nomi, ruoli, eventi, messaggi o importi nel fallback offline.
- [x] Verificare nel codice che il payload push non consenta navigazione cross-origin.
- [x] Verificare nel codice che il worker non aggiunga header auth, non legga token e non serializzi cookie/sessioni.
- [ ] Aggiungere una nota privacy su dati conservati localmente: nell'MVP sono solo asset pubblici e preferenze esistenti.

**Criteri di accettazione:** cambio account sullo stesso dispositivo senza riavviare il browser non mostra dati o schermate del precedente account.

### Fase 6 — Test automatici e matrice manuale

**File:** `tests/e2e/pwa.spec.ts`, `playwright.config.ts`, eventuali test unitari per helper puri.

#### Test Playwright Chromium

- [x] Aggiungere un progetto `pwa-chromium` che includa `pwa.spec.ts`; i progetti attuali hanno `testMatch` restrittivi.
- [x] Scrivere il test `GET /manifest.webmanifest`: status, campi obbligatori, start URL e icone.
- [x] Scrivere il test `GET /sw.js`: status, content type e assenza di redirect.
- [x] Scrivere il test per `/login`, `navigator.serviceWorker.ready` e scope/script URL.
- [x] Scrivere il test di navigazione offline verso il fallback.
- [x] Scrivere il controllo che Cache Storage non contenga `/api/`, `_rsc`, host Supabase o route protette.
- [ ] Simulare messaggi del worker per verificare il flusso update senza reload multipli.
- [x] Ripristinare sempre la rete in `finally` per non contaminare i test successivi.

#### Test unitari

- [ ] Estrarre e testare come funzioni pure la classificazione delle request e la normalizzazione delle URL push, se il worker viene costruito da una sorgente testabile.
- [ ] Testare gli stati di `InstallPwaButton`: non supportato, installabile, standalone e fallback iOS.

#### Matrice manuale su staging HTTPS

| Ambiente | Installazione | Avvio standalone | Offline fallback | Push | Deep link push | Update |
|---|---:|---:|---:|---:|---:|---:|
| Android / Chrome | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| iPhone/iPad / Safari | ✓ | ✓ | ✓ | ✓* | ✓ | ✓ |
| Windows / Edge | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| macOS / Chrome | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| macOS / Safari | ✓ | ✓ | ✓ | verificare | ✓ | ✓ |

`*` Verificare le notifiche su una PWA aggiunta alla Home Screen e con permesso concesso da gesto utente.

#### Comandi di verifica finale

```bash
npx tsc --noEmit
npm test
npm run build
npm run test:e2e -- --project=pwa-chromium
```

Stato attuale: `npx tsc --noEmit`, `npm test`, `npm run build` e `npm run lint` sono passati. Il comando Playwright è stato aggiunto ma non ha completato l'avvio nel sandbox gestito per un errore di binding/browser; va eseguito in CI o su staging. Eseguire inoltre Lighthouse in modalità mobile sulla build di produzione/staging, non sul dev server. Verificare almeno manifest installabile, service worker controllante, HTTPS, viewport e assenza di errori console.

### Fase 7 — Rollout, osservabilità e rollback

- [x] Rendere il sender push compatibile con il bundle serverless Vercel usando l'import statico di `web-push`.
- [x] Rendere `/api/notifications/test` diagnostico: segnala VAPID mancanti, subscription assenti e invii falliti invece di restituire falsi successi.
- [ ] Distribuire prima su staging HTTPS con VAPID reali di staging.
- [ ] Testare upgrade da una sessione che possiede già `push-sw.js`, non soltanto installazioni pulite.
- [ ] Distribuire in produzione a un gruppo pilota interno (admin + un coach + un atleta/familiare).
- [ ] Monitorare per 48–72 ore:
  - errori registrazione/aggiornamento worker;
  - tasso di sottoscrizione e invio push;
  - risposte 401/403 anomale dopo resume;
  - fallback offline inattesi mentre il dispositivo risulta online;
  - errori di caricamento chunk dopo deploy.
- [ ] Rendere diagnostica la versione del worker, senza includere dati utente.
- [ ] Preparare un worker di rollback che in `activate` elimina le sole cache `csroma-*`, chiama `unregister()` e forza i client a ricaricare online.
- [x] Conservare il vecchio endpoint `/push-sw.js` per una release di transizione; rimuoverlo solo dopo verifica della migrazione.
- [ ] Aggiornare `README.md` con installazione, comportamento offline, HTTPS/VAPID, procedura di debug e rollback.

**Go/no-go produzione:** nessuna regressione auth/RBAC, push funzionanti, nessun dato autenticato in cache, test PWA verdi e upgrade del worker verificato su almeno un device per piattaforma target.

## 6. Sequenza consigliata di pull request

### PR 1 — Fondamenta installabili

- manifest tipizzato;
- icone;
- metadata/lingua/safe areas;
- bypass middleware e header;
- test manifest/asset.

La PR è rilasciabile ma non registra ancora il nuovo worker.

### PR 2 — Worker unificato e compatibilità push

- `sw.js` con push invariato e caching ristretto;
- helper di registrazione;
- migrazione da `push-sw.js`;
- correzione deep link push;
- test registrazione e non-cache dei dati.

### PR 3 — UX installazione/offline/update

- fallback offline;
- banner connettività;
- pulsante installazione;
- update prompt controllato;
- pulizia runtime cache al logout;
- test E2E offline.

### PR 4 — Rollout e documentazione

- test dispositivi reali;
- Lighthouse;
- runbook rollback;
- aggiornamento README;
- rimozione del worker legacy solo dopo la finestra di transizione.

### PR 5 — Badge notifiche non lette (opzionale, post-MVP)

- conteggio non letto server-side per account;
- payload push con `unreadCount` per destinatario;
- aggiornamento e pulizia badge nel worker e al ritorno in foreground;
- fallback per piattaforme senza Badging API;
- test multi-account e multi-dispositivo.

## 7. Stima e dipendenze

| Attività | Stima indicativa |
|---|---:|
| Manifest, icone, metadata, middleware/header | 0,5–1 giorno |
| Worker unificato, cache sicura e migrazione push | 1–1,5 giorni |
| UX offline/install/update e logout | 1 giorno |
| Test automatici e regressione auth/push | 1–1,5 giorni |
| Staging, device test, documentazione e rollout | 0,5–1 giorno |
| Badge notifiche non lette (post-MVP) | 1–2 giorni |
| **Totale MVP** | **4–6 giorni persona** |

Dipendenze esterne:

- ambiente staging HTTPS raggiungibile da dispositivi reali;
- chiavi VAPID di staging e produzione;
- accesso a un dispositivo iOS/iPadOS e uno Android;
- approvazione delle icone quadrate/maskable.

## 8. Estensione futura: consultazione dati offline

Questa fase non fa parte dell'MVP e richiede una decisione di prodotto e privacy separata.

Se approvata, procedere per casi d'uso read-only e non per cache trasparente delle API:

1. scegliere dataset minimi e a basso rischio, ad esempio prossimi eventi e comunicazioni già lette;
2. creare uno store IndexedDB con schema versionato, `accountId/profileId`, timestamp e scadenza;
3. validare ogni payload con gli schemi Zod esistenti prima di salvarlo;
4. cifrare i dati sensibili o evitare del tutto di persisterli;
5. cancellare lo store a logout, cambio account, revoca profilo o scadenza;
6. mostrare sempre “Aggiornato al …” e distinguere dati offline da dati correnti;
7. mantenere le mutazioni online-only finché non esistono idempotency key, gestione conflitti e audit trail;
8. eseguire threat model e revisione privacy prima del rollout.

Non implementare background sync generico per pagamenti, presenze, messaggi, upload o operazioni amministrative: il replay automatico può duplicare o applicare fuori ordine operazioni di business.

## 9. Definition of Done complessiva

La trasformazione PWA è conclusa quando:

- [ ] l'app è installabile con nome, icone e colori corretti (manifest verificato, installazione reale ancora da completare);
- [ ] l'avvio standalone porta a `/dashboard` e rispetta il flusso auth;
- [x] esiste una sola registration service worker a scope `/`;
- [ ] le notifiche push continuano a funzionare su subscription nuove ed esistenti;
- [x] il fallback offline è accessibile, leggibile e non contiene dati personali;
- [ ] nessun dato/API/RSC autenticato è persistito dal worker (test automatico scritto, esecuzione da completare);
- [ ] aggiornamenti e rollback del worker sono controllati;
- [ ] i test automatici e la matrice dispositivi sono completati;
- [x] build, TypeScript, lint e suite Jest passano;
- [ ] README e runbook operativo sono aggiornati.
