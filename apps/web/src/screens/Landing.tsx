import React, { useState } from "react";
import { useNavigate } from "react-router";
import { api } from "../api";
import { useTripContext, type User } from "../context/TripContext";
import { formatDateRange } from "../dateUtils";

export default function Landing() {
  const { tripId, trip, users, setUser, refresh } = useTripContext();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"choose" | "new">("choose");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickExisting = (userId: number) => {
    setUser(userId);
    const me = users.find((u) => u.id === userId);
    if (me?.signup_completed) {
      navigate(`/trips/${tripId}/info`);
    } else {
      navigate(`/trips/${tripId}/signup`);
    }
  };

  const joinNew = async () => {
    setError(null);
    setBusy(true);
    try {
      const u = await api.createUser(tripId, name.trim());
      await refresh();
      setUser(u.id);
      navigate(`/trips/${tripId}/signup`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-shell">
      <div className="fade-overlay fade-overlay--top" aria-hidden="true" />
      <div className="content">
        <button
          className="glass-surface nav-pill"
          onClick={() => navigate("/")}
          style={{ marginBottom: 8, position: "relative", zIndex: 6 }}
        >
          ← Trips
        </button>
        <div className="h1">🧗 {trip.location}</div>
        {(trip.start_date || trip.end_date) && (
          <p className="muted">
            {formatDateRange(trip.start_date, trip.end_date)}
          </p>
        )}

        {mode === "choose" && (
          <div className="col" style={{ marginTop: 20 }}>
            <button className="btn-3d" onClick={() => setMode("new")}>
              Join the trip →
            </button>
            {users.length > 0 && (
              <>
                <p className="muted" style={{ marginTop: 16 }}>
                  Or pick yourself if you&apos;ve been here before:
                </p>
                {users.map((u) => (
                  <button
                    key={u.id}
                    className="secondary"
                    onClick={() => pickExisting(u.id)}
                  >
                    {u.name} {u.is_organizer && "👑"}
                  </button>
                ))}
              </>
            )}
          </div>
        )}

        {mode === "new" && (
          <div className="col" style={{ marginTop: 20 }}>
            <label>Your name</label>
            <input
              placeholder="e.g. Sam"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            {error && <div className="error-banner">{error}</div>}
            <div className="row">
              <button className="secondary" onClick={() => setMode("choose")}>
                Back
              </button>
              <button
                disabled={!name.trim() || busy}
                onClick={joinNew}
                style={{ flex: 1 }}
              >
                {busy ? "Joining…" : "Let's go"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
