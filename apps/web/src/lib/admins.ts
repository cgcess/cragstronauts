import { useUser } from "@clerk/clerk-react";

// The trips overview "All trips" tab and the legacy finder route are gated to
// these accounts (matched case-insensitively on the Clerk sign-in email).
//
// ⚠️ CLIENT-SIDE GATE ONLY. This hides the UI; it does NOT secure the data.
// The underlying GET /api/legacy-trips endpoint is still reachable by any
// signed-in user. If real enforcement is ever needed, add a server-side check
// on the caller's Clerk userId (see apps/api/src/lib/auth.ts `getAccountId`
// and the legacy-trips route in apps/api/src/routes/trip.ts).
const ADMIN_EMAILS = new Set([
  "nicolas.donati.94@gmail.com",
  "colin.cess@gmail.com",
  "juanibiapina@gmail.com",
]);

/**
 * Whether the signed-in user is one of the trip admins.
 *
 * Returns `undefined` until Clerk has finished loading the user, so callers can
 * tell "not an admin" apart from "not known yet" (and avoid a premature
 * redirect or a flash of admin-only UI).
 */
export function useIsAdmin(): boolean | undefined {
  const { isLoaded, user } = useUser();
  if (!isLoaded) return undefined;
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase();
  return email ? ADMIN_EMAILS.has(email) : false;
}
