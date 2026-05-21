import React, { useState } from "react";
import { api } from "../api.js";

export default function InfoTab({ trip, users, categories, isOrganizer, onChanged, onDeleteTrip }) {
  const joining = users.filter((u) => u.joining);
  const notJoining = users.filter((u) => !u.joining);
  const [addingCat, setAddingCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  return (
    <div>
      <div className="h1">📍 {trip.location}</div>
      {trip.start_date && (
        <p className="muted">
          {trip.start_date} → {trip.end_date || "?"}
        </p>
      )}

      <div className="card">
        <div className="h2" style={{ marginTop: 0 }}>Accommodation</div>
        <div className="row between">
          <span className="pill accent">{trip.accommodation_type || "—"}</span>
        </div>
        {trip.accommodation_details && (
          <p style={{ marginTop: 8 }}>{trip.accommodation_details}</p>
        )}
      </div>

      {trip.notes && (
        <div className="card">
          <div className="h2" style={{ marginTop: 0 }}>Notes</div>
          <p>{trip.notes}</p>
        </div>
      )}

      <div className="h2">Roster ({joining.length})</div>
      {joining.map((u) => (
        <div className="list-item" key={u.id}>
          <span>
            {u.name} {u.is_organizer && "👑"}
          </span>
          <span className="pill accent">Going</span>
        </div>
      ))}
      {notJoining.length > 0 && (
        <>
          <div className="muted" style={{ marginTop: 8 }}>Not joining</div>
          {notJoining.map((u) => (
            <div className="list-item" key={u.id}>
              <span>{u.name}</span>
              <span className="pill">Out</span>
            </div>
          ))}
        </>
      )}

      <div className="h2">Gear categories</div>
      {categories.map((c) => (
        <div className="list-item" key={c.id}>
          <span>{c.name}</span>
          <span className="muted">
            {c.fields.map((f) => f.label).join(", ") || "no fields"}
          </span>
        </div>
      ))}
      {isOrganizer && onDeleteTrip && (
        <div className="card" style={{ marginTop: 20, borderColor: "var(--danger)" }}>
          <div className="h2" style={{ marginTop: 0, color: "var(--danger)" }}>Danger zone</div>
          <p className="muted" style={{ fontSize: 13 }}>
            Deleting the trip removes it for everyone, along with all cars and gear.
          </p>
          <button
            className="secondary"
            style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
            onClick={async () => {
              if (confirm(`Delete the "${trip.location}" trip? This can't be undone.`)) {
                await onDeleteTrip();
              }
            }}
          >
            Delete trip
          </button>
        </div>
      )}

      {isOrganizer && (
        <div style={{ marginTop: 8 }}>
          {!addingCat ? (
            <button className="secondary" onClick={() => setAddingCat(true)}>
              + Add gear category
            </button>
          ) : (
            <div className="card">
              <label>Category name</label>
              <input
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="e.g. Helmets"
              />
              <div className="row" style={{ marginTop: 10 }}>
                <button className="secondary" onClick={() => { setAddingCat(false); setNewCatName(""); }}>
                  Cancel
                </button>
                <button
                  style={{ flex: 1 }}
                  disabled={!newCatName.trim()}
                  onClick={async () => {
                    await api.addCategory(trip.id, { name: newCatName.trim(), fields: [] });
                    setNewCatName("");
                    setAddingCat(false);
                    onChanged();
                  }}
                >
                  Add
                </button>
              </div>
              <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                (Quick add — no custom fields. Use signup form to capture per-user details.)
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
