---
name: zerovault
description: Manage secrets and environment variables for a project with ZeroVault. Use when provisioning API keys or environment secrets, creating or reading secrets with the `zv` CLI, loading secrets into a process, a .env file, or a CI job, or syncing a vault between environments.
---

# ZeroVault

ZeroVault stores per-app secrets and serves them to any process through the `zv`
CLI. The CLI runs anywhere Node runs: a laptop, a CI job, a container entrypoint.

## Object model

An **organization** owns **projects**; each project has **environments**
(`development` and `production` by default); each environment holds a flat set of
key/value **secrets**. API keys are organization-scoped: one `zv_...` key reaches
every project and environment, and the same key authorizes ZeroErrors.

## Install and authenticate

Run the CLI without installing (pin `@0.2.2`):

```bash
pnpm dlx zerovault-cli@0.2.2 --help    # command is `zv`
```

Create your first key in the dashboard (dash.zeroapps.dev -> **API keys**); it is
shown once. Then:

```bash
export ZEROVAULT_API_KEY=zv_your_key_here
zv whoami                              # prints user + org id; confirms the key
```

Auth precedence, first match wins: `--api-key` flag > directory context (`zv
context`) > `ZEROVAULT_API_KEY` env. Base URL resolves the same way and defaults
to `https://api.zeroapps.dev/vault`; override with `--base-url` or
`ZEROVAULT_API_URL` to target another instance.

Gotcha: `zv --version` misreports `0.2.1` on the `0.2.2` package. Pin `@0.2.2`.

## Commands that matter

```bash
zv projects create demo
zv projects list

zv secrets set API_TOKEN=abc123 -p demo -e production   # create-or-update; pass more KEY=VALUE to set several
zv secrets list   -p demo -e production                 # values masked
zv secrets get    API_TOKEN -p demo -e production        # prints the value
zv secrets delete API_TOKEN -p demo -e production

zv secrets download -p demo -e production -f env -o .env   # -f env|json|yaml|shell (default env)

zv keys create -l ci        # new key, shown once
zv keys list
zv keys revoke <id>
```

`zv export` / `zv import <file>` move a whole vault (every project, environment,
and secret) as a version:1 JSON document. `import` is re-runnable and converges to
the file.

## Load secrets into a process

`zv secrets download` writes the environment in the format the target reads.
Every download is plaintext; delete the file once loaded.

Into a `.env` for a Node/TS service:

```bash
zv secrets download -p demo -e production -f env -o .env   # KEY=VALUE lines
node -r dotenv/config server.js
rm .env
```

Into a CI job's environment, no file on disk:

```bash
eval "$(zv secrets download -p demo -e production -f shell)"   # export KEY="VALUE" lines
```

`-f env` emits `KEY=VALUE`; `-f shell` emits `export KEY="VALUE"` for sourcing;
`-f json` emits a flat `{ "KEY": "VALUE" }` object; `-f yaml` emits `KEY: "VALUE"`.

## Optional: Cloudflare Workers

One platform among others. Push the environment to a Worker at deploy time by
handing the JSON download to `wrangler`:

```bash
zv secrets download -p demo -e production -f json -o secrets.json
npx wrangler secret bulk secrets.json
rm secrets.json
```

To block a deploy when a secret is missing, add the names to `secrets.required` in
`wrangler.jsonc` (`{ "secrets": { "required": ["API_TOKEN"] } }`). `wrangler
deploy` then aborts if `API_TOKEN` is unset; it is not enforced on `wrangler
deploy --dry-run`.

Full reference: https://docs.zeroapps.dev/vault/cli/
