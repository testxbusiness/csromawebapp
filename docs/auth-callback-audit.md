# Audit callback autenticazione Supabase — 31 ottobre 2026

## Ambito e limiti

Audit statico in sola lettura del percorso di invito e recupero password, inclusa la schermata `/auth/callback` mostrata nello screenshot. Non sono stati interrogati Supabase, letti valori di `.env.local`, inviati messaggi, modificati account/configurazioni o cambiati file applicativi. L’email e gli identificatori dell’utente coinvolto non vengono ripetuti nel report.

La documentazione Supabase consultata descrive il comportamento generale dei flussi. Non dimostra la configurazione live del progetto, né il contenuto dei template SMTP Aruba o i dettagli di user-agent/IP dei log ricevuti.

## A. Analisi della causa

### Flussi ricostruiti

| Percorso | Generazione e redirect | Callback/sessione |
|---|---|---|
| Invito account da Admin > Iscritti/Collaboratori | `invite-account/route.ts` chiama `auth.admin.inviteUserByEmail` con `redirectTo` uguale all’origine della richiesta più `/auth/callback` (righe 75–83). La vecchia route `/api/admin/users` è disabilitata con HTTP 410; il precedente codice d’invito rimane commentato. | Il template Supabase dell’invito effettua la verifica `/auth/v1/verify`; in caso di successo il client browser deve completare il callback e salvare la sessione. Il callback reindirizza al fallback `/reset-password?recovery=1`. Il contenuto del template live non è nel repository. |
| Recupero self-service da `/forgot-password` | `resetPasswordForEmail` usa `window.location.origin + '/auth/callback'` con il browser client standard (`forgot-password/page.tsx:19–22`). | `createBrowserClient` di `@supabase/ssr` usa PKCE per impostazione standard. Il link di ritorno porta un `?code=...`; il browser che completa il flusso deve avere il verifier salvato all’avvio. Il callback si affida all’inizializzazione automatica del client e poi `getSession()` (`callback/page.tsx:29–37`). |
| Reset avviato dall’amministratore | La route admin controlla ruolo/account, imposta `must_change_password` nei metadati e nella tabella, poi restituisce l’email (`admin/users/reset-password/route.ts:7–18, 63–87`). `UsersManager.tsx:78–106` invia l’email dal browser dell’admin con `createRecoveryClient()` e redirect `/auth/callback`. | `createRecoveryClient()` imposta `flowType: 'implicit'`, `detectSessionInUrl: false`, `persistSession: false` (`client.ts:13–33`). Il browser del destinatario riceve normalmente token nell’hash e il callback li applica esplicitamente con `setSession` (`callback/page.tsx:38–58`). La sessione viene scritta attraverso il browser client SSR standard. |
| Impostazione nuova password | `/reset-password` è pubblica e dinamica. `ResetPasswordForm` legge la sessione browser, distingue `must_change_password`, poi invia la nuova password alla route server (`ResetPasswordForm.tsx:25–37, 57–75`). | La route server verifica l’utente con `getUser()`, controlla l’account e usa Admin API per aggiornare password/metadati e stato account (`api/auth/reset-password/route.ts:14–55`). Per il reset imposto dall’admin la UI reindirizza alla destinazione interna `nextPath`; per il recupero normale torna al login (`ResetPasswordForm.tsx:89–110`). |

### Problemi e valutazione

#### 1. Consumo anticipato del link monouso — **probabile**, confidenza medio-alta

- **Evidenza:** nei log forniti, il primo `GET /verify` riceve 303; circa otto secondi dopo, ulteriori richieste ricevono 403 `One-time token not found`. La documentazione Supabase afferma che alcuni scanner/prefetch email visitano `{{ .ConfirmationURL }}` e possono consumare immediatamente il token, facendo fallire il successivo click dell’utente. Riferimento codice: `src/app/auth/callback/page.tsx:38–45`, ramo che mostra il messaggio esatto dello screenshot se non trova token nella URL.
- **Comportamento attuale:** `/verify` usa un token monouso. Se la prima visita automatica lo consuma, il click effettivo è respinto. La navigazione che ha consumato il token può essere stata uno scanner, il client dell’utente, una preview o un altro agente: il solo status 303 non distingue queste possibilità.
- **Comportamento atteso:** solo un’azione intenzionale dell’utente dovrebbe consumare il token di verifica; le verifiche automatizzate del contenuto email non dovrebbero esaurire il link.
- **Riproduzione:** un client di sicurezza visita il link completo prima dell’utente; il successivo click produce “One-time token not found”. È necessario correlare la prima richiesta a user-agent/IP e, se disponibili, al click registrato dal provider.
- **Gravità/impatto:** alta per la disponibilità del recupero/invito; l’utente non può impostare la password da quel link e deve richiedere un nuovo messaggio.
- **Nota:** la documentazione descrive il rischio per i link `ConfirmationURL`; non è prova che Aruba o il client email usato in questo caso effettui quel prefetch.

