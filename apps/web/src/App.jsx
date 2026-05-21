import React, { useEffect, useState, useCallback } from "react";
import { api } from "./api.js";
import TripListing from "./screens/TripListing.jsx";
import OrganizerWizard from "./screens/OrganizerWizard.jsx";
import Landing from "./screens/Landing.jsx";
import SignupSwipe from "./screens/SignupSwipe.jsx";
import MainTabs from "./screens/MainTabs.jsx";
import AlpsBackground from "./components/AlpsBackground.jsx";

const TRIP_KEY = "climbingTrip.tripId";
const userKey = (tripId) => `climbingTrip.userId.${tripId}`;

function readNum(key) {
  const v = localStorage.getItem(key);
  return v ? Number(v) : null;
}

function computeStage({
  tripLoaded,
  creatingTrip,
  currentTripId,
  trip,
  currentUserId,
  users,
}) {
  if (!tripLoaded) return "loading";
  if (creatingTrip) return "organizer";
  if (currentTripId == null) return "trip-list";
  if (!trip || trip.id !== currentTripId) return "loading";
  if (!currentUserId) return "landing";
  const me = users.find((u) => u.id === currentUserId);
  if (!me) return "landing-stale";
  return me.signup_completed ? "main" : "signup";
}

export default function App() {
  const [trips, setTrips] = useState([]);
  const [trip, setTrip] = useState(null);
  const [tripLoaded, setTripLoaded] = useState(false);
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [currentTripId, setCurrentTripIdState] = useState(() =>
    readNum(TRIP_KEY)
  );
  const [currentUserId, setCurrentUserIdState] = useState(() => {
    const tid = readNum(TRIP_KEY);
    return tid != null ? readNum(userKey(tid)) : null;
  });
  const [creatingTrip, setCreatingTrip] = useState(false);

  // Stable; takes the trip id explicitly to avoid stale-closure races.
  const refreshAll = useCallback(async (tripId) => {
    const tripList = await api.listTrips();
    setTrips(tripList);
    if (tripId != null) {
      const t = tripList.find((x) => x.id === tripId);
      if (t) {
        setTrip(t);
        const [u, c] = await Promise.all([
          api.listUsers(tripId),
          api.listCategories(tripId),
        ]);
        setUsers(u);
        setCategories(c);
      } else {
        // Trip was deleted out from under us
        localStorage.removeItem(TRIP_KEY);
        setCurrentTripIdState(null);
        setCurrentUserIdState(null);
        setTrip(null);
        setUsers([]);
        setCategories([]);
      }
    } else {
      setTrip(null);
      setUsers([]);
      setCategories([]);
    }
    setTripLoaded(true);
  }, []);

  useEffect(() => {
    refreshAll(currentTripId).catch((e) => console.error(e));
  }, [currentTripId, refreshAll]);

  const refresh = useCallback(
    () => refreshAll(currentTripId),
    [refreshAll, currentTripId]
  );

  const stage = computeStage({
    tripLoaded,
    creatingTrip,
    currentTripId,
    trip,
    currentUserId,
    users,
  });

  // Self-heal stale stored user id within current trip
  useEffect(() => {
    if (stage === "landing-stale" && currentTripId != null) {
      localStorage.removeItem(userKey(currentTripId));
      setCurrentUserIdState(null);
    }
  }, [stage, currentTripId]);

  const setUser = (userId) => {
    if (currentTripId == null) return;
    if (userId == null) {
      localStorage.removeItem(userKey(currentTripId));
    } else {
      localStorage.setItem(userKey(currentTripId), String(userId));
    }
    setCurrentUserIdState(userId);
  };

  const selectTrip = (tripId) => {
    localStorage.setItem(TRIP_KEY, String(tripId));
    setCurrentTripIdState(tripId);
    setCurrentUserIdState(readNum(userKey(tripId)));
  };

  const exitTrip = () => {
    localStorage.removeItem(TRIP_KEY);
    setCurrentTripIdState(null);
    setCurrentUserIdState(null);
  };

  const switchUser = () => {
    if (currentTripId != null) {
      localStorage.removeItem(userKey(currentTripId));
    }
    setCurrentUserIdState(null);
  };

  const deleteCurrentTrip = async () => {
    if (currentTripId == null) return;
    const id = currentTripId;
    await api.deleteTrip(id);
    localStorage.removeItem(TRIP_KEY);
    localStorage.removeItem(userKey(id));
    setCurrentTripIdState(null);
    setCurrentUserIdState(null);
  };

  let screen;
  if (stage === "loading" || stage === "landing-stale") {
    screen = (
      <div className="app-shell">
        <div className="center-screen">
          <p className="muted">Loading…</p>
        </div>
      </div>
    );
  } else if (stage === "trip-list") {
    screen = (
      <TripListing
        trips={trips}
        onCreate={() => setCreatingTrip(true)}
        onSelect={selectTrip}
      />
    );
  } else if (stage === "organizer") {
    screen = (
      <OrganizerWizard
        onCancel={() => setCreatingTrip(false)}
        onComplete={async ({ trip_id, organizer_user_id }) => {
          localStorage.setItem(TRIP_KEY, String(trip_id));
          localStorage.setItem(userKey(trip_id), String(organizer_user_id));
          setCurrentTripIdState(trip_id);
          setCurrentUserIdState(organizer_user_id);
          setCreatingTrip(false);
        }}
      />
    );
  } else if (stage === "landing") {
    screen = (
      <Landing
        trip={trip}
        users={users}
        onPickExisting={(id) => setUser(id)}
        onBack={exitTrip}
        onJoinNew={async (name) => {
          const u = await api.createUser(currentTripId, name);
          await refreshAll(currentTripId);
          setUser(u.id);
        }}
      />
    );
  } else if (stage === "signup") {
    screen = (
      <SignupSwipe
        trip={trip}
        categories={categories}
        userId={currentUserId}
        onComplete={async () => {
          if (currentUserId) {
            try {
              await api.completeSignup(currentUserId);
            } catch (e) {
              console.error(e);
            }
          }
          await refresh();
        }}
        onNotJoining={async () => {
          switchUser();
          await refresh();
        }}
      />
    );
  } else {
    // stage === "main"
    screen = (
      <MainTabs
        trip={trip}
        users={users}
        categories={categories}
        currentUserId={currentUserId}
        onRefresh={refresh}
        onSwitchUser={switchUser}
        onExitTrip={exitTrip}
        onDeleteTrip={deleteCurrentTrip}
      />
    );
  }

  return (
    <>
      <AlpsBackground />
      {screen}
    </>
  );
}
