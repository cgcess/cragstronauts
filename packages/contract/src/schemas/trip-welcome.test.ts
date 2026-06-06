import { describe, it, expect } from "vitest";
import {
  TripSchema,
  CreateTripBodySchema,
  UpdateTripBodySchema,
} from "./trip";

describe("trip welcome message + signature", () => {
  it("round-trips welcome_message and signature through TripSchema", () => {
    const trip = {
      location: "Yosemite Valley",
      start_date: null,
      end_date: null,
      accommodation_type: null,
      accommodation_details: null,
      notes: null,
      latitude: null,
      longitude: null,
      place_label: null,
      welcome_message: "Hey crew! Booked a Grillhütte by the crag 🧗",
      signature: "Juan & Lovely Girl",
    };
    const result = TripSchema.safeParse(trip);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.welcome_message).toBe(trip.welcome_message);
      expect(result.data.signature).toBe(trip.signature);
    }
  });

  it("tolerates legacy trips with null welcome_message and signature", () => {
    const result = TripSchema.safeParse({
      location: "Frankenjura",
      start_date: null,
      end_date: null,
      accommodation_type: null,
      accommodation_details: null,
      notes: null,
      latitude: null,
      longitude: null,
      place_label: null,
      welcome_message: null,
      signature: null,
    });
    expect(result.success).toBe(true);
  });

  it("requires welcome_message and signature on create", () => {
    const base = {
      location: "Fontainebleau",
      start_date: null,
      end_date: null,
      accommodation_type: null,
      accommodation_details: null,
      notes: null,
      gear_categories: [],
      organizer_name: "Juan",
    };
    expect(CreateTripBodySchema.safeParse(base).success).toBe(false);
    expect(
      CreateTripBodySchema.safeParse({
        ...base,
        welcome_message: "Let's go!",
        signature: "Juan",
      }).success
    ).toBe(true);
  });

  it("rejects blanking welcome_message or signature on update", () => {
    expect(
      UpdateTripBodySchema.safeParse({ welcome_message: "" }).success
    ).toBe(false);
    expect(UpdateTripBodySchema.safeParse({ signature: "" }).success).toBe(
      false
    );
    expect(
      UpdateTripBodySchema.safeParse({
        welcome_message: "Found a Grillhütte!",
        signature: "Juan",
      }).success
    ).toBe(true);
  });
});
