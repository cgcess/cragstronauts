import type { z } from "zod";
import type { ExpenseSchema } from "@cragstronauts/contract";

type Expense = z.infer<typeof ExpenseSchema>;

/** Integer cents each person owes when an amount is split equally. */
export function equalShareCents(totalCents: number, count: number): number {
  if (count <= 0) return 0;
  return Math.round(totalCents / count);
}

export type SplitSummary = {
  /**
   * "equal" when every share is within a rounding cent of the equal share —
   * covers both true equal splits (null amounts) and seeded data that stores
   * an even split as per-row custom amounts (e.g. €6.67/€6.66). "custom" only
   * when shares genuinely differ.
   */
  kind: "equal" | "custom";
  /** Number of people the expense is split across. */
  count: number;
  /** The current user's share in cents, or null when they're not in the split. */
  yourShareCents: number | null;
};

/**
 * Resolve a single split row's amount in cents: explicit amount when set,
 * otherwise the equal share derived from the total.
 */
function shareForSplit(exp: Expense, amountCents: number | null | undefined): number {
  if (amountCents != null) return amountCents;
  return equalShareCents(exp.amount_cents, exp.splits.length);
}

/**
 * Summarize how an expense is split, from the reader's point of view.
 * Encapsulates the "effectively equal within 1 cent" heuristic and the
 * current-user lookup so the view layer can stay declarative.
 */
export function summarizeSplit(exp: Expense, currentUserId: number | null): SplitSummary {
  const count = exp.splits.length;
  const equalShare = equalShareCents(exp.amount_cents, count);

  const effectivelyEqual = exp.splits.every(
    (s) => Math.abs(shareForSplit(exp, s.amount_cents) - equalShare) <= 1
  );

  const mine =
    currentUserId == null
      ? undefined
      : exp.splits.find((s) => s.user_id === currentUserId);

  return {
    kind: effectivelyEqual ? "equal" : "custom",
    count,
    yourShareCents: mine ? shareForSplit(exp, mine.amount_cents) : null,
  };
}
