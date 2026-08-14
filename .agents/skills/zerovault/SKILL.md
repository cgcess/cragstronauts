---
name: zerovault
description: Manage secrets and environment variables for a project with ZeroVault. Use when provisioning API keys or environment secrets, creating or reading secrets with the `zero` CLI, loading secrets into a process, a .env file, or a CI job, or syncing a vault between environments.
---

# ZeroVault

ZeroVault stores per-app secrets and serves them to any process through the
`zero` CLI, under `zero vault`. The CLI runs anywhere Node runs: a laptop, a CI
job, a container entrypoint.

## Object model

An **organization** owns **projects**; each project has **environments**
(`development` and `production` by default); each environment holds a flat set of
key/value **secrets**. API keys are organization-scoped: one `zv_...` key reaches
every project and environment, and the same key authorizes ZeroErrors.

## Install and authenticate

Run the CLI without installing (pin `@0.4.1`):

```bash
pnpm dlx @zeroapps/cli@0.4.1 --help    # command is `zero`
```

Two ways to authenticate. On a human's machine, sign in with a browser:

```bash
zero login                             # approve, and pick an organization
zero whoami                            # user + org id, and which credential answered
zero logout                            # revokes this machine's sign-in
```

The sign-in is per user and per machine, carries exactly the organization picked
on the consent screen, and is stored in `~/.config/zero/config.json` (mode 0600).
`zero login --port 8976` pins the callback port for an `ssh -L` forward. There is
no headless sign-in: unattended machines use a key.

For CI, servers and anything unattended, use an API key. Create the first one in
the dashboard (dash.zeroapps.dev -> **API keys**), or from a signed-in terminal
with `zero keys create`; it is shown once.

```bash
export ZERO_API_KEY=zv_your_key_here
zero whoami                            # prints user + org id; confirms the key
```

Auth precedence, first match wins: `--api-key` flag > directory context (`zero
context`) > `ZERO_API_KEY` env > `zero login` sign-in. A sign-in is last because
it is machine-wide state, so an exported key still wins; `zero whoami` names the
credential that answered. Base URL resolves the same way and defaults to
`https://api.zeroapps.dev`, a bare origin the CLI appends `/vault/v1` to;
override with `--base-url` or `ZERO_API_URL` to target another instance.

The `zv` CLI it replaced is gone: `ZEROVAULT_API_KEY`, `ZEROVAULT_API_URL`, and
contexts in `~/.config/zerovault/` are not read, and a base URL ending in
`/vault` produces 404s.

## Commands that matter

```bash
zero vault projects create demo
zero vault projects list

zero vault secrets set API_TOKEN=abc123 -p demo -e production   # create-or-update; pass more KEY=VALUE to set several
zero vault secrets list   -p demo -e production                 # values masked
zero vault secrets get    API_TOKEN -p demo -e production        # prints the value
zero vault secrets delete API_TOKEN -p demo -e production

zero vault secrets download -p demo -e production -f env -o .env   # -f env|json|yaml|shell (default env)

zero keys create -l ci        # new key, shown once
zero keys list
zero keys revoke <id>
```

`zero vault export` / `zero vault import <file>` move a whole vault (every project, environment,
and secret) as a version:1 JSON document. `import` is re-runnable and converges to
the file.

## Load secrets into a process

`zero vault secrets download` writes the environment in the format the target reads.
Every download is plaintext; delete the file once loaded.

Into a `.env` for a Node/TS service:

```bash
zero vault secrets download -p demo -e production -f env -o .env   # KEY=VALUE lines
node -r dotenv/config server.js
rm .env
```

Into a CI job's environment, no file on disk:

```bash
eval "$(zero vault secrets download -p demo -e production -f shell)"   # export KEY="VALUE" lines
```

`-f env` emits `KEY=VALUE`; `-f shell` emits `export KEY="VALUE"` for sourcing;
`-f json` emits a flat `{ "KEY": "VALUE" }` object; `-f yaml` emits `KEY: "VALUE"`.

## Optional: Cloudflare Workers

One platform among others. Push the environment to a Worker at deploy time by
handing the JSON download to `wrangler`:

```bash
zero vault secrets download -p demo -e production -f json -o secrets.json
npx wrangler secret bulk secrets.json
rm secrets.json
```

To block a deploy when a secret is missing, add the names to `secrets.required` in
`wrangler.jsonc` (`{ "secrets": { "required": ["API_TOKEN"] } }`). `wrangler
deploy` then aborts if `API_TOKEN` is unset; it is not enforced on `wrangler
deploy --dry-run`.

Full reference: https://docs.zeroapps.dev/cli/overview/ and
https://docs.zeroapps.dev/vault/cli/
