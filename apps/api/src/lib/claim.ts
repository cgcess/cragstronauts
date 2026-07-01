export type ClaimDecision =
  | { ok: true; bind: string | null }
  | { ok: false; reason: "account_required" | "account_mismatch" };

/**
 * Policy for whether a claim attempt may proceed, given whether the target slot
 * is already bound to a Google account and which account (if any) is asking.
 * Pure, so the rule can be unit-tested without the Durable Object runtime.
 *
 *  - Unbound slot: always allowed. If the caller is signed in we bind the slot
 *    to their account (the durable claim); otherwise it stays a cooperative
 *    claim, exactly as before accounts existed.
 *  - Bound slot: only the same account may re-claim it. A caller with no session
 *    (account_required) or a different account (account_mismatch) is rejected.
 *    This is the impersonation guard.
 */
export function decideClaimBinding(args: {
  boundAccountId: string | null;
  sessionAccountId: string | null;
}): ClaimDecision {
  const { boundAccountId, sessionAccountId } = args;
  if (boundAccountId === null) return { ok: true, bind: sessionAccountId };
  if (sessionAccountId === null) return { ok: false, reason: "account_required" };
  if (sessionAccountId !== boundAccountId) return { ok: false, reason: "account_mismatch" };
  return { ok: true, bind: boundAccountId };
}
