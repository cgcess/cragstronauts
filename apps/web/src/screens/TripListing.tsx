import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { SignedIn, SignedOut } from "@clerk/clerk-react";
import { api } from "../api";
import { tripPath } from "../lib/tripUrl";
import { useIsAdmin } from "../lib/admins";
import TripsView from "../components/TripsView";
import SignInPrompt from "../components/SignInPrompt";
import type { z } from "zod";
import type { TripIndexEntrySchema } from "@cragstronauts/contract";

type TripEntry = z.infer<typeof TripIndexEntrySchema>;
type Scope = "mine" | "all";

// The signed-in account's own trips (owned + joined). Admins additionally get a
// scope switcher to view every trip via the legacy finder.
function MyTrips() {
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const [scope, setScope] = useState<Scope>("mine");

  // Cache each scope separately so flipping the switcher is instant and never
  // drops back to the loading state (which would hide the tabs).
  const [mine, setMine] = useState<TripEntry[] | null>(null);
  const [all, setAll] = useState<TripEntry[] | null>(null);

  useEffect(() => {
    api
      .listTrips()
      .then(setMine)
      .catch(() => setMine([]));
  }, []);

  // Admins prefetch the all-trips (legacy) list so the switch is seamless.
  // Non-admins never fetch it — and never see the tab.
  useEffect(() => {
    if (isAdmin === true && all === null) {
      api
        .legacyTrips()
        .then(setAll)
        .catch(() => setAll([]));
    }
  }, [isAdmin, all]);

  const showTabs = isAdmin === true;
  const active = scope === "all" ? all : mine;
  const loaded = active !== null;

  const tabs = showTabs ? (
    <div className="trips-seg" role="tablist" aria-label="Trips scope">
      <button
        type="button"
        role="tab"
        aria-selected={scope === "mine"}
        className={"trips-seg__opt" + (scope === "mine" ? " is-active" : "")}
        onClick={() => setScope("mine")}
      >
        My trips
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={scope === "all"}
        className={"trips-seg__opt" + (scope === "all" ? " is-active" : "")}
        onClick={() => setScope("all")}
      >
        All trips
      </button>
    </div>
  ) : null;

  return (
    <TripsView
      trips={active ?? []}
      loaded={loaded}
      tabs={tabs}
      onCreate={() => navigate("/trips/new")}
      onSelect={(trip) => navigate(tripPath(trip.name, trip.id))}
      emptyTitle={
        scope === "all" ? "No trips in the archive" : "No trips on the wall yet"
      }
      emptySub={
        scope === "all"
          ? "Every pre-migration trip will appear here."
          : "Tap to plan your first cragstronaut mission."
      }
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
