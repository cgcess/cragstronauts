import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Env } from "./types";
import { formatEvent, trackEvent, type AppEvent } from "./events";
import * as discord from "./discord";

describe("formatEvent", () => {
  it("trip_created with location and organizer", () => {
    expect(
      formatEvent({ type: "trip_created", tripName: "Kalymnos", location: "Greece", organizer: "Ana" }),
    ).toBe("🏕️ New trip: Kalymnos in Greece by Ana");
  });

  it("trip_created degrades when location and organizer are missing", () => {
    expect(
      formatEvent({ type: "trip_created", tripName: "Kalymnos", location: null, organizer: null }),
    ).toBe("🏕️ New trip: Kalymnos");
  });

  it("trip_updated / trip_deleted", () => {
    expect(formatEvent({ type: "trip_updated", tripName: "Kalymnos" })).toBe(
      "✏️ Trip updated: Kalymnos",
    );
    expect(formatEvent({ type: "trip_deleted", tripName: "Kalymnos" })).toBe(
      "🗑️ Trip deleted: Kalymnos",
    );
  });

  it("trip name degrades when missing", () => {
    expect(formatEvent({ type: "trip_updated", tripName: null })).toBe("✏️ Trip updated: a trip");
  });

  it("member events", () => {
    expect(formatEvent({ type: "user_joined", tripName: "K", userName: "Ana" })).toBe("👋 Ana joined K");
    expect(formatEvent({ type: "user_left", tripName: "K", userName: "Ana" })).toBe("🚪 Ana left K");
    expect(formatEvent({ type: "user_claimed", tripName: "K", userName: "Ana" })).toBe(
      "🔑 Ana was claimed on K",
    );
    expect(formatEvent({ type: "user_made_organizer", tripName: "K", userName: "Ana" })).toBe(
      "⭐ Ana is now the organizer of K",
    );
    expect(formatEvent({ type: "signup_completed", tripName: "K", userName: "Ana" })).toBe(
      "✅ Ana completed signup on K",
    );
  });

  it("member events degrade when actor name missing", () => {
    expect(formatEvent({ type: "user_joined", tripName: "K", userName: null })).toBe(
      "👋 Someone joined K",
    );
  });

  it("car events", () => {
    expect(formatEvent({ type: "car_created", tripName: "K", driverName: "Ana" })).toBe(
      "🚗 Ana added a car on K",
    );
    expect(formatEvent({ type: "car_deleted", tripName: "K" })).toBe("🚗 A car was removed from K");
    expect(
      formatEvent({ type: "car_seat_taken", tripName: "K", passengerName: "Bo", driverName: "Ana" }),
    ).toBe("💺 Bo hopped into Ana's car on K");
    expect(
      formatEvent({ type: "car_seat_vacated", tripName: "K", passengerName: "Bo", driverName: "Ana" }),
    ).toBe("💺 Bo left Ana's car on K");
  });

  it("dog events", () => {
    expect(formatEvent({ type: "dog_added", tripName: "K", dogName: "Rex", ownerName: "Ana" })).toBe(
      "🐕 Ana is bringing Rex to K",
    );
    expect(formatEvent({ type: "dog_removed", tripName: "K" })).toBe("🐕 A dog was removed from K");
    expect(
      formatEvent({ type: "dog_assigned_to_car", tripName: "K", dogName: "Rex", driverName: "Ana" }),
    ).toBe("🐕 Rex hopped into Ana's car on K");
    expect(
      formatEvent({ type: "dog_unassigned_from_car", tripName: "K", dogName: "Rex", driverName: "Ana" }),
    ).toBe("🐕 Rex left Ana's car on K");
  });

  it("gear events", () => {
    expect(
      formatEvent({ type: "gear_added", tripName: "K", userName: "Ana", categoryName: "Rope" }),
    ).toBe("🎒 Ana is bringing Rope to K");
    expect(formatEvent({ type: "gear_removed", tripName: "K" })).toBe(
      "🎒 A gear contribution was removed from K",
    );
    expect(
      formatEvent({ type: "gear_declined", tripName: "K", userName: "Ana", categoryName: "Rope" }),
    ).toBe("🚫 Ana is not bringing Rope on K");
    expect(formatEvent({ type: "gear_decline_removed", tripName: "K" })).toBe(
      "↩️ A gear decline was undone on K",
    );
    expect(formatEvent({ type: "gear_category_added", tripName: "K", categoryName: "Rope" })).toBe(
      "🧰 New gear category on K: Rope",
    );
    expect(formatEvent({ type: "gear_category_removed", tripName: "K" })).toBe(
      "🧰 A gear category was removed from K",
    );
  });

  it("gear events degrade when category missing", () => {
    expect(
      formatEvent({ type: "gear_added", tripName: "K", userName: "Ana", categoryName: null }),
    ).toBe("🎒 Ana is bringing gear to K");
  });

  it("poll events", () => {
    expect(
      formatEvent({ type: "poll_answered", tripName: "K", userName: "Ana", question: "Lead belay?" }),
    ).toBe('🗳️ Ana answered "Lead belay?" on K');
    expect(formatEvent({ type: "poll_answered", tripName: "K", userName: "Ana", question: null })).toBe(
      "🗳️ Ana answered a poll on K",
    );
    expect(formatEvent({ type: "poll_added", tripName: "K", question: "Lead belay?" })).toBe(
      "🗳️ New poll on K: Lead belay?",
    );
    expect(formatEvent({ type: "poll_removed", tripName: "K" })).toBe("🗳️ A poll was removed from K");
  });

  it("expense events", () => {
    expect(
      formatEvent({
        type: "expense_added",
        tripName: "K",
        payerName: "Ana",
        description: "Gas",
        amountCents: 1234,
      }),
    ).toBe("💰 Ana added an expense on K: Gas · €12.34");
    expect(
      formatEvent({ type: "expense_updated", tripName: "K", description: "Gas" }),
    ).toBe("💰 An expense was updated on K: Gas");
    expect(formatEvent({ type: "expense_deleted", tripName: "K" })).toBe(
      "💰 An expense was deleted from K",
    );
  });
});

describe("trackEvent", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const event: AppEvent = { type: "user_joined", tripName: "K", userName: "Ana" };

  it("dispatches the formatted line to the webhook url", () => {
    const notify = vi.spyOn(discord, "notifyDiscord").mockResolvedValue(undefined);
    const scheduled: Promise<unknown>[] = [];

    trackEvent(
      { DISCORD_WEBHOOK_URL: "https://discord.test/webhook" } as Env,
      (p) => scheduled.push(p),
      event,
    );

    expect(notify).toHaveBeenCalledWith("https://discord.test/webhook", "👋 Ana joined K");
    expect(scheduled).toHaveLength(1);
  });

  it("no-ops when the webhook url is unset", () => {
    const notify = vi.spyOn(discord, "notifyDiscord").mockResolvedValue(undefined);
    const scheduled: Promise<unknown>[] = [];

    trackEvent({} as Env, (p) => scheduled.push(p), event);

    expect(notify).not.toHaveBeenCalled();
    expect(scheduled).toHaveLength(0);
  });
});
