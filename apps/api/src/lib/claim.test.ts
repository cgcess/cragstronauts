import { describe, it, expect } from "vitest";
import { decideClaimBinding } from "./claim";

describe("decideClaimBinding", () => {
  it("binds an unbound slot to the signed-in account", () => {
    expect(decideClaimBinding({ boundAccountId: null, sessionAccountId: "acc-1" })).toEqual({
      ok: true,
      bind: "acc-1",
    });
  });

  it("allows a cooperative claim of an unbound slot when signed out", () => {
    expect(decideClaimBinding({ boundAccountId: null, sessionAccountId: null })).toEqual({
      ok: true,
      bind: null,
    });
  });

  it("lets the same account re-claim its own bound slot", () => {
    expect(decideClaimBinding({ boundAccountId: "acc-1", sessionAccountId: "acc-1" })).toEqual({
      ok: true,
      bind: "acc-1",
    });
  });

  it("rejects claiming a bound slot when signed out", () => {
    expect(decideClaimBinding({ boundAccountId: "acc-1", sessionAccountId: null })).toEqual({
      ok: false,
      reason: "account_required",
    });
  });

  it("rejects claiming a bound slot as a different account", () => {
    expect(decideClaimBinding({ boundAccountId: "acc-1", sessionAccountId: "acc-2" })).toEqual({
      ok: false,
      reason: "account_mismatch",
    });
  });
});
