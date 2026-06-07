import { describe, it, expect } from "vitest";
import { findNameMatches } from "./identity";
import type { User } from "../context/TripContext";

const user = (id: number, name: string): User => ({
  id,
  name,
  joining: true,
  is_organizer: false,
  signup_completed: false,
  claimed: true,
});

const users = [user(1, "Ada"), user(2, "Grace"), user(3, "ada")];

describe("findNameMatches", () => {
  it("matches case-insensitively", () => {
    expect(findNameMatches(users, "ADA").map((u) => u.id)).toEqual([1, 3]);
  });

  it("trims surrounding whitespace", () => {
    expect(findNameMatches(users, "  Grace  ").map((u) => u.id)).toEqual([2]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(findNameMatches(users, "Linus")).toEqual([]);
  });

  it("returns an empty array for a blank name", () => {
    expect(findNameMatches(users, "   ")).toEqual([]);
  });

  it("returns every duplicate when multiple match", () => {
    expect(findNameMatches(users, "ada")).toHaveLength(2);
  });
});
