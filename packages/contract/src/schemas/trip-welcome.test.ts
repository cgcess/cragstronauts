import { describe, it, expect } from "vitest";
import {
  TripSchema,
  CreateTripBodySchema,
  UpdateTripBodySchema,
  TripIndexEntrySchema,
} from "./trip";

describe("trip welcome message + signature", () => {
  it("round-trips welcome_message and signature through TripSchema", () => {
    const trip = {
      name: "Spring send mission",
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
      name: "Frankenjura long weekend",
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
      name: "Font bouldering",
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

describe("trip name vs location", () => {
  const baseTrip = {
    location: "Yosemite Valley",
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
  };

  it("round-trips a name distinct from location through TripSchema", () => {
    const result = TripSchema.safeParse({
      ...baseTrip,
      name: "Spring send mission",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Spring send mission");
      expect(result.data.location).toBe("Yosemite Valley");
    }
  });

  it("requires a non-empty name on TripSchema", () => {
    expect(TripSchema.safeParse(baseTrip).success).toBe(false);
  });

  it("requires a non-empty name on create", () => {
    const base = {
      location: "Fontainebleau",
      start_date: null,
      end_date: null,
      accommodation_type: null,
      accommodation_details: null,
      notes: null,
      gear_categories: [],
      organizer_name: "Juan",
      welcome_message: "Let's go!",
      signature: "Juan",
    };
    expect(CreateTripBodySchema.safeParse(base).success).toBe(false);
    expect(CreateTripBodySchema.safeParse({ ...base, name: "" }).success).toBe(
      false
    );
    expect(
      CreateTripBodySchema.safeParse({ ...base, name: "Font trip" }).success
    ).toBe(true);
  });

  it("rejects blanking the name on update", () => {
    expect(UpdateTripBodySchema.safeParse({ name: "" }).success).toBe(false);
    expect(UpdateTripBodySchema.safeParse({ name: "Renamed" }).success).toBe(
      true
    );
  });

  it("carries name through TripIndexEntrySchema", () => {
    const result = TripIndexEntrySchema.safeParse({
      id: "abc123",
      name: "Spring send mission",
      location: "Yosemite Valley",
      start_date: null,
      end_date: null,
    });
    expect(result.success).toBe(true);
  });
});
