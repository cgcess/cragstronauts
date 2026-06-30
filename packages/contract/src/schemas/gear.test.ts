import { describe, it, expect } from "vitest";
import { GearDeclineSchema, AddGearDeclineBodySchema } from "./gear";

describe("GearDeclineSchema", () => {
  const base = {
    id: 1,
    user_id: 7,
    user_name: "Alex",
    category_id: 3,
  };

  it("accepts a well-formed decline", () => {
    expect(GearDeclineSchema.safeParse(base).success).toBe(true);
  });

  it("rejects a decline missing the user name", () => {
    const { user_name, ...rest } = base;
    expect(GearDeclineSchema.safeParse(rest).success).toBe(false);
  });
});

describe("AddGearDeclineBodySchema", () => {
  it("accepts a user/category pair", () => {
    expect(
      AddGearDeclineBodySchema.safeParse({ user_id: 7, category_id: 3 }).success
    ).toBe(true);
  });

  it("rejects a body without a category", () => {
    expect(
      AddGearDeclineBodySchema.safeParse({ user_id: 7 }).success
    ).toBe(false);
  });
});
