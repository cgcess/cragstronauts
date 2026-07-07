import { OpenAPIHono } from "@hono/zod-openapi";
import type { Env } from "../types";
import { getAccountDO } from "../do";
import { getAccountId } from "../lib/auth";
import {
  pushSubscribeRoute,
  pushUnsubscribeRoute,
  getNotificationSettingsRoute,
  updateNotificationSettingsRoute,
} from "@cragstronauts/contract";

// Account-scoped: the Clerk bearer token identifies the account, so there is no
// trip_id and no user_id in the body. Sign-in is required (401 otherwise).
export const pushRoutes = new OpenAPIHono<{ Bindings: Env }>();

pushRoutes.openapi(pushSubscribeRoute, async (c) => {
  const accountId = getAccountId(c);
  if (accountId === null) return c.json({ detail: "Sign in to enable notifications" }, 401);
  const body = c.req.valid("json");
  const stub = getAccountDO(c.env, accountId);
  const result = await stub.savePushSubscription(body.subscription);
  return c.json(result, 200);
});

pushRoutes.openapi(pushUnsubscribeRoute, async (c) => {
  const accountId = getAccountId(c);
  if (accountId === null) return c.json({ detail: "Sign in to manage notifications" }, 401);
  const body = c.req.valid("json");
  const stub = getAccountDO(c.env, accountId);
  const result = await stub.deletePushSubscription(body.endpoint);
  return c.json(result, 200);
});

pushRoutes.openapi(getNotificationSettingsRoute, async (c) => {
  const accountId = getAccountId(c);
  if (accountId === null) return c.json({ detail: "Sign in to manage notifications" }, 401);
  const stub = getAccountDO(c.env, accountId);
  const scope = await stub.getNotificationScope();
  return c.json({ scope }, 200);
});

pushRoutes.openapi(updateNotificationSettingsRoute, async (c) => {
  const accountId = getAccountId(c);
  if (accountId === null) return c.json({ detail: "Sign in to manage notifications" }, 401);
  const body = c.req.valid("json");
  const stub = getAccountDO(c.env, accountId);
  await stub.setNotificationScope(body.scope);
  return c.json({ ok: true }, 200);
});
