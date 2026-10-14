# Athlete Query Freshness Policy

Data decisione: 14 ottobre 2026  
Ambito: query TanStack Query dell'area Atleta e area familiare/delegata che riusa i manager atleta. Coach/Admin sono fuori scope.

## Policy centralizzata

La policy è definita in `src/lib/athlete/query-policy.ts` e applicata esplicitamente alle query atleta. Il `QueryClient` è condiviso anche da Coach/Admin, quindi i default globali non vengono modificati.

| Query key | Endpoint | Categoria | Prima staleTime | staleTime finale | gcTime | Focus | Reconnect | Mount |
|---|---|---:|---:|---:|---:|---|---|---|
| `athlete/{account}/{subject}/profile` | `/api/athlete/profile` | LOW | 5 min | 30 min | 60 min | no | no | stale only |
| `athlete/{account}/{subject}/administration` | `/api/athlete/administration` | LOW/MEDIUM | 3 min | 15 min | 30 min | no | yes | stale only |
| `athlete/{account}/{subject}/dashboard` | `/api/athlete/dashboard` | MEDIUM/event aggregate | 90 s | 90 s | 30 min | yes | yes | stale only |
| `athlete/{account}/{subject}/dashboard-alerts` | `/api/athlete/dashboard/alerts` | LOW/MEDIUM | 3 min | 10 min | 30 min | no | yes | stale only |
| `athlete/{account}/{subject}/calendar` | `/api/athlete/calendar` | MEDIUM | 2 min | 2 min | 30 min | yes | yes | stale only |
| `athlete/{account}/{subject}/events/detail/{eventId}` | `/api/athlete/events/detail?id=...` | EVENT_DRIVEN | 1 min | 2 min | 30 min | yes | yes | stale only |
| `athlete/{account}/{subject}/messages/list` | `/api/athlete/messages?view=minimal` | HIGH | 45 s | 30 s | 30 min | yes | yes | stale only |
| `athlete/{account}/{subject}/messages/unread` | `/api/athlete/messages?countOnly=1` | HIGH/EVENT_DRIVEN | 15 s | 15 s | 30 min | yes | yes | stale only |
| `athlete/{account}/{subject}/messages/detail/{messageId}` | `/api/athlete/messages?view=full&id=...` | MEDIUM/EVENT_DRIVEN | 3 min | 5 min | 30 min | yes | yes | stale only |
| `athlete/{account}/{subject}/team-detail/{teamId}` | `/api/athlete/teams/detail?id=...` | LOW | 10 min | 15 min | 60 min | no | no | stale only |
| `athlete/{account}/{subject}/championships/catalog` | `/api/athlete/championships?view=catalog` | LOW | 5 min | 30 min | 60 min | no | no | stale only |
| `athlete/{account}/{subject}/championships/group/{groupId}` | `/api/athlete/championships?view=group&groupId=...` | MEDIUM | 3 min | 2 min | 30 min | yes | yes | stale only |
| `athlete/{account}/{subject}/championships/convocation/{matchId}/{clubTeamId}` | `/api/athlete/championships?view=convocation&...` | HIGH/EVENT_DRIVEN | 1 min | 1 min | 30 min | yes | yes | stale only |

`refetchOnMount: true` significa refetch solo se la query è stale; non forza una request a ogni navigazione. I parametri UI (mese, vista calendario, filtri, sezione amministrazione) non sono query key perché non cambiano la request server.

## Mutation e coerenza cross-view

| Mutation/evento | Aggiornamento immediato | Refetch/invalidation |
|---|---|---|
| Attendance/RSVP | `setQueryData` su Dashboard, Calendar e Event Detail per account+subject+event | Calendar invalidato dopo early-absence batch; timer `next_recalculation_at` invalida solo Calendar/Dashboard della stessa chiave |
| Early absence/revoca | `setQueryData` su Dashboard, Calendar e detail con `is_early_absence` | invalidazione mirata delle query Calendar/detail già presenti |
| Message read | `setQueryData` su Messages list, detail, unread count e Dashboard | nessuna invalidazione globale: il valore server è noto e l'evento custom aggiorna anche consumer shell |
| Nuovo messaggio/evento esterno | nessun realtime aggiunto in questo goal | focus/reconnect e staleTime breve aggiornano le query pertinenti |
| Profile mutation | nessuna mutation atleta rilevata nel codice corrente | invalidare solo Profile quando sarà introdotta una mutation profile |

Le invalidazioni esistenti sono key-specifiche; non sono stati introdotti `invalidateQueries()` root o refetch globali.

## Refresh legacy e timer

- I listener `online` presenti nei manager aggiornano lo stato offline/UI; il fetch è delegato a TanStack Query o, per i componenti già migrati, a `refetch()` esplicito dell'utente.
- Il timer `next_recalculation_at` è mantenuto perché rappresenta una transizione time-based reale dell'autorizzazione alla risposta; invalida solo il subject corrente.
- `AthleteFeesManager` contiene ancora il vecchio fetch manuale, ma non è montato dalla route attiva `/athlete/fees`, che usa `AthleteAdministrationManager`. Resta debito tecnico separato e non è stato alterato in questo goal.
- Nessun polling frequente è configurato sulle query atleta.

## Checklist manuale

- Dashboard → Calendar → Dashboard: dati cached immediati entro 90 secondi, senza skeleton completo.
- Profile → Dashboard → Profile: nessun refetch entro 30 minuti.
- Messages → Dashboard → Messages: read state coerente tra lista, dettaglio, badge e preview Dashboard.
- Calendar → Dashboard e Dashboard → Calendar dopo RSVP/early absence: stato coerente immediatamente.
- Focus tab esterna: query fresh statiche non refetchano; query stale/critiche possono aggiornarsi.
- Offline → online: reconnect solo sulle query configurate per il dominio, senza refresh globale.
- Subject A → Subject B: nessun dato visibile di A mentre B carica; le cache restano separate per account+subject.
- Logout → login con altro account: `QuerySessionCacheBoundary` pulisce la cache autenticata.

## Punti ancora aperti

- Il dettaglio allegati usa fetch on-demand locale e non è una query server-state condivisa.
- Il badge e i messaggi hanno endpoint distinti (`countOnly`/`minimal`); la sincronizzazione locale riduce il costo delle mutation, ma non consolida i contratti API.
- Non è stato introdotto realtime Supabase né persistence della Query Cache.
