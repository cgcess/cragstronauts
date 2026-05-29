import React, { useState } from "react";
import { useOutletContext } from "react-router";
import { api } from "../api.js";
import Linkify from "../components/Linkify.jsx";
import { useTripContext } from "../context/TripContext.jsx";

export default function InfoTab() {
  const { tripId, trip, users, categories, currentUserId, deleteTrip } = useTripContext();
  const { reload: onChanged } = useOutletContext();

  const me = users.find((u) => u.id === currentUserId);
  const isOrganizer = me?.is_organizer;

  const joining = users.filter((u) => u.joining);
  const notJoining = users.filter((u) => !u.joining);
  const [addingCat, setAddingCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");

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

  // Edit trip details (organizer)
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState(null);
  const [form, setForm] = useState(null);

  const startEdit = () => {
    setEditError(null);
    setForm({
      location: trip.location || "",
      start_date: trip.start_date || "",
      end_date: trip.end_date || "",
      accommodation_type: trip.accommodation_type || "campsite",
      accommodation_details: trip.accommodation_details || "",
      notes: trip.notes || "",
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    setEditError(null);
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
      setEditing(false);
      await onChanged();
    } catch (e) {
      setEditError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div>
        <div className="h1">Edit trip</div>
        {editError && <div className="error-banner">{editError}</div>}
        <div className="card">
          <div className="col">
            <div>
              <label>Climbing location *</label>
              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="e.g. Yosemite Valley"
              />
            </div>
            <div className="row">
              <div style={{ flex: 1 }}>
                <label>Start</label>
                <input
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
              <div style={{ flex: 1 }}>
                <label>End</label>
                <input
                  type="date"
                  min={form.start_date || undefined}
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label>Accommodation</label>
              <select
                value={form.accommodation_type}
                onChange={(e) => setForm({ ...form, accommodation_type: e.target.value })}
              >
                <option value="campsite">Campsite</option>
                <option value="airbnb">Airbnb</option>
                <option value="hotel">Hotel</option>
                <option value="hut">Hut / Refuge</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label>Accommodation details</label>
              <input
                value={form.accommodation_details}
                onChange={(e) => setForm({ ...form, accommodation_details: e.target.value })}
                placeholder="Name, address, link…"
              />
            </div>
            <div>
              <label>Notes</label>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <div className="row" style={{ marginTop: 4 }}>
              <button className="secondary" onClick={() => setEditing(false)} disabled={saving}>
                Cancel
              </button>
              <button
                style={{ flex: 1 }}
                disabled={!form.location.trim() || saving}
                onClick={saveEdit}
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
          <button className="secondary" onClick={startEdit}>
            Edit trip details
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
      {isOrganizer && deleteTrip && (
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
                await deleteTrip();
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
                    await api.addCategory(tripId, { name: newCatName.trim(), fields: [] });
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
