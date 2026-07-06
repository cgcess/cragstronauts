import { z } from "zod";

// The browser's PushSubscription.toJSON() shape, narrowed to the fields the
// server needs to encrypt and deliver a push (endpoint + the two keys).
export const PushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

export const PushSubscribeBodySchema = z.object({
  subscription: PushSubscriptionSchema,
});

export const PushUnsubscribeBodySchema = z.object({
  endpoint: z.string().url(),
});
