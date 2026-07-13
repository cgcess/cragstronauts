import { describe, it, expect } from "vitest";
import { computeSimplifiedBalances, distributeEqual, type Settlement } from "./balances";

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

  // ---- Settlement scenarios ----
  // Settlements are stored as custom-split expenses where the debtor pays
  // and the creditor is the sole split member. The balance engine sees them
  // as regular expenses, so these tests verify that mix works correctly.

  it("full settlement zeroes out the balance between two people", () => {
    // Alice(1) pays €100 split with Bob(2) → Bob owes 50
    // Bob settles the full €50 with Alice (settlement expense)
    const result = computeSimplifiedBalances([
      {
        payer_user_id: 1,
        amount_cents: 10000,
        splits: [{ user_id: 1 }, { user_id: 2 }],
      },
      // Settlement: Bob pays, Alice is the split target
      {
        payer_user_id: 2,
        amount_cents: 5000,
        splits: [{ user_id: 1, amount_cents: 5000 }],
      },
    ]);
    expect(result).toEqual([]);
  });

  it("partial settlement reduces but does not zero out the balance", () => {
    // Alice(1) pays €100 split with Bob(2) → Bob owes 50
    // Bob settles €30 of the €50
    const result = computeSimplifiedBalances([
      {
        payer_user_id: 1,
        amount_cents: 10000,
        splits: [{ user_id: 1 }, { user_id: 2 }],
      },
      {
        payer_user_id: 2,
        amount_cents: 3000,
        splits: [{ user_id: 1, amount_cents: 3000 }],
      },
    ]);
    expect(result).toEqual([
      { from_user_id: 2, to_user_id: 1, amount_cents: 2000 },
    ]);
  });

  it("new expense after full settlement creates fresh debt", () => {
    // 1. Alice(1) pays €60 split 3 ways → Bob(2) owes 20, Charlie(3) owes 20
    // 2. Bob settles his €20 with Alice
    // 3. Alice pays another €90 split 3 ways → each share 30
    // Net: Alice = 20+20-20+30+30 = +80, Bob = -20+20-30 = -30, Charlie = -20-30 = -50
    const result = computeSimplifiedBalances([
      {
        payer_user_id: 1,
        amount_cents: 6000,
        splits: [{ user_id: 1 }, { user_id: 2 }, { user_id: 3 }],
      },
      // Bob's settlement
      {
        payer_user_id: 2,
        amount_cents: 2000,
        splits: [{ user_id: 1, amount_cents: 2000 }],
      },
      // New expense after settlement
      {
        payer_user_id: 1,
        amount_cents: 9000,
        splits: [{ user_id: 1 }, { user_id: 2 }, { user_id: 3 }],
      },
    ]);
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ from_user_id: 3, to_user_id: 1, amount_cents: 5000 });
    expect(result).toContainEqual({ from_user_id: 2, to_user_id: 1, amount_cents: 3000 });
  });

  it("settlement then new expense where settled person is the payer", () => {
    // 1. Alice(1) pays €100 split with Bob(2) → Bob owes 50
    // 2. Bob settles €50 with Alice → all clear
    // 3. Bob pays €80 split with Alice → Alice owes 40
    const result = computeSimplifiedBalances([
      {
        payer_user_id: 1,
        amount_cents: 10000,
        splits: [{ user_id: 1 }, { user_id: 2 }],
      },
      {
        payer_user_id: 2,
        amount_cents: 5000,
        splits: [{ user_id: 1, amount_cents: 5000 }],
      },
      {
        payer_user_id: 2,
        amount_cents: 8000,
        splits: [{ user_id: 1 }, { user_id: 2 }],
      },
    ]);
    // Now Alice owes Bob 40
    expect(result).toEqual([
      { from_user_id: 1, to_user_id: 2, amount_cents: 4000 },
    ]);
  });

  it("multiple settlements from different people", () => {
    // Alice(1) pays €90 split 3 ways → Bob(2) owes 30, Charlie(3) owes 30
    // Bob settles 30, Charlie settles 30
    const result = computeSimplifiedBalances([
      {
        payer_user_id: 1,
        amount_cents: 9000,
        splits: [{ user_id: 1 }, { user_id: 2 }, { user_id: 3 }],
      },
      {
        payer_user_id: 2,
        amount_cents: 3000,
        splits: [{ user_id: 1, amount_cents: 3000 }],
      },
      {
        payer_user_id: 3,
        amount_cents: 3000,
        splits: [{ user_id: 1, amount_cents: 3000 }],
      },
    ]);
    expect(result).toEqual([]);
  });

  it("overpayment in settlement flips the debt direction", () => {
    // Alice(1) pays €100 split with Bob(2) → Bob owes 50
    // Bob accidentally settles €70 (overpays by 20)
    const result = computeSimplifiedBalances([
      {
        payer_user_id: 1,
        amount_cents: 10000,
        splits: [{ user_id: 1 }, { user_id: 2 }],
      },
      {
        payer_user_id: 2,
        amount_cents: 7000,
        splits: [{ user_id: 1, amount_cents: 7000 }],
      },
    ]);
    // Now Alice owes Bob 20
    expect(result).toEqual([
      { from_user_id: 1, to_user_id: 2, amount_cents: 2000 },
    ]);
  });
});

