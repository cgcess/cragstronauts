import { createRoute } from "@hono/zod-openapi";
import { PushSubscribeBodySchema, PushUnsubscribeBodySchema } from "../schemas/push";
import { ErrorSchema, OkSchema } from "../schemas/common";

export const pushSubscribeRoute = createRoute({
  method: "post",
  path: "/api/push/subscriptions",
  summary: "Register a Web Push subscription for the signed-in account",
  request: {
    body: {
      content: { "application/json": { schema: PushSubscribeBodySchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: OkSchema } },
      description: "Subscription saved",
    },
    401: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Not signed in",
    },
  },
});

export const pushUnsubscribeRoute = createRoute({
  method: "delete",
  path: "/api/push/subscriptions",
  summary: "Remove a Web Push subscription for the signed-in account",
  request: {
    body: {
      content: { "application/json": { schema: PushUnsubscribeBodySchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: OkSchema } },
      description: "Subscription removed",
    },
    401: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Not signed in",
    },
  },
});
