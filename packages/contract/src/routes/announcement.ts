import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";
import {
  AnnouncementSchema,
  CreatedAnnouncementSchema,
  CreateAnnouncementBodySchema,
  ToggleReactionBodySchema,
} from "../schemas/announcement";
import { ErrorSchema, OkSchema } from "../schemas/common";

const TripParamsSchema = z.object({
  trip_id: z.string(),
});

const AnnouncementParamsSchema = z.object({
  trip_id: z.string(),
  announcement_id: z.string(),
});

export const listAnnouncementsRoute = createRoute({
  method: "get",
  path: "/api/trips/{trip_id}/announcements",
  summary: "List announcements (top-level, newest first, with replies)",
  request: { params: TripParamsSchema },
  responses: {
    200: {
      content: { "application/json": { schema: z.array(AnnouncementSchema) } },
      description: "List of announcements",
    },
  },
});

export const createAnnouncementRoute = createRoute({
  method: "post",
  path: "/api/trips/{trip_id}/announcements",
  summary: "Post an announcement or a reply",
  request: {
    params: TripParamsSchema,
    body: {
      content: { "application/json": { schema: CreateAnnouncementBodySchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: CreatedAnnouncementSchema } },
      description: "The created announcement or reply (no nested replies)",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Error",
    },
  },
});

export const deleteAnnouncementRoute = createRoute({
  method: "delete",
  path: "/api/trips/{trip_id}/announcements/{announcement_id}",
  summary: "Delete an announcement or reply (author or organizer)",
  request: {
    params: AnnouncementParamsSchema,
    body: {
      content: {
        "application/json": {
          schema: z.object({ user_id: z.number() }),
        },
      },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: OkSchema } },
      description: "Deleted",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Error",
    },
    403: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Not allowed",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Not found",
    },
  },
});

export const toggleReactionRoute = createRoute({
  method: "post",
  path: "/api/trips/{trip_id}/announcements/{announcement_id}/reactions",
  summary: "Toggle the caller's reaction on an announcement or reply",
  request: {
    params: AnnouncementParamsSchema,
    body: {
      content: { "application/json": { schema: ToggleReactionBodySchema } },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            reactions: z.array(
              z.object({ emoji: z.string(), user_ids: z.array(z.number()) })
            ),
          }),
        },
      },
      description: "The message's reactions after the toggle",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Error",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Not found",
    },
  },
});
