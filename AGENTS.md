# Cragstronauts

Climbing trip coordination app. Organizer creates a trip, participants join via link, answer signup questions, then manage cars, gear, polls, and expenses from a shared dashboard.

Polls are organizer-defined multiple-choice questions (e.g. "Can you lead belay?", "Do you eat meat?") with a question, optional context/description, an emoji, and 2+ options. Each participant picks one option for now; the model (a `poll_answer` row per selected option) is built to allow multiple selections later without changes. Lead-belay is itself a seeded poll. Answers are captured in the signup deck and editable from the dashboard Polls card, which tallies each option plus who's still unanswered.

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
- Clear `climbingTrip.userId` from localStorage to switch user. The board is public; identity is established lazily on the first write (joining a car, adding gear, adding an expense) via the full-screen `IdentityFlow` overlay — type a name (or pick yourself), then the skippable questionnaire (swipe cards for yes/no questions, tap-to-pick cards for polls) — after which the original action resumes.
