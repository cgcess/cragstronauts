import { useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import { api } from "../api";
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
  // it to bind it to this account. A 403 (slot owned by someone else) is ignored.
  useEffect(() => {
    if (!isSignedIn || currentUserId == null) return;
    const me = users.find((u) => u.id === currentUserId);
    if (!me || me.linked) return;
    api
      .claimUser(tripId, currentUserId)
      .then(() => refresh())
      .catch(() => {});
  }, [isSignedIn, currentUserId, users, tripId, refresh]);

  return null;
}
