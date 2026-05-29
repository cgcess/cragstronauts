import React, { useState } from "react";
import { useNavigate, useOutletContext } from "react-router";
import Linkify from "../components/Linkify.jsx";
import { useTripContext } from "../context/TripContext.jsx";

export default function InfoTab() {
  const { tripId, trip, users, categories, currentUserId } = useTripContext();
  const { reload } = useOutletContext();
  const navigate = useNavigate();

  const me = users.find((u) => u.id === currentUserId);
  const isOrganizer = me?.is_organizer;

  const joining = users.filter((u) => u.joining);
  const notJoining = users.filter((u) => !u.joining);

  // Share link
  const [copied, setCopied] = useState(false);
  const shareLink = async () => {
    const url = `${window.location.origin}/trips/${tripId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy this trip link:", url);
    }
  };

  return (
    <div>
      <div className="h1">📍 {trip.location}</div>
      {trip.start_date && (
        <p className="muted">
          {trip.start_date} → {trip.end_date || "?"}
        </p>
      )}

      <div className="row" style={{ gap: 8, marginBottom: 8 }}>
        <button className="secondary" onClick={shareLink}>
          {copied ? "Link copied ✓" : "Share trip link"}
        </button>
        {isOrganizer && (
          <button
            className="secondary"
            onClick={() => navigate(`/trips/${tripId}/admin`)}
          >
            ⚙ Settings
          </button>
        )}
      </div>

      <div className="card">
        <div className="h2" style={{ marginTop: 0 }}>Accommodation</div>
        <div className="row between">
          <span className="pill accent">{trip.accommodation_type || "—"}</span>
        </div>
        {trip.accommodation_details && (
          <p style={{ marginTop: 8 }}>
            <Linkify>{trip.accommodation_details}</Linkify>
          </p>
        )}
      </div>

      {trip.notes && (
        <div className="card">
          <div className="h2" style={{ marginTop: 0 }}>Notes</div>
          <p><Linkify>{trip.notes}</Linkify></p>
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
    </div>
  );
}