#### 2. Callback mostra l’errore generico anche quando manca solo la sessione client — **confermato**, confidenza alta

- **Evidenza:** `callback/page.tsx:38–46` richiede `access_token` e `refresh_token` nell’hash e mostra “Il link di invito non contiene una sessione valida.” senza distinguere invito da recovery. La schermata corrisponde esattamente al ramo del codice.
- **Comportamento attuale:** ogni URL senza `code` e senza entrambi i token nell’hash ricade nello stesso errore. Può accadere con link scaduto/usato, hash rimosso, URL alterata, callback raggiunto direttamente o risposta di verifica che reindirizza con errore query anziché sessione. Lo screenshot identifica il ramo UI ma non la causa a monte.
- **Comportamento atteso:** mostrare uno stato di verifica fallita con istruzioni adeguate e classificare gli errori senza suggerire che il messaggio dimostri la tipologia del link.
- **Gravità/impatto:** media, confonde invito e recovery e non aiuta l’utente a distinguere link usato, scaduto o malformato.
- **Correzione minima:** gestire i parametri di errore `error`, `error_code` e `error_description` restituiti dal redirect, fornire un messaggio utilizzabile per link scaduto/usato e offrire un nuovo avvio del recupero. Evitare di registrare token o query sensibili.

#### 3. Callback implicit e rilevamento URL automatico — **rischio plausibile**, confidenza media-bassa

- **Evidenza:** il recovery client genera link implicit con `detectSessionInUrl: false`, ma il callback usa il client standard `createBrowserClient` con configurazione predefinita, che rileva automaticamente la sessione nell’URL. Il callback poi chiama esplicitamente `setSession` sullo stesso URL (`client.ts:6–10, 18–29`; `callback/page.tsx:24, 38–58`).
- **Comportamento attuale:** coesistono rilevamento implicito automatico del client SSR e gestione manuale dell’hash. La creazione del client e il successivo `setSession` possono avviare l’inizializzazione del client con URL detection attiva mentre il callback gestisce gli stessi token. I commenti nel callback affermano che non deve verificarsi un conflitto, ma il repository non contiene test che fissino l’ordine o provino questo percorso con le versioni installate (`@supabase/ssr ^0.7.0`, `@supabase/supabase-js ^2.56.0`).
- **Comportamento atteso:** un solo proprietario del parsing/consumo del risultato di auth, con esito e persistenza confermati prima di navigare.
- **Riproduzione:** link implicit valido aperto in un browser pulito con callback e provider Auth inizializzati contemporaneamente; acquisire eventi auth e richieste di rete in ambiente locale/staging.
- **Gravità/impatto:** potenzialmente alta ma non dimostrata dai log forniti. Non è la spiegazione primaria più forte del pattern 303 seguito da 403.
- **Correzione proposta:** aggiungere prima un test riproducibile per il client effettivo e separare/configurare il callback in modo da processare ogni risposta una sola volta. Non convertire il recovery admin a PKCE: il verifier del browser admin non sarebbe disponibile sul dispositivo del destinatario. Valutare una verifica server-side token-hash/OTP solo come modifica dedicata con template e allowlist verificati.

#### 4. PKCE self-service aperto in un browser/dispositivo diverso — **confermato per il modello PKCE; non dimostrato per l’incidente**

