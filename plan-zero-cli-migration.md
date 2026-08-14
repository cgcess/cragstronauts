# Plan: move Cragstronauts from the `zv` CLI to `zero`

## Goal

Every secrets path in this repo (scripts, docs, CI, agent skill) uses the
supported `@zeroapps/cli` (`zero`) instead of the retired `zerovault-cli` (`zv`),
and a human setting up the repo signs in with a browser instead of hand-copying
an API key.

## Background a fresh reader needs

- ZeroVault's CLI was replaced upstream: `zerovault-cli` (`zv`) is gone and
  `@zeroapps/cli` (command `zero`, current `0.4.1`) took over. Vault commands
  moved under a product prefix: `zv secrets list` is now
  `zero vault secrets list`. Flags are unchanged.
- The rename is not a rewrite of the credentials: the same `zv_…` key works.
  What changed is the **env var** (`ZEROVAULT_API_KEY` → `ZERO_API_KEY`), the
  **base URL** (`ZEROVAULT_API_URL` → `ZERO_API_URL`, now a bare origin: the CLI
  appends `/vault/v1` itself, so a value ending in `/vault` produces 404s), and
  the **config file** (`~/.config/zerovault/config.json` is not read; contexts
  must be re-added with `zero context add`).
- Nothing is broken today. The pinned `zerovault-cli@0.2.3` still reaches the
  live API: its default `https://api.zeroapps.dev/vault` plus its own `/v1`
  prefix lands on the same `/vault/v1` route, verified by a bogus key returning
  `401 Invalid API key` rather than a 404. This migration is about being on the
  supported tool, not about restoring service. Nothing here is urgent, and it
  can ship as one PR.
- New capability worth adopting: `zero login` signs the CLI in through the
  browser and stores a per-user, per-machine, org-scoped credential, so a new
  contributor no longer needs a key at all. Precedence is
  `--api-key > directory context > ZERO_API_KEY > sign-in`, so the repo's
  directory-context trick still wins over anything ambient, and CI is unaffected.
  Unattended runtimes (CI) still need a key: there is no headless sign-in.
- `zero whoami` now prints a `Credential:` line naming which of those answered,
  which is the fastest way to prove a teammate is on the right org.

## What to change and why

### 1. The pin (`package.json`)

Replace the `zerovault-cli: "0.2.3"` devDependency with
`@zeroapps/cli: "0.4.1"`. The scripts call it through `pnpm exec zero`.

Note for `AGENTS.md`: the old pin was described as carrying "the vault host
default", which was true when the host moved. The new CLI's default is
`https://api.zeroapps.dev` and that sentence should go, replaced by "bump the
pin to pick up CLI fixes".

### 2. The scripts (`bin/fetch-secrets`, `bin/sync-secrets-to-cloudflare`)

Change `ZV="pnpm exec zv"` to `ZERO="pnpm exec zero"` and every call from
`$ZV secrets …` to `$ZERO vault secrets …`. Flags are identical
(`-p`, `-e`, `--format`, `--output`), verified against `zero vault secrets
download --help` in 0.4.1.

Update the auth comment blocks: they name `zv context use` and
`ZEROVAULT_API_KEY`. New text should say `zero context use` and `ZERO_API_KEY`,
and can mention that a `zero login` on the machine sits below both, so it cannot
hijack the repo's binding.

### 3. CI (`.github/workflows/ci.yml`)

The job-level env is `ZEROVAULT_API_KEY: ${{ secrets.ZEROVAULT_API_KEY }}` and
the fetch step is skipped when it is empty (fork PRs). Rename both the env key
and the GitHub secret to `ZERO_API_KEY`.

Order matters, since the two steps are in different systems:

1. `gh secret set ZERO_API_KEY` with the same value as the existing secret (its
   value cannot be read back, so take it from ZeroVault or mint a fresh key with
   `zero keys create -l cragstronauts-ci`; a fresh key is preferable, it costs
   nothing and rotates a two-month-old credential).
2. Merge the workflow change.
3. `gh secret delete ZEROVAULT_API_KEY` once a green run proves the new name
   works.

Keep the `if: ${{ env.ZERO_API_KEY != '' }}` guard exactly as is: fork PRs still
get no secret and the build still tolerates missing web vars.

### 4. Docs (`docs/secrets.md`)

The one-time setup section is the piece that changes shape, not just names.
Recommended structure:

- **Setting up (humans):** `pnpm install`, then `pnpm exec zero login`, pick the
  Cragstronauts organization on the consent screen, then `pnpm exec zero whoami`
  to confirm the org and see `Credential: signed in as …`. No key, no context.
