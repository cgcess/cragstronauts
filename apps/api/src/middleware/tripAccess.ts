import type { MiddlewareHandler } from "hono";
import type { Env } from "../types";
import { getTripDO } from "../do";
import { getAccountId } from "../lib/auth";
import { decideTripAccess, type TripAction } from "../lib/access";

export type TripAccessVars = {
  accountId: string | null;
  isMember: boolean;
  isPublic: boolean;
};

function actionFor(method: string, path: string, tripId: string): TripAction {
  if (method === "POST" && path.endsWith(`/${tripId}/join`)) return "join";
  if (method === "GET" && path === `/api/trips/${tripId}`) return "read-summary";
  // /users/me is a non-member-safe read (returns null); the join screen needs it.
  if (method === "GET" && path.endsWith(`/${tripId}/users/me`)) return "read-summary";
  return "member";
}

// Gate every trip sub-route through decideTripAccess, attaching
// {accountId, isMember, isPublic} to the context on success.
export const tripAccess: MiddlewareHandler<{
  Bindings: Env;
  Variables: TripAccessVars;
}> = async (c, next) => {
  const tripId = c.req.param("trip_id");
  if (!tripId) return next();

  let stub;
  try {
    stub = getTripDO(c.env, tripId);
  } catch {
    return c.json({ detail: "Trip not found" }, 404);
  }

  const { isPublic } = await stub.getVisibility();
  const accountId = getAccountId(c);
  const signedIn = accountId !== null;
  const isMember = signedIn ? await stub.isMember(accountId) : false;

  const action = actionFor(c.req.method, c.req.path, tripId);
  const decision = decideTripAccess({ isPublic, signedIn, isMember, action });

  if (!decision.allow) {
    const detail =
      decision.status === 401 ? "Sign in to view this trip" : "You don't have access to this trip";
    return c.json({ detail }, decision.status);
  }

  c.set("accountId", accountId);
  c.set("isMember", isMember);
  c.set("isPublic", isPublic);
  return next();
};
