import { describe, it, expect } from "vitest";
import { UserSchema, CreateUserBodySchema } from "./user";

describe("UserSchema", () => {
  it("accepts a user with the claimed flag", () => {
    const parsed = UserSchema.parse({
      id: 1,
      name: "Ada",
      joining: true,
      is_organizer: false,
      signup_completed: true,
      claimed: true,
    });
    expect(parsed.claimed).toBe(true);
  });

  it("requires claimed to be present", () => {
    const result = UserSchema.safeParse({
      id: 1,
      name: "Ada",
      joining: true,
      is_organizer: false,
      signup_completed: true,
    });
    expect(result.success).toBe(false);
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
