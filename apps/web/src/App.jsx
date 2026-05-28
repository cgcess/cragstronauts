import React, { useEffect, useState, useCallback } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { api } from "./api.js";
import TripListing from "./screens/TripListing.jsx";
import OrganizerWizard from "./screens/OrganizerWizard.jsx";
import Landing from "./screens/Landing.jsx";
import SignupSwipe from "./screens/SignupSwipe.jsx";
import MainTabs from "./screens/MainTabs.jsx";
import AlpsBackground from "./components/AlpsBackground.jsx";
import GlassFilter from "./components/GlassFilter.jsx";

const EASE_OUT = [0.23, 1, 0.32, 1];

const userKey = (tripId) => `climbingTrip.userId.${tripId}`;

function readNum(key) {
  const v = localStorage.getItem(key);
  return v ? Number(v) : null;
}

function parseTripIdFromPath() {
  const m = window.location.pathname.match(/^\/trips\/([a-f0-9]+)/);
  return m ? m[1] : null;
}

function pushPath(path) {
  if (window.location.pathname !== path) {
    window.history.pushState({}, "", path);
  }
}

function replacePath(path) {
  if (window.location.pathname !== path) {
    window.history.replaceState({}, "", path);
  }
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
  if (!trip) return "loading";
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
  const [currentTripId, setCurrentTripId] = useState(parseTripIdFromPath);
  const [currentUserId, setCurrentUserId] = useState(() => {
    const tid = parseTripIdFromPath();
    return tid ? readNum(userKey(tid)) : null;
  });
  const [creatingTrip, setCreatingTrip] = useState(false);

  // Sync state with back/forward navigation.
  useEffect(() => {
    const onPop = () => {
      const tid = parseTripIdFromPath();
      setCurrentTripId(tid);
      setCurrentUserId(tid ? readNum(userKey(tid)) : null);
      setCreatingTrip(false);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Stable; takes the trip id explicitly to avoid stale-closure races.
  const refreshAll = useCallback(async (tripId) => {
    const tripList = await api.listTrips();
    setTrips(tripList);
    if (tripId != null) {
      try {
        const t = await api.getTrip(tripId);
        setTrip(t);
        const [u, c] = await Promise.all([
          api.listUsers(tripId),
          api.listCategories(tripId),
        ]);
        setUsers(u);
        setCategories(c);
      } catch {
        // Trip was deleted or doesn't exist — bounce to listing
        replacePath("/");
        setCurrentTripId(null);
        setCurrentUserId(null);
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
      setCurrentUserId(null);
    }
  }, [stage, currentTripId]);

  const setUser = (userId) => {
    if (currentTripId == null) return;
    if (userId == null) {
      localStorage.removeItem(userKey(currentTripId));
    } else {
      localStorage.setItem(userKey(currentTripId), String(userId));
    }
    setCurrentUserId(userId);
  };

  const selectTrip = (tripId) => {
    pushPath(`/trips/${tripId}`);
    setCurrentTripId(tripId);
    setCurrentUserId(readNum(userKey(tripId)));
  };

  const exitTrip = () => {
    pushPath("/");
    setCurrentTripId(null);
  };

  const switchUser = () => {
    if (currentTripId != null) {
      localStorage.removeItem(userKey(currentTripId));
    }
    setCurrentUserId(null);
  };

  const deleteCurrentTrip = async () => {
    if (currentTripId == null) return;
    const id = currentTripId;
    await api.deleteTrip(id);
    localStorage.removeItem(userKey(id));
    pushPath("/");
    setCurrentTripId(null);
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
          localStorage.setItem(userKey(trip_id), String(organizer_user_id));
          await refreshAll(trip_id);
          pushPath(`/trips/${trip_id}`);
          setCurrentTripId(trip_id);
          setCurrentUserId(organizer_user_id);
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
        tripId={currentTripId}
        trip={trip}
        categories={categories}
        userId={currentUserId}
        onComplete={async () => {
          if (currentUserId) {
            try {
              await api.completeSignup(currentTripId, currentUserId);
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
        tripId={currentTripId}
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
      <GlassFilter />
      <AlpsBackground />
      {screen}
    </>
  );
}

// Stage-level page transitions removed: AnimatePresence around the
// outer screen wrapper kept locking up under StrictMode (either via
// `mode="wait"`'s onExitComplete deadlock or `mode="popLayout"`'s
// indefinite mid-transition state where neither child resolves). The
// inner screen-level animations already give a satisfying transition
// feel; the outer wrapper was redundant polish at the cost of stability.
// eslint-disable-next-line no-unused-vars
function _StagePresence_disabled({ stageKey, children }) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) {
    return children;
  }
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={stageKey}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.32, ease: EASE_OUT }}
        style={{ height: "100%" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
