import React, { useState } from "react";
import { useNavigate, Navigate } from "react-router";
import { api } from "../api";
import { useTripContext, type Trip, type User, type Category } from "../context/TripContext";

export default function AdminPage() {
  const { tripId, trip, users, categories, currentUserId, refresh, deleteTrip } =
    useTripContext();
  const navigate = useNavigate();

  const me = users.find((u) => u.id === currentUserId);

  // Guard: only organizers
  if (!me?.is_organizer) {
    return <Navigate to={`/trips/${tripId}/board`} replace />;
  }

  return (
    <div className="admin-page">
      <div className="admin-topbar">
        <div className="admin-topbar-inner">
          <button
            className="admin-back"
            onClick={() => navigate(`/trips/${tripId}/board`)}
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
          <LocationSection tripId={tripId} trip={trip} onSaved={refresh} />
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

function TripDetailsSection({ tripId, trip, onSaved }: { tripId: string; trip: Trip; onSaved: () => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      setError(e instanceof Error ? e.message : String(e));
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

interface GeoResult {
  name: string;
  admin1?: string;
  country_code?: string;
  latitude: number;
  longitude: number;
}

function LocationSection({ tripId, trip, onSaved }: { tripId: string; trip: Trip; onSaved: () => Promise<void> }) {
  const [query, setQuery] = useState(trip.place_label || trip.location || "");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lat, setLat] = useState(trip.latitude != null ? String(trip.latitude) : "");
  const [lon, setLon] = useState(trip.longitude != null ? String(trip.longitude) : "");
  const [saving, setSaving] = useState(false);

  const labelFor = (r: GeoResult) =>
    [r.name, r.admin1, r.country_code].filter(Boolean).join(", ");

  const search = async () => {
    setError(null);
    setSearching(true);
    setSearched(false);
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        query.trim()
      )}&count=6&language=en&format=json`;
      const r = await fetch(url);
      const d = (await r.json()) as { results?: GeoResult[] };
      setResults(d.results || []);
      setSearched(true);
    } catch {
      setError("Search failed. Try entering coordinates manually.");
    } finally {
      setSearching(false);
    }
  };

  const savePin = async (latitude: number, longitude: number, place_label: string) => {
    setError(null);
    setSaving(true);
    try {
      await api.updateTrip(tripId, { latitude, longitude, place_label });
      await onSaved();
      setResults([]);
      setSearched(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const saveManual = () => {
    const la = parseFloat(lat);
    const lo = parseFloat(lon);
    if (Number.isNaN(la) || Number.isNaN(lo) || la < -90 || la > 90 || lo < -180 || lo > 180) {
      setError("Enter a valid latitude (−90…90) and longitude (−180…180).");
      return;
    }
    savePin(la, lo, query.trim() || trip.location);
  };

  const clearPin = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.updateTrip(tripId, { latitude: null, longitude: null, place_label: null });
      await onSaved();
      setLat("");
      setLon("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const pinned = trip.latitude != null && trip.longitude != null;

  return (
    <section className="admin-section admin-section--full">
      <h2 className="admin-section-title">Location &amp; weather</h2>
      <p className="admin-muted" style={{ marginTop: 0 }}>
        Pin the crag so everyone sees an accurate forecast. Search for the
        nearest town, or drop exact coordinates.
      </p>
      {error && <div className="admin-error">{error}</div>}

      {pinned && (
        <div className="admin-list-item" style={{ marginBottom: 10 }}>
          <span>
            📍 {trip.place_label || "Pinned"}
            <span className="admin-muted" style={{ marginLeft: 6 }}>
              {trip.latitude!.toFixed(4)}, {trip.longitude!.toFixed(4)}
            </span>
          </span>
          <button className="admin-btn-text admin-btn-text--danger" onClick={clearPin} disabled={saving}>
            Clear
          </button>
        </div>
      )}

      <div className="admin-form">
        <div className="admin-field">
          <label className="admin-label">Search a place</label>
          <div className="admin-row">
            <input
              className="admin-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Bishop, California"
              onKeyDown={(e) => e.key === "Enter" && search()}
              style={{ flex: 1 }}
            />
            <button className="admin-btn-outline" onClick={search} disabled={searching || !query.trim()}>
              {searching ? "…" : "Search"}
            </button>
          </div>
        </div>

        {results.length > 0 && (
          <div className="admin-list">
            {results.map((r, i) => (
              <div className="admin-list-item" key={i}>
                <span>{labelFor(r)}</span>
                <button
                  className="admin-btn-text"
                  disabled={saving}
                  onClick={() => savePin(r.latitude, r.longitude, labelFor(r))}
                >
                  Pin
                </button>
              </div>
            ))}
          </div>
        )}
        {searched && results.length === 0 && (
          <p className="admin-muted">
            No matches — many crags aren&apos;t in the place index. Enter
            coordinates below instead.
          </p>
        )}

        <div className="admin-row">
          <div className="admin-field" style={{ flex: 1 }}>
            <label className="admin-label">Latitude</label>
            <input
              className="admin-input"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="37.7807"
              inputMode="decimal"
            />
          </div>
          <div className="admin-field" style={{ flex: 1 }}>
            <label className="admin-label">Longitude</label>
            <input
              className="admin-input"
              value={lon}
              onChange={(e) => setLon(e.target.value)}
              placeholder="-83.6829"
              inputMode="decimal"
            />
          </div>
        </div>
        <div>
          <button className="admin-btn" onClick={saveManual} disabled={saving || !lat || !lon}>
            {saving ? "Saving…" : "Save coordinates"}
          </button>
        </div>
      </div>
    </section>
  );
}

function GearCategoriesSection({ tripId, categories, onChanged }: { tripId: string; categories: Category[]; onChanged: () => Promise<void> }) {
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addCategory = async () => {
    setError(null);
    try {
      await api.addCategory(tripId, { name: newName.trim(), fields: [] });
      setNewName("");
      setAdding(false);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const removeCategory = async (catId: number) => {
    setError(null);
    try {
      await api.deleteCategory(tripId, catId);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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

function MembersSection({ tripId, users, currentUserId, onChanged }: { tripId: string; users: User[]; currentUserId: number | null; onChanged: () => Promise<void> }) {
  const [error, setError] = useState<string | null>(null);

  const removeMember = async (userId: number, userName: string) => {
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
      setError(e instanceof Error ? e.message : String(e));
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

function DangerSection({ trip, onDelete }: { trip: Trip; onDelete: () => Promise<void> }) {
  return (
    <section className="admin-section admin-section--danger">
      <h2 className="admin-section-title admin-section-title--danger">
        Danger zone
      </h2>
      <p className="admin-muted">
        Deleting the trip removes it for everyone, along with all cars and gear.
        This can&apos;t be undone.
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
