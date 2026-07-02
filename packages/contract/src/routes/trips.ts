import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";
import {
  TripSchema,
  CreateTripBodySchema,
  CreateTripResponseSchema,
  UpdateTripBodySchema,
  TripIndexEntrySchema,
} from "../schemas/trip";
import { UserSchema } from "../schemas/user";
import { ErrorSchema, OkSchema } from "../schemas/common";

const TripParamsSchema = z.object({
  trip_id: z.string(),
});

export const listTripsRoute = createRoute({
  method: "get",
  path: "/api/trips",
  summary: "List the signed-in account's owned + joined trips",
  responses: {
    200: {
      content: { "application/json": { schema: z.array(TripIndexEntrySchema) } },
      description: "List of trips",
    },
    401: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Sign-in required",
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
    401: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Sign-in required",
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
    403: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Only the owner can delete the trip",
    },
  },
});

export const joinTripRoute = createRoute({
  method: "post",
  path: "/api/trips/{trip_id}/join",
  summary: "Join a private trip as the signed-in account",
  request: {
    params: TripParamsSchema,
  },
  responses: {
    200: {
      content: { "application/json": { schema: UserSchema } },
      description: "Joined; the created or existing member slot",
    },
    401: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Sign-in required",
    },
    403: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Not permitted",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Trip not found",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Error",
    },
  },
});

// Transitional finder over the frozen global index. Remove once ownership is
// assigned to every legacy trip.
export const legacyTripsRoute = createRoute({
  method: "get",
  path: "/api/legacy-trips",
  summary: "List every pre-migration trip (transitional finder)",
  responses: {
    200: {
      content: { "application/json": { schema: z.array(TripIndexEntrySchema) } },
      description: "All trips in the frozen global index",
    },
    401: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Sign-in required",
    },
  },
});
