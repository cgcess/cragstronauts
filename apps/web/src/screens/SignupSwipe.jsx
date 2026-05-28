import React, { useEffect, useMemo, useState } from "react";
import { animate, motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
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

export default function SignupSwipe({ tripId, trip, categories, userId, onComplete, onNotJoining }) {
  const questions = useMemo(() => buildQuestions(categories), [categories]);
  const [idx, setIdx] = useState(0);
  const [details, setDetails] = useState(null); // for showing detail form
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [exitDir, setExitDir] = useState(null); // "left" | "right" — drives exit animation
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
        await api.addGear(tripId, {
          user_id: userId,
          category_id: qq.category.id,
          details: extra || {},
        });
      }
      if (qq.kind === "driving" && yes) {
        await api.createCar(tripId, {
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
        await api.deleteUser(tripId, userId);
      } catch (e) {
        setError(e.message);
        return;
      }
      onNotJoining();
      return;
    }
    setExitDir(yes ? "right" : "left");
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
      <div className="content content--swipe">
        <div className="row between">
          <div className="pill">
            {idx + 1} / {questions.length}
          </div>
          <button className="glass-surface nav-pill" onClick={onComplete}>
            Skip
          </button>
        </div>

        {error && <div className="error-banner" style={{ marginTop: 12 }}>{error}</div>}

        <div className="deck">
          <div className="deck-stage">
            <AnimatePresence custom={exitDir} initial={false}>
              {!details && (
                <SwipeCard
                  key={q.id}
                  question={q}
                  onAnswer={handleAnswer}
                  exitDir={exitDir}
                  hint={idx === 0}
                />
              )}
            </AnimatePresence>
          </div>

          {!details && (
            <SwipeActions
              disabled={submitting}
              onNo={() => handleAnswer(false)}
              onYes={() => handleAnswer(true)}
            />
          )}
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

function SwipeCard({ question, onAnswer, exitDir, hint }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-14, 14]);
  const yesOp = useTransform(x, [20, 140], [0, 1]);
  const noOp = useTransform(x, [-140, -20], [1, 0]);
  // Color-fill overlay: red on the left, green on the right
  const fillOp = useTransform(x, [-180, -20, 0, 20, 180], [0.78, 0, 0, 0, 0.78]);
  const fillBg = useTransform(x, (v) =>
    v < 0 ? "var(--danger)" : "var(--grass-500)"
  );

  // One-time "swipeable" wiggle on the very first card
  useEffect(() => {
    if (!hint) return;
    const controls = animate(x, [0, -26, 22, -14, 12, 0], {
      duration: 1.4,
      delay: 0.55,
      ease: [0.45, 0, 0.55, 1],
    });
    return () => controls.stop();
  }, [hint, x]);

  const onDragEnd = (_, info) => {
    // Commit the visual direction immediately so it can't be undone by
    // the drag-release spring back to 0 during the async handleAnswer.
    if (info.offset.x > 120) {
      animate(x, 520, { duration: 0.3, ease: [0.4, 0, 0.2, 1] });
      onAnswer(true);
    } else if (info.offset.x < -120) {
      animate(x, -520, { duration: 0.3, ease: [0.4, 0, 0.2, 1] });
      onAnswer(false);
    }
  };

  return (
    <motion.div
      className="swipe-card"
      style={{ x, rotate }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={onDragEnd}
      initial={{ scale: 0.94, opacity: 0, y: 8 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      custom={exitDir}
      exit={(dir) => {
        // Prefer the current drag/imperative position over `dir` so the
        // exit can't reverse a swipe that's already committed visually.
        const current = x.get();
        const goingLeft =
          Math.abs(current) > 40 ? current < 0 : dir === "left";
        return {
          x: goingLeft ? -480 : 480,
          rotate: goingLeft ? -22 : 22,
          opacity: 0,
          transition: { duration: 0.32, ease: [0.4, 0, 0.2, 1] },
        };
      }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
      whileTap={{ cursor: "grabbing" }}
    >
      {/* Colored fill that intensifies as the card is dragged */}
      <motion.div
        className="swipe-card__fill"
        style={{ opacity: fillOp, background: fillBg }}
        aria-hidden="true"
      />

      <motion.div className="stamp yes" style={{ opacity: yesOp }}>
        Yes
      </motion.div>
      <motion.div className="stamp no" style={{ opacity: noOp }}>
        No
      </motion.div>

      <div className="swipe-card__body">
        <div className="q-title">{question.title}</div>
        <div className="q-sub">{question.sub}</div>
      </div>

      <div className="hint-row">
        <span className="no">
          <SwipeLeftIcon />
          Swipe no
        </span>
        <span className="yes">
          Swipe yes
          <SwipeRightIcon />
        </span>
      </div>
    </motion.div>
  );
}

function SwipeActions({ disabled, onNo, onYes }) {
  return (
    <div className="swipe-actions">
      <button
        type="button"
        className="action-btn no"
        disabled={disabled}
        onClick={onNo}
        aria-label="No"
      >
        <CloseIcon />
      </button>
      <button
        type="button"
        className="action-btn yes"
        disabled={disabled}
        onClick={onYes}
        aria-label="Yes"
      >
        <CheckIcon />
      </button>
    </div>
  );
}

/* --- Inline SVG icons (no extra deps) --- */

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="28"
      height="28"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6l-12 12" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="28"
      height="28"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

// Double chevrons evoke a swipe motion better than a single arrow
function SwipeLeftIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17 6l-6 6 6 6" />
      <path d="M11 6l-6 6 6 6" />
    </svg>
  );
}

function SwipeRightIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 6l6 6-6 6" />
      <path d="M13 6l6 6-6 6" />
    </svg>
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
