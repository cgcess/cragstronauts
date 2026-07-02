import { getAuth } from "@clerk/hono";
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
