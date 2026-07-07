import { createRoute } from "@hono/zod-openapi";
import {
  PushSubscribeBodySchema,
  PushUnsubscribeBodySchema,
  NotificationSettingsSchema,
} from "../schemas/push";
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

export const getNotificationSettingsRoute = createRoute({
  method: "get",
  path: "/api/push/settings",
  summary: "Read the signed-in account's notification settings",
  responses: {
    200: {
      content: { "application/json": { schema: NotificationSettingsSchema } },
      description: "Current settings",
    },
    401: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Not signed in",
    },
  },
});

export const updateNotificationSettingsRoute = createRoute({
  method: "put",
  path: "/api/push/settings",
  summary: "Update the signed-in account's notification settings",
  request: {
    body: {
      content: { "application/json": { schema: NotificationSettingsSchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: OkSchema } },
      description: "Settings saved",
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
