import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";
import {
  FeedbackSchema,
  CreateFeedbackBodySchema,
  ListFeedbackQuerySchema,
} from "../schemas/feedback";
import { ErrorSchema } from "../schemas/common";

const TripParamsSchema = z.object({
  trip_id: z.string(),
});

export const createFeedbackRoute = createRoute({
  method: "post",
  path: "/api/trips/{trip_id}/feedback",
  summary: "Submit feedback for a trip (any member)",
  request: {
    params: TripParamsSchema,
    body: {
      content: {
        "application/json": { schema: CreateFeedbackBodySchema },
      },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: FeedbackSchema } },
      description: "Feedback submitted",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Validation error",
    },
  },
});

export const listFeedbackRoute = createRoute({
  method: "get",
  path: "/api/trips/{trip_id}/feedback",
  summary: "List all feedback for a trip (organizer only)",
  request: {
    params: TripParamsSchema,
    query: ListFeedbackQuerySchema,
  },
  responses: {
    200: {
      content: { "application/json": { schema: z.array(FeedbackSchema) } },
      description: "All feedback for the trip",
    },
    403: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Not the organizer",
    },
  },
});
