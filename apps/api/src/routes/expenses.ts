import { OpenAPIHono } from "@hono/zod-openapi";
import type { Env } from "../types";
import { getTripDO } from "../do";
import {
  listExpensesRoute,
  createExpenseRoute,
  deleteExpenseRoute,
  getBalancesRoute,
} from "@cragstronauts/contract";

export const expenseRoutes = new OpenAPIHono<{ Bindings: Env }>();

expenseRoutes.openapi(listExpensesRoute, async (c) => {
  const { trip_id: tripId } = c.req.valid("param");
  const stub = getTripDO(c.env, tripId);
  const expenses = await stub.listExpenses();
  return c.json([...expenses], 200);
});

expenseRoutes.openapi(createExpenseRoute, async (c) => {
  const { trip_id: tripId } = c.req.valid("param");
  const body = c.req.valid("json");
  try {
    const stub = getTripDO(c.env, tripId);
    const expense = await stub.createExpense(body);
    return c.json(expense, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ detail: msg }, 400);
  }
});

expenseRoutes.openapi(deleteExpenseRoute, async (c) => {
  const { trip_id: tripId, expense_id } = c.req.valid("param");
  const expenseId = Number(expense_id);
  try {
    const stub = getTripDO(c.env, tripId);
    const result = await stub.deleteExpense(expenseId);
    return c.json(result, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ detail: msg }, 404);
  }
});

expenseRoutes.openapi(getBalancesRoute, async (c) => {
  const { trip_id: tripId } = c.req.valid("param");
  const stub = getTripDO(c.env, tripId);
  const balances = await stub.getBalances();
  return c.json([...balances], 200);
});
