import { describe, it, expect } from "vitest";
import type { z } from "zod";
import type { ExpenseSchema } from "@cragstronauts/contract";
import { equalShareCents, summarizeSplit } from "./expense-summary";

type Expense = z.infer<typeof ExpenseSchema>;

type SplitInput = { user_id: number; amount_cents?: number | null };

const expense = (totalCents: number, splits: SplitInput[]): Expense => ({
  id: 1,
  payer_user_id: splits[0]?.user_id ?? 1,
  payer_name: "Payer",
  amount_cents: totalCents,
  description: "Test",
  created_at: "2026-01-01T00:00:00Z",
  is_settlement: false,
  splits: splits.map((s) => ({
    user_id: s.user_id,
    name: `user${s.user_id}`,
    amount_cents: s.amount_cents,
  })),
});

describe("equalShareCents", () => {
  it("rounds to the nearest cent", () => {
    expect(equalShareCents(12000, 18)).toBe(667);
  });

  it("returns 0 for a non-positive count", () => {
    expect(equalShareCents(1000, 0)).toBe(0);
  });
});

describe("summarizeSplit", () => {
  it("treats null-amount splits as equal", () => {
    const exp = expense(3000, [{ user_id: 1 }, { user_id: 2 }, { user_id: 3 }]);
    const s = summarizeSplit(exp, 2);
    expect(s.kind).toBe("equal");
    expect(s.count).toBe(3);
    expect(s.yourShareCents).toBe(1000);
  });

  it("treats a rounding-remainder custom split as equal", () => {
    // €120 across 18 people: most pay €6.67, the rest €6.66.
    const splits: SplitInput[] = Array.from({ length: 18 }, (_, i) => ({
      user_id: i + 1,
      amount_cents: i < 6 ? 667 : 666,
    }));
    const exp = expense(12000, splits);
    const s = summarizeSplit(exp, 1);
    expect(s.kind).toBe("equal");
    expect(s.count).toBe(18);
    expect(s.yourShareCents).toBe(667);
  });

  it("flags a genuinely uneven split as custom", () => {
    const exp = expense(
      10000,
      [
        { user_id: 1, amount_cents: 8000 },
        { user_id: 2, amount_cents: 2000 },
      ]
    );
    const s = summarizeSplit(exp, 2);
    expect(s.kind).toBe("custom");
    expect(s.yourShareCents).toBe(2000);
  });

  it("returns a null share when the current user is not in the split", () => {
    const exp = expense(2000, [{ user_id: 1 }, { user_id: 2 }]);
    expect(summarizeSplit(exp, 99).yourShareCents).toBeNull();
  });

  it("returns a null share when there is no current user", () => {
    const exp = expense(2000, [{ user_id: 1 }, { user_id: 2 }]);
    expect(summarizeSplit(exp, null).yourShareCents).toBeNull();
  });

  it("handles a single-person split", () => {
    const exp = expense(5000, [{ user_id: 1 }]);
    const s = summarizeSplit(exp, 1);
    expect(s.kind).toBe("equal");
    expect(s.count).toBe(1);
    expect(s.yourShareCents).toBe(5000);
  });
});
