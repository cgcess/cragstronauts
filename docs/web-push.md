# Web Push notifications

When someone joins a car, the car's driver gets a browser push ("Alice hopped
into your car"). Web Push runs end-to-end on the Cloudflare Workers runtime, and
the `sendPushToAccount` seam is built to grow into "notify on any app action"
later.

## Architecture

```
carSignup route ─▶ stub.getUserAccountId(driverUserId)  ← TripDO (trip-local user → Clerk account)
                      │  null (cooperative public-trip driver) ⇒ no-op
                      ▼
                sendPushToAccount(env, schedule, accountStub, notif)
                      │  (backgrounded via executionCtx.waitUntil)
                      ▼
                accountStub.listPushSubscriptions()   ← AccountDO (SQLite)
                      │  for each device:
                      ▼
                buildPushHTTPRequest(...)  ← @pushforge/builder (Web Crypto)
                      │  → { endpoint, headers, body }
                      ▼
                fetch(endpoint, …)  ← the push service (FCM / Mozilla / …)
                      │  404/410 ⇒ accountStub.deletePushSubscription(endpoint)
                      ▼
                browser SW `push` handler → showNotification → click opens board
```

### Subscription storage — in the `AccountDO`

Notification opt-in belongs to the **account**, not a single trip. Storage lives
in the per-account `AccountDO` (one Durable Object per Clerk account,
`idFromName(accountId)`), so **one opt-in per device covers every trip that
account drives on**, and a send fans out to all the account's devices. Account
migration `0001_push_subscription.sql`:

```
push_subscription(id, endpoint UNIQUE, p256dh, auth, created_at)
```

A subscription is still **per device/browser** (one endpoint per device;
permission + `subscribe()` are per-browser). RPC methods on `AccountDO`:
`savePushSubscription` (idempotent per `endpoint` — delete-then-insert),
`listPushSubscriptions`, `deletePushSubscription`.

**Public/cooperative trips get nothing.** Their members have `account_id = null`
(no sign-in), so on the send path `TripDO.getUserAccountId(driverUserId)` returns
`null` and the push is a silent no-op. There is no per-trip fallback — Löbejün
and every public trip behave exactly as before (they never had push).

**Subscribe/unsubscribe routes** are account-scoped and sign-in gated
(`POST`/`DELETE /api/push/subscriptions`, no `trip_id`, no `user_id`). The Clerk
bearer token identifies the account server-side; a signed-out caller gets `401`.

### The sender seam — `apps/api/src/push.ts`

`sendPushToAccount(env, schedule, accountStub, { title, body, url? })` is a deep
module that hides encryption, VAPID, `fetch`, and dead-subscription pruning. It
depends only on the `AccountDO` seam; the trip→account resolution lives in the
car route. It deliberately mirrors `trackEvent`/`trackTripEvent` (the Discord
event system):

- **No-ops** when `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` are unset, so local dev
  and CI stay silent.
- **Backgrounds** the whole send via `schedule`
  (`(p) => c.executionCtx.waitUntil(p)`), so a slow/failing push never touches
  the mutation response.
- **Owns the `fetch`**, so the push service is a cleanly mockable dependency in
  tests (`apps/api/src/push.test.ts`). On `404`/`410` it prunes the dead
  subscription; all errors are swallowed/logged like `notifyDiscord`.

Discord is *broadcast* to one channel (a single formatted string); push is
*targeted* to an account's devices. They're different in kind, so push is its own
module wired directly at the car-join call site — not a `formatEvent` branch.

**Growing it later:** a general "targeted notification" layer can call
`sendPushToAccount`, and because the `AccountDO` already holds the subscriptions
it can even build+fetch from inside an account alarm/background process.

### Client — prompt and toggle

`apps/web/src/lib/push.ts` owns the browser side: `enablePush()` (ask permission
inside a user gesture, subscribe, POST to `/api/push/subscriptions`),
`disablePush()` (unsubscribe + DELETE), and `pushEnabled()` (permission granted
*and* a live browser subscription).

