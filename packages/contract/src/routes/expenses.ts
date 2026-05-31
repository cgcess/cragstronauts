import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";
import { ExpenseSchema, SettlementSchema, CreateExpenseBodySchema } from "../schemas/expense";
import { ErrorSchema, OkSchema } from "../schemas/common";

const TripParamsSchema = z.object({
  trip_id: z.string(),
});

const ExpenseParamsSchema = z.object({
  trip_id: z.string(),
  expense_id: z.string(),
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
