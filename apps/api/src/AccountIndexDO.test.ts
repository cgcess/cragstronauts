import { describe, it, expect, vi } from "vitest";
import { createMockStorage } from "do-orm/src/test-utils";

// AccountIndexDO extends DurableObject from the workers runtime, which isn't
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

// The migrations module imports a raw .sql file, which vitest can't parse.
// The mock storage auto-creates tables on first insert, so no migration needed.
vi.mock("./db/account-index-migrations", () => ({ accountIndexMigrations: {} }));

import { AccountIndexDO } from "./AccountIndexDO";
import type { Env } from "./types";

function makeDO() {
  const storage = createMockStorage();
  const ctx = {
    storage,
    blockConcurrencyWhile: async (fn: () => unknown) => fn(),
  } as unknown as DurableObjectState;
  return new AccountIndexDO(ctx, {} as Env);
}

const meta = {
  name: "Löbejün",
  location: "Saxony-Anhalt",
  start_date: "2025-05-01",
  end_date: "2025-05-04",
};

describe("AccountIndexDO.ensureMember", () => {
  it("inserts an absent trip with role member and the given meta", async () => {
    const doo = makeDO();
    await doo.ensureMember("trip1", meta);
    const list = await doo.list();
    expect(list).toEqual([
      {
        id: "trip1",
        name: "Löbejün",
        location: "Saxony-Anhalt",
        start_date: "2025-05-01",
        end_date: "2025-05-04",
        role: "member",
      },
    ]);
  });

  it("keeps an existing owner role and refreshes meta", async () => {
    const doo = makeDO();
    await doo.add("trip1", "owner", { ...meta, name: "Old name" });
    await doo.ensureMember("trip1", meta);
    const list = await doo.list();
    expect(list).toHaveLength(1);
    expect(list[0].role).toBe("owner");
    expect(list[0].name).toBe("Löbejün");
  });

  it("keeps an existing member role and refreshes meta", async () => {
    const doo = makeDO();
    await doo.add("trip1", "member", { ...meta, name: "Old name" });
    await doo.ensureMember("trip1", meta);
    const list = await doo.list();
    expect(list).toHaveLength(1);
    expect(list[0].role).toBe("member");
    expect(list[0].name).toBe("Löbejün");
  });
});
