import { describe, expect, it } from "vitest";
import {
  accountNameFromIdentity,
  preferredMemberName,
  replacementForGeneratedMemberName,
} from "./profile";

describe("accountNameFromIdentity", () => {
  it("prefers the first name over other Clerk identity fields", () => {
    expect(
      accountNameFromIdentity({
        fullName: "Ada Lovelace",
        firstName: "  Ada  ",
        username: "ada",
        primaryEmailAddress: { emailAddress: "ada@example.com" },
      })
    ).toBe("Ada");
  });

  it("never uses the primary email as a member name", () => {
    expect(
      accountNameFromIdentity({
        fullName: null,
        firstName: null,
        username: null,
        primaryEmailAddress: { emailAddress: "ada@example.com" },
      })
    ).toBeUndefined();
  });

  it("returns undefined when Clerk has no usable identity field", () => {
    expect(
      accountNameFromIdentity({
        fullName: " ",
        firstName: null,
        username: "",
        primaryEmailAddress: null,
      })
    ).toBeUndefined();
  });
});

describe("preferredMemberName", () => {
  it("uses the saved profile nickname before the Clerk account name", () => {
    expect(
      preferredMemberName(
        { v: 1, username: "  Ada  ", cars: [], gear: [], companions: [] },
        "Ada Lovelace"
      )
    ).toBe("Ada");
  });
});

describe("replacementForGeneratedMemberName", () => {
  it("repairs the generated Climber name when a better name is available", () => {
    expect(replacementForGeneratedMemberName("Climber", "Ada")).toBe("Ada");
  });

  it("leaves non-placeholder and intentionally retained names unchanged", () => {
    expect(replacementForGeneratedMemberName("Alex", "Ada")).toBeUndefined();
    expect(replacementForGeneratedMemberName("Climber", "Climber")).toBeUndefined();
    expect(replacementForGeneratedMemberName("Climber", undefined)).toBeUndefined();
  });
});
