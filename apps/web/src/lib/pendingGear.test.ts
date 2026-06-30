import { describe, it, expect } from "vitest";
import { pendingGearCategories } from "./pendingGear";
import type { Category } from "../context/TripContext";
import type { GearContribution, GearDecline } from "../context/TripContext";

const cat = (id: number): Category => ({
  id,
  name: `Cat${id}`,
  fields: [],
  summary_mode: "people",
  catalog_key: null,
});

const contribution = (categoryId: number, userId: number): GearContribution => ({
  id: categoryId * 100 + userId,
  user_id: userId,
  user_name: `user${userId}`,
  category_id: categoryId,
  category_name: `Cat${categoryId}`,
  details: {},
});

const decline = (categoryId: number, userId: number): GearDecline => ({
  id: categoryId * 1000 + userId,
  user_id: userId,
  user_name: `user${userId}`,
  category_id: categoryId,
});

describe("pendingGearCategories", () => {
  const categories = [cat(1), cat(2), cat(3)];

  it("returns every category when the user has neither brought nor declined", () => {
    expect(
      pendingGearCategories({ categories, gear: [], declines: [], userId: 7 }).map(
        (c) => c.id
      )
    ).toEqual([1, 2, 3]);
  });

  it("drops a category the user is bringing", () => {
    const gear = [contribution(2, 7)];
    expect(
      pendingGearCategories({ categories, gear, declines: [], userId: 7 }).map(
        (c) => c.id
      )
    ).toEqual([1, 3]);
  });

  it("drops a category the user declined", () => {
    const declines = [decline(1, 7)];
    expect(
      pendingGearCategories({ categories, gear: [], declines, userId: 7 }).map(
        (c) => c.id
      )
    ).toEqual([2, 3]);
  });

  it("treats a category with both a contribution and a decline as answered", () => {
    const gear = [contribution(1, 7)];
    const declines = [decline(1, 7)];
    expect(
      pendingGearCategories({ categories, gear, declines, userId: 7 }).map(
        (c) => c.id
      )
    ).toEqual([2, 3]);
  });

  it("ignores other users' answers", () => {
    const gear = [contribution(1, 99)];
    const declines = [decline(2, 99)];
    expect(
      pendingGearCategories({ categories, gear, declines, userId: 7 }).map(
        (c) => c.id
      )
    ).toEqual([1, 2, 3]);
  });

  it("returns nothing when there are no categories", () => {
    expect(
      pendingGearCategories({ categories: [], gear: [], declines: [], userId: 7 })
    ).toEqual([]);
  });
});