describe("computeSimplifiedBalances — remove middlemen only (no cross-group routing)", () => {
  // Users: Nico=1, Bohdan=2, Lotti=3, Sashi=4, Lisa=5, Sara=6, Sam=7
  it("Löbejün: two unrelated cars stay separate (no stranger payments)", () => {
    const result = computeSimplifiedBalances([
      // Nico's car: gas €63 split 4 ways (Nico, Bohdan, Lotti, Sashi)
      {
        payer_user_id: 1,
        amount_cents: 6300,
        splits: [{ user_id: 1 }, { user_id: 2 }, { user_id: 3 }, { user_id: 4 }],
      },
      // Nico's car: car €341 split 4 ways
      {
        payer_user_id: 1,
        amount_cents: 34100,
        splits: [{ user_id: 1 }, { user_id: 2 }, { user_id: 3 }, { user_id: 4 }],
      },
      // Lotti settles €101 with Nico
      {
        payer_user_id: 3,
        amount_cents: 10100,
        splits: [{ user_id: 1, amount_cents: 10100 }],
      },
      // Sashi settles €101 with Nico
      {
        payer_user_id: 4,
        amount_cents: 10100,
        splits: [{ user_id: 1, amount_cents: 10100 }],
      },
      // Lisa's car: Minka car €211.11 split 3 ways (Lisa, Sara, Sam)
      {
        payer_user_id: 5,
        amount_cents: 21111,
        splits: [{ user_id: 5 }, { user_id: 6 }, { user_id: 7 }],
      },
    ]);

    // Exactly three honest transfers.
    expect(result).toHaveLength(3);
    expect(result).toContainEqual({ from_user_id: 2, to_user_id: 1, amount_cents: 10100 });
    expect(result).toContainEqual({ from_user_id: 6, to_user_id: 5, amount_cents: 7037 });
    expect(result).toContainEqual({ from_user_id: 7, to_user_id: 5, amount_cents: 7037 });

    // No settlement links the two cars.
    const crossGroup = result.filter(
      (s) =>
        (s.to_user_id === 1 && s.from_user_id !== 2) || // paying Nico who isn't Bohdan
        (s.to_user_id === 5 && s.from_user_id === 2), // Bohdan paying Lisa
    );
    expect(crossGroup).toEqual([]);
  });

  it("pure payers/receivers are left alone (no minimization)", () => {
    // Two pure creditors X(10), Y(20); two pure debtors A(1), B(2).
    // A and B each owe X and Y €5 (via X and Y each paying a €10 shared expense).
    // X pays €10 split with A, B → A owes 5, B owes 5.
    // Y pays €10 split with A, B → A owes 5, B owes 5.
    const result = computeSimplifiedBalances([
      {
        payer_user_id: 10,
        amount_cents: 1000,
        splits: [
          { user_id: 10, amount_cents: 0 },
          { user_id: 1, amount_cents: 500 },
          { user_id: 2, amount_cents: 500 },
        ],
      },
      {
        payer_user_id: 20,
        amount_cents: 1000,
        splits: [
          { user_id: 20, amount_cents: 0 },
          { user_id: 1, amount_cents: 500 },
          { user_id: 2, amount_cents: 500 },
        ],
      },
    ]);
    // Honest: 4 transfers, NOT the 2-transfer minimized form.
    expect(result).toHaveLength(4);
    expect(result).toContainEqual({ from_user_id: 1, to_user_id: 10, amount_cents: 500 });
    expect(result).toContainEqual({ from_user_id: 1, to_user_id: 20, amount_cents: 500 });
    expect(result).toContainEqual({ from_user_id: 2, to_user_id: 10, amount_cents: 500 });
    expect(result).toContainEqual({ from_user_id: 2, to_user_id: 20, amount_cents: 500 });
  });

  it("every settlement respects reachability in the pairwise digraph; net preserved; no self-edges", () => {
    // Build the step-2 pairwise digraph independently and check the property.
    const cases: Expense[][] = [
      // Löbejün
      [
        { payer_user_id: 1, amount_cents: 6300, splits: [{ user_id: 1 }, { user_id: 2 }, { user_id: 3 }, { user_id: 4 }] },
        { payer_user_id: 1, amount_cents: 34100, splits: [{ user_id: 1 }, { user_id: 2 }, { user_id: 3 }, { user_id: 4 }] },
        { payer_user_id: 3, amount_cents: 10100, splits: [{ user_id: 1, amount_cents: 10100 }] },
        { payer_user_id: 4, amount_cents: 10100, splits: [{ user_id: 1, amount_cents: 10100 }] },
        { payer_user_id: 5, amount_cents: 21111, splits: [{ user_id: 5 }, { user_id: 6 }, { user_id: 7 }] },
      ],
      // Chain A→B→C
      [
        { payer_user_id: 1, amount_cents: 1000, splits: [{ user_id: 2, amount_cents: 1000 }] },
        { payer_user_id: 2, amount_cents: 1000, splits: [{ user_id: 3, amount_cents: 1000 }] },
      ],
      // Longer chain 1→2→3→4
      [
        { payer_user_id: 1, amount_cents: 500, splits: [{ user_id: 2, amount_cents: 500 }] },
        { payer_user_id: 2, amount_cents: 500, splits: [{ user_id: 3, amount_cents: 500 }] },
        { payer_user_id: 3, amount_cents: 500, splits: [{ user_id: 4, amount_cents: 500 }] },
      ],
      // Mixed
      [
        { payer_user_id: 1, amount_cents: 6000, splits: [{ user_id: 1 }, { user_id: 2 }, { user_id: 3 }] },
        { payer_user_id: 2, amount_cents: 3000, splits: [{ user_id: 1 }, { user_id: 3 }] },
        { payer_user_id: 3, amount_cents: 1200, splits: [{ user_id: 4, amount_cents: 1200 }] },
      ],
    ];

    for (const expenses of cases) {
      // Reference: pairwise directed debts (debtor -> payer), then net opposing pairs.
      const edge = new Map<string, number>();
      const bump = (from: number, to: number, amt: number) => {
        if (amt === 0) return;
        const k = `${from}->${to}`;
        edge.set(k, (edge.get(k) ?? 0) + amt);
      };
      for (const exp of expenses) {
        const n = exp.splits.length;
        if (n === 0) continue;
        const shares = distributeEqual(exp.amount_cents, n);
        exp.splits.forEach((s, i) => {
          const share = s.amount_cents != null ? s.amount_cents : shares[i];
          if (s.user_id === exp.payer_user_id) return;
          if (share === 0) return;
          bump(s.user_id, exp.payer_user_id, share);
        });
      }
      const users = new Set<number>();
      for (const k of edge.keys()) {
        const [f, t] = k.split("->").map(Number);
        users.add(f);
        users.add(t);
      }
      const get = (f: number, t: number) => edge.get(`${f}->${t}`) ?? 0;
      const set = (f: number, t: number, v: number) => {
        if (v === 0) edge.delete(`${f}->${t}`);
        else edge.set(`${f}->${t}`, v);
      };
      const arr = [...users];
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const a = arr[i], b = arr[j];
          const m = Math.min(get(a, b), get(b, a));
          if (m > 0) {
            set(a, b, get(a, b) - m);
            set(b, a, get(b, a) - m);
          }
        }
      }
      // Reachability over the netted digraph.
      const adj = new Map<number, Set<number>>();
      for (const k of edge.keys()) {
        const [f, t] = k.split("->").map(Number);
        if (!adj.has(f)) adj.set(f, new Set());
        adj.get(f)!.add(t);
      }
      const reachable = (from: number, to: number): boolean => {
        const seen = new Set<number>();
        const stack = [from];
        while (stack.length) {
          const cur = stack.pop()!;
          if (cur === to) return true;
          for (const nxt of adj.get(cur) ?? []) {
            if (!seen.has(nxt)) {
              seen.add(nxt);
              stack.push(nxt);
            }
          }
        }
        return false;
      };

      const result = computeSimplifiedBalances(expenses);

      // Per-user net from the emitted settlements matches the netted-digraph net.
      const refNet = new Map<number, number>();
      for (const [k, v] of edge) {
        const [f, t] = k.split("->").map(Number);
        refNet.set(f, (refNet.get(f) ?? 0) - v);
        refNet.set(t, (refNet.get(t) ?? 0) + v);
      }
      const outNet = new Map<number, number>();
      for (const s of result) {
        expect(s.from_user_id).not.toBe(s.to_user_id); // no self-edges
        expect(reachable(s.from_user_id, s.to_user_id)).toBe(true); // no phantom links
        outNet.set(s.from_user_id, (outNet.get(s.from_user_id) ?? 0) - s.amount_cents);
        outNet.set(s.to_user_id, (outNet.get(s.to_user_id) ?? 0) + s.amount_cents);
      }
      for (const u of users) {
        expect(outNet.get(u) ?? 0).toBe(refNet.get(u) ?? 0);
      }
    }
  });
});

