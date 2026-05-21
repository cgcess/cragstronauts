import { Hono } from "hono";
import type { Env } from "../types";
import { getTripDO } from "../do";

export const userRoutes = new Hono<{ Bindings: Env }>();

userRoutes.get("/api/users", async (c) => {
  const stub = getTripDO(c.env);
  const users = await stub.listUsers();
  return c.json(users);
});

userRoutes.post("/api/users", async (c) => {
  const stub = getTripDO(c.env);
  const body = await c.req.json();
  try {
    const user = await stub.createUser(body);
    return c.json(user);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ detail: msg }, 400);
  }
});

userRoutes.delete("/api/users/:user_id", async (c) => {
  const stub = getTripDO(c.env);
  const userId = Number(c.req.param("user_id"));
  try {
    const result = await stub.deleteUser(userId);
    return c.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ detail: msg }, 400);
  }
});

userRoutes.post("/api/users/:user_id/complete-signup", async (c) => {
  const stub = getTripDO(c.env);
  const userId = Number(c.req.param("user_id"));
  try {
    const user = await stub.completeSignup(userId);
    return c.json(user);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "User not found") {
      return c.json({ detail: msg }, 404);
    }
    return c.json({ detail: msg }, 400);
  }
});

userRoutes.patch("/api/users/:user_id", async (c) => {
  const stub = getTripDO(c.env);
  const userId = Number(c.req.param("user_id"));
  const body = await c.req.json();
  try {
    const user = await stub.updateUser(userId, body);
    return c.json(user);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "User not found") {
      return c.json({ detail: msg }, 404);
    }
    return c.json({ detail: msg }, 400);
  }
});
