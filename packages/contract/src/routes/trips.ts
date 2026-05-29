import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";
import {
  TripSchema,
  CreateTripBodySchema,
  CreateTripResponseSchema,
  UpdateTripBodySchema,
  TripIndexEntrySchema,
} from "../schemas/trip";
import { ErrorSchema, OkSchema } from "../schemas/common";

const TripParamsSchema = z.object({
  trip_id: z.string(),
});

export const listTripsRoute = createRoute({
  method: "get",
  path: "/api/trips",
  summary: "List all trips",
  responses: {
    200: {
      content: { "application/json": { schema: z.array(TripIndexEntrySchema) } },
      description: "List of trips",
    },
  },
});

export const createTripRoute = createRoute({
  method: "post",
  path: "/api/trips",
  summary: "Create a new trip",
  request: {
    body: {
      content: { "application/json": { schema: CreateTripBodySchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: CreateTripResponseSchema } },
      description: "Trip created",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Validation error",
    },
  },
});

export const getTripRoute = createRoute({
  method: "get",
  path: "/api/trips/{trip_id}",
  summary: "Get a trip by ID",
  request: {
    params: TripParamsSchema,
  },
  responses: {
    200: {
      content: { "application/json": { schema: TripSchema } },
      description: "Trip details",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Trip not found",
    },
  },
});

export const updateTripRoute = createRoute({
  method: "patch",
  path: "/api/trips/{trip_id}",
  summary: "Update a trip",
  request: {
    params: TripParamsSchema,
    body: {
      content: { "application/json": { schema: UpdateTripBodySchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: TripSchema } },
      description: "Updated trip",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Validation error",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Trip not found",
    },
  },
});

export const deleteTripRoute = createRoute({
  method: "delete",
  path: "/api/trips/{trip_id}",
  summary: "Delete a trip",
  request: {
    params: TripParamsSchema,
  },
  responses: {
    200: {
      content: { "application/json": { schema: OkSchema } },
      description: "Trip deleted",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Error",
    },
  },
});