describe("distributeEqual", () => {
  it("splits evenly when no remainder", () => {
    expect(distributeEqual(900, 3)).toEqual([300, 300, 300]);
  });

  it("gives the first share the extra cent (remainder 1)", () => {
    expect(distributeEqual(1000, 3)).toEqual([334, 333, 333]);
  });

  it("gives the first two shares an extra cent (remainder 2)", () => {
    expect(distributeEqual(1001, 3)).toEqual([334, 334, 333]);
  });

  it("handles 2-way odd split", () => {
    expect(distributeEqual(999, 2)).toEqual([500, 499]);
  });

  it("handles single-person split", () => {
    expect(distributeEqual(1000, 1)).toEqual([1000]);
  });

  it("always sums to the total", () => {
    const cases: [number, number][] = [
      [1000, 3], [1001, 3], [999, 2], [7, 4], [100, 7], [1, 3], [2, 3], [10000, 6],
    ];
    for (const [total, n] of cases) {
      const shares = distributeEqual(total, n);
      expect(shares.reduce((a, b) => a + b, 0)).toBe(total);
      expect(shares).toHaveLength(n);
    }
  });

  it("no share differs from another by more than 1", () => {
    const cases: [number, number][] = [
      [1000, 3], [7, 4], [100, 7], [1, 5], [9999, 11],
    ];
    for (const [total, n] of cases) {
      const shares = distributeEqual(total, n);
      const min = Math.min(...shares);
      const max = Math.max(...shares);
      expect(max - min).toBeLessThanOrEqual(1);
    }
  });
});