- **Evidenza:** il reset self-service usa `createBrowserClient` standard e quindi PKCE; il verifier è memorizzato nel contesto locale al browser che avvia la richiesta. La documentazione Supabase dichiara che il callback PKCE richiede il verifier locale e che il code è monouso. Il reset admin evita deliberatamente questo vincolo usando implicit.
- **Comportamento attuale:** un recovery self-service iniziato in Safari e aperto in Chrome iOS, Gmail in un contesto browser isolato o su un altro dispositivo può non completare l’exchange PKCE anche se il codice non è scaduto. Per l’admin recovery l’assenza del verifier condiviso non si applica, perché il flusso è implicit.
- **Gravità/impatto:** media per recuperi self-service cross-browser; non spiega lo screenshot se il link era stato generato dal reset admin.
- **Correzione proposta:** documentare che il link self-service va aperto nello stesso browser/context che l’ha richiesto oppure progettare il passaggio a un endpoint server-side con token hash/OTP. Non cambiare flow senza test e scelta esplicita dell’architettura.

### iPhone e browser mobile

- Il fragment `#access_token=...&refresh_token=...` non viene inviato nella richiesta HTTP al server. Il server logga `/verify` e il redirect ma non può dimostrare se Safari/Gmail/Chrome abbia preservato l’hash al caricamento della pagina. Il callback deve essere verificato lato browser.
- L’implicit recovery admin è stato scelto proprio per non dipendere dal verifier del browser admin; un browser diverso è quindi previsto per questo percorso, salvo perdita/consumo del token.
- Il PKCE self-service dipende invece dal verifier nel browser d’origine; browser diversi sono un caso di fallimento atteso dal protocollo.
- Il link aperto una seconda volta è monouso: dopo un completamento valido, il riuso deve fallire. Se il primo accesso è automatico, il fallimento al click successivo ha lo stesso aspetto esterno.
- Non sono state trovate evidenze nel repository per attribuire la rimozione del fragment a uno specifico browser iOS o app email. Verificare con un link di test non reale e cattura URL client-side redatta.

### Configurazione, sessioni e autorizzazione

- `supabase/config.toml:155–165` configura `site_url = http://127.0.0.1:3000` e una allowlist solo localhost. È configurazione locale, non prova né descrive la configurazione hosted di produzione/staging. I redirect di produzione `/auth/callback` devono essere confrontati nel dashboard Supabase con `app.csroma.it`; non è possibile concludere da questo file che siano errati.
- Gli endpoint di invito admin costruiscono il redirect dall’origin della richiesta. I due client browser costruiscono il redirect da `window.location.origin`. Verificare che ogni host reale (produzione e staging) sia autorizzato e che richieste non fidate non possano influire sull’origin percepita dal deployment.
- `middleware.ts:6–12, 48–66` rende pubblici callback e reset e aggiorna/legge la sessione via cookie SSR; non reindirizza fuori da callback. `callback/page.tsx:61–63` cancella l’URL visibile prima del redirect successivo. `ResetPasswordForm` invia la modifica password al server, dove `getUser()` verifica la sessione (`api/auth/reset-password/route.ts:14–16`). Non è emerso un bypass evidente della verifica server-side.
- L’email viene inviata dalle API Auth Supabase con SMTP configurato nel progetto hosted; nel repository non sono presenti i template live del dashboard. `src/lib/utils/email.ts` contiene helper/template legacy con link applicativi propri, ma non è chiamato dai percorsi Auth esaminati e non va confuso con i messaggi `inviteUserByEmail` / `resetPasswordForEmail`.
- Nessun valore di `.env.local`, token, password o chiave privilegiata è stato letto o riportato.

### Raccomandazione tecnica

La spiegazione più coerente con la sequenza di log è **consumo del link monouso prima del click riuscito**, probabilmente da prefetch/scanner email o da una prima apertura, seguito dal 403 sul tentativo successivo. La schermata prova soltanto che il callback è arrivato al ramo senza `code` e senza token nell’hash; non prova chi abbia consumato il link. Classificazione finale: **probabile effetto di una prima verifica automatica o apertura anticipata, con una debolezza applicativa confermata nella diagnostica del callback**. Non ci sono prove sufficienti per dichiarare la configurazione hosted sbagliata o un bug esclusivamente iOS. Il rischio di doppia gestione dell’hash nel callback richiede un test specifico prima di essere promosso a root cause.

