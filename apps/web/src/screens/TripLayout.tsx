import React, { useEffect, useState, useCallback, useRef } from "react";
import { Outlet, useParams, useNavigate } from "react-router";
import { api } from "../api";
import { TripProvider, type Trip, type User, type Category } from "../context/TripContext";
import BottomSheet from "../components/BottomSheet";
import { Button } from "../components/ui";

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

  // Resolve the pending ensureUser() promise (if any) and close the sheet.
  const resolveIdentity = (id: number | null) => {
    setIdentityOpen(false);
    const resolve = resolverRef.current;
    resolverRef.current = null;
    resolve?.(id);
  };

  const identify = async (id: number) => {
    // Refresh first so the users list already contains `id` before we set it as
    // current. Otherwise the self-heal effect sees an id that isn't in the
    // (stale) users list and immediately clears it.
    await refresh();
    setUser(id);
    resolveIdentity(id);
  };

  const createAndIdentify = async (name: string) => {
    const u = await api.createUser(tripId!, name.trim());
    await identify(u.id);
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
      <IdentitySheet
        open={identityOpen}
        users={users}
        onClose={() => resolveIdentity(null)}
        onPick={identify}
        onCreate={createAndIdentify}
      />
    </TripProvider>
  );
}

/* ------------------------------------------------------------------ */
/* Lazy-identity sheet                                                 */
/* ------------------------------------------------------------------ */

function IdentitySheet({
  open,
  users,
  onClose,
  onPick,
  onCreate,
}: {
  open: boolean;
  users: User[];
  onClose: () => void;
  onPick: (id: number) => Promise<void>;
  onCreate: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the form each time the sheet opens.
  useEffect(() => {
    if (open) {
      setName("");
      setError(null);
      setBusy(false);
    }
  }, [open]);

  const submitNew = async () => {
    if (!name.trim() || busy) return;
    setError(null);
    setBusy(true);
    try {
      await onCreate(name);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const pick = async (id: number) => {
    if (busy) return;
    setBusy(true);
    try {
      await onPick(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="col" style={{ gap: 14 }}>
        <input
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitNew()}
          autoFocus
        />
        {error && <div className="error-banner">{error}</div>}
        <Button
          variant="primary"
          fullWidth
          disabled={!name.trim() || busy}
          onClick={submitNew}
        >
          {busy ? "One sec…" : "That's me →"}
        </Button>

        {users.length > 0 && (
          <>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              …or pick yourself:
            </p>
            <div className="col">
              {users.map((u) => (
                <Button
                  key={u.id}
                  variant="secondary"
                  fullWidth
                  disabled={busy}
                  onClick={() => pick(u.id)}
                >
                  {u.name} {u.is_organizer && "👑"}
                </Button>
              ))}
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  );
}
