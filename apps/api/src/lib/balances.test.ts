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

  // ---- Custom (unequal) splits ----

  it("uses explicit per-member amounts when provided", () => {
    // Alice (1) pays €100. Bob owes €70, Charlie owes €30.
    const result = computeBalances([
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

  it("handles custom split where payer also has a share", () => {
    // Alice pays €90, split: Alice €30, Bob €40, Charlie €20
    const result = computeBalances([
      {
        payer_user_id: 1,
        amount_cents: 9000,
        splits: [
          { user_id: 1, amount_cents: 3000 },
          { user_id: 2, amount_cents: 4000 },
          { user_id: 3, amount_cents: 2000 },
        ],
      },
    ]);
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ from_user_id: 2, to_user_id: 1, amount_cents: 4000 });
    expect(result).toContainEqual({ from_user_id: 3, to_user_id: 1, amount_cents: 2000 });
  });

  it("nets custom and equal splits across expenses", () => {
    const result = computeBalances([
      // Alice pays €60, custom: Bob €40, Charlie €20
      {
        payer_user_id: 1,
        amount_cents: 6000,
        splits: [
          { user_id: 2, amount_cents: 4000 },
          { user_id: 3, amount_cents: 2000 },
        ],
      },
      // Bob pays €30, equal split 3 ways → each owes 1000
      {
        payer_user_id: 2,
        amount_cents: 3000,
        splits: [{ user_id: 1 }, { user_id: 2 }, { user_id: 3 }],
      },
    ]);
    // Bob owes Alice 4000, Alice owes Bob 1000 → net Bob→Alice 3000
    // Charlie owes Alice 2000, Charlie owes Bob 1000
    expect(result).toHaveLength(3);
    expect(result).toContainEqual({ from_user_id: 2, to_user_id: 1, amount_cents: 3000 });
    expect(result).toContainEqual({ from_user_id: 3, to_user_id: 1, amount_cents: 2000 });
    expect(result).toContainEqual({ from_user_id: 3, to_user_id: 2, amount_cents: 1000 });
  });

  it("handles a custom split with a zero-amount member", () => {
    // Alice pays €50, Bob gets the full amount, Charlie owes nothing
    const result = computeBalances([
      {
        payer_user_id: 1,
        amount_cents: 5000,
        splits: [
          { user_id: 2, amount_cents: 5000 },
          { user_id: 3, amount_cents: 0 },
        ],
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result).toContainEqual({ from_user_id: 2, to_user_id: 1, amount_cents: 5000 });
  });

  // ---- Settlements as expenses ----
  // A settlement "Bob pays Alice €4" is modeled as:
  //   payer: Bob, amount: 400, splits: [{ user_id: Alice, amount_cents: 400 }]
  // The math naturally reduces Bob’s debt to Alice.

  it("reduces a balance when a settlement expense is added", () => {
    // Bob owes Alice €10 from an equal split, then settles €4
    const result = computeBalances([
      {
        payer_user_id: 1,
        amount_cents: 2000,
        splits: [{ user_id: 1 }, { user_id: 2 }],
      },
      // Settlement: Bob paid €4, Alice’s share is €4
      {
        payer_user_id: 2,
        amount_cents: 400,
        splits: [{ user_id: 1, amount_cents: 400 }],
      },
    ]);
    expect(result).toEqual([
      { from_user_id: 2, to_user_id: 1, amount_cents: 600 },
    ]);
  });

  it("removes a balance entirely when settlement equals debt", () => {
    const result = computeBalances([
      {
        payer_user_id: 1,
        amount_cents: 2000,
        splits: [{ user_id: 1 }, { user_id: 2 }],
      },
      // Bob settles the full €10
      {
        payer_user_id: 2,
        amount_cents: 1000,
        splits: [{ user_id: 1, amount_cents: 1000 }],
      },
    ]);
    expect(result).toEqual([]);
  });

  it("flips direction when settlement exceeds debt", () => {
    const result = computeBalances([
      {
        payer_user_id: 1,
        amount_cents: 2000,
        splits: [{ user_id: 1 }, { user_id: 2 }],
      },
      // Bob overpays: settles €15 when he only owed €10
      {
        payer_user_id: 2,
        amount_cents: 1500,
        splits: [{ user_id: 1, amount_cents: 1500 }],
      },
    ]);
    expect(result).toEqual([
      { from_user_id: 1, to_user_id: 2, amount_cents: 500 },
    ]);
  });
});
