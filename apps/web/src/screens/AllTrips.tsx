import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { SignedIn, SignedOut } from "@clerk/clerk-react";
import { api } from "../api";
import { tripPath } from "../lib/tripUrl";
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
  return (
    <>
      <SignedIn>
        <LegacyFinder />
      </SignedIn>
      <SignedOut>
        <SignInPrompt sub="Sign in to browse every trip." />
      </SignedOut>
    </>
  );
}
