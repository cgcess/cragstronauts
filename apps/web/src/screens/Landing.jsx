import React, { useState } from "react";

export default function Landing({ trip, users, onPickExisting, onJoinNew, onBack }) {
  const [mode, setMode] = useState("choose"); // choose | new
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const joinNew = async () => {
    setError(null);
    setBusy(true);
    try {
      await onJoinNew(name.trim());
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-shell">
      <div className="content">
        {onBack && (
          <button
            className="ghost"
            onClick={onBack}
            style={{ marginBottom: 8 }}
          >
            ← Trips
          </button>
        )}
        <div className="h1">🧗 {trip.location}</div>
        {trip.start_date && (
          <p className="muted">
            {trip.start_date} → {trip.end_date || "?"}
          </p>
        )}

        {mode === "choose" && (
          <div className="col" style={{ marginTop: 20 }}>
            <button onClick={() => setMode("new")}>+ Join the trip</button>
            {users.length > 0 && (
              <>
                <p className="muted" style={{ marginTop: 16 }}>
                  Or pick yourself if you've been here before:
                </p>
                {users.map((u) => (
                  <button
                    key={u.id}
                    className="secondary"
                    onClick={() => onPickExisting(u.id)}
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
