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

// How wide a net the account's push notifications cast. Account-scoped (not per
// device): `always` fires for any trip event; `trip` fires only while the trip
// the event belongs to is currently running (today within its start/end dates).
// `always` is the default so existing subscribers keep getting everything.
export const NOTIFICATION_SCOPES = ["trip", "always"] as const;
export const NotificationScopeSchema = z.enum(NOTIFICATION_SCOPES);
export type NotificationScope = z.infer<typeof NotificationScopeSchema>;

export const NotificationSettingsSchema = z.object({
  scope: NotificationScopeSchema,
});
export type NotificationSettings = z.infer<typeof NotificationSettingsSchema>;
