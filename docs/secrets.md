# Secrets

All Cragstronauts secrets live in [ZeroVault](https://zerovault.juanibiapina.dev),
the self-hosted secrets manager. The local dev files and the Cloudflare Worker
production secrets are **generated artifacts** pulled from ZeroVault — never
hand-edit them.

The `zv` CLI is pinned as a root dev dependency (`zerovault-cli`), so the scripts
call it via `pnpm exec zv`. Run `pnpm install` first.

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
member to invite you). Then create your **own** personal API key and bind it to
this repo's directory:

```bash
# 1. Create a personal API key (ZeroVault web portal, or `zv keys create`).
# 2. Register it as a named context (base URL defaults to the prod deployment):
npx zerovault-cli@0.2.0 context add cragstronauts --api-key zv_...

# 3. Bind this repo directory (and subdirs) to that context:
cd <this repo>
npx zerovault-cli@0.2.0 context use cragstronauts
```

Why the directory binding matters: resolution precedence is
`--api-key flag > per-dir context > env > default`. The binding **beats** any
global `ZEROVAULT_API_KEY` you may have exported for a different org, so plain
`zv` inside this repo always targets Cragstronauts. It also needs no
`ZEROVAULT_API_URL` — the CLI defaults to `https://zerovault.juanibiapina.dev`.

Keys are per-person, not shared; each teammate makes their own.

Sanity check (must print the Cragstronauts org):

```bash
pnpm exec zv whoami
```

## Fetch local secrets

```bash
bin/fetch-secrets   # writes .dev.vars, .env.local, .env.production
pnpm turbo dev
```

## Managing values

```bash
zv secrets list -p cragstronauts-worker -e development
zv secrets get  CLERK_SECRET_KEY -p cragstronauts-worker -e development
zv secrets set  ADMIN_SECRET=new-value -p cragstronauts-worker -e development
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

CI has no local context binding, so it uses the env-var path: the GitHub Actions
secret `ZEROVAULT_API_KEY` feeds `bin/fetch-secrets` before the build. Fork PRs
have no secret access, so the fetch step is skipped; the build tolerates missing
web vars (Clerk/VAPID reads throw only at runtime), so the check still passes.
