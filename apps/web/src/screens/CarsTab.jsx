import React, { useState } from "react";
import { api } from "../api.js";

export default function CarsTab({ cars, users, currentUserId, onChanged }) {
  const [adding, setAdding] = useState(false);
  const [seats, setSeats] = useState(4);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState(null);

  const myCar = cars.find((c) => c.driver_user_id === currentUserId);

  const submitCar = async () => {
    setError(null);
    try {
      await api.createCar({
        driver_user_id: currentUserId,
        total_seats: Number(seats),
        notes: notes.trim() || null,
      });
      setAdding(false);
      setNotes("");
      onChanged();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div>
      <div className="h1">🚗 Rides</div>
      {error && <div className="error-banner">{error}</div>}

      {cars.length === 0 && (
        <p className="muted">No cars yet. Be the first to offer a ride!</p>
      )}

      {cars.map((c) => {
        const passengerCount = c.passengers.length;
        const passengerCapacity = Math.max(0, c.total_seats - 1);
        const empty = passengerCapacity - passengerCount;
        const iAmIn =
          c.driver_user_id === currentUserId ||
          c.passengers.some((p) => p.user_id === currentUserId);
        return (
          <div className="card" key={c.id}>
            <div className="row between">
              <div>
                <div style={{ fontWeight: 600 }}>{c.driver_name}'s car</div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {c.total_seats} seats · {passengerCount}/{passengerCapacity} passengers
                </div>
              </div>
              {c.driver_user_id === currentUserId && (
                <button
                  className="ghost"
                  onClick={async () => {
                    if (confirm("Remove your car from the trip?")) {
                      await api.deleteCar(c.id);
                      onChanged();
                    }
                  }}
                >
                  Remove
                </button>
              )}
            </div>
            {c.notes && <p style={{ marginTop: 8 }}>{c.notes}</p>}
            <div className="seat-row">
              <span className="seat driver">🚗 {c.driver_name}</span>
              {c.passengers.map((p) => (
                <span className="seat" key={p.user_id}>
                  {p.name}
                  {p.user_id === currentUserId && (
                    <button
                      className="ghost"
                      style={{ padding: "0 4px", color: "var(--danger)" }}
                      onClick={async () => {
                        await api.carSignoff(c.id, currentUserId);
                        onChanged();
                      }}
                    >
                      ✕
                    </button>
                  )}
                </span>
              ))}
              {Array.from({ length: empty }).map((_, i) => (
                <button
                  key={`empty-${i}`}
                  className="seat empty"
                  disabled={iAmIn}
                  onClick={async () => {
                    setError(null);
                    try {
                      await api.carSignup(c.id, currentUserId);
                      onChanged();
                    } catch (e) {
                      setError(e.message);
                    }
                  }}
                  style={{
                    border: "1px dashed var(--border)",
                    background: "transparent",
                  }}
                >
                  + open seat
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {!myCar && !adding && (
        <button className="secondary" onClick={() => setAdding(true)} style={{ marginTop: 12 }}>
          + Offer a ride
        </button>
      )}

      {adding && (
        <div className="card">
          <div className="h2" style={{ marginTop: 0 }}>Your car</div>
          <label>Total seats (including driver)</label>
          <input
            type="number"
            min={1}
            value={seats}
            onChange={(e) => setSeats(e.target.value)}
          />
          <label style={{ marginTop: 10 }}>Notes (optional)</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. leaving Friday 5pm"
          />
          <div className="row" style={{ marginTop: 12 }}>
            <button className="secondary" onClick={() => setAdding(false)}>
              Cancel
            </button>
            <button onClick={submitCar} style={{ flex: 1 }}>
              Save car
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
