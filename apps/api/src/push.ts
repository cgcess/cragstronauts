import { buildPushHTTPRequest } from "@pushforge/builder";
import type { Env } from "./types";
import type { AccountDO } from "./AccountDO";

/** The payload the service worker's `push` handler renders (see apps/web/src/sw.ts). */
export type PushNotification = {
  title: string;
  body: string;
  url?: string;
};

/**
 * Targeted Web Push: notify every device an account has registered. Mirrors
 * `trackEvent` — no-ops when VAPID is unset (so local dev and CI stay silent)
 * and backgrounds the send via `schedule` (`(p) => c.executionCtx.waitUntil(p)`)
 * so a slow or failing push never touches the mutation response. Encryption and
 * VAPID live behind PushForge's `buildPushHTTPRequest`; we own the `fetch`, so a
 * 404/410 lets us prune a dead subscription and errors are swallowed like
 * `notifyDiscord`.
 */
export const sendPushToAccount = (
  env: Env,
  schedule: (promise: Promise<unknown>) => void,
  stub: DurableObjectStub<AccountDO>,
  notification: PushNotification,
): void => {
  const privateJWK = env.VAPID_PRIVATE_KEY;
  const subject = env.VAPID_SUBJECT;
  if (!privateJWK || !subject) return;

  schedule(deliver(stub, notification, privateJWK, subject));
};

async function deliver(
  stub: DurableObjectStub<AccountDO>,
  notification: PushNotification,
  privateJWK: string,
  subject: string,
): Promise<void> {
  try {
    const subs = await stub.listPushSubscriptions();
    await Promise.all(
      subs.map((sub) => deliverOne(stub, sub, notification, privateJWK, subject)),
    );
  } catch (err) {
    console.error("push_send_failed", { error: String(err) });
  }
}

async function deliverOne(
  stub: DurableObjectStub<AccountDO>,
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  notification: PushNotification,
  privateJWK: string,
  subject: string,
): Promise<void> {
  try {
    const request = await buildPushHTTPRequest({
      privateJWK,
      subscription: sub,
      message: {
        payload: notification,
        adminContact: subject,
        options: { ttl: 12 * 60 * 60, urgency: "normal" },
      },
    });

    const res = await fetch(request.endpoint, {
      method: "POST",
      headers: request.headers,
      body: request.body,
    });

    // The subscription expired or was revoked — drop it so we stop retrying.
    if (res.status === 404 || res.status === 410) {
      await stub.deletePushSubscription(sub.endpoint);
      return;
    }
    if (!res.ok) {
      console.error("push_send_failed", { status: res.status });
    }
  } catch (err) {
    console.error("push_send_failed", { error: String(err) });
  }
}