## B. Correzioni proposte

1. Correlare in modo redatto la prima richiesta `/verify` con user-agent, IP anonimizzato, request id e redirect successivo; non registrare query token, hash, OTP o URL complete.
2. Verificare i template hosted di reset e invito: link, tracking/rewriting del provider e uso di `ConfirmationURL`. Disabilitare tracking/riscrittura link sui messaggi Auth se abilitati.
3. Come mitigazione robusta contro scanner, valutare template email con codice OTP/token hash e una pagina di conferma con azione esplicita dell’utente o verifica server-side. Va progettata separatamente perché invito e recovery hanno type, sessione SSR e semantica diversi.
4. Rendere espliciti gli stati callback: `code` PKCE, hash implicit, errore query, token assente/scaduto. Processare una sola modalità e navigare solo dopo conferma sessione; coprire con test l’interazione fra URL detection automatica e `setSession`.
5. Verificare allowlist e Site URL hosted per produzione/staging; modificare dashboard solo dopo aver confrontato gli URL di deployment effettivi.
6. Non usare `getSession()` come prova server-side di autorizzazione. Le API protette continuano a dover verificare l’utente lato server, come già avviene nella route di cambio password.

## C. Piano di test e regressione

### Eseguito in questo audit

- Ricostruzione statica dei percorsi invito, self-service reset, admin reset, callback, middleware e cambio password.
- Verifica della configurazione Supabase locale versionata e delle chiamate `redirectTo` nel codice.
- Confronto del flusso PKCE/implicit e della protezione contro prefetch con documentazione Supabase ufficiale.
- Nessun test di integrazione o browser è stato eseguito: non è stato configurato/contattato un ambiente Auth locale o staging, e non sono stati usati account reali. Nessun account/email di produzione è stato toccato.

### Test da eseguire in ambiente locale o staging isolato

1. **Nuovo account/invito:** template hosted equivalente, verifica riuscita, callback con hash, cookie/sessione presente e passaggio a reset obbligatorio; aggiornamento password e successivo login.
2. **Self-service reset:** richiesta da browser A, link aperto nello stesso browser A; verificare `?code`, exchange PKCE unico, cookie SSR e completamento.
3. **Self-service cross-browser/device:** avviare in A e aprire in B; verificare errore chiaro e nessun falso successo. Ripetere su Safari iOS e Chrome iOS/Gmail iOS.
4. **Admin reset cross-browser:** invio dal browser admin A e apertura del recipient link sul dispositivo/browser B; validare sessione implicita, cookie SSR e `must_change_password`.
5. **Doppia apertura/scanner:** simulare una visita GET iniziale allo stesso link, poi click utente; osservare consumo, redirect e messaggio in callback. Non inviare email a utenti reali.
6. **Token usato/scaduto:** il callback deve mostrare stato recuperabile, senza esporre parametri token; il nuovo reset deve essere avviabile.
7. **Matrice callback:** `code` valido/assente/già scambiato; hash con entrambi i token, solo access, solo refresh, hash vuoto; query error Supabase; hash conservato in Safari; navigazione successiva solo dopo sessione verificata.
8. **Race URL detection:** inizializzare `createClient`, `useAuth` e callback nello stesso documento; accertare una sola elaborazione, una sessione cookie coerente e nessun secondo tentativo di consumare codice/token.
9. **Redirect e middleware:** redirect hosted consentito/non consentito per staging e produzione, route callback/reset pubbliche, richieste API senza sessione e cookie assente/valido.
10. **Cambio password:** sessione assente, account non abilitato, account invitato e attivo; controllare che solo gli stati autorizzati cambino e che metadati/record account restino coerenti.

Per ogni test raccogliere: browser/app/versione, timestamp UTC e locale, request id, status e destinazione redatta, eventi `onAuthStateChange`, esito `getUser()` server-side e presenza/assenza dei cookie senza registrarne i valori. Non raccogliere token, password o email in chiaro.

## D. Evidenze ancora necessarie

