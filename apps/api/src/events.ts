import type { z } from "zod";
import type { UserSchema } from "@cragstronauts/contract";
import type { Env } from "./types";
import type { TripDO } from "./TripDO";
import { notifyDiscord } from "./discord";

type User = z.infer<typeof UserSchema>;

/**
 * A notable business action, carrying the already-resolved display strings the
 * formatter needs. Keeping raw ids out of the union keeps `formatEvent` pure
 * and every wording change lives in one place. Optional strings are `null`
 * when a name could not be resolved; the formatter degrades gracefully.
 */
export type AppEvent =
  // Trip
  | { type: "trip_created"; tripName: string; location: string | null; organizer: string | null }
  | { type: "trip_updated"; tripName: string | null }
  | { type: "trip_deleted"; tripName: string | null }
  // Members
  | { type: "user_joined"; tripName: string | null; userName: string | null }
  | { type: "user_left"; tripName: string | null; userName: string | null }
  | { type: "user_claimed"; tripName: string | null; userName: string | null }
  | { type: "user_made_organizer"; tripName: string | null; userName: string | null }
  | { type: "signup_completed"; tripName: string | null; userName: string | null }
  // Cars
  | { type: "car_created"; tripName: string | null; driverName: string | null }
  | { type: "car_deleted"; tripName: string | null }
  | { type: "car_seat_taken"; tripName: string | null; passengerName: string | null; driverName: string | null }
  | { type: "car_seat_vacated"; tripName: string | null; passengerName: string | null; driverName: string | null }
  // Dogs
  | { type: "dog_added"; tripName: string | null; dogName: string | null; ownerName: string | null }
  | { type: "dog_removed"; tripName: string | null }
  | { type: "dog_assigned_to_car"; tripName: string | null; dogName: string | null; driverName: string | null }
  | { type: "dog_unassigned_from_car"; tripName: string | null; dogName: string | null; driverName: string | null }
  // Gear
  | { type: "gear_added"; tripName: string | null; userName: string | null; categoryName: string | null }
  | { type: "gear_removed"; tripName: string | null }
  | { type: "gear_declined"; tripName: string | null; userName: string | null; categoryName: string | null }
  | { type: "gear_decline_removed"; tripName: string | null }
  | { type: "gear_category_added"; tripName: string | null; categoryName: string | null }
  | { type: "gear_category_removed"; tripName: string | null }
  // Polls
  | { type: "poll_answered"; tripName: string | null; userName: string | null; question: string | null }
  | { type: "poll_added"; tripName: string | null; question: string | null }
  | { type: "poll_removed"; tripName: string | null }
  // Announcements
  | { type: "announcement_posted"; tripName: string | null; userName: string | null; isReply: boolean }
  // Expenses
  | { type: "expense_added"; tripName: string | null; payerName: string | null; description: string | null; amountCents: number | null }
  | { type: "expense_updated"; tripName: string | null; description: string | null }
  | { type: "expense_deleted"; tripName: string | null };

const trip = (name: string | null): string => name || "a trip";
const who = (name: string | null): string => name || "Someone";
const someone = (name: string | null, fallback: string): string => name || fallback;

const money = (cents: number | null): string | null =>
  cents == null ? null : (cents / 100).toFixed(2);

/**
 * Pure. One line per event type, leading emoji, trip name, actor and detail
 * where available. Degrades gracefully when a name is missing.
 */
