# Cragstronauts

A small webapp for coordinating a single group climbing trip: the organizer sets up the trip (location, dates, accommodation, gear categories), and other participants load the app, join, complete a signup swipe, and contribute cars and gear from the main tabs.

## Architecture

- **Worker** (`apps/api`) — Cloudflare Worker using Hono. Serves the JSON API under `/api/*` and the frontend as static assets.
- **Durable Object** — `TripDO` with SQLite storage holds all state in a single instance (named `"default"`). Schema managed via do-orm migrations. It also hosts a Hibernatable WebSocket channel that broadcasts a "changed" signal to connected viewers so a mutation by one participant is picked up by the others within ~1s (see `docs/realtime-updates.md`).
- **Frontend** (`apps/web`) — React 18 + Vite + framer-motion. A state machine in `src/App.jsx` routes between the Organizer Wizard, Landing, Signup Swipe, and the Main Tabs (Info / Cars / Gear).

## Requirements

- Node.js 18+ and pnpm

## Running locally

Fetch the local secrets first (needs Clerk app membership and a logged-in Clerk
CLI). This writes the gitignored `apps/api/.dev.vars` and `apps/web/.env.local`:

```bash
bin/fetch-secrets
```

Then:

```bash
pnpm install
pnpm turbo dev
```

This starts both servers:
- **Frontend (Vite + HMR)**: http://localhost:3000
- **API (Wrangler)**: http://localhost:8787

Open http://localhost:3000 for development.

## Deploying

```bash
pnpm turbo deploy
```

Builds the frontend, then deploys the worker + static assets to Cloudflare.

## Resetting

- **Wipe the trip:** Delete the `.wrangler` directory to reset local dev state.
- **Switch user in the browser:** use the "switch user" action in the UI, or clear the `climbingTrip.userId` and `climbingTrip.signupDone.*` keys from localStorage.

## TODO
- When initially joining a trip, the app should immediately ask the initial questions upon entering the user's name
- Make the UI nicer.
