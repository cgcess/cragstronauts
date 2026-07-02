# Discord notifications

Notable business actions post a short line to a Discord channel via an incoming
webhook. This covers both the Clerk signup notice and a broad set of in-app
events (trips, members, cars, dogs, gear, polls, expenses). One channel, one
secret: `DISCORD_WEBHOOK_URL`.

## How it works

The transport is `apps/api/src/discord.ts` (`notifyDiscord`): it POSTs
`{ content }`, logs and swallows non-2xx and network errors, and never throws.

Business events go through `apps/api/src/events.ts`:

- `formatEvent(event)` — pure. One line per event type, leading emoji, trip
  name, actor and detail where available. Missing names degrade gracefully.
- `trackEvent(env, schedule, event)` — reads `env.DISCORD_WEBHOOK_URL`, **no-ops
  when it is unset** (so local dev without the secret is silent), otherwise
  dispatches the formatted line in the background.
- `trackTripEvent(env, schedule, stub, makeEvent)` — for handlers that hold only
  a `tripId`: it reads the trip name and users off the response hot path (inside
  the backgrounded dispatch), hands them to `makeEvent`, then dispatches.

Route handlers call these after a successful mutation. Dispatch always runs in
the background via `executionCtx.waitUntil`, so a Discord outage or non-2xx
never changes an API response or throws, and the extra enrichment reads stay off
the response hot path. With `DISCORD_WEBHOOK_URL` unset, no Discord calls happen
and every route behaves exactly as before.

The signup path is `apps/api/src/routes/clerk-webhook.ts`: `POST
/api/webhooks/clerk` is a public route authenticated by the Svix signature Clerk
attaches to every webhook. On `user.created` it posts a signup line (`🎉 New
signup: Alice Smith — alice@example.com (user_abc123)`). A bad or missing
signature returns `401`; non-`user.created` events return `200` and post
nothing. The route sits under `/api/*` so `clerkMiddleware()` runs on it (to
populate auth, not to gate); `tripAccess` is scoped to
`/api/trips/:trip_id/*` and never touches this route.

## Tracked events

- **Trip**: created, updated, deleted.
- **Members**: joined (private join and public create), left, claimed, made
  organizer, signup completed.
- **Cars**: created, deleted, seat taken, seat vacated.
- **Dogs**: added, removed, assigned to a car, unassigned from a car.
- **Gear**: contribution added, contribution removed, declined ("not bringing
  one"), decline removed, category added, category removed.
- **Polls**: answered, added, removed.
- **Expenses**: added, updated, deleted.

Messages carry names already visible in-trip; emails are kept out of
business-event messages (only the signup message includes one). Poll answers,
seat changes and gear are the chatty ones — the `AppEvent` union makes gating a
subset behind a verbosity flag a one-place change later if the channel gets
noisy.

## Secrets

Both are secrets — never commit real values. They live in `.dev.vars`
(gitignored) locally and the Worker secret store in production.

- `CLERK_WEBHOOK_SIGNING_SECRET` — `whsec_…`, from the Clerk Dashboard webhook
  endpoint.
- `DISCORD_WEBHOOK_URL` — the Discord channel's incoming webhook URL. Leave it
  unset locally to keep dev silent.

Local (`apps/api/.dev.vars`):

```
CLERK_WEBHOOK_SIGNING_SECRET=whsec_...
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

Production:

```bash
cd apps/api
wrangler secret put CLERK_WEBHOOK_SIGNING_SECRET
wrangler secret put DISCORD_WEBHOOK_URL
```

The URL lives in the manual `Env` augmentation in `apps/api/src/types.ts`, not
the generated types, so no `pnpm cf-typegen` run is needed for it.

If either secret is ever committed, rotate it: regenerate the Discord webhook in
the channel's integration settings, and roll the signing secret from the Clerk
dashboard webhook endpoint.

## Clerk Dashboard (one-time)

Dashboard → Webhooks → Add endpoint:

- URL: `https://<deployed-cragstronauts-host>/api/webhooks/clerk`
- Events: `user.created`

Copy the endpoint's signing secret into `CLERK_WEBHOOK_SIGNING_SECRET`.
