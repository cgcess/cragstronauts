import { describe, it, expect } from "vitest";
import {
  TripSchema,
  TripLinkSchema,
  CreateTripBodySchema,
  UpdateTripBodySchema,
} from "./trip";

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

describe("trip location links", () => {
  it("accepts a valid name + url link", () => {
    const result = TripLinkSchema.safeParse({
      name: "Google Maps",
      url: "https://maps.app.goo.gl/abc",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a blank name", () => {
    expect(
      TripLinkSchema.safeParse({ name: "", url: "https://example.com" }).success
    ).toBe(false);
  });

  it("rejects a non-URL", () => {
    expect(
      TripLinkSchema.safeParse({ name: "Crag", url: "not a url" }).success
    ).toBe(false);
  });

  it("round-trips links through TripSchema", () => {
    const result = TripSchema.safeParse({
      ...baseTrip,
      links: [
        { name: "Crag topo", url: "https://thecrag.com/x" },
        { name: "Maps", url: "https://maps.google.com/y" },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.links).toHaveLength(2);
      expect(result.data.links[0].name).toBe("Crag topo");
    }
  });

  it("defaults missing links to an empty array", () => {
    const result = TripSchema.safeParse(baseTrip);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.links).toEqual([]);
  });

  it("allows links on create and update", () => {
    const create = CreateTripBodySchema.safeParse({
      name: "Font trip",
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
      links: [{ name: "Maps", url: "https://maps.app.goo.gl/abc" }],
    });
    expect(create.success).toBe(true);

    const update = UpdateTripBodySchema.safeParse({
      links: [{ name: "Parking", url: "https://maps.app.goo.gl/p" }],
    });
    expect(update.success).toBe(true);
  });

  it("rejects an invalid url on create", () => {
    const result = CreateTripBodySchema.safeParse({
      name: "Font trip",
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
      links: [{ name: "Maps", url: "nope" }],
    });
    expect(result.success).toBe(false);
  });
});
