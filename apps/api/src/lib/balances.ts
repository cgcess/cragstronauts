export interface Expense {
  payer_user_id: number;
  amount_cents: number;
  splits: { user_id: number; amount_cents?: number }[];
}

export interface Settlement {
  from_user_id: number;
  to_user_id: number;
  amount_cents: number;
}

/**
 * Distribute `total` cents into `n` integer shares that sum exactly to `total`.
 * The first `total % n` shares get one extra cent.
 */
export function distributeEqual(total: number, n: number): number[] {
  const base = Math.floor(total / n);
  const remainder = total % n;
  return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0));
}

/**
 * Compute simplified (minimized) settlements.
 * Nets each person's total balance, then greedily matches
 * creditors with debtors to minimize transaction count.
 */
export function computeSimplifiedBalances(expenses: Expense[]): Settlement[] {
  // Step 1: Compute net balance per user.
  // Positive = they are owed money (creditor), negative = they owe money (debtor).
  const netBalance = new Map<number, number>();

  for (const exp of expenses) {
    const n = exp.splits.length;
    if (n === 0) continue;
    // Fallback shares for splits that don't carry explicit amounts.
    const shares = distributeEqual(exp.amount_cents, n);

    exp.splits.forEach((s, i) => {
      const share = s.amount_cents != null ? s.amount_cents : shares[i];
      if (s.user_id === exp.payer_user_id) return;
      if (share === 0) return;
      netBalance.set(s.user_id, (netBalance.get(s.user_id) ?? 0) - share);
      netBalance.set(exp.payer_user_id, (netBalance.get(exp.payer_user_id) ?? 0) + share);
    });
  }

  // Step 2: Separate into creditors and debtors.
  const creditors: { userId: number; amount: number }[] = [];
  const debtors: { userId: number; amount: number }[] = [];

  for (const [userId, balance] of netBalance) {
    if (balance > 0) creditors.push({ userId, amount: balance });
    else if (balance < 0) debtors.push({ userId, amount: -balance });
  }

  // Step 3: Greedy matching — sort descending by amount, match largest pairs.
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const result: Settlement[] = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const transfer = Math.min(creditors[ci].amount, debtors[di].amount);
    if (transfer > 0) {
      result.push({
        from_user_id: debtors[di].userId,
        to_user_id: creditors[ci].userId,
        amount_cents: transfer,
      });
    }
    creditors[ci].amount -= transfer;
    debtors[di].amount -= transfer;
    if (creditors[ci].amount === 0) ci++;
    if (debtors[di].amount === 0) di++;
  }

  return result;
}
