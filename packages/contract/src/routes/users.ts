import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";
import {
  UserSchema,
  CreateUserBodySchema,
  UpdateUserBodySchema,
  MyTripUserSchema,
} from "../schemas/user";
import { ErrorSchema, OkSchema } from "../schemas/common";

const TripParamsSchema = z.object({
  trip_id: z.string(),
});

export const getMyTripUserRoute = createRoute({
  method: "get",
  path: "/api/trips/{trip_id}/users/me",
  summary: "Resolve the signed-in account to its trip user (if any)",
  request: { params: TripParamsSchema },
  responses: {
    200: {
      content: { "application/json": { schema: MyTripUserSchema } },
      description: "The linked user id, or null",
    },
  },
});

const UserParamsSchema = z.object({
  trip_id: z.string(),
  user_id: z.string(),
});

export const listUsersRoute = createRoute({
  method: "get",
  path: "/api/trips/{trip_id}/users",
  summary: "List users in a trip",
  request: { params: TripParamsSchema },
  responses: {
    200: {
      content: { "application/json": { schema: z.array(UserSchema) } },
      description: "List of users",
    },
  },
});

export const createUserRoute = createRoute({
  method: "post",
  path: "/api/trips/{trip_id}/users",
  summary: "Add a user to a trip",
  request: {
    params: TripParamsSchema,
    body: {
      content: { "application/json": { schema: CreateUserBodySchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: UserSchema } },
      description: "User created",
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

export const deleteUserRoute = createRoute({
  method: "delete",
  path: "/api/trips/{trip_id}/users/{user_id}",
  summary: "Remove a user from a trip",
  request: { params: UserParamsSchema },
  responses: {
    200: {
      content: { "application/json": { schema: OkSchema } },
      description: "User deleted",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Error",
    },
  },
});

export const completeSignupRoute = createRoute({
  method: "post",
  path: "/api/trips/{trip_id}/users/{user_id}/complete-signup",
  summary: "Mark signup as completed",
  request: { params: UserParamsSchema },
  responses: {
    200: {
      content: { "application/json": { schema: UserSchema } },
      description: "Signup completed",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Error",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "User not found",
    },
  },
});

export const claimUserRoute = createRoute({
  method: "post",
  path: "/api/trips/{trip_id}/users/{user_id}/claim",
  summary: "Mark a user as claimed (taken) by a device",
  request: { params: UserParamsSchema },
  responses: {
    200: {
      content: { "application/json": { schema: UserSchema } },
      description: "User claimed",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Error",
    },
    403: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Slot is linked to a Google account; sign-in required or wrong account",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "User not found",
    },
  },
});

export const makeOrganizerRoute = createRoute({
  method: "post",
  path: "/api/trips/{trip_id}/users/{user_id}/make-organizer",
  summary: "Transfer trip ownership to a user",
  request: { params: UserParamsSchema },
  responses: {
    200: {
      content: { "application/json": { schema: UserSchema } },
      description: "Ownership transferred to the user",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Error",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "User not found",
    },
  },
});

export const updateUserRoute = createRoute({
  method: "patch",
  path: "/api/trips/{trip_id}/users/{user_id}",
  summary: "Update a user",
  request: {
    params: UserParamsSchema,
    body: {
      content: { "application/json": { schema: UpdateUserBodySchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: UserSchema } },
      description: "Updated user",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Error",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "User not found",
    },
  },
});
