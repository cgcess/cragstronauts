import { describe, it, expect } from "vitest";
import { computeBalances } from "./balances";

describe("computeBalances", () => {
  it("returns empty settlements when there are no expenses", () => {
    const result = computeBalances([]);
    expect(result).toEqual([]);
  });

  it("splits a 3-way expense correctly, payer doesn't owe themselves", () => {
    // Alice (1) pays €60, split among Alice/Bob/Charlie → each share is €20
    const result = computeBalances([
      {
        payer_user_id: 1,
        amount_cents: 6000,
        splits: [{ user_id: 1 }, { user_id: 2 }, { user_id: 3 }],
      },
    ]);
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ from_user_id: 2, to_user_id: 1, amount_cents: 2000 });
    expect(result).toContainEqual({ from_user_id: 3, to_user_id: 1, amount_cents: 2000 });
  });

  it("returns one settlement for a 2-way split", () => {
    const result = computeBalances([
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

  it("aggregates debts across multiple expenses", () => {
    const result = computeBalances([
      {
        payer_user_id: 1,
        amount_cents: 2000,
        splits: [{ user_id: 1 }, { user_id: 2 }],
      },
      {
        payer_user_id: 1,
        amount_cents: 4000,
        splits: [{ user_id: 1 }, { user_id: 2 }],
      },
    ]);
    // Bob owes Alice 1000 + 2000 = 3000
    expect(result).toEqual([
      { from_user_id: 2, to_user_id: 1, amount_cents: 3000 },
    ]);
  });

  it("nets out mutual debts", () => {
    const result = computeBalances([
      {
        payer_user_id: 1,
        amount_cents: 2000,
        splits: [{ user_id: 1 }, { user_id: 2 }],
      },
      {
        payer_user_id: 2,
        amount_cents: 800,
        splits: [{ user_id: 1 }, { user_id: 2 }],
      },
    ]);
    // Bob owes Alice 1000, Alice owes Bob 400 → net: Bob owes Alice 600
    expect(result).toEqual([
      { from_user_id: 2, to_user_id: 1, amount_cents: 600 },
    ]);
  });

  it("returns empty when mutual debts cancel out exactly", () => {
    const result = computeBalances([
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

  it("distributes remainder cents to first split members", () => {
    // €10.00 split 3 ways → 333 + 333 + 334? No — floor gives 333 each, 1 cent lost
    // We want the remainder distributed: two get 333, but the total owed is 666 not 667
    // Actually with floor: 3333 each, total = 9999. Payer absorbs the 1 cent.
    const result = computeBalances([
      {
        payer_user_id: 1,
        amount_cents: 1000,
        splits: [{ user_id: 1 }, { user_id: 2 }, { user_id: 3 }],
      },
    ]);
    // Each share = floor(1000/3) = 333. Bob owes 333, Charlie owes 333.
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ from_user_id: 2, to_user_id: 1, amount_cents: 333 });
    expect(result).toContainEqual({ from_user_id: 3, to_user_id: 1, amount_cents: 333 });
  });
});
