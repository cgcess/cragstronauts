import { describe, it, expect } from "vitest";
import {
  PollSchema,
  CreatePollBodySchema,
  UpdatePollBodySchema,
  SetPollAnswerBodySchema,
} from "./poll";

describe("PollSchema", () => {
  const base = {
    id: 1,
    question: "Do you eat meat?",
    description: "We're firing up the BBQ on Saturday.",
    emoji: "🍖",
    position: 0,
    options: [
      { id: 10, label: "Meat", emoji: "🍖", position: 0 },
      { id: 11, label: "Vegetarian", emoji: null, position: 1 },
    ],
  };

  it("accepts a poll with multiple options", () => {
    expect(PollSchema.safeParse(base).success).toBe(true);
  });

  it("allows null description and emoji", () => {
    const result = PollSchema.safeParse({
      ...base,
      description: null,
      emoji: null,
    });
    expect(result.success).toBe(true);
  });
});

describe("CreatePollBodySchema", () => {
  it("accepts 2+ options without ids", () => {
    const result = CreatePollBodySchema.safeParse({
      question: "Do you eat meat?",
      options: [{ label: "Meat" }, { label: "Vegan", emoji: "🌱" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects fewer than two options", () => {
    const result = CreatePollBodySchema.safeParse({
      question: "Single?",
      options: [{ label: "Only one" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("UpdatePollBodySchema", () => {
  it("accepts options carrying existing ids for reconcile", () => {
    const result = UpdatePollBodySchema.safeParse({
      question: "Updated?",
      options: [{ id: 10, label: "Keep me" }, { label: "Brand new" }],
    });
    expect(result.success).toBe(true);
  });
});

describe("SetPollAnswerBodySchema", () => {
  it("accepts a single option id (single-select today)", () => {
    const result = SetPollAnswerBodySchema.safeParse({
      user_id: 1,
      poll_id: 2,
      option_ids: [10],
    });
    expect(result.success).toBe(true);
  });

  it("accepts multiple option ids (multi-select later)", () => {
    const result = SetPollAnswerBodySchema.safeParse({
      user_id: 1,
      poll_id: 2,
      option_ids: [10, 11],
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty list (clear answer)", () => {
    const result = SetPollAnswerBodySchema.safeParse({
      user_id: 1,
      poll_id: 2,
      option_ids: [],
    });
    expect(result.success).toBe(true);
  });
});
