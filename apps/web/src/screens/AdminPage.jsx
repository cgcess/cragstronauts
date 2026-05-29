import React, { useState } from "react";
import { useNavigate, Navigate } from "react-router";
import { api } from "../api.js";
import { useTripContext } from "../context/TripContext.jsx";

export default function AdminPage() {
  const { tripId, trip, users, categories, currentUserId, refresh, deleteTrip } =
    useTripContext();
  const navigate = useNavigate();

  const me = users.find((u) => u.id === currentUserId);

  // Guard: only organizers
  if (!me?.is_organizer) {
    return <Navigate to={`/trips/${tripId}/info`} replace />;
  }

  return (
    <div className="admin-page">
      <div className="admin-topbar">
        <div className="admin-topbar-inner">
          <button
            className="admin-back"
            onClick={() => navigate(`/trips/${tripId}/info`)}
          >
            ← Back to trip
          </button>
        </div>
      </div>

      <div className="admin-container">
        <div className="admin-header">
          <h1 className="admin-title">Settings</h1>
        </div>

        <div className="admin-sections">
          <TripDetailsSection tripId={tripId} trip={trip} onSaved={refresh} />
          <GearCategoriesSection
            tripId={tripId}
            categories={categories}
            onChanged={refresh}
          />
          <MembersSection
            tripId={tripId}
            users={users}
            currentUserId={currentUserId}
            onChanged={refresh}
          />
          <DangerSection trip={trip} onDelete={deleteTrip} />
        </div>
      </div>
    </div>
  );
}

function TripDetailsSection({ tripId, trip, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    location: trip.location || "",
    start_date: trip.start_date || "",
    end_date: trip.end_date || "",
    accommodation_type: trip.accommodation_type || "campsite",
    accommodation_details: trip.accommodation_details || "",
    notes: trip.notes || "",
  });

  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      await api.updateTrip(tripId, {
        location: form.location.trim(),
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        accommodation_type: form.accommodation_type,
        accommodation_details: form.accommodation_details.trim() || null,
        notes: form.notes.trim() || null,
      });
      await onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="admin-section admin-section--full">
      <h2 className="admin-section-title">Trip details</h2>
      {error && <div className="admin-error">{error}</div>}
      <div className="admin-form">
        <div className="admin-field">
          <label className="admin-label">Location</label>
          <input
            className="admin-input"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder="e.g. Yosemite Valley"
          />
        </div>
        <div className="admin-row">
          <div className="admin-field" style={{ flex: 1 }}>
            <label className="admin-label">Start</label>
            <input
              className="admin-input"
              type="date"
              value={form.start_date}
              onChange={(e) => {
                const v = e.target.value;
                setForm((f) => ({
                  ...f,
                  start_date: v,
                  end_date: f.end_date && f.end_date < v ? v : f.end_date,
                }));
              }}
            />
          </div>
          <div className="admin-field" style={{ flex: 1 }}>
            <label className="admin-label">End</label>
            <input
              className="admin-input"
              type="date"
              min={form.start_date || undefined}
              value={form.end_date}
              onChange={(e) =>
                setForm({ ...form, end_date: e.target.value })
              }
            />
          </div>
        </div>
        <div className="admin-field">
          <label className="admin-label">Accommodation</label>
          <select
            className="admin-input"
            value={form.accommodation_type}
            onChange={(e) =>
              setForm({ ...form, accommodation_type: e.target.value })
            }
          >
            <option value="campsite">Campsite</option>
            <option value="airbnb">Airbnb</option>
            <option value="hotel">Hotel</option>
            <option value="hut">Hut / Refuge</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="admin-field">
          <label className="admin-label">Accommodation details</label>
          <input
            className="admin-input"
            value={form.accommodation_details}
            onChange={(e) =>
              setForm({ ...form, accommodation_details: e.target.value })
            }
            placeholder="Name, address, link…"
          />
        </div>
        <div className="admin-field">
          <label className="admin-label">Notes</label>
          <textarea
            className="admin-input admin-textarea"
            rows={3}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
        <div>
          <button
            className="admin-btn"
            disabled={!form.location.trim() || saving}
            onClick={save}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </section>
  );
}

