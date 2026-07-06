import { describe, it, expect, vi } from "vitest";
import { createMockStorage } from "do-orm/src/test-utils";

// AccountDO extends DurableObject from the workers runtime, which isn't
// available under plain vitest. Stub the base class: the methods only touch
// this.db, built in the constructor from ctx.storage.
vi.mock("cloudflare:workers", () => ({
  DurableObject: class {
    ctx: unknown;
    env: unknown;
    constructor(ctx: unknown, env: unknown) {
      this.ctx = ctx;
      this.env = env;
    }
  },
}));

// The migrations module imports raw .sql files, which vitest can't parse. The
// mock storage auto-creates tables on first insert, so no migration is needed.
vi.mock("./db/account-migrations", () => ({ accountMigrations: {} }));

import { AccountDO } from "./AccountDO";
import type { Env } from "./types";

function makeDO() {
  const storage = createMockStorage();
  const ctx = {
    storage,
    blockConcurrencyWhile: async (fn: () => unknown) => fn(),
  } as unknown as DurableObjectState;
  return new AccountDO(ctx, {} as Env);
}

const subA = { endpoint: "https://push/a", keys: { p256dh: "pa", auth: "aa" } };
const subB = { endpoint: "https://push/b", keys: { p256dh: "pb", auth: "ab" } };

describe("AccountDO push subscriptions", () => {
  it("lists the account's saved subscriptions", async () => {
    const doo = makeDO();

    await doo.savePushSubscription(subA);
    await doo.savePushSubscription(subB);

    expect(await doo.listPushSubscriptions()).toEqual([subA, subB]);
  });

  it("is idempotent per endpoint (re-saving the same device replaces, not duplicates)", async () => {
    const doo = makeDO();

    await doo.savePushSubscription(subA);
    await doo.savePushSubscription({ ...subA, keys: { p256dh: "new", auth: "new" } });

    const list = await doo.listPushSubscriptions();
    expect(list).toHaveLength(1);
    expect(list[0].keys).toEqual({ p256dh: "new", auth: "new" });
  });

  it("removes a subscription by endpoint", async () => {
    const doo = makeDO();
    await doo.savePushSubscription(subA);
    await doo.savePushSubscription(subB);

    await doo.deletePushSubscription(subA.endpoint);

    expect(await doo.listPushSubscriptions()).toEqual([subB]);
  });
});
