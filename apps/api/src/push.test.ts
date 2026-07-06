import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// PushForge's builder does real ECDH/VAPID crypto against the subscription's
// key material, which we don't fabricate here (encryption is validated
// manually). Mock it to a deterministic request and test our seam: subscription
// fan-out, forwarding the built request to fetch, pruning, and error swallowing.
const buildPushHTTPRequest = vi.fn();
vi.mock("@pushforge/builder", () => ({
  buildPushHTTPRequest: (opts: unknown) => buildPushHTTPRequest(opts),
}));

import { sendPushToAccount } from "./push";
import type { Env } from "./types";
import type { AccountDO } from "./AccountDO";

type Sub = { endpoint: string; keys: { p256dh: string; auth: string } };

function makeStub(subs: Sub[]) {
  const deleted: string[] = [];
  const stub = {
    listPushSubscriptions: vi.fn(async () => subs),
    deletePushSubscription: vi.fn(async (endpoint: string) => {
      deleted.push(endpoint);
      return { ok: true };
    }),
  } as unknown as DurableObjectStub<AccountDO>;
  return { stub, deleted };
}

const env = (over: Partial<Env> = {}): Env =>
  ({
    VAPID_PRIVATE_KEY: '{"kty":"EC"}',
    VAPID_SUBJECT: "mailto:test@example.com",
    ...over,
  }) as Env;

// Run scheduled promises inline and let the test await them.
const scheduled: Promise<unknown>[] = [];
const schedule = (p: Promise<unknown>) => {
  scheduled.push(p);
};
const flush = () => Promise.all(scheduled);

const notification = { title: "Hi", body: "You have a passenger", url: "/x" };

describe("sendPushToAccount", () => {
  beforeEach(() => {
    scheduled.length = 0;
    buildPushHTTPRequest.mockReset();
    buildPushHTTPRequest.mockImplementation(async ({ subscription }: { subscription: Sub }) => ({
      endpoint: subscription.endpoint,
      headers: { Authorization: "vapid t=jwt,k=key", TTL: "43200" },
      body: new ArrayBuffer(8),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("no-ops when VAPID is unset (never touches subscriptions)", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const { stub } = makeStub([{ endpoint: "https://push/a", keys: { p256dh: "p", auth: "a" } }]);

    sendPushToAccount(env({ VAPID_PRIVATE_KEY: "" }), schedule, stub, notification);
    await flush();

    expect(scheduled).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(stub.listPushSubscriptions).not.toHaveBeenCalled();
  });

  it("sends one fetch per subscription, forwarding the built request", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 201 }));
    const subs: Sub[] = [
      { endpoint: "https://push/a", keys: { p256dh: "pa", auth: "aa" } },
      { endpoint: "https://push/b", keys: { p256dh: "pb", auth: "ab" } },
    ];
    const { stub, deleted } = makeStub(subs);

    sendPushToAccount(env(), schedule, stub, notification);
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://push/a");
    expect((init?.headers as Record<string, string>).Authorization).toContain("vapid");
    expect(init?.method).toBe("POST");
    expect(deleted).toEqual([]);
  });

  it("prunes a subscription the push service reports gone (410)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 410 }));
    const { stub, deleted } = makeStub([
      { endpoint: "https://push/gone", keys: { p256dh: "p", auth: "a" } },
    ]);

    sendPushToAccount(env(), schedule, stub, notification);
    await flush();

    expect(deleted).toEqual(["https://push/gone"]);
  });

  it("swallows a throwing fetch without pruning", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { stub, deleted } = makeStub([
      { endpoint: "https://push/a", keys: { p256dh: "p", auth: "a" } },
    ]);

    sendPushToAccount(env(), schedule, stub, notification);
    await expect(flush()).resolves.toBeDefined();
    expect(deleted).toEqual([]);
  });
});
