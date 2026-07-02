# Trip visibility, ownership, and join

How trips are gated after PR 1 (ownership + privacy).

## Model

- **Visibility.** Each trip has a `public` boolean (SQLite migration `0020`,
  private by default).
  - `public = true` — the legacy **cooperative** board: no sign-in, anonymous
    writes, full `IdentityFlow`. Every trip that existed before this shipped is
    flipped `public = true`, so it keeps working exactly as before.
  - `public = false` (all new trips) — **private**: only members read/write, and
    the shared link lets a signed-in visitor join.
- **Ownership.** The organizer `user` row carries the creator's Clerk
  `account_id`. Owner = organizer with a bound account. New trips are created
  private and owned.
- **Membership.** An account is a member of a trip iff it has a `user` row there
  with a matching `account_id`.
- **Per-account trip index.** `AccountIndexDO` (one per account,
  `idFromName(accountId)`) holds the trips an account owns or joined, with
  denormalized meta so "my trips" renders in one read. Trip edits/deletes fan
  out to every member's index.

## Access policy

The whole policy is the pure `decideTripAccess` (`apps/api/src/lib/access.ts`),
fronted by one middleware (`apps/api/src/middleware/tripAccess.ts`) mounted on
`/api/trips/:trip_id/*`:

- Public trip → allow every action (anonymous ok).
- Private + signed out → `401`.
- Private + signed-in member → allow.
- Private + signed-in non-member → allow `join` and the summary read
  (`GET /api/trips/:id`); everything else `403`.

`GET /api/trips` (list) and `POST /api/trips` (create) are not under `:trip_id`;
they require a signed-in account in their handlers (`401` otherwise).

## Grandfathering happens in the migration (no lockout window)

A manual "flip every trip public after deploy" step is unworkable during a
gradual rollout: requests hit old or new version at random, so you can't target
the flip at the new version, and the moment any new-version request touches a
trip its default `public = 0` would lock out anonymous users until the flip
raced through.

Instead, migration `0020_trip_public.sql` self-grandfathers:

```sql
ALTER TABLE `trip` ADD COLUMN `public` INTEGER NOT NULL DEFAULT 0;
UPDATE `trip` SET `public` = 1;
```

do-orm runs it once per DO, inside the `TripDO` constructor's
`blockConcurrencyWhile`, **before** any method (including `getVisibility`) can
run. So the first time the new code touches an existing trip, that trip is
already `public = 1` within the same request — there is no window where an
existing trip is private. New trips are created after migrations run, on an
empty table (the `UPDATE` matches nothing), and `initialize()` inserts
`public = 0` → private. Nothing to target, nothing to time.

## Rollout

1. `wrangler versions upload` — uploads a new version and prints its **preview
   URL** (version-specific, does not affect production traffic split).
2. Verify the new version in isolation on that preview URL:
   - `GET /api/version` returns the new version `id`.
   - Signed-out, load Löbejün
     (`cc9480f59198100c0d76f1e869bc7b83078bb845a229f7220a212e649736744a`) and the
     other two trips — each loads with full data, no sign-in (the migration
     flipped them public on first touch).
   - Signed in, create a trip (private + owned, appears in your list), open its
     link from a second account, join.
3. Promote to 100% in one step (CF dashboard → Deployments). Gradual % is
   unnecessary here and only creates mixed old/new frontend+backend requests;
   trips are low-traffic.
4. Confirm promotion: `curl https://cragstronauts.colin-cess.workers.dev/api/version`
   a few times — every response should show the new version `id`.

Because the preview URL and production share the same Durable Objects, step 2
already grandfathers whichever trips you open there; that is the intended end
state and is forward-safe (the old version ignores the `public` column).

## Transitional finder

`GET /api/legacy-trips` returns the frozen global `TripIndexDO` (every
pre-migration trip), any signed-in user. The hidden
`/nicoisnotthestrongestclimber` page (`AllTrips`) reads it so grandfathered
public trips stay discoverable while ownership is assigned. Remove the route,
the page, `api.legacyTrips`, and `TripIndexDO` once no longer needed.

## Deferred

- **Owner backfill.** Making a specific legacy trip private/owned (set the
  organizer slot's `account_id`, seed that account's index) is a future one-off
  `POST /api/admin/trips/:id/owner`, not part of this PR.
- **Leave a trip.** A member removing a joined trip from their own list
  (self-remove + `AccountIndexDO.remove`) is not implemented yet.
