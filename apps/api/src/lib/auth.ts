import { getAuth } from "@clerk/hono";
import type { Context } from "hono";
import type { Env } from "../types";

/**
 * The Clerk user id of the signed-in caller, or null when signed out (or when
 * Clerk is not configured, so clerkMiddleware was skipped). This is the value a
 * trip `user` row binds to via account_id. Identity stays additive: routes that
 * call this keep working for anonymous, cooperative visitors.
 */
export function getAccountId(c: Context<{ Bindings: Env }>): string | null {
  try {
    return getAuth(c)?.userId ?? null;
  } catch {
    return null;
  }
}
