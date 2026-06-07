import React, { useEffect, useState, useCallback, useRef } from "react";
import { Outlet, useParams, useNavigate } from "react-router";
import { api } from "../api";
import { TripProvider, type Trip, type User, type Category } from "../context/TripContext";
import IdentityFlow from "./IdentityFlow";

const userKey = (tripId: string) => `climbingTrip.userId.${tripId}`;

function readNum(key: string): number | null {
  const v = localStorage.getItem(key);
  return v ? Number(v) : null;
}

export default function TripLayout() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<number | null>(() =>
    readNum(userKey(tripId!))
  );

  // Lazy-identity sheet. `identityOpen` controls visibility; `resolverRef`
  // holds the promise resolver from the in-flight ensureUser() call so the
  // original write action can resume once the visitor identifies (or dismisses).
  const [identityOpen, setIdentityOpen] = useState(false);
  const resolverRef = useRef<((id: number | null) => void) | null>(null);

  const refresh = useCallback(async () => {
    try {
      const t = await api.getTrip(tripId!);
      setTrip(t);
      const [u, c] = await Promise.all([
        api.listUsers(tripId!),
        api.listCategories(tripId!),
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
    setCurrentUserId(readNum(userKey(tripId!)));
    refresh();
  }, [tripId, refresh]);

  // Self-heal: if stored userId no longer exists in users list, clear it
  useEffect(() => {
    if (loading || !currentUserId) return;
    const found = users.find((u) => u.id === currentUserId);
    if (!found) {
      localStorage.removeItem(userKey(tripId!));
      setCurrentUserId(null);
    }
  }, [loading, currentUserId, users, tripId]);

  const setUser = (userId: number | null) => {
    if (userId == null) {
      localStorage.removeItem(userKey(tripId!));
    } else {
      localStorage.setItem(userKey(tripId!), String(userId));
    }
    setCurrentUserId(userId);
  };

  const switchUser = () => {
    localStorage.removeItem(userKey(tripId!));
    setCurrentUserId(null);
  };

  const ensureUser = useCallback((): Promise<number | null> => {
    const existing = readNum(userKey(tripId!));
    if (existing != null) return Promise.resolve(existing);
    return new Promise<number | null>((resolve) => {
      resolverRef.current = resolve;
      setIdentityOpen(true);
    });
  }, [tripId]);

  // Resolve the pending ensureUser() promise (if any) and close the overlay.
  const resolveIdentity = (id: number | null) => {
    setIdentityOpen(false);
    const resolve = resolverRef.current;
    resolverRef.current = null;
    resolve?.(id);
  };

  const deleteTrip = async () => {
    await api.deleteTrip(tripId!);
    localStorage.removeItem(userKey(tripId!));
    navigate("/", { replace: true });
  };

  if (loading || !trip) {
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
        tripId: tripId!,
        trip,
        users,
        categories,
        currentUserId,
        setUser,
        switchUser,
        ensureUser,
        refresh,
        deleteTrip,
      }}
    >
      <Outlet />
      <IdentityFlow
        open={identityOpen}
        tripId={tripId!}
        users={users}
        categories={categories}
        setUser={setUser}
        refresh={refresh}
        onDone={resolveIdentity}
      />
    </TripProvider>
  );
}