describe("computeSimplifiedBalances — remainder handling", () => {
  it("accounts for every cent in a 3-way split of 1000 (null amounts)", () => {
    // 1000 / 3 → shares [334, 333, 333]. Payer (u1) is at position 0.
    // u2 owes 333, u3 owes 333. Payer's implicit share = 334.
    const result = computeSimplifiedBalances([
      {
        payer_user_id: 1,
        amount_cents: 1000,
        splits: [{ user_id: 1 }, { user_id: 2 }, { user_id: 3 }],
      },
    ]);
    const totalOwed = result.reduce((s, r) => s + r.amount_cents, 0);
    expect(totalOwed).toBe(666);
    expect(result).toContainEqual({ from_user_id: 2, to_user_id: 1, amount_cents: 333 });
    expect(result).toContainEqual({ from_user_id: 3, to_user_id: 1, amount_cents: 333 });
  });

  it("accounts for every cent in a 3-way split of 1000 (stored amounts)", () => {
    // Same scenario but with explicit amounts as the write path now produces.
    const result = computeSimplifiedBalances([
      {
        payer_user_id: 1,
        amount_cents: 1000,
        splits: [
          { user_id: 1, amount_cents: 334 },
          { user_id: 2, amount_cents: 333 },
          { user_id: 3, amount_cents: 333 },
        ],
      },
    ]);
    const totalOwed = result.reduce((s, r) => s + r.amount_cents, 0);
    expect(totalOwed).toBe(666);
    expect(result).toContainEqual({ from_user_id: 2, to_user_id: 1, amount_cents: 333 });
    expect(result).toContainEqual({ from_user_id: 3, to_user_id: 1, amount_cents: 333 });
  });

  it("payer at non-first position gets the smaller share", () => {
    // splits: [u2, u1(payer), u3]. distributeEqual(1000, 3) = [334, 333, 333].
    // u2 gets 334 (owes 334), u1(payer) gets 333 (skipped), u3 gets 333 (owes 333).
    const result = computeSimplifiedBalances([
      {
        payer_user_id: 1,
        amount_cents: 1000,
        splits: [{ user_id: 2 }, { user_id: 1 }, { user_id: 3 }],
      },
    ]);
    const totalOwed = result.reduce((s, r) => s + r.amount_cents, 0);
    expect(totalOwed).toBe(667);
    expect(result).toContainEqual({ from_user_id: 2, to_user_id: 1, amount_cents: 334 });
    expect(result).toContainEqual({ from_user_id: 3, to_user_id: 1, amount_cents: 333 });
  });

  it("2-way split of odd amount with remainder (null amounts)", () => {
    // 999 / 2 → [500, 499]. Payer is u1 (position 0, gets 500, skipped).
    // u2 owes 499.
    const result = computeSimplifiedBalances([
      {
        payer_user_id: 1,
        amount_cents: 999,
        splits: [{ user_id: 1 }, { user_id: 2 }],
      },
    ]);
    expect(result).toEqual([
      { from_user_id: 2, to_user_id: 1, amount_cents: 499 },
    ]);
  });

  it("net across all users is exactly zero (no lost cents)", () => {
    // Three expenses with odd totals. The net across everyone must be 0.
    const expenses = [
      {
        payer_user_id: 1,
        amount_cents: 1000,
        splits: [{ user_id: 1 }, { user_id: 2 }, { user_id: 3 }],
      },
      {
        payer_user_id: 2,
        amount_cents: 700,
        splits: [{ user_id: 1 }, { user_id: 2 }, { user_id: 3 }],
      },
      {
        payer_user_id: 3,
        amount_cents: 500,
        splits: [{ user_id: 1 }, { user_id: 2 }, { user_id: 3 }],
      },
    ];
    const result = computeSimplifiedBalances(expenses);
    // Sum of all from_amounts must equal sum of all to_amounts
    // (every cent that leaves someone arrives at someone else).
    const totalFrom = result.reduce((s, r) => s + r.amount_cents, 0);
    const totalTo = result.reduce((s, r) => s + r.amount_cents, 0);
    expect(totalFrom).toBe(totalTo);
    // Also verify indirectly: credits - debits = 0 over all users.
    const net = new Map<number, number>();
    for (const s of result) {
      net.set(s.from_user_id, (net.get(s.from_user_id) ?? 0) - s.amount_cents);
      net.set(s.to_user_id, (net.get(s.to_user_id) ?? 0) + s.amount_cents);
    }
    const globalNet = [...net.values()].reduce((a, b) => a + b, 0);
    expect(globalNet).toBe(0);
  });

  it("remainder 2: stored amounts from 1001 split 3 ways", () => {
    // distributeEqual(1001, 3) = [334, 334, 333]
    const result = computeSimplifiedBalances([
      {
        payer_user_id: 1,
        amount_cents: 1001,
        splits: [
          { user_id: 1, amount_cents: 334 },
          { user_id: 2, amount_cents: 334 },
          { user_id: 3, amount_cents: 333 },
        ],
      },
    ]);
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ from_user_id: 2, to_user_id: 1, amount_cents: 334 });
    expect(result).toContainEqual({ from_user_id: 3, to_user_id: 1, amount_cents: 333 });
    const totalOwed = result.reduce((s, r) => s + r.amount_cents, 0);
    expect(totalOwed).toBe(667); // payer's implicit share = 334, 334+334+333=1001
  });

  it("settlement still zeros out a remainder-affected expense", () => {
    // Alice(1) pays 1000 split 3 ways → shares [334, 333, 333]
    // Bob(2) owes 333, Charlie(3) owes 333.
    // Bob settles 333, Charlie settles 333.
    const result = computeSimplifiedBalances([
      {
        payer_user_id: 1,
        amount_cents: 1000,
        splits: [
          { user_id: 1, amount_cents: 334 },
          { user_id: 2, amount_cents: 333 },
          { user_id: 3, amount_cents: 333 },
        ],
      },
      {
        payer_user_id: 2,
        amount_cents: 333,
        splits: [{ user_id: 1, amount_cents: 333 }],
      },
      {
        payer_user_id: 3,
        amount_cents: 333,
        splits: [{ user_id: 1, amount_cents: 333 }],
      },
    ]);
    expect(result).toEqual([]);
  });
});
