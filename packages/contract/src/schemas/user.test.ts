import { describe, it, expect } from "vitest";
import { JoinTripBodySchema } from "./trip";
import { UserSchema, CreateUserBodySchema } from "./user";

describe("UserSchema", () => {
  it("accepts a user with the claimed and linked flags", () => {
    const parsed = UserSchema.parse({
      id: 1,
      name: "Ada",
      joining: true,
      is_organizer: false,
      signup_completed: true,
      claimed: true,
      linked: false,
    });
    expect(parsed.claimed).toBe(true);
    expect(parsed.linked).toBe(false);
  });

  it("requires claimed to be present", () => {
    const result = UserSchema.safeParse({
      id: 1,
      name: "Ada",
      joining: true,
      is_organizer: false,
      signup_completed: true,
      linked: false,
    });
    expect(result.success).toBe(false);
  });

  it("requires linked to be present", () => {
    const result = UserSchema.safeParse({
      id: 1,
      name: "Ada",
      joining: true,
      is_organizer: false,
      signup_completed: true,
      claimed: true,
    });
    expect(result.success).toBe(false);
  });
});

describe("JoinTripBodySchema", () => {
  it("requires a non-empty member name", () => {
    expect(JoinTripBodySchema.safeParse({}).success).toBe(false);
    expect(JoinTripBodySchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("trims the member name", () => {
    expect(JoinTripBodySchema.parse({ name: "  Ada  " })).toEqual({ name: "Ada" });
  });
});

describe("CreateUserBodySchema", () => {
  it("does not require a claimed field", () => {
    const parsed = CreateUserBodySchema.parse({ name: "Ada", joining: true });
    expect(parsed).toEqual({ name: "Ada", joining: true });
  });

  it("accepts an optional claimed flag", () => {
    const parsed = CreateUserBodySchema.parse({
      name: "Ada",
      joining: true,
      claimed: false,
    });
    expect(parsed).toEqual({ name: "Ada", joining: true, claimed: false });
  });
});
