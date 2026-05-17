import React, { useState } from "react";
import { api } from "../api.js";

const defaultCategories = [
  {
    name: "Rope",
    fields: [
      { key: "length", label: "Length (m)", type: "number" },
      { key: "diameter", label: "Diameter (mm)", type: "number" },
    ],
  },
  {
    name: "Quickdraws",
    fields: [{ key: "count", label: "How many", type: "number" }],
  },
];

export default function OrganizerWizard({ onComplete }) {
  const [step, setStep] = useState(0);
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [accomType, setAccomType] = useState("campsite");
  const [accomDetails, setAccomDetails] = useState("");
  const [notes, setNotes] = useState("");
  const [categories, setCategories] = useState(defaultCategories);
  const [organizerName, setOrganizerName] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.createTrip({
        location: location.trim(),
        start_date: startDate || null,
        end_date: endDate || null,
        accommodation_type: accomType,
        accommodation_details: accomDetails.trim() || null,
        notes: notes.trim() || null,
        organizer_name: organizerName.trim(),
        gear_categories: categories
          .filter((c) => c.name.trim())
          .map((c) => ({
            name: c.name.trim(),
            fields: c.fields.filter((f) => f.key.trim() && f.label.trim()),
          })),
      });
      onComplete(res.organizer_user_id);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app-shell">
      <div className="content">
        <div className="h1">Set up the trip</div>
        <p className="muted">Step {step + 1} of 3</p>

        {error && <div className="error-banner">{error}</div>}

        {step === 0 && (
          <div className="col">
            <div>
              <label>Climbing location *</label>
              <input
                placeholder="e.g. Bishop, CA"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="row">
              <div style={{ flex: 1 }}>
                <label>Start</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label>End</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label>Accommodation</label>
              <select
                value={accomType}
                onChange={(e) => setAccomType(e.target.value)}
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
                placeholder="Name, address, link…"
                value={accomDetails}
                onChange={(e) => setAccomDetails(e.target.value)}
              />
            </div>
            <div>
              <label>Notes (optional)</label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <button
              disabled={!location.trim()}
              onClick={() => setStep(1)}
            >
              Next: Gear categories
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="col">
            <p className="muted">
              Define the categories of gear (rope, draws, etc.) and what to ask
              each person.
            </p>
            {categories.map((cat, ci) => (
              <div className="card" key={ci}>
                <div className="row between">
                  <input
                    value={cat.name}
                    placeholder="Category name"
                    onChange={(e) => {
                      const next = [...categories];
                      next[ci] = { ...cat, name: e.target.value };
                      setCategories(next);
                    }}
                  />
                  <button
                    className="ghost"
                    onClick={() =>
                      setCategories(categories.filter((_, i) => i !== ci))
                    }
                  >
                    Remove
                  </button>
                </div>
                <div style={{ marginTop: 10 }}>
                  <label>Fields to ask</label>
                  {cat.fields.map((f, fi) => (
                    <div className="field-builder-row" key={fi}>
                      <input
                        placeholder="Label (e.g. Length)"
                        value={f.label}
                        onChange={(e) => {
                          const next = [...categories];
                          const fields = [...cat.fields];
                          fields[fi] = {
                            ...f,
                            label: e.target.value,
                            key:
                              f.key ||
                              e.target.value.toLowerCase().replace(/\s+/g, "_"),
                          };
                          next[ci] = { ...cat, fields };
                          setCategories(next);
                        }}
                      />
                      <select
                        value={f.type}
                        onChange={(e) => {
                          const next = [...categories];
                          const fields = [...cat.fields];
                          fields[fi] = { ...f, type: e.target.value };
                          next[ci] = { ...cat, fields };
                          setCategories(next);
                        }}
                      >
                        <option value="text">Text</option>
                        <option value="number">Number</option>
                      </select>
                      <button
                        className="ghost"
                        onClick={() => {
                          const next = [...categories];
                          next[ci] = {
                            ...cat,
                            fields: cat.fields.filter((_, i) => i !== fi),
                          };
                          setCategories(next);
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    className="secondary"
                    onClick={() => {
                      const next = [...categories];
                      next[ci] = {
                        ...cat,
                        fields: [
                          ...cat.fields,
                          { key: "", label: "", type: "text" },
                        ],
                      };
                      setCategories(next);
                    }}
                  >
                    + Add field
                  </button>
                </div>
              </div>
            ))}
            <button
              className="secondary"
              onClick={() =>
                setCategories([...categories, { name: "", fields: [] }])
              }
            >
              + Add category
            </button>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="secondary" onClick={() => setStep(0)}>
                Back
              </button>
              <button onClick={() => setStep(2)} style={{ flex: 1 }}>
                Next: Your name
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="col">
            <p className="muted">
              You're the organizer. What's your name?
            </p>
            <input
              placeholder="Your name"
              value={organizerName}
              onChange={(e) => setOrganizerName(e.target.value)}
            />
            <div className="row">
              <button className="secondary" onClick={() => setStep(1)}>
                Back
              </button>
              <button
                disabled={!organizerName.trim() || submitting}
                onClick={submit}
                style={{ flex: 1 }}
              >
                {submitting ? "Creating…" : "Create trip"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
