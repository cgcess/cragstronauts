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

// The signed-in account's own trips (owned + joined).
function MyTrips() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState<TripEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api
      .listTrips()
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
      emptyTitle="No trips on the wall yet"
      emptySub="Tap to plan your first cragstronaut mission."
    />
  );
}

export default function TripListing() {
  return (
    <>
      <SignedIn>
        <MyTrips />
      </SignedIn>
      <SignedOut>
        <SignInPrompt />
      </SignedOut>
    </>
  );
}