- **One-time prompt** — `NotificationsButton` on the dashboard is a soft-ask
  shown once per device: only when signed in, the browser can subscribe,
  permission isn't already granted, and the device hasn't dismissed it.
  Dismissal is device-local (`localStorage` `crag.push.dismissed`); enabling or
  dismissing hides it for good on that device.
- **Permanent control** — Profile → Account has a Notifications toggle
  (`AccountTab`) that flips `enablePush`/`disablePush` and reflects live state.
  This is also the re-enable path after a device dismissed the prompt.
- **Sign-out** calls `disablePush()` before Clerk `signOut`, so after a
  sign-out/sign-in swap the previous account stops pushing to this device.

**Known limitation (multi-account per browser).** Subscriptions are keyed by
endpoint *within* an account's DO, so the same browser endpoint can linger in a
previously-signed-in account's DO after switching accounts without signing out
first. The sign-out unsubscribe covers the common path; a global
endpoint→account index is the complete fix (deferred).

### Library — PushForge

`@pushforge/builder` is zero-dependency and built on the Web Crypto API, so it
runs on Workers (the classic `web-push` npm package needs Node `crypto` and does
not). `buildPushHTTPRequest(...)` returns `{ endpoint, headers, body }`; we own
the `fetch`.

### Service worker — `apps/web/src/sw.ts`

The generated SW (`generateSW`) can't hold a custom `push` listener, so
`vite-plugin-pwa` runs in **`injectManifest`** mode with a hand-written SW. It
keeps precaching, `skipWaiting` + `clients.claim()`, and the NetworkFirst HTML
shell (see `docs/service-worker-updates.md`), and adds `push` →
`showNotification` and `notificationclick` → focus/open the board.

## VAPID config

Generate one keypair, once:

```
npx @pushforge/builder vapid
```

It prints a **Public Key** (base64url) and a **Private Key (JWK)** JSON string.

All four live in ZeroVault. Set them with `zv secrets set`, then propagate
(`bin/fetch-secrets` for local, `bin/sync-secrets-to-cloudflare` for prod).

| Value                    | ZeroVault location                                          | Secret? |
| ------------------------ | ---------------------------------------------------------- | ------- |
| `VAPID_PRIVATE_KEY` (JWK)| `cragstronauts-worker` / dev + production                  | yes     |
| `VAPID_PUBLIC_KEY`       | `cragstronauts-worker` / dev + production                  | no      |
| `VAPID_SUBJECT`          | `cragstronauts-worker` / dev + production (`mailto:` URL)  | no      |
| `VITE_VAPID_PUBLIC_KEY`  | `cragstronauts-web` / dev + production (same as public)    | no      |

When the API vars are unset the push path no-ops; when the web var is unset the
"Enable notifications" control is hidden.

## Platform constraint (iOS)

Web Push works in a PWA on Chrome/Edge/Firefox (desktop + Android) with the
browser running, and on **iOS/iPadOS Safari 16.4+ only when the app is added to
the Home Screen**. There is no in-browser push on iOS. Since our product is
"join via a shared link" and many participants never install, iOS reach is
limited by design — a product decision deferred past this slice.

## Testing locally

1. Generate keys (above); set the three worker vars in `cragstronauts-worker` and
   `VITE_VAPID_PUBLIC_KEY` in `cragstronauts-web` (both `development`), then run
   `bin/fetch-secrets` to write `apps/api/.dev.vars` and `apps/web/.env.local`.
2. `pnpm turbo dev`.
3. Open the trip on two devices/profiles (Android or desktop Chrome first). Both
   the driver and the joining user must be **signed in** (push is account-scoped).
   On the driver's device, tap **Enable notifications** and allow the prompt (or
   flip the toggle in Profile → Account).
4. From the other user, join the driver's car. The driver's device shows the
   notification; tapping it opens the trip board.
5. iOS: add the app to the Home Screen first, then repeat.

Automated tests cover the seams: `AccountDO` subscription methods,
`TripDO.getUserAccountId`, `sendPushToAccount` (mocked `fetch`), the contract
schemas, and the pure `urlBase64ToUint8Array`. Actual browser subscription +
delivery is validated manually.
