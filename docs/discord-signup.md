# Clerk webhook → Discord signup notice

`POST /api/webhooks/clerk` is a public route (no Clerk JWT) authenticated by the
Svix signature Clerk attaches to every webhook. On `user.created` it posts a
signup line to a Discord channel via an incoming webhook URL. The Discord call
runs in the background (`executionCtx.waitUntil`); the route returns `200`
immediately and never 5xxes on a Discord outage, so Clerk does not retry. A
bad or missing signature returns `401`. Non-`user.created` events return `200`
and post nothing.

The route sits under `/api/*`, so `clerkMiddleware()` runs on it, but only to
populate auth — it does not gate the request. `tripAccess` is scoped to
`/api/trips/:trip_id/*`, so it never touches this route.

Message format (name and email included, degrading gracefully):

```
🎉 New signup: Alice Smith — alice@example.com (user_abc123)
```

Code: `apps/api/src/routes/clerk-webhook.ts` (route + `formatSignupMessage` +
`handleClerkEvent`) and `apps/api/src/discord.ts` (`notifyDiscord`).

## Secrets

Both are secrets — never commit real values. They live in `.dev.vars`
(gitignored) locally and the Worker secret store in production.

- `CLERK_WEBHOOK_SIGNING_SECRET` — `whsec_…`, from the Clerk Dashboard webhook
  endpoint.
- `DISCORD_SIGNUP_WEBHOOK_URL` — the Discord channel's incoming webhook URL.

Local (`apps/api/.dev.vars`):

```
CLERK_WEBHOOK_SIGNING_SECRET=whsec_...
DISCORD_SIGNUP_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

Production:

```bash
cd apps/api
wrangler secret put CLERK_WEBHOOK_SIGNING_SECRET
wrangler secret put DISCORD_SIGNUP_WEBHOOK_URL
pnpm cf-typegen   # regenerate worker-configuration.d.ts after adding secrets
```

If either secret is ever committed, rotate it: regenerate the Discord webhook
in the channel's integration settings, and roll the signing secret from the
Clerk dashboard webhook endpoint.

## Clerk Dashboard (one-time)

Dashboard → Webhooks → Add endpoint:

- URL: `https://<deployed-cragstronauts-host>/api/webhooks/clerk`
- Events: `user.created`

Copy the endpoint's signing secret into `CLERK_WEBHOOK_SIGNING_SECRET`.
