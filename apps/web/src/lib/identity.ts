import type { User } from "../context/TripContext";

/**
 * Find existing users whose name matches `name`, case-insensitively and
 * ignoring surrounding whitespace. Used by IdentityFlow to detect when a typed
 * name collides with someone already on the trip, so we can offer "that's me"
 * (re-claim) vs. "add a new person" instead of silently creating a duplicate.
 */
export function findNameMatches(users: User[], name: string): User[] {
  const needle = name.trim().toLowerCase();
  if (!needle) return [];
  return users.filter((u) => u.name.trim().toLowerCase() === needle);
}
