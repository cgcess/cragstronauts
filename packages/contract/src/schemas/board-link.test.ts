import { describe, it, expect } from "vitest";
import {
  BOARD_SECTIONS,
  BOARD_SECTION_PARAM,
  boardPath,
  parseBoardSection,
} from "./board-link";

describe("boardPath", () => {
  it("builds the bare board path with no section", () => {
    expect(boardPath("abc123")).toBe("/trips/abc123/board");
  });

  it("appends the section as a query param", () => {
    expect(boardPath("abc123", "cars")).toBe("/trips/abc123/board?card=cars");
    expect(boardPath("abc123", "announcements")).toBe(
      "/trips/abc123/board?card=announcements",
    );
  });
});

describe("parseBoardSection", () => {
  it("returns the section for each valid value", () => {
    for (const section of BOARD_SECTIONS) {
      const params = new URLSearchParams();
      params.set(BOARD_SECTION_PARAM, section);
      expect(parseBoardSection(params)).toBe(section);
    }
  });

  it("returns null for a missing param", () => {
    expect(parseBoardSection(new URLSearchParams())).toBeNull();
  });

  it("returns null for an unknown value", () => {
    const params = new URLSearchParams();
    params.set(BOARD_SECTION_PARAM, "nonsense");
    expect(parseBoardSection(params)).toBeNull();
  });

  it("round-trips a path built by boardPath", () => {
    const url = new URL(`https://example.com${boardPath("t1", "polls")}`);
    expect(parseBoardSection(url.searchParams)).toBe("polls");
  });
});
