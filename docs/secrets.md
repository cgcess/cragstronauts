# Secrets

All Cragstronauts secrets live in [ZeroVault](https://dash.zeroapps.dev/vault),
the secrets manager. The local dev files and the Cloudflare Worker production
secrets are **generated artifacts** pulled from ZeroVault — never hand-edit
them.

The `zero` CLI is pinned as a root dev dependency (`@zeroapps/cli`), so the
scripts call it via `pnpm exec zero`. Run `pnpm install` first.

## Projects and files

Two projects, each with a `development` and a `production` environment:

| Project                | Env           | Generated file             | Consumed by                    |
| ---------------------- | ------------- | -------------------------- | ------------------------------ |
| `cragstronauts-worker` | `development` | `apps/api/.dev.vars`       | Worker runtime, `pnpm turbo dev` |
| `cragstronauts-worker` | `production`  | (pushed to Cloudflare)     | Worker runtime in prod         |
| `cragstronauts-web`    | `development` | `apps/web/.env.local`      | Vite dev build                 |
| `cragstronauts-web`    | `production`  | `apps/web/.env.production` | Vite production build          |

`cragstronauts-worker` holds `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`,
`ADMIN_SECRET` (dev only), `CLERK_WEBHOOK_SIGNING_SECRET`, `DISCORD_WEBHOOK_URL`,
`VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`. `cragstronauts-web`
holds the two public build-time keys, `VITE_CLERK_PUBLISHABLE_KEY` and
`VITE_VAPID_PUBLIC_KEY` (duplicated from the worker's public values so each
project is self-contained).

## One-time setup

You need to be a member of the Cragstronauts ZeroVault org (ask an existing
member to invite you). Then sign in from this repo — no API key to copy:

```bash
pnpm install
pnpm exec zero login     # approve in the browser, pick **Cragstronauts**
```

Picking the organization matters: the sign-in reaches exactly the one you choose
on the consent screen. Run `zero login` again to switch. It belongs to you and
this machine, and `pnpm exec zero logout` ends it without affecting anyone else.

Sanity check (must print the Cragstronauts org):

```bash
pnpm exec zero whoami
```

```
User ID: user_…
Org ID: org_3G8KRCwWMC05TmtRhJLixykNhpf
Credential: signed in as you@example.com
```

The `Credential:` line says which credential answered. If it says `api key` when
you expected your sign-in, an exported `ZERO_API_KEY` is shadowing it.

### If you work across several orgs

A sign-in is machine-wide, so bind this directory to a named context instead and
it wins everywhere inside the repo:

```bash
pnpm exec zero context add cragstronauts --api-key zv_...   # `zero keys create`
cd <this repo>
pnpm exec zero context use cragstronauts
```

Precedence, first match wins: `--api-key flag > per-dir context > ZERO_API_KEY >
sign-in`. So the binding beats a key you exported for another org, and a sign-in
never overrides either.

Keys are per-person, not shared; each teammate makes their own. Do not set
`ZERO_API_URL`: the CLI defaults to `https://api.zeroapps.dev`, a bare origin it
appends `/vault/v1` to. A value ending in `/vault` (from the old `zv` CLI)
produces 404s.

### If you used the old `zv` CLI

`zv` is gone, and nothing carries over. Contexts under `~/.config/zerovault/`
are not read, and `ZEROVAULT_API_KEY` / `ZEROVAULT_API_URL` are ignored — which
is silent, so a stale export looks like "no credentials". Run `zero login`, or
re-add the context with `zero context add`. Your existing `zv_…` keys still
work; only the tool changed.

## Fetch local secrets

```bash
bin/fetch-secrets   # writes .dev.vars, .env.local, .env.production
pnpm turbo dev
```

## Managing values

```bash
zero vault secrets list -p cragstronauts-worker -e development
zero vault secrets get  CLERK_SECRET_KEY -p cragstronauts-worker -e development
zero vault secrets set  ADMIN_SECRET=new-value -p cragstronauts-worker -e development
```

After changing a value, re-run `bin/fetch-secrets` (local) or
`bin/sync-secrets-to-cloudflare` (production Worker) to propagate it. **Never**
hand-edit the generated `.dev.vars` / `.env.*` files — the next fetch overwrites
them.

## Production

```bash
bin/sync-secrets-to-cloudflare   # pushes cragstronauts-worker/production to Cloudflare
bin/deploy                       # sync secrets + refresh build vars + deploy
```

`bin/sync-secrets-to-cloudflare` streams `cragstronauts-worker/production` as
JSON into `wrangler secret bulk`, setting every secret on the `cragstronauts`
worker in one call. Run it from the repo root so the context binding applies;
Cloudflare secrets are write-only, so ZeroVault is the source of truth.

## CI

CI has no browser and no local context binding, so it uses the env-var path: the
GitHub Actions secret `ZERO_API_KEY` feeds `bin/fetch-secrets` before the build.
Fork PRs have no secret access, so the fetch step is skipped; the build tolerates
missing web vars (Clerk/VAPID reads throw only at runtime), so the check still
passes.

The CLI exits `1` when the API refuses a request (bad key, missing project) and
`75` when it could not be reached or was failing, so a retry wrapper can tell the
two apart.
