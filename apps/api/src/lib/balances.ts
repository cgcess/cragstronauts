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
    const isCustom = exp.splits.some((s) => s.amount_cents != null);
    const equalShare = Math.floor(exp.amount_cents / n);

    for (const s of exp.splits) {
      const share = isCustom ? (s.amount_cents ?? 0) : equalShare;
      if (s.user_id === exp.payer_user_id) continue;
      if (share === 0) continue;
      // s.user_id owes `share` to payer
      netBalance.set(s.user_id, (netBalance.get(s.user_id) ?? 0) - share);
      netBalance.set(exp.payer_user_id, (netBalance.get(exp.payer_user_id) ?? 0) + share);
    }
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