- **If you work across several orgs:** keep the existing directory-context
  advice, updated to `zero context add cragstronauts --api-key zv_…` and
  `zero context use`. Explain that a directory context beats both `ZERO_API_KEY`
  and a sign-in, which is exactly why this repo uses it.
- **CI:** the `ZERO_API_KEY` secret, unchanged in spirit.
- Delete the paragraph about `--base-url` pointing at a retired host and the one
  claiming the default is `https://api.zeroapps.dev/vault`: the default is now
  the bare origin `https://api.zeroapps.dev`, and a `/vault` suffix is a bug.
- Add the exit codes worth scripting against: `1` the API refused, `75` it was
  unreachable or failing (`bin/deploy` could use this later; not in scope).
- Update the `zv secrets …` examples under "Managing values" to
  `zero vault secrets …`.

`docs/secrets.md` also opens with a link to `https://api.zeroapps.dev/vault` as
if it were a web portal. The dashboard is `https://dash.zeroapps.dev`; fix it
while there.

### 5. Agent skill (`.agents/skills/zerovault/`, `skills-lock.json`)

The committed skill is the upstream `juanibiapina/zero-skills` copy from the `zv`
era (it still says "pin `@0.2.2`" and teaches `zv`). Upstream has been rewritten
for `zero`, including `zero login` and the 0.4.1 pin, so this is a refresh, not
an edit: run `npx skills update` (or
`npx skills add juanibiapina/zero-skills -s zerovault`) and commit both the
regenerated `SKILL.md` and the new `computedHash` in `skills-lock.json`. Never
hand-edit the vendored skill: the hash is what proves it matches upstream.

Consider adding the `zeroerrors` skill in the same pass only if this project
reports errors to ZeroErrors; it does not today, so leave it out.

### 6. `AGENTS.md` (`CLAUDE.md` is a symlink to it)

Update the secrets paragraph: bind with `zero context use` or just
`zero login`, the skill is refreshed with `npx skills update`, and the pin is
`@zeroapps/cli`. Drop the "pin carries the vault host default" sentence.

## Tests

This repo has no test coverage for the secrets scripts and does not need new
unit tests for a rename. Verification is behavioral, in this order:

1. `pnpm install && pnpm exec zero whoami` prints the Cragstronauts org.
2. `bin/fetch-secrets` regenerates `apps/api/.dev.vars`, `apps/web/.env.local`
   and `apps/web/.env.production`, and `git status` shows them unchanged in
   content (they are gitignored; compare against a copy taken before the run).
   This is the real proof: same values, new tool.
3. `pnpm turbo typecheck build` and `npx vitest run` stay green.
4. A CI run on the PR with the new secret name shows the "Fetch secrets" step
   executing, not skipping.
5. `bin/sync-secrets-to-cloudflare` is **not** part of the PR verification: it
   writes production Worker secrets. Run it once, deliberately, after merge, and
   check `wrangler secret list` afterwards.

## Docs to update

`docs/secrets.md`, `AGENTS.md`, the two `bin/` script headers, and the vendored
skill (regenerated, not written). No changelog: this repo keeps none.

## Skills to use

- `workspace` — locating and pulling the repo before touching it.
- `git-commit` and `open-pr` — this lands as one PR, per repo convention.
- `technical-writing` — the `docs/secrets.md` rewrite is most of the work.
- `cli-design` — only if the scripts grow exit-code handling.

## Acceptance criteria

- No `zv`, `zerovault-cli`, `ZEROVAULT_API_KEY` or `ZEROVAULT_API_URL` remains
  anywhere outside historical plan files (`rg` proves it).
- A fresh contributor can follow `docs/secrets.md` with no API key: `pnpm
  install`, `zero login`, `bin/fetch-secrets`, `pnpm turbo dev`.
- `bin/fetch-secrets` produces byte-identical files to the ones the `zv` version
  produced.
- CI is green with `ZERO_API_KEY`, the fetch step runs on a branch push, and the
  old secret is deleted.
- The vendored skill matches upstream (`skills-lock.json` hash regenerated by the
  tool, not by hand) and teaches `zero`, including `zero login`.

## Risks

- **Losing the CI secret's value.** It cannot be read back from GitHub. Mint a
  fresh key from a signed-in terminal (`zero keys create -l cragstronauts-ci`)
  rather than hunting for the old one, and revoke the old key afterwards from
  `zero keys list`.
- **A teammate's stale context.** Anyone who had `zv context add cragstronauts`
  keeps a config under `~/.config/zerovault/` that the new CLI ignores. They will
  see "no credentials" until they run `zero login` or re-add the context. Say so
  in `docs/secrets.md` under a short "if you used `zv`" note.
- **A stale global `ZEROVAULT_API_KEY` in a shell profile** now does nothing,
  which is silent. `zero whoami`'s `Credential:` line is the diagnostic; point at
  it.
