import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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

const STEP_TITLES = [
  "Plan the climb",
  "Pack the rack",
  "Sign on as belayer-in-chief",
];
const STEP_TAGS = [
  "Base camp · 1 of 3",
  "Gear locker · 2 of 3",
  "Rope captain · 3 of 3",
];

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Strong custom easing per emil-design-eng skill — punchier than the
// CSS default ease-out. Used as the default for everything entering.
const EASE_OUT = [0.23, 1, 0.32, 1];

export default function OrganizerWizard({ onComplete, onCancel }) {
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

  const reduceMotion = useReducedMotion();
  const today = useMemo(todayISO, []);

  // Keep end >= start as the user edits. If they pick a start that's
  // after the current end, snap end forward. If they try to pick an
  // end before start, snap it up.
  const onStartChange = (value) => {
    setStartDate(value);
    if (value && endDate && endDate < value) setEndDate(value);
  };
  const onEndChange = (value) => {
    if (value && startDate && value < startDate) {
      // Hard guard — should be unreachable via picker thanks to `min`
      setEndDate(startDate);
      return;
    }
    setEndDate(value);
  };

  const datesValid =
    !startDate || !endDate || endDate >= startDate;

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
      onComplete({
        trip_id: res.trip_id,
        organizer_user_id: res.organizer_user_id,
        location: location.trim(),
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Stagger preset for forms: each child fades up by 12px, 60ms apart.
  const stagger = reduceMotion
    ? { hidden: {}, show: {} }
    : {
        hidden: { opacity: 0 },
        show: {
          opacity: 1,
          transition: { staggerChildren: 0.06, delayChildren: 0.08 },
        },
      };
  const item = reduceMotion
    ? { hidden: {}, show: {} }
    : {
        hidden: { opacity: 0, y: 12 },
        show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: EASE_OUT } },
      };

  return (
    <div className="app-shell">
      <div className="content">
        <motion.div
          className="row between"
          initial={reduceMotion ? false : { opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: EASE_OUT }}
        >
          <div className="h1">{STEP_TITLES[step]}</div>
          {onCancel && (
            <button className="ghost" onClick={onCancel}>
              Cancel
            </button>
          )}
        </motion.div>
        <motion.p
          className="step-tag"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.32, delay: 0.06, ease: EASE_OUT }}
          key={`tag-${step}`}
        >
          {STEP_TAGS[step]}
        </motion.p>

        {error && <div className="error-banner">{error}</div>}

        <AnimatePresence mode="wait" initial={false}>
          {step === 0 && (
            <motion.div
              key="step-0"
              className="col"
              variants={stagger}
              initial="hidden"
              animate="show"
              exit={reduceMotion ? undefined : { opacity: 0, x: -24, transition: { duration: 0.2 } }}
            >
              <motion.div variants={item}>
                <label>Where are we climbing? *</label>
                <input
                  placeholder="e.g. Yosemite Valley"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </motion.div>

              <motion.div variants={item} className="date-row">
                <div className="date-row__field">
                  <label>From</label>
                  <input
                    type="date"
                    min={today}
                    value={startDate}
                    onChange={(e) => onStartChange(e.target.value)}
                  />
                </div>
                <div className="date-row__field">
                  <label>To</label>
                  <input
                    type="date"
                    min={startDate || today}
                    value={endDate}
                    onChange={(e) => onEndChange(e.target.value)}
                  />
                </div>
              </motion.div>
              {!datesValid && (
                <div className="inline-warn">
                  End date can't be before the start. We bumped it for you.
                </div>
              )}

              <motion.div variants={item}>
                <label>Where do we sleep?</label>
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
              </motion.div>
              <motion.div variants={item}>
                <label>Drop the address (or a link)</label>
                <input
                  placeholder="Name, address, link…"
                  value={accomDetails}
                  onChange={(e) => setAccomDetails(e.target.value)}
                />
              </motion.div>
              <motion.div variants={item}>
                <label>Field notes (optional)</label>
                <textarea
                  rows={3}
                  placeholder="Approach, beta, who's bringing the espresso…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </motion.div>
              <motion.button
                variants={item}
                className="btn-3d"
                disabled={!location.trim() || !datesValid}
                onClick={() => setStep(1)}
                whileTap={reduceMotion ? undefined : { scale: 0.97 }}
              >
                Next · Pack the rack →
              </motion.button>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              key="step-1"
              className="col"
              variants={stagger}
              initial="hidden"
              animate="show"
              exit={reduceMotion ? undefined : { opacity: 0, x: -24, transition: { duration: 0.2 } }}
            >
              <motion.p variants={item} className="muted">
                What kit are we asking each climber to bring? Add as many
                categories as you need — ropes, draws, stove, snacks…
              </motion.p>
              {categories.map((cat, ci) => (
                <motion.div className="card" key={ci} variants={item}>
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
                                e.target.value
                                  .toLowerCase()
                                  .replace(/\s+/g, "_"),
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
                </motion.div>
              ))}
              <motion.button
                variants={item}
                className="secondary"
                onClick={() =>
                  setCategories([...categories, { name: "", fields: [] }])
                }
              >
                + Add category
              </motion.button>
              <motion.div variants={item} className="row" style={{ marginTop: 10 }}>
                <button className="secondary" onClick={() => setStep(0)}>
                  Back
                </button>
                <motion.button
                  className="btn-3d"
                  onClick={() => setStep(2)}
                  style={{ flex: 1 }}
                  whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                >
                  Next · Sign on →
                </motion.button>
              </motion.div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step-2"
              className="col"
              variants={stagger}
              initial="hidden"
              animate="show"
              exit={reduceMotion ? undefined : { opacity: 0, x: -24, transition: { duration: 0.2 } }}
            >
              <motion.p variants={item} className="muted">
                You're the rope captain — the trip lives on your account.
                What should the squad call you?
              </motion.p>
              <motion.input
                variants={item}
                placeholder="Your name"
                value={organizerName}
                onChange={(e) => setOrganizerName(e.target.value)}
              />
              <motion.div variants={item} className="row">
                <button className="secondary" onClick={() => setStep(1)}>
                  Back
                </button>
                <motion.button
                  className="btn-3d"
                  disabled={!organizerName.trim() || submitting}
                  onClick={submit}
                  style={{ flex: 1 }}
                  whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                >
                  {submitting ? "Pitching the tent…" : "Send it →"}
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
