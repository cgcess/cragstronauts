export interface Expense {
  payer_user_id: number;
  amount_cents: number;
  splits: { user_id: number }[];
}

export interface Settlement {
  from_user_id: number;
  to_user_id: number;
  amount_cents: number;
}

export function computeBalances(expenses: Expense[]): Settlement[] {
  // Net balance per ordered pair (a, b) where a < b.
  // Positive means a owes b, negative means b owes a.
  const nets = new Map<string, number>();

  for (const exp of expenses) {
    const n = exp.splits.length;
    if (n === 0) continue;
    const share = Math.floor(exp.amount_cents / n);

    for (const s of exp.splits) {
      if (s.user_id === exp.payer_user_id) continue;
      // s.user_id owes payer
      const [lo, hi] =
        s.user_id < exp.payer_user_id
          ? [s.user_id, exp.payer_user_id]
          : [exp.payer_user_id, s.user_id];
      const key = `${lo}:${hi}`;
      const prev = nets.get(key) ?? 0;
      // Convention: positive = lo owes hi
      const delta = s.user_id < exp.payer_user_id ? share : -share;
      nets.set(key, prev + delta);
    }
  }

  const settlements: Settlement[] = [];
  for (const [key, amount] of nets) {
    if (amount === 0) continue;
    const [lo, hi] = key.split(":").map(Number);
    if (amount > 0) {
      settlements.push({ from_user_id: lo, to_user_id: hi, amount_cents: amount });
    } else {
      settlements.push({ from_user_id: hi, to_user_id: lo, amount_cents: -amount });
    }
  }

  return settlements;
}
