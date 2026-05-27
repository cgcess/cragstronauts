import React, { useState } from "react";
import { api } from "../api.js";

export default function GearTab({ tripId, trip, categories, gear, currentUserId, onChanged }) {
  const [addingFor, setAddingFor] = useState(null); // category id
  const [values, setValues] = useState({});
  const [error, setError] = useState(null);

  const byCat = {};
  for (const c of categories) byCat[c.id] = [];
  for (const g of gear) {
    if (byCat[g.category_id]) byCat[g.category_id].push(g);
  }

  const addContribution = async (cat) => {
    setError(null);
    try {
      await api.addGear(tripId, {
        user_id: currentUserId,
        category_id: cat.id,
        details: values,
      });
      setAddingFor(null);
      setValues({});
      onChanged();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div>
      <div className="h1">🎒 Gear</div>
      {error && <div className="error-banner">{error}</div>}

      {categories.length === 0 && (
        <p className="muted">No gear categories yet. Organizer can add some from Info tab.</p>
      )}

      {categories.map((cat) => (
        <div className="card" key={cat.id}>
          <div className="row between">
            <div className="h2" style={{ marginTop: 0 }}>{cat.name}</div>
            <span className="pill">{byCat[cat.id].length}</span>
          </div>

          {byCat[cat.id].length === 0 && (
            <p className="muted" style={{ fontSize: 14 }}>Nobody's bringing one yet.</p>
          )}
          {byCat[cat.id].map((g) => (
            <div className="list-item" key={g.id}>
              <div>
                <div>{g.user_name}</div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {Object.entries(g.details)
                    .map(([k, v]) => `${labelFor(cat, k)}: ${v}`)
                    .join(" · ") || "—"}
                </div>
              </div>
              {g.user_id === currentUserId && (
                <button
                  className="ghost"
                  style={{ color: "var(--danger)" }}
                  onClick={async () => {
                    await api.deleteGear(tripId, g.id);
                    onChanged();
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}

          {addingFor === cat.id ? (
            <div style={{ marginTop: 10 }}>
              {cat.fields.length === 0 && (
                <p className="muted" style={{ fontSize: 13 }}>
                  No fields to fill — just tap save.
                </p>
              )}
              {cat.fields.map((f) => (
                <div key={f.key} style={{ marginBottom: 8 }}>
                  <label>{f.label}</label>
                  <input
                    type={f.type === "number" ? "number" : "text"}
                    value={values[f.key] ?? ""}
                    onChange={(e) =>
                      setValues({ ...values, [f.key]: e.target.value })
                    }
                  />
                </div>
              ))}
              <div className="row">
                <button
                  className="secondary"
                  onClick={() => {
                    setAddingFor(null);
                    setValues({});
                  }}
                >
                  Cancel
                </button>
                <button onClick={() => addContribution(cat)} style={{ flex: 1 }}>
                  Save
                </button>
              </div>
            </div>
          ) : (
            <button
              className="secondary"
              onClick={() => {
                setAddingFor(cat.id);
                setValues({});
              }}
              style={{ marginTop: 10 }}
            >
              + I'm bringing one
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function labelFor(cat, key) {
  const f = cat.fields.find((f) => f.key === key);
  return f ? f.label : key;
}
