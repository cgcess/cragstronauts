import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useOutletContext } from "react-router";
import { api } from "../api";
import DateRangePicker from "../components/DateRangePicker";
import Linkify from "../components/Linkify";
import { useTripContext, type Category } from "../context/TripContext";
import { formatDateRange } from "../dateUtils";
import type { TabsOutletContext } from "./TabsLayout";

// Same local-date helpers used by the new-trip wizard, so the inline
// edit picker round-trips the YYYY-MM-DD strings the API expects
// without timezone drift.
function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function isoToDate(iso: string | undefined): Date | undefined {
  if (!iso) return undefined;
  return new Date(`${iso}T00:00:00`);
}

type GearField = { key: string; label: string; type: string };
type EditableCategory = { id: number | null; name: string; fields: GearField[] };

type EditForm = {
  location: string;
  start_date: string;
  end_date: string;
  accommodation_type: string;
  accommodation_details: string;
  notes: string;
  categories: EditableCategory[];
  removedCategoryIds: number[];
};

const removeBtnStyle: CSSProperties = {
  padding: "6px 12px",
  fontSize: 13,
  color: "var(--danger)",
  borderColor: "var(--danger)",
};

const fieldXBtnStyle: CSSProperties = {
  padding: "4px 8px",
  fontSize: 13,
  color: "var(--brown-600)",
};

function snapshotCategories(cats: Category[]): EditableCategory[] {
  return cats.map((c) => ({
    id: c.id,
    name: c.name,
    fields: c.fields.map((f) => ({ ...f })),
  }));
}

function serializeCategories(cats: EditableCategory[]): string {
  return JSON.stringify(
    cats.map((c) => ({
      id: c.id,
      name: c.name,
      fields: c.fields.map((f) => ({
        key: f.key,
        label: f.label,
        type: f.type,
      })),
    })),
  );
}

function editFormIsDirty(
  form: EditForm | null,
  baseline: EditForm | null,
): boolean {
  if (!form || !baseline) return false;
  if (form.removedCategoryIds.length > 0) return true;
  if (
    form.location !== baseline.location ||
    form.start_date !== baseline.start_date ||
    form.end_date !== baseline.end_date ||
    form.accommodation_type !== baseline.accommodation_type ||
    form.accommodation_details !== baseline.accommodation_details ||
    form.notes !== baseline.notes
  ) {
    return true;
  }
  return serializeCategories(form.categories) !== serializeCategories(baseline.categories);
}