export const formatEvent = (event: AppEvent): string => {
  switch (event.type) {
    case "trip_created": {
      const tail = [event.location && `in ${event.location}`, event.organizer && `by ${event.organizer}`]
        .filter(Boolean)
        .join(" ");
      return `🏕️ New trip: ${event.tripName}${tail ? ` ${tail}` : ""}`;
    }
    case "trip_updated":
      return `✏️ Trip updated: ${trip(event.tripName)}`;
    case "trip_deleted":
      return `🗑️ Trip deleted: ${trip(event.tripName)}`;
    case "user_joined":
      return `👋 ${who(event.userName)} joined ${trip(event.tripName)}`;
    case "user_left":
      return `🚪 ${who(event.userName)} left ${trip(event.tripName)}`;
    case "user_claimed":
      return `🔑 ${who(event.userName)} was claimed on ${trip(event.tripName)}`;
    case "user_made_organizer":
      return `⭐ ${who(event.userName)} is now the organizer of ${trip(event.tripName)}`;
    case "signup_completed":
      return `✅ ${who(event.userName)} completed signup on ${trip(event.tripName)}`;
    case "car_created":
      return `🚗 ${someone(event.driverName, "Someone")} added a car on ${trip(event.tripName)}`;
    case "car_deleted":
      return `🚗 A car was removed from ${trip(event.tripName)}`;
    case "car_seat_taken":
      return `💺 ${who(event.passengerName)} hopped into ${someone(event.driverName, "a")}'s car on ${trip(event.tripName)}`;
    case "car_seat_vacated":
      return `💺 ${who(event.passengerName)} left ${someone(event.driverName, "a")}'s car on ${trip(event.tripName)}`;
    case "dog_added":
      return `🐕 ${someone(event.ownerName, "Someone")} is bringing ${someone(event.dogName, "a dog")} to ${trip(event.tripName)}`;
    case "dog_removed":
      return `🐕 A dog was removed from ${trip(event.tripName)}`;
    case "dog_assigned_to_car":
      return `🐕 ${someone(event.dogName, "A dog")} hopped into ${someone(event.driverName, "a")}'s car on ${trip(event.tripName)}`;
    case "dog_unassigned_from_car":
      return `🐕 ${someone(event.dogName, "A dog")} left ${someone(event.driverName, "a")}'s car on ${trip(event.tripName)}`;
    case "gear_added":
      return `🎒 ${who(event.userName)} is bringing ${someone(event.categoryName, "gear")} to ${trip(event.tripName)}`;
    case "gear_removed":
      return `🎒 A gear contribution was removed from ${trip(event.tripName)}`;
    case "gear_declined":
      return `🚫 ${who(event.userName)} is not bringing ${someone(event.categoryName, "gear")} on ${trip(event.tripName)}`;
    case "gear_decline_removed":
      return `↩️ A gear decline was undone on ${trip(event.tripName)}`;
    case "gear_category_added":
      return `🧰 New gear category on ${trip(event.tripName)}: ${someone(event.categoryName, "gear")}`;
    case "gear_category_removed":
      return `🧰 A gear category was removed from ${trip(event.tripName)}`;
    case "poll_answered":
      return `🗳️ ${who(event.userName)} answered ${event.question ? `"${event.question}"` : "a poll"} on ${trip(event.tripName)}`;
    case "poll_added":
      return `🗳️ New poll on ${trip(event.tripName)}${event.question ? `: ${event.question}` : ""}`;
    case "poll_removed":
      return `🗳️ A poll was removed from ${trip(event.tripName)}`;
    case "announcement_posted":
      return event.isReply
        ? `📣 ${who(event.userName)} replied to an announcement on ${trip(event.tripName)}`
        : `📣 ${who(event.userName)} posted an announcement on ${trip(event.tripName)}`;
    case "expense_added": {
      const amount = money(event.amountCents);
      const detail = [event.description, amount && `€${amount}`].filter(Boolean).join(" · ");
      return `💰 ${who(event.payerName)} added an expense on ${trip(event.tripName)}${detail ? `: ${detail}` : ""}`;
    }
    case "expense_updated":
      return `💰 An expense was updated on ${trip(event.tripName)}${event.description ? `: ${event.description}` : ""}`;
    case "expense_deleted":
      return `💰 An expense was deleted from ${trip(event.tripName)}`;
  }
};

/**
 * Impure orchestrator. No-ops when the webhook secret is unset (so local dev
 * without the secret is silent), otherwise dispatches the formatted line in the
 * background. `schedule` matches `handleClerkEvent`'s: callers pass
 * `(p) => c.executionCtx.waitUntil(p)`.
 */
export const trackEvent = (
  env: Env,
  schedule: (promise: Promise<unknown>) => void,
  event: AppEvent,
): void => {
  const url = env.DISCORD_WEBHOOK_URL;
  if (!url) return;
  schedule(notifyDiscord(url, formatEvent(event)));
};

/** Enrichment context handed to `trackTripEvent`'s builder. */
export type TripEventCtx = {
  tripName: string | null;
  users: User[];
  stub: DurableObjectStub<TripDO>;
};

/**
 * Convenience for handlers that hold only `tripId` plus the returned entity.
 * Reads the trip name and users off the response hot path (inside the
 * backgrounded dispatch), hands them to `makeEvent`, then dispatches. The
 * builder may return `null` to skip. Extra reads for rarer detail can be done
 * through the provided `stub`.
 */
export const trackTripEvent = (
  env: Env,
  schedule: (promise: Promise<unknown>) => void,
  stub: DurableObjectStub<TripDO>,
  makeEvent: (ctx: TripEventCtx) => AppEvent | null | Promise<AppEvent | null>,
): void => {
  const url = env.DISCORD_WEBHOOK_URL;
  if (!url) return;
  schedule(
    (async () => {
      const [trip, users] = await Promise.all([stub.getTrip(), stub.listUsers()]);
      const event = await makeEvent({ tripName: trip?.name ?? null, users, stub });
      if (event) await notifyDiscord(url, formatEvent(event));
    })(),
  );
};

/** Resolve a user's display name from a users snapshot. */
export const nameOf = (users: User[], id: number | null | undefined): string | null =>
  users.find((u) => u.id === id)?.name ?? null;
