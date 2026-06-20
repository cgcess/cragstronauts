import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/clerk-react";
import { ApiError, api } from "../api";
import { useTripContext } from "../context/TripContext";

// Reconciles the signed-in Clerk account with this trip. No-op when signed out.
// Rendered only when Clerk is enabled, inside TripProvider.
export default function TripAccountSync() {
  const { isSignedIn } = useAuth();
  const { tripId, currentUserId, users, setUser, refresh } = useTripContext();

  // Recognize: ask the server which slot this account already owns here, so a
  // returning user is picked up on any device without re-identifying.
  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    api
      .myTripUser(tripId)
      .then((r) => {
        if (!cancelled && r.user_id != null) setUser(r.user_id);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, tripId, setUser]);

  // Bind: if identified here but the slot isn't linked to an account yet, claim
  // it to bind it to this account. This effect re-runs whenever `users` changes
  // (every refresh and any roster edit), so without a guard it would re-POST
  // claim repeatedly while the slot stays unlinked. We attempt each slot at most
  // once: success links it (the early-return above then short-circuits), a 403
  // means the slot belongs to a different account so retrying can't help, and a
  // transient failure clears the guard so a later change retries.
  const attempted = useRef<string | null>(null);
  useEffect(() => {
    if (!isSignedIn || currentUserId == null) return;
    const me = users.find((u) => u.id === currentUserId);
    if (!me || me.linked) return;
    const key = `${tripId}:${currentUserId}`;
    if (attempted.current === key) return;
    attempted.current = key;
    api
      .claimUser(tripId, currentUserId)
      .then(() => refresh())
      .catch((e) => {
        if (!(e instanceof ApiError && e.status === 403)) attempted.current = null;
      });
  }, [isSignedIn, currentUserId, users, tripId, refresh]);

  return null;
}
