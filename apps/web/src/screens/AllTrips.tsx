import React, { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { SignedIn, SignedOut } from "@clerk/clerk-react";
import { api } from "../api";
import { tripPath } from "../lib/tripUrl";
import { useIsAdmin } from "../lib/admins";
import TripsView from "../components/TripsView";
import SignInPrompt from "../components/SignInPrompt";
import type { z } from "zod";
import type { TripIndexEntrySchema } from "@cragstronauts/contract";

type TripEntry = z.infer<typeof TripIndexEntrySchema>;

// Transitional finder (hidden route): every pre-migration trip, from the frozen
// global index. Remove once ownership is assigned.
function LegacyFinder() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState<TripEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api
      .legacyTrips()
      .then((t) => {
        setTrips(t);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  return (
    <TripsView
      trips={trips}
      loaded={loaded}
      onCreate={() => navigate("/trips/new")}
      onSelect={(trip) => navigate(tripPath(trip.name, trip.id))}
    />
  );
}

export default function AllTrips() {
  const isAdmin = useIsAdmin();

  return (
    <>
      <SignedIn>
        {/* Admin-only. Non-admins are bounced to their own trips; the redirect
            waits until Clerk has loaded so we don't bounce a real admin.
            NOTE: UI gate only — GET /api/legacy-trips is still open. */}
        {isAdmin === undefined ? null : isAdmin ? (
          <LegacyFinder />
        ) : (
          <Navigate to="/" replace />
        )}
      </SignedIn>
      <SignedOut>
        <SignInPrompt sub="Sign in to browse every trip." />
      </SignedOut>
    </>
  );
}
