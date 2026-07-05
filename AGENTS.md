# Cragstronauts

Climbing trip coordination app. Organizer creates a trip, participants join via link, answer signup questions, then manage cars, gear, polls, and expenses from a shared dashboard.

Polls are organizer-defined multiple-choice questions (e.g. "Can you lead belay?", "Do you eat meat?") with a question, optional context/description, an emoji, and 2+ options. Each participant picks one option for now; the model (a `poll_answer` row per selected option) is built to allow multiple selections later without changes. Lead-belay is itself a seeded poll. Answers are captured in the signup deck and editable from the dashboard Polls card, which tallies each option plus who's still unanswered.

Gear categories are answerable both ways. Bringing one is a `gear_contribution` row; saying "not bringing one" is a `gear_decline` row (per user, per category, no details), mirroring the explicit-answer poll model. A user's status for a category is **bringing** (≥1 contribution, supersedes any decline), **declined** (a decline and no contribution), or **pending** (neither). Bringing one clears any prior decline server-side (`addGear` deletes it), so the two never coexist. A category's "action needed" / urgency is driven by *pending* categories, not by absence of a contribution — bringing one **or** declining clears it. The dashboard Gear card offers "+ I'm bringing one" and "Not bringing one" while pending, and a quiet "You're not bringing one" line with an undo (`deleteGearDecline`) once declined. A signup-deck "no" swipe on a gear card persists a decline. Both FKs cascade (`ON DELETE CASCADE`), so deleting a user or a category auto-removes their/its declines.

When the identified user still has unanswered polls or pending gear, a horizontal nudge card appears between the dashboard hero and the mosaic tiles, counting both. Tapping it reopens the swipe deck filtered to just that user's outstanding polls and pending gear categories (no joining/driving cards, and it leaves `signup_completed` untouched); a "no" swipe on a gear card there records a decline. The card self-clears once they've answered everything. Gear contributions and declines are loaded into `TripContext` alongside polls so the nudge and the dashboard share state and the card self-clears the moment the deck closes.

Dogs are a first-class resource. A `dog` is owned by a user and created at the trip level (a person *brings* a dog — no car required), then placed in a car via a `car_dog` link (parallel to `car_signup`). A dog occupies a seat like a passenger but is **never a climber**, so it never appears in any climber/user tally — the hero shows a dog count beside the climber count. A dog rides in at most one car; moving it to another car relinks (the UI prompts a switch confirmation naming the previous car). Removing a dog from a car keeps the dog (it returns to `no car`); deleting it from the trip-level Dogs card is what destroys it. Seat capacity (`total_seats - 1`) counts `passengers + dogs + reserved`. Cascades: deleting a car unassigns its dogs, an owner leaving a car unassigns their dogs from it, and deleting a user deletes their dogs. The Dogs dashboard card is the creation/management home; an open car seat opens a chooser where everything you can drop into the seat is a tappable chip — a **People** row and a **Dogs** row — plus a quiet utility row (`🔒 Reserve seat` for the driver, and `+ new dog` which expands a compact name field). A normal member sees just a "You" chip (when not already aboard) and their own dogs; the organizer sees every joining member not already in the car and **every** dog (any owner, with the owner's name appended). Tapping a person seats them; tapping a dog places it (with the move confirm if it's in another car). By default you add a dog for yourself, but the organizer gets an owner picker (joining members) on the trip-level Dogs card to bring a dog on someone else's behalf, and can delete any dog from that card — everyone else can only delete their own. In a car, the organizer can also remove any passenger or dog; everyone else can only remove themselves and their own dogs (a driver can also remove dogs from their car).

## Stack

pnpm workspaces + turborepo monorepo with three packages:

- `apps/web` — React 18, Vite, framer-motion, react-router
- `apps/api` — Cloudflare Worker, Hono, Durable Objects with SQLite (do-orm)
- `packages/contract` — Zod schemas and route contracts

