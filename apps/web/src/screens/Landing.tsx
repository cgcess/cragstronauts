import React, { useState } from "react";
import { useNavigate } from "react-router";
import { api } from "../api";
import { useTripContext, type User } from "../context/TripContext";
import { formatDateRange } from "../dateUtils";
import { Button } from "../components/ui";
import Markdown from "../components/Markdown";

const SIGNOFF_WORDS = [
  "Send it",
  "Stay psyched",
  "Climb on",
  "Yours in chalk",
  "Belay on",
  "Stoked",
  "Crimps & dreams",
  "Keep sending",
];

export default function Landing() {
  const { tripId, trip, users, setUser, refresh } = useTripContext();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"choose" | "new">("choose");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signoffIndex, setSignoffIndex] = useState(0);

  const pickExisting = (userId: number) => {
    setUser(userId);
    const me = users.find((u) => u.id === userId);
    if (me?.signup_completed) {
      navigate(`/trips/${tripId}/board`);
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
        <Button
          variant="secondary"
          pill
          onClick={() => navigate("/", { replace: true })}
          style={{ marginBottom: 8, position: "relative", zIndex: 6 }}
        >
          ← Trips
        </Button>
        <div className="h1">🧗 {trip.location}</div>
        {(trip.start_date || trip.end_date) && (
          <p className="muted">
            {formatDateRange(trip.start_date, trip.end_date)}
          </p>
        )}

        {trip.welcome_message && (
          <div
            className="card"
            style={{
              marginTop: 20,
              lineHeight: 1.6,
              maxWidth: 560,
              whiteSpace: "pre-wrap",
            }}
          >
            <Markdown>{trip.welcome_message}</Markdown>
            {trip.signature && (
              <p style={{ marginTop: 16, marginBottom: 0 }}>
                <em
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    setSignoffIndex((i) => (i + 1) % SIGNOFF_WORDS.length)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSignoffIndex((i) => (i + 1) % SIGNOFF_WORDS.length);
                    }
                  }}
                  style={{ cursor: "pointer", userSelect: "none" }}
                  title="Tap me"
                >
                  {SIGNOFF_WORDS[signoffIndex]}
                </em>
                , {trip.signature}
              </p>
            )}
          </div>
        )}

        {mode === "choose" && (
          <div className="col" style={{ marginTop: 20 }}>
            <Button variant="primary" fullWidth onClick={() => setMode("new")}>
              Join the trip →
            </Button>
            {users.length > 0 && (
              <>
                <p className="muted" style={{ marginTop: 16 }}>
                  Or pick yourself if you&apos;ve been here before:
                </p>
                {users.map((u) => (
                  <Button
                    key={u.id}
                    variant="secondary"
                    fullWidth
                    onClick={() => pickExisting(u.id)}
                  >
                    {u.name} {u.is_organizer && "👑"}
                  </Button>
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
              <Button variant="secondary" onClick={() => setMode("choose")}>
                Back
              </Button>
              <Button
                variant="primary"
                disabled={!name.trim() || busy}
                onClick={joinNew}
                style={{ flex: 1 }}
              >
                {busy ? "Joining…" : "Let's go"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
