import { describe, it, expect } from "vitest";
import { UpdateExpenseBodySchema } from "./expense";

describe("UpdateExpenseBodySchema", () => {
  it("accepts a valid equal-split payload", () => {
    const result = UpdateExpenseBodySchema.safeParse({
      payer_user_id: 1,
      amount_cents: 2500,
      description: "Groceries",
      split_mode: "equal",
      split_user_ids: [1, 2, 3],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid custom-split payload", () => {
    const result = UpdateExpenseBodySchema.safeParse({
      payer_user_id: 1,
      amount_cents: 5000,
      description: "Dinner",
      split_mode: "custom",
      splits: [
        { user_id: 1, amount_cents: 2000 },
        { user_id: 2, amount_cents: 3000 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing payer_user_id", () => {
    const result = UpdateExpenseBodySchema.safeParse({
      amount_cents: 2500,
      description: "Groceries",
      split_mode: "equal",
      split_user_ids: [1, 2],
    });
    expect(result.success).toBe(false);
  });

  it("rejects amount less than 1", () => {
    const result = UpdateExpenseBodySchema.safeParse({
      payer_user_id: 1,
      amount_cents: 0,
      description: "Groceries",
      split_mode: "equal",
      split_user_ids: [1, 2],
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty description", () => {
    const result = UpdateExpenseBodySchema.safeParse({
      payer_user_id: 1,
      amount_cents: 2500,
      description: "",
      split_mode: "equal",
      split_user_ids: [1, 2],
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty split_user_ids", () => {
    const result = UpdateExpenseBodySchema.safeParse({
      payer_user_id: 1,
      amount_cents: 2500,
      description: "Groceries",
      split_mode: "equal",
      split_user_ids: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects custom splits with empty array", () => {
    const result = UpdateExpenseBodySchema.safeParse({
      payer_user_id: 1,
      amount_cents: 2500,
      description: "Groceries",
      split_mode: "custom",
      splits: [],
    });
    expect(result.success).toBe(false);
  });
});