Confirmations use the custom `useConfirm()` hook (`apps/web/src/components/ui`,
mounted via `ConfirmProvider` in `App.tsx`) — `await confirm({ title, message,
confirmLabel, tone })` returns a `Promise<boolean>`. Never use the native
`window.confirm`. Browse the UI kit at `/ui-kit`.

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

## Feedback

Bugs and ideas all funnel into **GitHub Issues** (one hub, triaged with labels:
`type:bug` / `type:idea`, `status:triage`, `reporter:*`). Two ways to file:

- **From your Claude agent:** run `/crag-feedback <your feedback in plain words>` —
  it classifies, dedupe-checks, labels, and opens the issue for you. (Defined in
  `.claude/commands/crag-feedback.md`; you get it just by having this repo checked
  out. Named `crag-feedback` to avoid clashing with Claude Code's built-in
  `/feedback`.)
- **From GitHub:** New issue → the 💬 Feedback form.

Triage later with e.g. *"Claude, list open `status:triage` issues and fix the top 3."*

## Trip visibility & ownership

Trips have a `public` boolean (SQLite migration `0020`, private by default; see `docs/trip-visibility.md`).

- **New trips are private and account-owned.** The creator must be signed in; their Clerk `account_id` is bound to the organizer `user` row. A trip appears in an account's "my trips" list (`GET /api/trips`, backed by the per-account `AccountIndexDO`) only for accounts that own or joined it. Creating a trip and viewing "my trips" require sign-in (`401` otherwise).
- **Sharing a private link lets a signed-in visitor join** (`POST /api/trips/:id/join`) — they get an account-bound member slot and the trip joins their list. On a private trip, identity **is** the Clerk account: no cooperative name-entry / claim / "pick yourself" dance, just the skippable questionnaire after joining.
- **The whole privacy policy is the pure `decideTripAccess`** (`apps/api/src/lib/access.ts`), fronted by one middleware on `/api/trips/:trip_id/*`. Signed-out on a private trip → sign-in prompt; signed-in non-member → join screen; member → full board.
- **A signed-in account's participation in a public trip also lands in its `AccountIndexDO`**, so public trips surface in "my trips", not only the admin finder. There is no public join path, so membership is recognized lazily via `GET /api/trips/:id/users/me` and `POST .../users/:uid/claim`; both call `AccountIndexDO.ensureMember` (best-effort), which preserves an existing role (never downgrades an owner) and self-heals existing members on their next open.
- **Every trip that predates this is grandfathered `public = true`** and behaves exactly as before: no sign-in, anonymous cooperative writes, full `IdentityFlow`. The cooperative identity model below applies **only to public trips**. Löbejün is the one that must never break.

## Resetting local state

- Delete `apps/api/.wrangler/` to wipe the local database.
- Clear `climbingTrip.userId.<tripId>` from localStorage to switch user on a **public** trip. Identity is established lazily on the first write (joining a car, adding gear, adding an expense) via the full-screen `IdentityFlow` overlay — type a name, then the skippable questionnaire (swipe cards for yes/no questions, tap-to-pick cards for polls) — after which the original action resumes.
- On public trips, identity is cooperative, not secured, but guarded against accidental impersonation. A user carries a `claimed` (taken) flag, set the moment a device adopts it — every self-typed user is claimed at creation. Typing your name is the prominent path; "pick yourself" is a collapsed disclosure where taken users show a 🔒 and can't be adopted in one tap. If the typed name collides with someone already on the trip, a confirm offers "that's me" (re-claims via `POST .../users/{id}/claim` — the new-device / cleared-storage re-entry path) or "add a new {name}" (a distinct person). Logout clears only the device's local identity; it never releases a claim. The organizer can also pre-seed members by name from the "Manage members" card; those slots are created **unclaimed** (`POST .../users` with `claimed: false`) so the real person can adopt them in one tap via "pick yourself" later.
