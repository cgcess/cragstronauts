import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";
import {
  PollSchema,
  PollAnswerSchema,
  CreatePollBodySchema,
  UpdatePollBodySchema,
  SetPollAnswerBodySchema,
} from "../schemas/poll";
import { ErrorSchema, OkSchema } from "../schemas/common";

const TripParamsSchema = z.object({
  trip_id: z.string(),
});

const PollParamsSchema = z.object({
  trip_id: z.string(),
  poll_id: z.string(),
});

export const listPollsRoute = createRoute({
  method: "get",
  path: "/api/trips/{trip_id}/polls",
  summary: "List polls",
  request: { params: TripParamsSchema },
  responses: {
    200: {
      content: { "application/json": { schema: z.array(PollSchema) } },
      description: "List of polls",
    },
  },
});

export const addPollRoute = createRoute({
  method: "post",
  path: "/api/trips/{trip_id}/polls",
  summary: "Add a poll",
  request: {
    params: TripParamsSchema,
    body: {
      content: { "application/json": { schema: CreatePollBodySchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: PollSchema } },
      description: "Poll added",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Error",
    },
  },
});

export const updatePollRoute = createRoute({
  method: "patch",
  path: "/api/trips/{trip_id}/polls/{poll_id}",
  summary: "Update a poll",
  request: {
    params: PollParamsSchema,
    body: {
      content: { "application/json": { schema: UpdatePollBodySchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: PollSchema } },
      description: "Poll updated",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Error",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Poll not found",
    },
  },
});

export const deletePollRoute = createRoute({
  method: "delete",
  path: "/api/trips/{trip_id}/polls/{poll_id}",
  summary: "Delete a poll",
  request: { params: PollParamsSchema },
  responses: {
    200: {
      content: { "application/json": { schema: OkSchema } },
      description: "Poll deleted",
    },
  },
});

export const listPollAnswersRoute = createRoute({
  method: "get",
  path: "/api/trips/{trip_id}/poll-answers",
  summary: "List poll answers",
  request: { params: TripParamsSchema },
  responses: {
    200: {
      content: { "application/json": { schema: z.array(PollAnswerSchema) } },
      description: "List of poll answers",
    },
  },
});

export const setPollAnswerRoute = createRoute({
  method: "post",
  path: "/api/trips/{trip_id}/poll-answers",
  summary: "Set a user's answer for a poll",
  request: {
    params: TripParamsSchema,
    body: {
      content: { "application/json": { schema: SetPollAnswerBodySchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: z.array(PollAnswerSchema) } },
      description: "The user's answers for the poll after the update",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Error",
    },
  },
});
