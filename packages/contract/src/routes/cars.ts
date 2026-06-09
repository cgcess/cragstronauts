import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";
import { CarSchema, CreateCarBodySchema, CarSignupBodySchema, DogSchema, CreateDogBodySchema, AssignDogBodySchema } from "../schemas/car";
import { ErrorSchema, OkSchema } from "../schemas/common";

const TripParamsSchema = z.object({
  trip_id: z.string(),
});

const CarParamsSchema = z.object({
  trip_id: z.string(),
  car_id: z.string(),
});

const DogParamsSchema = z.object({
  trip_id: z.string(),
  dog_id: z.string(),
});

const CarDogParamsSchema = z.object({
  trip_id: z.string(),
  car_id: z.string(),
  dog_id: z.string(),
});

const CarSignupParamsSchema = z.object({
  trip_id: z.string(),
  car_id: z.string(),
  user_id: z.string(),
});

export const listCarsRoute = createRoute({
  method: "get",
  path: "/api/trips/{trip_id}/cars",
  summary: "List cars in a trip",
  request: { params: TripParamsSchema },
  responses: {
    200: {
      content: { "application/json": { schema: z.array(CarSchema) } },
      description: "List of cars",
    },
  },
});

export const createCarRoute = createRoute({
  method: "post",
  path: "/api/trips/{trip_id}/cars",
  summary: "Offer a car for a trip",
  request: {
    params: TripParamsSchema,
    body: {
      content: { "application/json": { schema: CreateCarBodySchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: CarSchema } },
      description: "Car created/updated",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Validation error",
    },
  },
});

export const deleteCarRoute = createRoute({
  method: "delete",
  path: "/api/trips/{trip_id}/cars/{car_id}",
  summary: "Remove a car",
  request: { params: CarParamsSchema },
  responses: {
    200: {
      content: { "application/json": { schema: OkSchema } },
      description: "Car removed",
    },
  },
});

export const carSignupRoute = createRoute({
  method: "post",
  path: "/api/trips/{trip_id}/cars/{car_id}/signup",
  summary: "Sign up as a passenger",
  request: {
    params: CarParamsSchema,
    body: {
      content: { "application/json": { schema: CarSignupBodySchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: CarSchema } },
      description: "Signed up",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Error",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Car not found",
    },
  },
});

export const carSignoffRoute = createRoute({
  method: "delete",
  path: "/api/trips/{trip_id}/cars/{car_id}/signup/{user_id}",
  summary: "Remove a passenger from a car",
  request: { params: CarSignupParamsSchema },
  responses: {
    200: {
      content: { "application/json": { schema: CarSchema } },
      description: "Passenger removed",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Error",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Car not found",
    },
  },
});

export const listDogsRoute = createRoute({
  method: "get",
  path: "/api/trips/{trip_id}/dogs",
  summary: "List dogs in a trip",
  request: { params: TripParamsSchema },
  responses: {
    200: {
      content: { "application/json": { schema: z.array(DogSchema) } },
      description: "List of dogs",
    },
  },
});

export const createDogRoute = createRoute({
  method: "post",
  path: "/api/trips/{trip_id}/dogs",
  summary: "Bring a dog to a trip",
  request: {
    params: TripParamsSchema,
    body: {
      content: { "application/json": { schema: CreateDogBodySchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: DogSchema } },
      description: "Dog created",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Validation error",
    },
  },
});

export const deleteDogRoute = createRoute({
  method: "delete",
  path: "/api/trips/{trip_id}/dogs/{dog_id}",
  summary: "Remove a dog",
  request: { params: DogParamsSchema },
  responses: {
    200: {
      content: { "application/json": { schema: OkSchema } },
      description: "Dog removed",
    },
  },
});

export const assignDogRoute = createRoute({
  method: "post",
  path: "/api/trips/{trip_id}/cars/{car_id}/dogs",
  summary: "Place a dog in a car (assign or move)",
  request: {
    params: CarParamsSchema,
    body: {
      content: { "application/json": { schema: AssignDogBodySchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: CarSchema } },
      description: "Dog placed",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Error",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Car not found",
    },
  },
});

export const unassignDogRoute = createRoute({
  method: "delete",
  path: "/api/trips/{trip_id}/cars/{car_id}/dogs/{dog_id}",
  summary: "Remove a dog from a car",
  request: { params: CarDogParamsSchema },
  responses: {
    200: {
      content: { "application/json": { schema: CarSchema } },
      description: "Dog removed from car",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Error",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Car not found",
    },
  },
});
