import { describe, it, expect, vi } from "vitest";
import { createMockStorage } from "do-orm/src/test-utils";

// Mirror TripDO.account.test.ts: stub the workers base class and the raw-SQL
// migrations (the mock storage auto-creates tables on first insert).
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
vi.mock("./db/migrations", () => ({ migrations: {} }));

import { TripDO } from "./TripDO";
import type { Env } from "./types";

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

describe("TripDO announcements", () => {
  it("creates a top-level post and lists it with empty reactions/replies", async () => {
    const doo = makeDO();
    const org = await seedOrganizer(doo);

    const created = await doo.createAnnouncement({
      user_id: org,
      body: "  Queue your music: https://open.spotify.com/x  ",
    });
    expect(created.parent_id).toBeNull();
    expect(created.author_name).toBe("Alex");
    expect(created.body).toBe("Queue your music: https://open.spotify.com/x");

    const list = await doo.listAnnouncements();
    expect(list).toHaveLength(1);
    expect(list[0].reactions).toEqual([]);
    expect(list[0].replies).toEqual([]);
  });

  it("nests a one-level reply and rejects replying to a reply", async () => {
    const doo = makeDO();
    const org = await seedOrganizer(doo);
    const robin = await doo.createUser({ name: "Robin", joining: true });

    const top = await doo.createAnnouncement({ user_id: org, body: "boar sighting" });
    const reply = await doo.createAnnouncement({
      user_id: robin.id,
      body: "seems gone now",
      parent_id: top.id,
    });
    expect(reply.parent_id).toBe(top.id);

    const list = await doo.listAnnouncements();
    expect(list[0].replies).toHaveLength(1);
    expect(list[0].replies[0].author_name).toBe("Robin");

    await expect(
      doo.createAnnouncement({ user_id: org, body: "nested", parent_id: reply.id })
    ).rejects.toThrow("Can't reply to a reply");
  });

  it("toggles a reaction on and off, grouped by emoji", async () => {
    const doo = makeDO();
    const org = await seedOrganizer(doo);
    const robin = await doo.createUser({ name: "Robin", joining: true });
    const top = await doo.createAnnouncement({ user_id: org, body: "hi all" });

    let res = await doo.toggleReaction(top.id, { user_id: org, emoji: "❤️" });
    expect(res.reactions).toEqual([{ emoji: "❤️", user_ids: [org] }]);

    res = await doo.toggleReaction(top.id, { user_id: robin.id, emoji: "❤️" });
    expect(res.reactions).toEqual([{ emoji: "❤️", user_ids: [org, robin.id] }]);

    // Same user + emoji again removes just their reaction.
    res = await doo.toggleReaction(top.id, { user_id: org, emoji: "❤️" });
    expect(res.reactions).toEqual([{ emoji: "❤️", user_ids: [robin.id] }]);
  });

  it("lets the author or organizer delete, but no one else", async () => {
    const doo = makeDO();
    const org = await seedOrganizer(doo);
    const robin = await doo.createUser({ name: "Robin", joining: true });
    const sam = await doo.createUser({ name: "Sam", joining: true });

    const post = await doo.createAnnouncement({ user_id: robin.id, body: "mine" });

    // A different non-organizer member can't delete it.
    await expect(doo.deleteAnnouncement(post.id, sam.id)).rejects.toThrow("Not allowed");

    // The organizer can moderate anyone's post.
    expect(await doo.deleteAnnouncement(post.id, org)).toEqual({ ok: true });
    expect(await doo.listAnnouncements()).toHaveLength(0);
  });

  it("lists newest-first", async () => {
    const doo = makeDO();
    const org = await seedOrganizer(doo);
    const first = await doo.createAnnouncement({ user_id: org, body: "first" });
    const second = await doo.createAnnouncement({ user_id: org, body: "second" });
    const list = await doo.listAnnouncements();
    expect(list.map((a) => a.id)).toEqual([second.id, first.id]);
  });
});
