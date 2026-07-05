# Real-time trip updates

When one participant changes anything on a trip (joins a car, answers a poll,
adds gear or an expense, edits the trip, …), every other participant currently
viewing that trip refetches within ~1s, no manual reload.

## Design: invalidate-and-refetch, not deltas

The server broadcasts a tiny **"something changed"** signal, never row data. The
client reacts by re-running its trip loads: `TripLayout.refresh` reloads the
context slices (trip, users, categories, gear, declines, polls, poll answers),
and any screen holding its own fetched slices reloads them via
`subscribeToChanges` (the dashboard's cars, dogs, expenses, balances). Those
loads are cheap and idempotent, so there is zero client merge logic and no
ordering hazard. A leaked frame reveals only "this trip changed".

Message (server → client): `{ "type": "changed", "resource"?: string }`.
`resource` is an optional path tag (`"cars"`, `"polls"`, …) reserved for a later
targeted-refetch optimization; v1 refetches everything. Client → server:
nothing meaningful — heartbeats use the runtime's auto-response.

## Transport: Hibernatable WebSockets on `TripDO`

The channel lives on the existing per-trip `TripDO` (the single writer), so
`broadcast` is a local `getWebSockets()` fan-out with no extra hop. Hibernation
keeps idle viewers from holding the DO resident; a `broadcast` RPC re-wakes it,
and `getWebSockets()` returns the live sockets. `setWebSocketAutoResponse("ping"
→ "pong")` answers heartbeats without waking the DO.

`fanOut` (`apps/api/src/lib/realtime.ts`) is extracted and unit-tested; a dead
socket can't abort the rest of the fan-out. The lifecycle handlers
(`webSocketClose`/`webSocketError`) only `ws.close()` — no storage writes, which
would wake/bill the DO on every disconnect. There is no per-connection state, so
no `serializeAttachment`.

## Auth: connect-time only, no refresh

Browsers can't set an `Authorization` header on `new WebSocket`, so the upgrade
is intercepted in the Worker entry (`apps/api/src/index.ts`) **before Hono**. The
token rides in the WebSocket subprotocol (`clerktoken, <jwt>`) to keep it out of
URLs and logs — `observability` is on, so `?token=` could land in logs; the
query param stays only as a fallback for proxies that strip the header.

`resolveAccountFromToken` verifies the JWT (`@clerk/backend` `verifyToken`), then
the same pure `decideTripAccess` gate used for REST runs with
`action: "read-summary"`. Private trip + no valid member token → `401`/`403`, no
upgrade. Public trip → open.

Auth is verified **once**, at the handshake. After the `101` the socket is a raw
pipe with no per-message auth, and hibernation wake never re-consults the token.
An expired token can't reach `new WebSocket` because the client's reconnect loop
calls `getAuthToken()` freshly each attempt. There is no token-refresh path.

## Broadcast trigger: one middleware, on 2xx mutations

`broadcastOnMutation` (`apps/api/src/middleware/broadcast.ts`) is registered once
on `/api/trips/:trip_id/*`, right after `tripAccess`. It awaits `next()`, then
if the request was a `POST`/`PATCH`/`DELETE` **and** the response is 2xx, it
schedules `getTripDO(env, tripId).broadcast(resource)` via
`c.executionCtx.waitUntil` — fire-and-forget, off the hot path. One place
instead of ~30 routes; fires only on confirmed success; a throwing broadcast
can't affect the mutation response. Self-echo to the actor is harmless (refetch
is idempotent).

## Client hook

`useTripSocket(tripId, enabled, onChange)` (`apps/web/src/lib/useTripSocket.ts`)
connects when the viewer can read the trip (`member` or `public`), debounces the
`changed` signal ~250ms so a burst collapses to one refetch, sends a `"ping"`
heartbeat every ~30s, and reconnects with capped exponential backoff, fetching a
fresh token per attempt. `nextBackoff` and `makeDebounce` are pure and
unit-tested. `TripLayout` wires `onChange` to a handler that both calls
`refresh` (context slices) and fans out to `subscribeToChanges` listeners
(screen-owned slices like the dashboard's cars/dogs/expenses/balances).

## Dev proxy

`apps/web/vite.config.ts` proxies `/api` with `ws: true` so the upgrade reaches
`:8787` in dev. In prod the Worker serves assets and `/api/*` same-origin, and
`run_worker_first: ["/api/*"]` (in `wrangler.jsonc`) is what lets the Worker —
not the asset handler — see `/api/trips/<hex>/ws` and intercept the upgrade. Keep
that config intact.

See `docs/trip-visibility.md` for the shared `decideTripAccess` gate.
