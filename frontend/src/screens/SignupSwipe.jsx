import React, { useMemo, useState } from "react";
import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import { api } from "../api.js";

// Build the question list from gear categories
function buildQuestions(categories) {
  const qs = [
    {
      id: "joining",
      title: "Are you joining the trip?",
      sub: "Swipe right for yes, left for no.",
    },
  ];
  for (const c of categories) {
    qs.push({
      id: `gear:${c.id}`,
      title: `Are you bringing a ${c.name.toLowerCase()}?`,
      sub: c.fields.length
        ? "If yes, we'll ask for details."
        : "Swipe right if you'll bring one.",
      kind: "gear",
      category: c,
    });
  }
  qs.push({
    id: "driving",
    title: "Are you driving?",
    sub: "If yes, we'll ask how many seats.",
    kind: "driving",
  });
  return qs;
}

export default function SignupSwipe({ trip, categories, userId, onComplete }) {
  const questions = useMemo(() => buildQuestions(categories), [categories]);
  const [idx, setIdx] = useState(0);
  const [details, setDetails] = useState(null); // for showing detail form
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  // answers shape:
  // { joining: bool, driving: {seats}|null, gear: { [catId]: details|null } }
  const [answers, setAnswers] = useState({ joining: true, driving: null, gear: {} });

  const q = questions[idx];

  const persistAnswer = async (qq, yes, extra) => {
    setError(null);
    setSubmitting(true);
    try {
      // "joining" question: user is created with joining=true; nothing to persist on yes,
      // and the no-path is handled above by short-circuiting to onComplete.
      if (qq.kind === "gear" && yes) {
        await api.addGear({
          user_id: userId,
          category_id: qq.category.id,
          details: extra || {},
        });
      }
      if (qq.kind === "driving" && yes) {
        await api.createCar({
          driver_user_id: userId,
          total_seats: Number(extra?.seats || 1),
          notes: extra?.notes || null,
        });
      }
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setSubmitting(false);
    }
  };

  const next = () => {
    if (idx + 1 >= questions.length) {
      onComplete();
    } else {
      setIdx(idx + 1);
    }
  };

  const handleAnswer = async (yes) => {
    // If yes and the question has follow-up details, open the detail form
    if (yes && q.kind === "gear" && q.category.fields.length) {
      setDetails({ kind: "gear", category: q.category, values: {} });
      return;
    }
    if (yes && q.kind === "driving") {
      setDetails({ kind: "driving", values: { seats: 4 } });
      return;
    }
    if (q.id === "joining" && !yes) {
      try {
        await api.updateUser(userId, { joining: false });
      } catch (e) {
        setError(e.message);
      }
      onComplete();
      return;
    }
    try {
      await persistAnswer(q, yes, null);
      next();
    } catch {}
  };

  const submitDetails = async () => {
    try {
      await persistAnswer(q, true, details.values);
      setDetails(null);
      next();
    } catch {}
  };

  if (!q) {
    return null;
  }

  return (
    <div className="app-shell">
      <div className="content" style={{ display: "flex", flexDirection: "column" }}>
        <div className="row between">
          <div className="pill">
            {idx + 1} / {questions.length}
          </div>
          <button className="ghost" onClick={onComplete}>
            Skip
          </button>
        </div>

        {error && <div className="error-banner" style={{ marginTop: 12 }}>{error}</div>}

        <div className="deck">
          <AnimatePresence>
            {!details && (
              <SwipeCard
                key={q.id}
                question={q}
                onAnswer={handleAnswer}
                disabled={submitting}
              />
            )}
          </AnimatePresence>
        </div>

        {details && (
          <DetailForm
            details={details}
            setDetails={setDetails}
            onCancel={() => setDetails(null)}
            onSubmit={submitDetails}
            submitting={submitting}
          />
        )}
      </div>
    </div>
  );
}

function SwipeCard({ question, onAnswer, disabled }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-18, 18]);
  const yesOp = useTransform(x, [0, 120], [0, 1]);
  const noOp = useTransform(x, [-120, 0], [1, 0]);

  const onDragEnd = (_, info) => {
    if (info.offset.x > 120) onAnswer(true);
    else if (info.offset.x < -120) onAnswer(false);
  };

  return (
    <motion.div
      className="swipe-card"
      style={{ x, rotate }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={onDragEnd}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ x: 400, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <motion.div className="stamp yes" style={{ opacity: yesOp }}>
        Yes
      </motion.div>
      <motion.div className="stamp no" style={{ opacity: noOp }}>
        No
      </motion.div>

      <div className="q-title">{question.title}</div>
      <div className="q-sub">{question.sub}</div>

      <div className="hint-row">
        <span className="no">← Swipe no</span>
        <span className="yes">Swipe yes →</span>
      </div>

      <div className="swipe-actions">
        <button
          className="circle no"
          disabled={disabled}
          onClick={() => onAnswer(false)}
          aria-label="No"
        >
          ✕
        </button>
        <button
          className="circle yes"
          disabled={disabled}
          onClick={() => onAnswer(true)}
          aria-label="Yes"
        >
          ✓
        </button>
      </div>
    </motion.div>
  );
}

function DetailForm({ details, setDetails, onCancel, onSubmit, submitting }) {
  if (details.kind === "gear") {
    return (
      <div className="card" style={{ marginTop: 16 }}>
        <div className="h2">Tell us about your {details.category.name.toLowerCase()}</div>
        <div className="col">
          {details.category.fields.map((f) => (
            <div key={f.key}>
              <label>{f.label}</label>
              <input
                type={f.type === "number" ? "number" : "text"}
                value={details.values[f.key] ?? ""}
                onChange={(e) =>
                  setDetails({
                    ...details,
                    values: { ...details.values, [f.key]: e.target.value },
                  })
                }
              />
            </div>
          ))}
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="secondary" onClick={onCancel}>
            Cancel
          </button>
          <button onClick={onSubmit} disabled={submitting} style={{ flex: 1 }}>
            {submitting ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    );
  }
  if (details.kind === "driving") {
    return (
      <div className="card" style={{ marginTop: 16 }}>
        <div className="h2">Your car</div>
        <div className="col">
          <div>
            <label>Total seats (including driver)</label>
            <input
              type="number"
              min={1}
              value={details.values.seats}
              onChange={(e) =>
                setDetails({
                  ...details,
                  values: { ...details.values, seats: e.target.value },
                })
              }
            />
          </div>
          <div>
            <label>Notes (optional)</label>
            <input
              placeholder="e.g. leaving Friday 5pm"
              value={details.values.notes || ""}
              onChange={(e) =>
                setDetails({
                  ...details,
                  values: { ...details.values, notes: e.target.value },
                })
              }
            />
          </div>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="secondary" onClick={onCancel}>
            Cancel
          </button>
          <button onClick={onSubmit} disabled={submitting} style={{ flex: 1 }}>
            {submitting ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    );
  }
  return null;
}