function GearCategoriesSection({ tripId, categories, onChanged }) {
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(null);

  const addCategory = async () => {
    setError(null);
    try {
      await api.addCategory(tripId, { name: newName.trim(), fields: [] });
      setNewName("");
      setAdding(false);
      await onChanged();
    } catch (e) {
      setError(e.message);
    }
  };

  const removeCategory = async (catId) => {
    setError(null);
    try {
      await api.deleteCategory(tripId, catId);
      await onChanged();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <section className="admin-section">
      <h2 className="admin-section-title">Gear categories</h2>
      {error && <div className="admin-error">{error}</div>}
      {categories.length === 0 && (
        <p className="admin-list-empty">No categories yet.</p>
      )}
      <div className="admin-list">
        {categories.map((c) => (
          <div className="admin-list-item" key={c.id}>
            <span>{c.name}</span>
            <button
              className="admin-btn-text admin-btn-text--danger"
              onClick={() => removeCategory(c.id)}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      {adding ? (
        <div className="admin-inline-form">
          <input
            className="admin-input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Category name"
            autoFocus
          />
          <div className="admin-row" style={{ marginTop: 8 }}>
            <button
              className="admin-btn-outline"
              onClick={() => {
                setAdding(false);
                setNewName("");
              }}
            >
              Cancel
            </button>
            <button
              className="admin-btn"
              disabled={!newName.trim()}
              onClick={addCategory}
            >
              Add
            </button>
          </div>
        </div>
      ) : (
        <button
          className="admin-btn-outline"
          onClick={() => setAdding(true)}
          style={{ marginTop: categories.length > 0 ? 8 : 0 }}
        >
          + Add category
        </button>
      )}
    </section>
  );
}

function MembersSection({ tripId, users, currentUserId, onChanged }) {
  const [error, setError] = useState(null);

  const removeMember = async (userId, userName) => {
    setError(null);
    try {
      const [cars, gear] = await Promise.all([
        api.listCars(tripId),
        api.listGear(tripId),
      ]);
      const hasCar = cars.some((c) => c.driver_user_id === userId);
      const hasGear = gear.some((g) => g.user_id === userId);

      let msg = `Remove ${userName} from the trip?`;
      if (hasCar && hasGear) {
        msg += "\n\nThey have a car and gear contributions that will also be removed.";
      } else if (hasCar) {
        msg += "\n\nThey have a car that will also be removed.";
      } else if (hasGear) {
        msg += "\n\nThey have gear contributions that will also be removed.";
      }

      if (!confirm(msg)) return;

      await api.deleteUser(tripId, userId);
      await onChanged();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <section className="admin-section">
      <h2 className="admin-section-title">Members</h2>
      {error && <div className="admin-error">{error}</div>}
      {users.length === 0 && (
        <p className="admin-list-empty">No members yet.</p>
      )}
      <div className="admin-list">
        {users.map((u) => (
          <div className="admin-list-item" key={u.id}>
            <span>
              {u.name}
              {u.is_organizer && (
                <span className="admin-muted" style={{ marginLeft: 6 }}>
                  (organizer)
                </span>
              )}
              {!u.is_organizer && (
                <span className="admin-muted" style={{ marginLeft: 6 }}>
                  {u.joining ? "joining" : "not joining"}
                </span>
              )}
            </span>
            {!u.is_organizer && (
              <button
                className="admin-btn-text admin-btn-text--danger"
                onClick={() => removeMember(u.id, u.name)}
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function DangerSection({ trip, onDelete }) {
  return (
    <section className="admin-section admin-section--danger">
      <h2 className="admin-section-title admin-section-title--danger">
        Danger zone
      </h2>
      <p className="admin-muted">
        Deleting the trip removes it for everyone, along with all cars and gear.
        This can't be undone.
      </p>
      <button
        className="admin-btn admin-btn--danger"
        onClick={async () => {
          if (
            confirm(
              `Delete the "${trip.location}" trip? This can't be undone.`
            )
          ) {
            await onDelete();
          }
        }}
      >
        Delete trip
      </button>
    </section>
  );
}
