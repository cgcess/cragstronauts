# Cragstronauts

Climbing trip coordination app. Organizer creates a trip, participants join via link, answer signup questions, then manage cars, gear, and expenses from a shared dashboard.

## Stack

pnpm workspaces + turborepo monorepo with three packages:

- `apps/web` — React 18, Vite, framer-motion, react-router
- `apps/api` — Cloudflare Worker, Hono, Durable Objects with SQLite (do-orm)
- `packages/contract` — Zod schemas and route contracts

## Local development

```bash
pnpm install
pnpm turbo dev
```

Frontend runs at http://localhost:3000, API at http://localhost:8787.

## Checks

Run all checks before pushing:

```bash
pnpm turbo typecheck build
npx vitest run
```

These same checks run in CI on every push to main and on PRs.

## Resetting local state

- Delete `apps/api/.wrangler/` to wipe the local database.
- Clear `climbingTrip.userId` and `climbingTrip.signupDone.*` from localStorage to switch user.
