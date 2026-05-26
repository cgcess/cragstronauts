import React, { useEffect, useState, useCallback } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { api } from "./api.js";
import TripListing from "./screens/TripListing.jsx";
import OrganizerWizard from "./screens/OrganizerWizard.jsx";
import Landing from "./screens/Landing.jsx";
import SignupSwipe from "./screens/SignupSwipe.jsx";
import MainTabs from "./screens/MainTabs.jsx";
import AlpsBackground from "./components/AlpsBackground.jsx";

const EASE_OUT = [0.23, 1, 0.32, 1];

const userKey = (tripId) => `climbingTrip.userId.${tripId}`;

function readNum(key) {
  const v = localStorage.getItem(key);
  return v ? Number(v) : null;
}

function slugify(s) {
  if (s == null) return "";
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function tripSlug(trip) {
  return slugify(trip.location) || `trip-${trip.id}`;
}

function parseTripSlugFromPath() {
  const m = window.location.pathname.match(/^\/trips\/([^/]+)/);
  return m ? decodeURIComponent(m[1]) : null;
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
  // URL is the source of truth for which trip is open; the slug comes
  // straight from the path. id is resolved by matching against the
  // loaded trips list, since slugs aren't unique on their own.
  const [currentTripSlug, setCurrentTripSlugState] = useState(
    parseTripSlugFromPath
  );
  const [currentTripId, setCurrentTripIdState] = useState(null);
  const [currentUserId, setCurrentUserIdState] = useState(null);
  const [creatingTrip, setCreatingTrip] = useState(false);

  // Sync state with back/forward navigation.
  useEffect(() => {
    const onPop = () => {
      setCurrentTripSlugState(parseTripSlugFromPath());
      setCreatingTrip(false);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Resolve slug → id whenever the URL slug or the trips list changes.
  // If the slug doesn't match any trip after the initial load, bounce
  // back to "/" so a bad link doesn't leave the user stuck.
  useEffect(() => {
    if (currentTripSlug == null) {
      setCurrentTripIdState(null);
      return;
    }
    const t = trips.find((x) => tripSlug(x) === currentTripSlug);
    if (t) {
      setCurrentTripIdState(t.id);
    } else if (tripLoaded) {
      replacePath("/");
      setCurrentTripSlugState(null);
      setCurrentTripIdState(null);
    }
  }, [currentTripSlug, trips, tripLoaded]);

  // When the resolved trip id transitions, pick up that trip's stored
  // user identity from localStorage (or clear it). User-initiated
  // changes go through setUser / switchUser and update state directly,
  // so this effect doesn't clobber them (it only fires on id changes).
  useEffect(() => {
    if (currentTripId == null) {
      setCurrentUserIdState(null);
    } else {
      setCurrentUserIdState(readNum(userKey(currentTripId)));
    }
  }, [currentTripId]);

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
        // Trip was deleted out from under us — bounce back to the
        // listing. The slug→id effect will also fire once trips state
        // updates, but doing it here too keeps the transition tight.
        replacePath("/");
        setCurrentTripSlugState(null);
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
    const t = trips.find((x) => x.id === tripId);
    if (!t) return;
    const slug = tripSlug(t);
    pushPath(`/trips/${slug}`);
    setCurrentTripSlugState(slug);
  };

  const exitTrip = () => {
    pushPath("/");
    setCurrentTripSlugState(null);
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
    localStorage.removeItem(userKey(id));
    pushPath("/");
    setCurrentTripSlugState(null);
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
        onComplete={async ({ trip_id, organizer_user_id, location }) => {
          const slug = slugify(location) || `trip-${trip_id}`;
          localStorage.setItem(userKey(trip_id), String(organizer_user_id));
          // Refresh first so the trips list contains the new trip before
          // the slug→id effect runs (otherwise it would bounce to /).
          await refreshAll(trip_id);
          pushPath(`/trips/${slug}`);
          setCurrentTripSlugState(slug);
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
