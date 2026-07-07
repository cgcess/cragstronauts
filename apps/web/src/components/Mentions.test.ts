import { describe, it, expect } from "vitest";
import { mentionedIds } from "./Mentions";

const members = [
  { id: 1, name: "Alex" },
  { id: 2, name: "Jon" },
  { id: 3, name: "Jon Snow" },
  { id: 4, name: "María" },
];

describe("mentionedIds", () => {
  it("finds a simple mention", () => {
    expect(mentionedIds("hey @Alex look", members)).toEqual([1]);
  });

  it("does not match a name that is only a prefix (@Jon vs Jonathan-style)", () => {
    // "@Jonny" must not resolve to member "Jon".
    expect(mentionedIds("yo @Jonny", members)).toEqual([]);
  });

  it("matches multi-word names and end-of-string", () => {
    expect(mentionedIds("cc @Jon Snow", members)).toEqual([3]);
  });

  it("prefers exact token boundaries — @Jon before a space matches Jon, not Jon Snow", () => {
    expect(mentionedIds("ping @Jon here", members)).toEqual([2]);
  });

  it("handles multiple distinct mentions and dedupes repeats", () => {
    expect(mentionedIds("@Alex and @María and @Alex", members).sort()).toEqual([1, 4]);
  });

  it("ignores an email-like @ (not preceded by whitespace)", () => {
    expect(mentionedIds("mail me at foo@Alex.com", members)).toEqual([]);
  });

  it("returns nothing when there are no mentions", () => {
    expect(mentionedIds("plain text", members)).toEqual([]);
  });
});
