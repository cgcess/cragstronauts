import React, { useEffect, useState, useCallback } from "react";
import { Outlet, useParams, useNavigate } from "react-router";
import { api } from "../api.js";
import { TripProvider } from "../context/TripContext.jsx";

const userKey = (tripId) => `climbingTrip.userId.${tripId}`;

function readNum(key) {
  const v = localStorage.getItem(key);
  return v ? Number(v) : null;
}

export default function TripLayout() {
  const { tripId } = useParams();
  const navigate = useNavigate();

  const [trip, setTrip] = useState(null);
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(() =>
    readNum(userKey(tripId))
  );

  const refresh = useCallback(async () => {
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
      navigate("/", { replace: true });
    }
    setLoading(false);
  }, [tripId, navigate]);

  useEffect(() => {
    setLoading(true);
    setCurrentUserId(readNum(userKey(tripId)));
    refresh();
  }, [tripId, refresh]);

  // Self-heal: if stored userId no longer exists in users list, clear it
  useEffect(() => {
    if (loading || !currentUserId) return;
    const found = users.find((u) => u.id === currentUserId);
    if (!found) {
      localStorage.removeItem(userKey(tripId));
      setCurrentUserId(null);
    }
  }, [loading, currentUserId, users, tripId]);

  const setUser = (userId) => {
    if (userId == null) {
      localStorage.removeItem(userKey(tripId));
    } else {
      localStorage.setItem(userKey(tripId), String(userId));
    }
    setCurrentUserId(userId);
  };

  const switchUser = () => {
    localStorage.removeItem(userKey(tripId));
    setCurrentUserId(null);
  };

  const deleteTrip = async () => {
    await api.deleteTrip(tripId);
    localStorage.removeItem(userKey(tripId));
    navigate("/", { replace: true });
  };

  if (loading) {
    return (
      <div className="app-shell">
        <div className="center-screen">
          <p className="muted">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <TripProvider
      value={{
        tripId,
        trip,
        users,
        categories,
        currentUserId,
        setUser,
        switchUser,
        refresh,
        deleteTrip,
      }}
    >
      <Outlet />
    </TripProvider>
  );
}
