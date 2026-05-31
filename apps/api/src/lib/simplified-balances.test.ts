import { describe, it, expect } from "vitest";
import { computeSimplifiedBalances, type Settlement } from "./balances";

describe("computeSimplifiedBalances", () => {
  it("returns empty settlements when there are no expenses", () => {
    const result = computeSimplifiedBalances([]);
    expect(result).toEqual([]);
  });

  it("returns a single settlement for a 2-way split (same as pairwise)", () => {
    const result = computeSimplifiedBalances([
      {
        payer_user_id: 1,
        amount_cents: 2000,
        splits: [{ user_id: 1 }, { user_id: 2 }],
      },
    ]);
    expect(result).toEqual([
      { from_user_id: 2, to_user_id: 1, amount_cents: 1000 },
    ]);
  });

  it("simplifies a chain: A→B and B→C becomes A→C", () => {
    // Alice pays €30 split 3 ways (Alice, Bob, Charlie) → Bob owes 10, Charlie owes 10
    // Bob pays €30 split 3 ways (Alice, Bob, Charlie) → Alice owes 10, Charlie owes 10
    // Pairwise: Bob→Alice 10, Charlie→Alice 10, Alice→Bob 10, Charlie→Bob 10
    //   nets to: Charlie→Alice 10, Charlie→Bob 10 (but not minimal if we think in net terms)
    // Net balances: Alice = paid 30, owes 10+10 = 20 → net +10
    //               Bob = paid 30, owes 10+10 = 20 → net +10
    //               Charlie = paid 0, owes 10+10 = 20 → net -20
    // Simplified: Charlie→Alice 10, Charlie→Bob 10 (2 transactions — same as pairwise here)
    const result = computeSimplifiedBalances([
      {
        payer_user_id: 1,
        amount_cents: 3000,
        splits: [{ user_id: 1 }, { user_id: 2 }, { user_id: 3 }],
      },
      {
        payer_user_id: 2,
        amount_cents: 3000,
        splits: [{ user_id: 1 }, { user_id: 2 }, { user_id: 3 }],
      },
    ]);
    // Net: Alice +1000, Bob +1000, Charlie -2000
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ from_user_id: 3, to_user_id: 1, amount_cents: 1000 });
    expect(result).toContainEqual({ from_user_id: 3, to_user_id: 2, amount_cents: 1000 });
  });

  it("reduces 3 pairwise debts to 2 transactions via simplification", () => {
    // Classic case: A pays for B (€10), B pays for C (€10)
    // Pairwise: B→A €10, C→B €10 (2 transactions, involves B as intermediary)
    // Net: A = +10, B = 0, C = -10
    // Simplified: C→A €10 (1 transaction!)
    const result = computeSimplifiedBalances([
      {
        payer_user_id: 1, // A pays
        amount_cents: 1000,
        splits: [{ user_id: 2, amount_cents: 1000 }], // only B owes
      },
      {
        payer_user_id: 2, // B pays
        amount_cents: 1000,
        splits: [{ user_id: 3, amount_cents: 1000 }], // only C owes
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result).toEqual([
      { from_user_id: 3, to_user_id: 1, amount_cents: 1000 },
    ]);
  });

  it("handles multiple debtors and creditors", () => {
    // A paid €40 for everyone (A, B, C, D) → each share €10
    // Net: A = +30, B = -10, C = -10, D = -10
    // Simplified: B→A 10, C→A 10, D→A 10
    const result = computeSimplifiedBalances([
      {
        payer_user_id: 1,
        amount_cents: 4000,
        splits: [{ user_id: 1 }, { user_id: 2 }, { user_id: 3 }, { user_id: 4 }],
      },
    ]);
    expect(result).toHaveLength(3);
    expect(result).toContainEqual({ from_user_id: 2, to_user_id: 1, amount_cents: 1000 });
    expect(result).toContainEqual({ from_user_id: 3, to_user_id: 1, amount_cents: 1000 });
    expect(result).toContainEqual({ from_user_id: 4, to_user_id: 1, amount_cents: 1000 });
  });

  it("returns empty when all balances cancel out", () => {
    const result = computeSimplifiedBalances([
      {
        payer_user_id: 1,
        amount_cents: 2000,
        splits: [{ user_id: 1 }, { user_id: 2 }],
      },
      {
        payer_user_id: 2,
        amount_cents: 2000,
        splits: [{ user_id: 1 }, { user_id: 2 }],
      },
    ]);
    expect(result).toEqual([]);
  });

  it("handles complex scenario with fewer transactions than pairwise", () => {
    // A pays €60 for (A, B, C) → each owes 20. B owes A 20, C owes A 20.
    // B pays €60 for (A, B, C) → each owes 20. A owes B 20, C owes B 20.
    // C pays €60 for (A, B, C) → each owes 20. A owes C 20, B owes C 20.
    // Net: everyone paid 60 and owes 40 → all net 0.
    // Pairwise might produce settlements; simplified = empty.
    const result = computeSimplifiedBalances([
      {
        payer_user_id: 1,
        amount_cents: 6000,
        splits: [{ user_id: 1 }, { user_id: 2 }, { user_id: 3 }],
      },
      {
        payer_user_id: 2,
        amount_cents: 6000,
        splits: [{ user_id: 1 }, { user_id: 2 }, { user_id: 3 }],
      },
      {
        payer_user_id: 3,
        amount_cents: 6000,
        splits: [{ user_id: 1 }, { user_id: 2 }, { user_id: 3 }],
      },
    ]);
    expect(result).toEqual([]);
  });

  it("handles custom splits", () => {
    // A pays €100, custom: B owes 70, C owes 30
    // Net: A = +100, B = -70, C = -30
    const result = computeSimplifiedBalances([
      {
        payer_user_id: 1,
        amount_cents: 10000,
        splits: [
          { user_id: 1, amount_cents: 0 },
          { user_id: 2, amount_cents: 7000 },
          { user_id: 3, amount_cents: 3000 },
        ],
      },
    ]);
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ from_user_id: 2, to_user_id: 1, amount_cents: 7000 });
    expect(result).toContainEqual({ from_user_id: 3, to_user_id: 1, amount_cents: 3000 });
  });
});
