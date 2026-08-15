# Secrets

All Cragstronauts secrets live in [ZeroVault](https://dash.zeroapps.dev/vault),
the secrets manager. Nothing is written to disk: `zero vault run` gives a
command the secrets it needs and removes every trace when the command exits.
There is no `bin/fetch-secrets` and there are no generated `.dev.vars` or
`.env.*` files.

The `zero` CLI is pinned as a root dev dependency (`@zeroapps/cli`), so the
scripts call it via `pnpm exec zero`. Run `pnpm install` first.

## Projects and files

Two projects, each with a `development` and a `production` environment:

| Project                | Env           | How it reaches the process                          |
| ---------------------- | ------------- | --------------------------------------------------- |
| `cragstronauts-worker` | `development` | mounted as `apps/api/.dev.vars` while `wrangler dev` runs |
| `cragstronauts-worker` | `production`  | pushed to Cloudflare by `bin/sync-secrets-to-cloudflare` |
| `cragstronauts-web`    | `development` | environment variables around `pnpm dev`             |
| `cragstronauts-web`    | `production`  | environment variables around `pnpm run deploy`      |

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

## Run the app

```bash
pnpm dev
```

That is `zero vault run -p cragstronauts-web -e development -- turbo run dev`.
The web values become environment variables that Vite reads, and the Worker's
own script adds `--mount .dev.vars`, which serves the worker secrets through a
named pipe that exists only while `wrangler dev` runs.

Two rules follow from the mount:

- A leftover real `apps/api/.dev.vars` file wins over everything, and the mount
  refuses to start while it exists. Delete it.
- Every worker secret must be listed in `secrets.required` in
  `apps/api/wrangler.jsonc`. Wrangler binds only the secrets named there, so an
  unlisted one never reaches the worker and nothing says so.

With no network, the commands exit with status 75 and nothing starts.

## Managing values

```bash
zero vault secrets list -p cragstronauts-worker -e development
zero vault secrets get  CLERK_SECRET_KEY -p cragstronauts-worker -e development
zero vault secrets set  ADMIN_SECRET=new-value -p cragstronauts-worker -e development
```

A changed value reaches local development on the next `pnpm dev`, with nothing
to re-fetch. For the production Worker, run `bin/sync-secrets-to-cloudflare`.

## Production

```bash
bin/sync-secrets-to-cloudflare   # pushes cragstronauts-worker/production to Cloudflare
bin/deploy                       # sync secrets, then build + deploy
```

`bin/sync-secrets-to-cloudflare` streams `cragstronauts-worker/production` as
JSON into `wrangler secret bulk`, setting every secret on the `cragstronauts`
worker in one call. Run it from the repo root so the context binding applies;
Cloudflare secrets are write-only, so ZeroVault is the source of truth.

## CI

CI holds no ZeroVault credential at all. It sets placeholder values for the two
public build-time keys, because it proves that the code compiles and passes its
tests, not that the configuration is right. Push and pull request runs are
therefore identical, including runs from forks.

The CLI exits `1` when the API refuses a request (bad key, missing project) and
`75` when it could not be reached or was failing, so a retry wrapper can tell the
two apart.
