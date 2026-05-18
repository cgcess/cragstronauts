import React, { useEffect, useState, useCallback } from "react";
import { api } from "./api.js";
import OrganizerWizard from "./screens/OrganizerWizard.jsx";
import Landing from "./screens/Landing.jsx";
import SignupSwipe from "./screens/SignupSwipe.jsx";
import MainTabs from "./screens/MainTabs.jsx";

const USER_KEY = "climbingTrip.userId";

function computeStage({ tripLoaded, trip, currentUserId, users }) {
  if (!tripLoaded) return "loading";
  if (!trip) return "organizer";
  if (!currentUserId) return "landing";
  const me = users.find((u) => u.id === currentUserId);
  if (!me) return "landing-stale"; // signal: stored id no longer exists
  if (me.is_organizer) return "main";
  const done = localStorage.getItem(`climbingTrip.signupDone.${currentUserId}`);
  return done ? "main" : "signup";
}

export default function App() {
  const [trip, setTrip] = useState(null);
  const [tripLoaded, setTripLoaded] = useState(false);
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(() => {
    const v = localStorage.getItem(USER_KEY);
    return v ? Number(v) : null;
  });
  // Forced stage override (e.g., right after finishing the wizard) so we don't
  // wait for refetched state before transitioning.
  const [forcedStage, setForcedStage] = useState(null);

  const refreshAll = useCallback(async () => {
    const t = await api.getTrip();
    setTrip(t);
    if (t) {
      const [u, c] = await Promise.all([api.listUsers(), api.listCategories()]);
      setUsers(u);
      setCategories(c);
    } else {
      setUsers([]);
      setCategories([]);
    }
    setTripLoaded(true);
    return t;
  }, []);

  useEffect(() => {
    refreshAll().catch((e) => console.error(e));
  }, [refreshAll]);

  let stage =
    forcedStage ||
    computeStage({ tripLoaded, trip, currentUserId, users });

  // Self-heal stale localStorage if the stored user no longer exists.
  useEffect(() => {
    if (stage === "landing-stale") {
      localStorage.removeItem(USER_KEY);
      setCurrentUserId(null);
    }
  }, [stage]);

  const setUser = (id) => {
    localStorage.setItem(USER_KEY, String(id));
    setCurrentUserId(id);
  };

  const switchUser = () => {
    localStorage.removeItem(USER_KEY);
    setCurrentUserId(null);
    setForcedStage(null);
  };

  if (stage === "loading" || stage === "landing-stale") {
    return (
      <div className="app-shell">
        <div className="center-screen">
          <p className="muted">Loading…</p>
        </div>
      </div>
    );
  }

  if (stage === "organizer") {
    return (
      <OrganizerWizard
        onComplete={async (organizerUserId) => {
          localStorage.setItem(`climbingTrip.signupDone.${organizerUserId}`, "1");
          setUser(organizerUserId);
          await refreshAll();
        }}
      />
    );
  }

  if (stage === "landing") {
    return (
      <Landing
        trip={trip}
        users={users}
        onPickExisting={(id) => setUser(id)}
        onJoinNew={async (name) => {
          const u = await api.createUser(name);
          setUser(u.id);
          await refreshAll();
        }}
      />
    );
  }

  if (stage === "signup") {
    return (
      <SignupSwipe
        trip={trip}
        categories={categories}
        userId={currentUserId}
        onComplete={async () => {
          if (currentUserId) {
            localStorage.setItem(
              `climbingTrip.signupDone.${currentUserId}`,
              "1"
            );
          }
          await refreshAll();
        }}
      />
    );
  }

  // stage === "main"
  if (!trip) {
    // shouldn't happen given computeStage, but guard anyway
    return (
      <div className="app-shell">
        <div className="center-screen">
          <p className="muted">No trip configured.</p>
        </div>
      </div>
    );
  }

  return (
    <MainTabs
      trip={trip}
      users={users}
      categories={categories}
      currentUserId={currentUserId}
      onRefresh={refreshAll}
      onSwitchUser={switchUser}
    />
  );
}
