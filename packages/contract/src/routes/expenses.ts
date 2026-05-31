import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";
import {
  ExpenseSchema,
  SettlementSchema,
  SettlementRecordSchema,
  CreateExpenseBodySchema,
  CreateSettlementBodySchema,
} from "../schemas/expense";
import { ErrorSchema, OkSchema } from "../schemas/common";

const TripParamsSchema = z.object({
  trip_id: z.string(),
});

const ExpenseParamsSchema = z.object({
  trip_id: z.string(),
  expense_id: z.string(),
});

const SettlementParamsSchema = z.object({
  trip_id: z.string(),
  settlement_id: z.string(),
});

export const listExpensesRoute = createRoute({
  method: "get",
  path: "/api/trips/{trip_id}/expenses",
  summary: "List expenses in a trip",
  request: { params: TripParamsSchema },
  responses: {
    200: {
      content: { "application/json": { schema: z.array(ExpenseSchema) } },
      description: "List of expenses",
    },
  },
});

export const createExpenseRoute = createRoute({
  method: "post",
  path: "/api/trips/{trip_id}/expenses",
  summary: "Add an expense",
  request: {
    params: TripParamsSchema,
    body: {
      content: {
        "application/json": {
          schema: CreateExpenseBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: ExpenseSchema } },
      description: "Expense created",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Validation error",
    },
  },
});

export const deleteExpenseRoute = createRoute({
  method: "delete",
  path: "/api/trips/{trip_id}/expenses/{expense_id}",
  summary: "Remove an expense",
  request: { params: ExpenseParamsSchema },
  responses: {
    200: {
      content: { "application/json": { schema: OkSchema } },
      description: "Expense removed",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Not found",
    },
  },
});

export const getBalancesRoute = createRoute({
  method: "get",
  path: "/api/trips/{trip_id}/balances",
  summary: "Get settlement balances for a trip",
  request: { params: TripParamsSchema },
  responses: {
    200: {
      content: { "application/json": { schema: z.array(SettlementSchema) } },
      description: "Net settlements",
    },
  },
});

export const listSettlementsRoute = createRoute({
  method: "get",
  path: "/api/trips/{trip_id}/settlements",
  summary: "List settlement payments",
  request: { params: TripParamsSchema },
  responses: {
    200: {
      content: { "application/json": { schema: z.array(SettlementRecordSchema) } },
      description: "List of settlements",
    },
  },
});

export const createSettlementRoute = createRoute({
  method: "post",
  path: "/api/trips/{trip_id}/settlements",
  summary: "Record a settlement payment",
  request: {
    params: TripParamsSchema,
    body: {
      content: {
        "application/json": { schema: CreateSettlementBodySchema },
      },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: SettlementRecordSchema } },
      description: "Settlement created",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Validation error",
    },
  },
});

export const deleteSettlementRoute = createRoute({
  method: "delete",
  path: "/api/trips/{trip_id}/settlements/{settlement_id}",
  summary: "Delete a settlement payment",
  request: { params: SettlementParamsSchema },
  responses: {
    200: {
      content: { "application/json": { schema: OkSchema } },
      description: "Settlement removed",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Not found",
    },
  },
});
