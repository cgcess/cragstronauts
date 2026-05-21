import React from "react";

function today() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isPast(trip, today) {
  // Past if end_date (or start_date as fallback) is strictly before today.
  const ref = trip.end_date || trip.start_date;
  return ref != null && ref < today;
}

function dateRange(trip) {
  if (!trip.start_date && !trip.end_date) return null;
  if (trip.start_date && trip.end_date && trip.start_date !== trip.end_date) {
    return `${trip.start_date} → ${trip.end_date}`;
  }
  return trip.start_date || trip.end_date;
}

export default function TripListing({ trips, onCreate, onSelect }) {
  const t = today();
  const upcoming = trips
    .filter((trip) => !isPast(trip, t))
    .sort((a, b) => {
      const ad = a.start_date || a.end_date || "9999-12-31";
      const bd = b.start_date || b.end_date || "9999-12-31";
      return ad.localeCompare(bd);
    });
  const past = trips
    .filter((trip) => isPast(trip, t))
    .sort((a, b) => {
      const ad = a.end_date || a.start_date || "";
      const bd = b.end_date || b.start_date || "";
      return bd.localeCompare(ad);
    });

  const renderTrip = (trip) => {
    const range = dateRange(trip);
    return (
      <button
        key={trip.id}
        className="secondary"
        onClick={() => onSelect(trip.id)}
        style={{
          textAlign: "left",
          display: "block",
          width: "100%",
          marginBottom: 8,
        }}
      >
        <div style={{ fontWeight: 600 }}>🧗 {trip.location}</div>
        {range && (
          <div className="muted" style={{ fontSize: 13 }}>
            {range}
          </div>
        )}
      </button>
    );
  };

  return (
    <div className="app-shell">
      <div className="content">
        <div className="h1">Climbing trips</div>

        <button onClick={onCreate} style={{ marginBottom: 20 }}>
          + New trip
        </button>

        {trips.length === 0 && (
          <p className="muted">
            No trips yet. Create one to get started.
          </p>
        )}

        {upcoming.length > 0 && (
          <>
            <div className="h2">Upcoming</div>
            {upcoming.map(renderTrip)}
          </>
        )}

        {past.length > 0 && (
          <>
            <div className="h2" style={{ marginTop: 24 }}>Past</div>
            {past.map(renderTrip)}
          </>
        )}
      </div>
    </div>
  );
}
