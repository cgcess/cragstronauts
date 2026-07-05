import { getAuth } from "@clerk/hono";
import { verifyToken } from "@clerk/backend";
import type { Context } from "hono";
import type { Env } from "../types";

/**
 * The Clerk user id of the signed-in caller, or null when signed out. This is
 * the value a trip `user` row binds to via account_id. Public trips still allow
 * anonymous, cooperative visitors (a null account id).
 */
export function getAccountId<E extends { Bindings: Env }>(c: Context<E>): string | null {
  try {
    return getAuth(c)?.userId ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolve a Clerk session token to its account id, or null on any failure.
 * Used for the WebSocket upgrade, where the token arrives in the subprotocol
 * (or a query-param fallback) rather than the Clerk middleware's request flow.
 * Defensive by design: a garbage or expired token yields null, never a throw.
 */
export async function resolveAccountFromToken(
  env: Env,
  token: string | null
): Promise<string | null> {
  if (!token) return null;
  try {
    const payload = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY,
    });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}
