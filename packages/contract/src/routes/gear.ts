import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";
import {
  GearCategorySchema,
  AddGearCategoryBodySchema,
  GearContributionSchema,
  AddGearBodySchema,
} from "../schemas/gear";
import { ErrorSchema, OkSchema } from "../schemas/common";

const TripParamsSchema = z.object({
  trip_id: z.string(),
});

const CategoryParamsSchema = z.object({
  trip_id: z.string(),
  cat_id: z.string(),
});

const ContribParamsSchema = z.object({
  trip_id: z.string(),
  contrib_id: z.string(),
});

export const listCategoriesRoute = createRoute({
  method: "get",
  path: "/api/trips/{trip_id}/gear-categories",
  summary: "List gear categories",
  request: { params: TripParamsSchema },
  responses: {
    200: {
      content: { "application/json": { schema: z.array(GearCategorySchema) } },
      description: "List of gear categories",
    },
  },
});

export const addCategoryRoute = createRoute({
  method: "post",
  path: "/api/trips/{trip_id}/gear-categories",
  summary: "Add a gear category",
  request: {
    params: TripParamsSchema,
    body: {
      content: { "application/json": { schema: AddGearCategoryBodySchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: GearCategorySchema } },
      description: "Category added",
    },
  },
});

export const deleteCategoryRoute = createRoute({
  method: "delete",
  path: "/api/trips/{trip_id}/gear-categories/{cat_id}",
  summary: "Delete a gear category",
  request: { params: CategoryParamsSchema },
  responses: {
    200: {
      content: { "application/json": { schema: OkSchema } },
      description: "Category deleted",
    },
  },
});

export const listGearRoute = createRoute({
  method: "get",
  path: "/api/trips/{trip_id}/gear",
  summary: "List gear contributions",
  request: { params: TripParamsSchema },
  responses: {
    200: {
      content: { "application/json": { schema: z.array(GearContributionSchema) } },
      description: "List of gear contributions",
    },
  },
});

export const addGearRoute = createRoute({
  method: "post",
  path: "/api/trips/{trip_id}/gear",
  summary: "Add a gear contribution",
  request: {
    params: TripParamsSchema,
    body: {
      content: { "application/json": { schema: AddGearBodySchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: GearContributionSchema } },
      description: "Gear added",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Error",
    },
  },
});

export const deleteGearRoute = createRoute({
  method: "delete",
  path: "/api/trips/{trip_id}/gear/{contrib_id}",
  summary: "Delete a gear contribution",
  request: { params: ContribParamsSchema },
  responses: {
    200: {
      content: { "application/json": { schema: OkSchema } },
      description: "Gear deleted",
    },
  },
});