export default function InfoTab() {
  const {
    tripId,
    trip,
    users,
    categories,
    currentUserId,
    deleteTrip,
  } = useTripContext();
  const { reload, setEditMode } = useOutletContext<TabsOutletContext>();

  const me = users.find((u) => u.id === currentUserId);
  const isOrganizer = !!me?.is_organizer;

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

  // Inline edit mode (organizer only)
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);

  // Refs let the stable cancel/save callbacks read the latest state
  // without changing identity, so registering with the tabbar's edit
  // actions doesn't loop.
  const formRef = useRef<EditForm | null>(form);
  formRef.current = form;
  const baselineRef = useRef<EditForm | null>(null);
  const originalCategoriesRef = useRef<EditableCategory[]>([]);

  const startEdit = () => {
    setError(null);
    originalCategoriesRef.current = snapshotCategories(categories);
    const baseline: EditForm = {
      location: trip.location || "",
      start_date: trip.start_date || "",
      end_date: trip.end_date || "",
      accommodation_type: trip.accommodation_type || "campsite",
      accommodation_details: trip.accommodation_details || "",
      notes: trip.notes || "",
      categories: snapshotCategories(categories),
      removedCategoryIds: [],
    };
    baselineRef.current = baseline;
    setForm({
      ...baseline,
      categories: baseline.categories.map((c) => ({
        ...c,
        fields: c.fields.map((f) => ({ ...f })),
      })),
    });
    setEditing(true);
  };

  const stableCancel = useCallback(() => {
    setEditing(false);
    setError(null);
    setForm(null);
    baselineRef.current = null;
  }, []);

  const stableSave = useCallback(async () => {
    const f = formRef.current;
    if (!f) return;
    setError(null);
    setSaving(true);
    try {
      await api.updateTrip(tripId, {
        location: f.location.trim(),
        start_date: f.start_date || null,
        end_date: f.end_date || null,
        accommodation_type: f.accommodation_type,
        accommodation_details: f.accommodation_details.trim() || null,
        notes: f.notes.trim() || null,
      });

      // Delete categories the organizer removed during this edit session.
      for (const id of f.removedCategoryIds) {
        await api.deleteCategory(tripId, id);
      }

      // Upsert categories: create new ones (no id), update existing ones
      // that diverge from the snapshot taken at startEdit.
      const originals = new Map(
        originalCategoriesRef.current.map((c) => [c.id, c]),
      );
      for (const c of f.categories) {
        const name = c.name.trim();
        if (!name) continue;
        const cleanFields: GearField[] = c.fields
          .filter((field) => field.label.trim())
          .map((field) => ({
            key:
              field.key.trim() ||
              field.label.trim().toLowerCase().replace(/\s+/g, "_"),
            label: field.label.trim(),
            type: field.type || "text",
          }));
        if (c.id == null) {
          await api.addCategory(tripId, { name, fields: cleanFields });
        } else {
          const orig = originals.get(c.id);
          const fieldsChanged =
            !orig ||
            JSON.stringify(orig.fields) !== JSON.stringify(cleanFields);
          const nameChanged = !orig || orig.name !== name;
          if (nameChanged || fieldsChanged) {
            await api.updateCategory(tripId, c.id, {
              name,
              fields: cleanFields,
            });
          }
        }
      }

      await reload();
      setEditing(false);
      setForm(null);
      baselineRef.current = null;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [tripId, reload]);

  // Register edit mode with TabsLayout so its bottom action row can render
  // Cancel/Save in place of the tabbar.
  useEffect(() => {
    if (!editing) {
      setEditMode(null);
      return;
    }
    setEditMode({
      onCancel: stableCancel,
      onSave: stableSave,
      canSave: !!form?.location?.trim() && !saving,
      saving,
      isDirty: editFormIsDirty(form, baselineRef.current),
    });
    return () => setEditMode(null);
  }, [
    editing,
    saving,
    form,
    stableCancel,
    stableSave,
    setEditMode,
  ]);

  const removeMember = async (userId: number, userName: string) => {
    setError(null);
    try {
      let warning = "";
      try {
        const [cars, gear] = await Promise.all([
          api.listCars(tripId),
          api.listGear(tripId),
        ]);
        const hasCar = cars.some((c) => c.driver_user_id === userId);
        const hasGear = gear.some((g) => g.user_id === userId);
        if (hasCar && hasGear) {
          warning =
            "\n\nThey have a car and gear contributions that will also be removed.";
        } else if (hasCar) {
          warning = "\n\nThey have a car that will also be removed.";
        } else if (hasGear) {
          warning = "\n\nThey have gear contributions that will also be removed.";
        }
      } catch {
        // best-effort warning; proceed even if listing fails
      }
      if (!confirm(`Remove ${userName} from the trip?${warning}`)) return;
      await api.deleteUser(tripId, userId);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const confirmDeleteTrip = async () => {
    if (confirm(`Delete the "${trip.location}" trip? This can't be undone.`)) {
      await deleteTrip();
    }
  };

  // Helpers for the in-edit categories editor
  const setCategoryAt = (
    ci: number,
    updater: (c: EditableCategory) => EditableCategory,
  ) => {
    setForm((f) => {
      if (!f) return f;
      const next = [...f.categories];
      next[ci] = updater(next[ci]);
      return { ...f, categories: next };
    });
  };

  const removeCategoryAt = (ci: number) => {
    setForm((f) => {
      if (!f) return f;
      const target = f.categories[ci];
      const next = f.categories.filter((_, i) => i !== ci);
      const removed =
        target.id != null
          ? [...f.removedCategoryIds, target.id]
          : f.removedCategoryIds;
      return { ...f, categories: next, removedCategoryIds: removed };
    });
  };

  const addBlankCategory = () => {
    setForm((f) =>
      f
        ? {
            ...f,
            categories: [...f.categories, { id: null, name: "", fields: [] }],
          }
        : f,
    );
  };

  return (
    <div>
      <div className="h1">📍 {trip.location}</div>
      {(trip.start_date || trip.end_date) && (
        <p className="muted">
          {formatDateRange(trip.start_date, trip.end_date)}
        </p>
      )}

      <div className="row" style={{ gap: 8, marginBottom: 8 }}>
        <button className="secondary" onClick={shareLink}>
          {copied ? "Link copied ✓" : "Share trip link"}
        </button>
        {isOrganizer && !editing && (
          <button className="secondary" onClick={startEdit}>
            ✏️ Edit
          </button>
        )}
      </div>

      {editing && error && <div className="error-banner">{error}</div>}

      {/* Trip details — editable when in edit mode */}
      {editing && form && (
        <div className="card">
          <div className="h2" style={{ marginTop: 0 }}>Trip details</div>
          <div className="col">
            <div>
              <label>Climbing location *</label>
              <input
                value={form.location}
                onChange={(e) =>
                  setForm((f) => (f ? { ...f, location: e.target.value } : f))
                }
                placeholder="e.g. Yosemite Valley"
              />
            </div>
            <div>
              <label>When</label>
              <DateRangePicker
                value={{
                  from: isoToDate(form.start_date || undefined),
                  to: isoToDate(form.end_date || undefined),
                }}
                onChange={(r) =>
                  setForm((f) =>
                    f
                      ? {
                          ...f,
                          start_date: r?.from ? toLocalISO(r.from) : "",
                          end_date: r?.to ? toLocalISO(r.to) : "",
                        }
                      : f,
                  )
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* Accommodation card */}
      <div className="card">
        <div className="h2" style={{ marginTop: 0 }}>Accommodation</div>
        {editing && form ? (
          <div className="col">
            <div>
              <label>Type</label>
              <select
                value={form.accommodation_type}
                onChange={(e) =>
                  setForm((f) =>
                    f ? { ...f, accommodation_type: e.target.value } : f,
                  )
                }
              >
                <option value="campsite">Campsite</option>
                <option value="airbnb">Airbnb</option>
                <option value="hotel">Hotel</option>
                <option value="hut">Hut / Refuge</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label>Details</label>
              <input
                value={form.accommodation_details}
                onChange={(e) =>
                  setForm((f) =>
                    f ? { ...f, accommodation_details: e.target.value } : f,
                  )
                }
                placeholder="Name, address, link…"
              />
            </div>
          </div>
        ) : (
          <>
            <div className="row between">
              <span className="pill accent">
                {trip.accommodation_type || "—"}
              </span>
            </div>
            {trip.accommodation_details && (
              <p style={{ marginTop: 8 }}>
                <Linkify>{trip.accommodation_details}</Linkify>
              </p>
            )}
          </>
        )}
      </div>

      {/* Notes card */}
      {(editing || trip.notes) && (
        <div className="card">
          <div className="h2" style={{ marginTop: 0 }}>Notes</div>
          {editing && form ? (
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) =>
                setForm((f) => (f ? { ...f, notes: e.target.value } : f))
              }
              placeholder="Crag info, links, things to remember…"
            />
          ) : (
            <p>
              <Linkify>{trip.notes ?? ""}</Linkify>
            </p>
          )}
        </div>
      )}

      <div className="h2">Roster ({joining.length})</div>
      {joining.map((u) => (
        <div className="list-item" key={u.id}>
          <span>
            {u.name} {u.is_organizer && "👑"}
          </span>
          <span className="row" style={{ gap: 8, alignItems: "center" }}>
            <span className="pill accent">Going</span>
            {editing && !u.is_organizer && (
              <button
                className="secondary"
                style={removeBtnStyle}
                onClick={() => removeMember(u.id, u.name)}
              >
                Remove
              </button>
            )}
          </span>
        </div>
      ))}
      {notJoining.length > 0 && (
        <>
          <div className="muted" style={{ marginTop: 8 }}>Not joining</div>
          {notJoining.map((u) => (
            <div className="list-item" key={u.id}>
              <span>{u.name}</span>
              <span className="row" style={{ gap: 8, alignItems: "center" }}>
                <span className="pill">Out</span>
                {editing && !u.is_organizer && (
                  <button
                    className="secondary"
                    style={removeBtnStyle}
                    onClick={() => removeMember(u.id, u.name)}
                  >
                    Remove
                  </button>
                )}
              </span>
            </div>
          ))}
        </>
      )}

      <div className="h2">Gear categories</div>
      {!editing &&
        categories.map((c) => (
          <div className="list-item" key={c.id}>
            <span>{c.name}</span>
            <span className="muted">
              {c.fields.map((f) => f.label).join(", ") || "no fields"}
            </span>
          </div>
        ))}
      {editing && form &&
        form.categories.map((cat, ci) => (
          <div className="card" key={cat.id ?? `new-${ci}`}>
            <div className="row between" style={{ alignItems: "center" }}>
              <input
                value={cat.name}
                placeholder="Category name"
                onChange={(e) =>
                  setCategoryAt(ci, (c) => ({ ...c, name: e.target.value }))
                }
                style={{ flex: 1, marginRight: 8 }}
              />
              <button
                className="secondary"
                style={removeBtnStyle}
                onClick={() => removeCategoryAt(ci)}
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
                    onChange={(e) =>
                      setCategoryAt(ci, (c) => {
                        const fields = [...c.fields];
                        fields[fi] = {
                          ...f,
                          label: e.target.value,
                          key:
                            f.key ||
                            e.target.value
                              .toLowerCase()
                              .replace(/\s+/g, "_"),
                        };
                        return { ...c, fields };
                      })
                    }
                  />
                  <select
                    value={f.type}
                    onChange={(e) =>
                      setCategoryAt(ci, (c) => {
                        const fields = [...c.fields];
                        fields[fi] = { ...f, type: e.target.value };
                        return { ...c, fields };
                      })
                    }
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                  </select>
                  <button
                    className="ghost"
                    style={fieldXBtnStyle}
                    onClick={() =>
                      setCategoryAt(ci, (c) => ({
                        ...c,
                        fields: c.fields.filter((_, i) => i !== fi),
                      }))
                    }
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                className="secondary"
                style={{ padding: "6px 12px", fontSize: 13 }}
                onClick={() =>
                  setCategoryAt(ci, (c) => ({
                    ...c,
                    fields: [
                      ...c.fields,
                      { key: "", label: "", type: "text" },
                    ],
                  }))
                }
              >
                + Add field
              </button>
            </div>
          </div>
        ))}
      {editing && (
        <button
          className="secondary"
          style={{ marginTop: 8 }}
          onClick={addBlankCategory}
        >
          + Add gear category
        </button>
      )}

      {/* Danger zone (organizer only, in edit mode) */}
      {editing && (
        <div
          className="card"
          style={{ marginTop: 20, borderColor: "var(--danger)" }}
        >
          <div className="h2" style={{ marginTop: 0, color: "var(--danger)" }}>
            Danger zone
          </div>
          <p className="muted" style={{ fontSize: 13 }}>
            Deleting the trip removes it for everyone, along with all cars and gear.
          </p>
          <button
            className="secondary"
            style={removeBtnStyle}
            onClick={confirmDeleteTrip}
          >
            Delete trip
          </button>
        </div>
      )}
    </div>
  );
}
