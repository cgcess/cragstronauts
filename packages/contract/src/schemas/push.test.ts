import { describe, it, expect } from "vitest";
import {
  PushSubscriptionSchema,
  PushSubscribeBodySchema,
  PushUnsubscribeBodySchema,
} from "./push";

const sub = {
  endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
  keys: { p256dh: "BNn5-key", auth: "tBHI-auth" },
};

describe("PushSubscriptionSchema", () => {
  it("accepts a browser subscription shape", () => {
    expect(PushSubscriptionSchema.safeParse(sub).success).toBe(true);
  });

  it("requires both keys", () => {
    const { keys, ...rest } = sub;
    void keys;
    expect(PushSubscriptionSchema.safeParse({ ...rest, keys: { p256dh: "x" } }).success).toBe(false);
  });

  it("rejects a non-url endpoint", () => {
    expect(PushSubscriptionSchema.safeParse({ ...sub, endpoint: "not-a-url" }).success).toBe(false);
  });
});

describe("PushSubscribeBodySchema", () => {
  it("accepts a subscription", () => {
    expect(PushSubscribeBodySchema.safeParse({ subscription: sub }).success).toBe(true);
  });

  it("requires a subscription", () => {
    expect(PushSubscribeBodySchema.safeParse({}).success).toBe(false);
  });
});

describe("PushUnsubscribeBodySchema", () => {
  it("accepts an endpoint", () => {
    expect(PushUnsubscribeBodySchema.safeParse({ endpoint: sub.endpoint }).success).toBe(true);
  });

  it("requires an endpoint", () => {
    expect(PushUnsubscribeBodySchema.safeParse({}).success).toBe(false);
  });
});
