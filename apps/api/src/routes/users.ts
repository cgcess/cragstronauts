import { OpenAPIHono } from "@hono/zod-openapi";
import type { Env } from "../types";
import { getTripDO, getTripIndexDO } from "../do";
import { getAccountId } from "../lib/auth";
import {
  listUsersRoute,
  createUserRoute,
  deleteUserRoute,
  completeSignupRoute,
  claimUserRoute,
  makeOrganizerRoute,
  updateUserRoute,
  getMyTripUserRoute,
} from "@cragstronauts/contract";

export const userRoutes = new OpenAPIHono<{ Bindings: Env }>();

userRoutes.openapi(listUsersRoute, async (c) => {
  const { trip_id: tripId } = c.req.valid("param");
  const stub = getTripDO(c.env, tripId);
  const users = await stub.listUsers();
  return c.json([...users], 200);
});

userRoutes.openapi(createUserRoute, async (c) => {
  const { trip_id: tripId } = c.req.valid("param");
  const body = c.req.valid("json");
  try {
    const stub = getTripDO(c.env, tripId);
    const user = await stub.createUser(body);
    return c.json(user, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Trip not found") {
      return c.json({ detail: msg }, 404);
    }
    return c.json({ detail: msg }, 400);
  }
});

userRoutes.openapi(deleteUserRoute, async (c) => {
  const { trip_id: tripId, user_id } = c.req.valid("param");
  const userId = Number(user_id);
  try {
    const stub = getTripDO(c.env, tripId);
    const result = await stub.deleteUser(userId);
    return c.json(result, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ detail: msg }, 400);
  }
});

userRoutes.openapi(completeSignupRoute, async (c) => {
  const { trip_id: tripId, user_id } = c.req.valid("param");
  const userId = Number(user_id);
  try {
    const stub = getTripDO(c.env, tripId);
    const user = await stub.completeSignup(userId);
    return c.json(user, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "User not found") {
      return c.json({ detail: msg }, 404);
    }
    return c.json({ detail: msg }, 400);
  }
});

userRoutes.openapi(claimUserRoute, async (c) => {
  const { trip_id: tripId, user_id } = c.req.valid("param");
  const userId = Number(user_id);
  const accountId = getAccountId(c);
  try {
    const stub = getTripDO(c.env, tripId);
    const user = await stub.claimUser(userId, accountId);
    if (accountId) {
      const index = getTripIndexDO(c.env);
      await index.registerMember(accountId, tripId);
    }
    return c.json(user, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "User not found") {
      return c.json({ detail: msg }, 404);
    }
    if (msg === "ACCOUNT_REQUIRED") {
      return c.json(
        { detail: "This member is linked to a Google account. Sign in with Google to claim it." },
        403
      );
    }
    if (msg === "ACCOUNT_MISMATCH") {
      return c.json({ detail: "This member is linked to a different Google account." }, 403);
    }
    return c.json({ detail: msg }, 400);
  }
});

userRoutes.openapi(makeOrganizerRoute, async (c) => {
  const { trip_id: tripId, user_id } = c.req.valid("param");
  const userId = Number(user_id);
  try {
    const stub = getTripDO(c.env, tripId);
    const user = await stub.makeOrganizer(userId);
    return c.json(user, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "User not found") {
      return c.json({ detail: msg }, 404);
    }
    return c.json({ detail: msg }, 400);
  }
});

userRoutes.openapi(updateUserRoute, async (c) => {
  const { trip_id: tripId, user_id } = c.req.valid("param");
  const userId = Number(user_id);
  const body = c.req.valid("json");
  try {
    const stub = getTripDO(c.env, tripId);
    const user = await stub.updateUser(userId, body);
    return c.json(user, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "User not found") {
      return c.json({ detail: msg }, 404);
    }
    return c.json({ detail: msg }, 400);
  }
});

userRoutes.openapi(getMyTripUserRoute, async (c) => {
  const { trip_id: tripId } = c.req.valid("param");
  const accountId = getAccountId(c);
  if (!accountId) return c.json({ user_id: null }, 200);
  const stub = getTripDO(c.env, tripId);
  const me = await stub.findUserByAccount(accountId);
  return c.json({ user_id: me?.id ?? null }, 200);
});
