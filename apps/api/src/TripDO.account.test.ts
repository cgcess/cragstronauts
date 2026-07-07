import { describe, it, expect, vi } from "vitest";
import { createMockStorage } from "do-orm/src/test-utils";

// TripDO extends the workers-runtime DurableObject; stub the base class so the
// constructor's this.db (built from ctx.storage) is all that matters here.
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

// Migrations import raw .sql files vitest can't parse; the mock storage
// auto-creates tables on first insert, so no real migration is needed.
vi.mock("./db/migrations", () => ({ migrations: {} }));

import { TripDO } from "./TripDO";
import type { Env } from "./types";

// The constructor registers a WebSocket auto-response; give it a harmless stub.
(globalThis as unknown as { WebSocketRequestResponsePair: unknown }).WebSocketRequestResponsePair =
  class {
    constructor(
      public a: string,
      public b: string,
    ) {}
  };

function makeDO() {
  const storage = createMockStorage();
  const ctx = {
    storage,
    blockConcurrencyWhile: async (fn: () => unknown) => fn(),
    setWebSocketAutoResponse: () => {},
  } as unknown as DurableObjectState;
  return new TripDO(ctx, {} as Env);
}

async function seedOrganizer(doo: TripDO): Promise<number> {
  const { organizer_user_id } = await doo.initialize({
    name: "Löbejün",
    location: "Saxony-Anhalt",
    start_date: null,
    end_date: null,
    accommodation_type: null,
    accommodation_details: null,
    notes: null,
    welcome_message: "hi",
    signature: "org",
    gear_categories: [],
    organizer_name: "Alex",
    organizer_account_id: "acct_1",
  });
  return organizer_user_id;
}

describe("TripDO.getUserAccountId", () => {
  it("returns the account bound to a user", async () => {
    const doo = makeDO();
    const uid = await seedOrganizer(doo);
    expect(await doo.getUserAccountId(uid)).toBe("acct_1");
  });

  it("returns null for a cooperative user with no account", async () => {
    const doo = makeDO();
    await seedOrganizer(doo);
    const coop = await doo.createUser({ name: "Robin", joining: true });
    expect(await doo.getUserAccountId(coop.id)).toBeNull();
  });

  it("returns null for an unknown user", async () => {
    const doo = makeDO();
    await seedOrganizer(doo);
    expect(await doo.getUserAccountId(9999)).toBeNull();
  });
});

describe("TripDO.accountIdsForUsers", () => {
  it("maps user ids to distinct bound accounts, dropping unbound and unknown ids", async () => {
    const doo = makeDO();
    const orgId = await seedOrganizer(doo); // acct_1
    const member = await doo.join("acct_2", "Sam"); // bound account
    const coop = await doo.createUser({ name: "Robin", joining: true }); // no account

    const accounts = await doo.accountIdsForUsers([orgId, member.id, coop.id, 9999]);
    expect(accounts.sort()).toEqual(["acct_1", "acct_2"]);
  });

  it("dedupes ids that resolve to the same account", async () => {
    const doo = makeDO();
    const orgId = await seedOrganizer(doo);
    expect(await doo.accountIdsForUsers([orgId, orgId])).toEqual(["acct_1"]);
  });

  it("returns an empty array for no ids", async () => {
    const doo = makeDO();
    await seedOrganizer(doo);
    expect(await doo.accountIdsForUsers([])).toEqual([]);
  });
});
