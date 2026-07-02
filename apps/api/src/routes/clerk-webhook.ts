import { OpenAPIHono } from "@hono/zod-openapi";
import { verifyWebhook } from "@clerk/backend/webhooks";
import type { UserJSON, WebhookEvent } from "@clerk/backend";
import type { Env } from "../types";
import { notifyDiscord } from "../discord";

export const formatSignupMessage = (user: UserJSON): string => {
  const name = [user.first_name, user.last_name]
    .filter((part): part is string => !!part)
    .join(" ")
    .trim();
  const displayName = name || user.username || "";

  const primary = user.email_addresses.find(
    (e) => e.id === user.primary_email_address_id,
  );
  const email =
    primary?.email_address ?? user.email_addresses[0]?.email_address ?? "";

  const parts = [displayName, email].filter((p) => p.length > 0);
  const who = parts.join(" — ");
  return who
    ? `🎉 New signup: ${who} (${user.id})`
    : `🎉 New signup: (${user.id})`;
};

export const handleClerkEvent = (
  event: WebhookEvent,
  env: Env,
  schedule: (promise: Promise<unknown>) => void,
): void => {
  if (event.type !== "user.created") return;
  const message = formatSignupMessage(event.data);
  schedule(notifyDiscord(env.DISCORD_SIGNUP_WEBHOOK_URL, message));
};

export const createClerkWebhookRoute = () => {
  const router = new OpenAPIHono<{ Bindings: Env }>();

  router.post("/api/webhooks/clerk", async (c) => {
    let event: WebhookEvent;
    try {
      event = await verifyWebhook(c.req.raw, {
        signingSecret: c.env.CLERK_WEBHOOK_SIGNING_SECRET,
      });
    } catch (err) {
      console.error("clerk_webhook_invalid", { error: String(err) });
      return c.text("invalid signature", 401);
    }

    handleClerkEvent(event, c.env, (promise) =>
      c.executionCtx.waitUntil(promise),
    );
    return c.text("ok", 200);
  });

  return router;
};