- Esportazione redatta dei log Auth relativi al caso con timestamp, user-agent, IP anonimizzato e request id, compresa la URL di destinazione senza query/hash sensibili.
- Configurazione hosted read-only: Site URL, Redirect URLs, template Invite e Reset Password, scadenza OTP/link e impostazioni SMTP/tracking. Non includere segreti.
- Chiarire se il link segnalato proviene dal reset self-service, dal reset admin o dall’invito; il testo del messaggio UI non basta a determinarlo.
- Riproduzione con account staging isolato e dispositivo/browser iOS coinvolto o equivalente.

## Riferimenti

- Codice: `src/app/auth/callback/page.tsx`, `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/app/api/admin/users/reset-password/route.ts`, `src/app/api/admin/profiles/[id]/invite-account/route.ts`, `src/app/api/auth/reset-password/route.ts`, `src/components/shared/ResetPasswordForm.tsx`, `src/middleware.ts`, `src/app/forgot-password/page.tsx`, `src/components/admin/UsersManager.tsx`, `supabase/config.toml`.
- [Supabase Email Templates — prefetching e token OTP](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Supabase PKCE Flow — code monouso e verifier locale](https://supabase.com/docs/guides/auth/sessions/pkce-flow)
- [Supabase Advanced SSR Auth — PKCE e cookie condivisi](https://supabase.com/docs/guides/auth/server-side/advanced-guide)
- [Supabase Password-based Auth — reset password](https://supabase.com/docs/guides/auth/passwords)
- [Supabase Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)

## Stato

Report diagnostico completato in sola lettura. Nessuna correzione applicativa o modifica Supabase è stata eseguita. Le ipotesi principali restano da validare tramite log redatti e test staging controllati.

---

## Follow-up mirato — self-service PKCE / Chrome iOS e Gmail

**Aggiornamento:** 31 ottobre 2026. La nuova informazione dell’utente conferma che i due casi erano reset self-service. Per il caso con screenshot, l’utente ha avviato il recupero e aperto il link dall’app Gmail nuovamente in Chrome sullo stesso iPhone. Questo riduce la probabilità del classico errore PKCE da cambio browser/dispositivo: il verifier dovrebbe restare nel cookie di Chrome, a meno che l’apertura da Gmail non sia stata gestita in un contesto browser diverso da quello dichiarato.

### Root cause ordinate per confidenza

#### 1. Verifica del link monouso prima del click effettivo — **probabile, confidenza medio-alta**

- Il `GET /verify` 303 indica che una richiesta di verifica è stata accettata e ha prodotto un redirect; non dimostra che Chrome abbia ricevuto e scambiato il successivo PKCE `code`.
- Nel caso di Fabio sono riportati successivi `GET /verify` 403 `One-time token not found`, ma non un `POST /token?grant_type=pkce` riuscito. Nel caso di Riccardo, invece, è documentato proprio il `POST /token` PKCE HTTP 200 dopo il 303.
- La sequenza di Fabio è quindi più coerente con: un primo visitatore (possibile scanner/preview dell’email) consuma il token OTP e segue il 303 senza eseguire l’app JavaScript; il click successivo dell’utente ripete `/verify` e viene rifiutato. Supabase può allora reindirizzare il browser con parametri di errore e senza `code`; il callback attuale ignora tali parametri e mostra il testo generico relativo all’invito.
- Gmail/Chrome sullo stesso iPhone non esclude questa ipotesi: il prefetch avviene prima dell’apertura dell’utente e non dipende dal browser che poi conserva il verifier.
- **Non è ancora confermato:** i log forniti non includono user-agent/IP correlabili, `Location` redatta del primo 303 e destinazione del 403. La documentazione Supabase conferma in generale che i prefetch possono consumare URL `ConfirmationURL`, ma non prova che Gmail abbia effettuato la prima visita in questo caso.

#### 2. Il callback classifica la URL dopo che l’inizializzazione automatica può averla modificata — **bug applicativo confermato; causa del caso Fabio non provata**

- Il provider Auth globale è sopra tutte le pagine (`src/app/layout.tsx:61–71`). `useAuthState()` crea il client browser durante il render (`src/hooks/useAuth.ts:60–62`). La versione installata di `@supabase/ssr` (`0.7.0`) rende singleton il client nel browser, abilita `detectSessionInUrl` e avvia il client Auth automatico (`node_modules/@supabase/ssr/dist/main/createBrowserClient.js:5–41`).
- In `@supabase/auth-js` installato (`2.71.1`, risolto dal lockfile), l’inizializzazione rileva `?code` solo se trova il verifier, esegue `_exchangeCodeForSession`, salva la sessione e poi cancella `code` con `history.replaceState` (`node_modules/@supabase/auth-js/dist/main/GoTrueClient.js:195–256, 1290–1310`). Quindi **sì**, `code` può non esserci più quando l’`useEffect` di `src/app/auth/callback/page.tsx:22–27` legge `window.location.href`, benché la sessione sia già stata creata.
- Il callback attuale, se non vede più `code`, passa al ramo implicit e richiede i token nell’hash (`callback/page.tsx:38–45`); non controlla prima la sessione già stabilita. In quel timing mostra esattamente il messaggio “Il link di invito non contiene una sessione valida” anche dopo uno scambio PKCE riuscito. È un difetto reale di classificazione/ordine, indipendente dal motivo per cui il primo caso non mostra un exchange nei log forniti.
- Un errore di verifier mancante non porta l’SDK a cancellare il `code`: `_isPKCECallback` richiede `code` **e** verifier (`GoTrueClient.js:1366–1369`); se il verifier manca, il callback continua a vedere `code`, non viene fatto `POST /token` e il codice applicativo dovrebbe scegliere il ramo PKCE e mostrare “Il link di autenticazione non è valido o è scaduto”, non il messaggio dell’invito. Quindi verifier mancante da solo non spiega lo screenshot esatto, salvo che la URL ricevuta non contenga più il `code` o un’inizializzazione precedente abbia già alterato lo stato.

### Riproduzione isolata del comportamento SDK

Eseguita con Node + JSDOM e i pacchetti installati localmente; URL sintetica `?code=synthetic-code`, cookie verifier sintetico e fetch Auth mockato. Nessuna chiamata a Supabase reale, nessun account, token, email o credenziale reale.

| Scenario | Esito osservato |
|---|---|
| Client SSR browser con `code` e verifier; risposta token mock HTTP 200 | Prima dell’inizializzazione `code` presente; dopo `getSession()`/inizializzazione `code` rimosso; una sola richiesta PKCE; sessione presente e persistita nei cookie. |
| Client SSR browser con `code` ma senza verifier | `code` resta nella URL; zero richieste PKCE; sessione assente. Con la logica applicativa attuale il callback segue il ramo PKCE e restituisce il messaggio generico di link auth non valido/scaduto, non quello di invito. |
| Valutazione della condizione callback dopo il primo scenario | Lo stato risultante è URL senza `code` e senza hash ma sessione esistente. Dato il controllo nell’ordine presente a `callback/page.tsx:24–45`, il componente selezionerebbe il ramo “invito privo di sessione”. È una conclusione dal comportamento runtime SDK più il codice del callback, non un test React end-to-end né una prova del timing del dispositivo dell’utente. |

È quindi verificato che il callback può perdere la distinzione PKCE dopo auto-inizializzazione. Questo non genera da solo un secondo `GET /verify`: il code exchange è una richiesta `/token`, distinta dalla verifica OTP `/verify`.

### Confronto fra i due utenti

- **Riccardo:** `POST /token?grant_type=pkce` HTTP 200 dimostra che un client ha ricevuto un `code`, ha trovato un verifier valido e ha completato lo scambio. Non dimostra da solo che il callback React abbia letto il code prima della pulizia URL; se l’inizializzazione globale lo aveva già scambiato, il bug descritto sopra potrebbe ancora verificarsi. Serve sapere se Riccardo ha effettivamente raggiunto `/reset-password`.
- **Fabio:** i 403 successivi su `/verify` indicano un tentativo di riusare una verifica monouso; non sono l’errore standard di code verifier mancante, che riguarderebbe `/token`. L’assenza del `POST /token` nei log disponibili è coerente con un 303 seguito fuori dal browser interattivo e un successivo click rifiutato, ma va confermata con log completi.
- **Il 303 è insufficiente** per distinguere una verifica seguita da exchange PKCE (Riccardo) da una verifica anticipata seguita da tentativo duplicato (possibile Fabio). Servono gli eventi di tutti e tre i passaggi: `/verify` iniziale, callback redirect/location e `/token` PKCE.

### Correzione minima consigliata (da implementare solo in un goal successivo)

1. Non scegliere il ramo PKCE/implicit basandosi soltanto su una lettura tardiva della URL. L’inizializzazione SDK può aver già scambiato il code e rimosso il parametro.
2. Riconoscere prima la sessione/sessione di recovery già stabilita dal client Auth; preservare una fotografia iniziale della URL prima della creazione del client quando possibile. Per la validazione di recovery, usare la semantica/evento Auth appropriata e non trattare un qualsiasi utente già autenticato come prova che il link sia stato verificato.
3. Se non c’è sessione e il callback ha un errore Supabase in query o un code senza verifier, mostrare una causa PKCE/recupero chiara e recuperabile. Non mostrare il testo dell’invito nel percorso self-service.
4. Mantenere il ramo hash implicito per inviti e reset admin; non cambiare il loro flow PKCE/implicit in questo fix. Aggiungere test distinti per `code` prima/dopo l’auto-exchange, code con verifier assente, hash invito e query error.

**Rischi regressione:** il callback è condiviso da recovery self-service PKCE, invito e admin reset implicit. Il fix deve dimostrare che: (a) un code PKCE auto-scambiato non viene rifiutato dopo la pulizia URL; (b) un code non scambiato/verifier assente non viene dichiarato valido; (c) l’hash invite/admin viene ancora convertito in sessione SSR una sola volta; (d) link usati/scaduti non fanno passare l’utente al cambio password senza una sessione autenticata valida. Nessuna conversione di flow è raccomandata.

### Test dispositivo/staging: esecuzione e blocchi

- Confermata tramite elenco progetti read-only l’esistenza di un progetto Supabase staging attivo (`csromawebapp-staging`). Non sono state interrogate tabelle, account o log di produzione, e non è stato inviato alcun messaggio.
- **Non eseguiti in staging:** Chrome iOS → Gmail → Chrome iOS, richiesta/apertura stesso browser, Safari → Chrome, Chrome → Gmail, dispositivi diversi, link duplicato/consumato, scanner email. Per completarli serve un account di test dedicato con casella controllabile e URL deploy del frontend collegato allo staging; questi non sono presenti nel repository né forniti nella richiesta. L’emulazione browser desktop non replicherebbe l’apertura nativa Gmail/Chrome di iOS.
- Il link di produzione non va riutilizzato per riprodurre: è monouso e riguarda account reali.
- **Prova specifica che manca per confermare il consumo anticipato:** per una richiesta di test staging, correlare senza valori segreti (1) user-agent/orario del primo `GET /verify`, (2) presenza del parametro `code` nella `Location` del 303 indicata soltanto come booleano, (3) user-agent/orario del 403 e sua destinazione redatta, (4) presenza e status del successivo `POST /token?grant_type=pkce`. Un primo visitatore non interattivo seguito dal click Chrome con `/verify` 403 e nessun PKCE exchange confermerebbe lo scanner/prefetch.

### Conclusione aggiornata

Non c’è prova sufficiente per affermare una root cause unica dell’incidente senza le destinazioni redatte e la correlazione user-agent dei log. Le ipotesi ordinate sono: **(1)** consumo della conferma da prefetch/visita precedente prima che Chrome scambi il code — più probabile per i 403 duplicati `/verify` senza exchange noto; **(2)** bug applicativo certo nel callback che non considera una sessione PKCE già creata e code rimosso dall’inizializzazione automatica — riprodotto con SDK installato, può produrre il testo fuorviante anche dopo un exchange riuscito; **(3)** perdita del verifier nel contesto aperto da Gmail — possibile solo se il collegamento non torna allo stesso storage/cookie Chrome, ma meno probabile dato il percorso dichiarato e non spiegazione del messaggio mostrato in assenza di code.

**Definition of Done raggiunta per il report:** comportamento SDK riprodotto in test isolato e causa applicativa del callback dimostrata; causa a monte specifica di Fabio resta un’ipotesi ordinata, con evidenze esatte indicate per confermarla. Il flusso iOS/Gmail live non è stato riprodotto per mancanza di account/casella di test e URL frontend staging.
