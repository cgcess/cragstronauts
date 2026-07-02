import { describe, it, expect } from "vitest";
import { TripSchema, TripIndexEntrySchema } from "./trip";

const baseTrip = {
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
  welcome_message: null,
  signature: null,
};

describe("trip visibility (public flag)", () => {
  it("round-trips public=true through TripSchema", () => {
    const result = TripSchema.safeParse({ ...baseTrip, public: true });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.public).toBe(true);
  });

  it("defaults public to false when the field is absent", () => {
    const result = TripSchema.safeParse(baseTrip);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.public).toBe(false);
  });
});

describe("trip index entry role", () => {
  const base = {
    id: "abc123",
    name: "Spring send mission",
    location: "Yosemite Valley",
    start_date: null,
    end_date: null,
  };

  it("accepts an owner role", () => {
    const result = TripIndexEntrySchema.safeParse({ ...base, role: "owner" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.role).toBe("owner");
  });

  it("accepts a member role", () => {
    expect(
      TripIndexEntrySchema.safeParse({ ...base, role: "member" }).success
    ).toBe(true);
  });

  it("tolerates a role-less legacy entry", () => {
    const result = TripIndexEntrySchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.role).toBeUndefined();
  });

  it("rejects an unknown role", () => {
    expect(
      TripIndexEntrySchema.safeParse({ ...base, role: "guest" }).success
    ).toBe(false);
  });
});
