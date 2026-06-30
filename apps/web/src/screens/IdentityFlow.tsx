import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  animate,
  motion,
  useMotionValue,
  useTransform,
  AnimatePresence,
} from "framer-motion";
import { api } from "../api";
import type { User, Category, Poll } from "../context/TripContext";
import { Button, Tag } from "../components/ui";
import { findNameMatches } from "../lib/identity";
import { gearForCategory, firstCar, type CragProfile } from "../lib/profile";

/* ------------------------------------------------------------------ */
/* IdentityFlow                                                        */
/*                                                                     */
/* A full-screen overlay that establishes identity on demand. It is    */
/* opened by TripContext.ensureUser() the first time an anonymous      */
/* visitor tries to write. Two phases:                                 */
/*                                                                     */
/*   1. identify  — type your name (or pick an existing person)        */
/*   2. questions — the swipe-deck questionnaire (skippable)           */
/*                                                                     */
/* It renders over the still-mounted board, so once it resolves the    */
/* triggering action resumes exactly where it left off.                */
/*                                                                     */
/* Taken / claim model: identity is cooperative, not secured, but we    */
/* add friction against accidental impersonation. A user is `claimed`   */
/* (taken) the moment a device adopts it — every self-typed user is     */
/* claimed at creation. The identify panel makes typing your name the   */
/* prominent path and demotes "pick yourself" to a collapsed disclosure.*/
/* If a typed name collides with an existing person we show a confirm:  */
/* "that's me" re-claims that identity (api.claimUser) — the new-device  */
/* / cleared-storage re-entry path — while "add a new {name}" creates a  */
/* distinct person. Taken users in the disclosure can't be adopted in   */
/* one tap; they route through the same confirm. Logout never releases  */
/* a claim.                                                            */
/* ------------------------------------------------------------------ */

type Phase = "identify" | "questions";

interface IdentityFlowProps {
  open: boolean;
  tripId: string;
  users: User[];
  categories: Category[];
  polls: Poll[];
  setUser: (id: number | null) => void;
  refresh: () => Promise<void>;
  /** Resolve the pending ensureUser() promise and close the overlay. */
  onDone: (id: number | null) => void;
  /**
   * "identify" (default) runs the full name → questionnaire flow for an
   * anonymous visitor. "questions" skips straight to a polls-only deck for an
   * already-identified user (`questionUserId`) — used by the dashboard nudge to
   * mop up unanswered polls without touching signup state.
   */
  mode?: "identify" | "questions";
  questionUserId?: number | null;
  /** Signed-in member's saved kit, used to prefill the questionnaire. */
  profile?: CragProfile | null;
}

export default function IdentityFlow({
  open,
  tripId,
  users,
  categories,
  polls,
  setUser,
  refresh,
  onDone,
  mode = "identify",
  questionUserId = null,
  profile = null,
}: IdentityFlowProps) {
  const pollsOnly = mode === "questions";
  const [phase, setPhase] = useState<Phase>("identify");
  const [userId, setUserId] = useState<number | null>(null);

  // Reset to a clean state every time the overlay opens. In questions mode the
  // user is already known, so jump straight to the deck.
  useEffect(() => {
    if (open) {
      setPhase(pollsOnly ? "questions" : "identify");
      setUserId(pollsOnly ? questionUserId : null);
    }
  }, [open, pollsOnly, questionUserId]);

  // New visitor typed a name → create them, then run the questionnaire.
  const createAndContinue = async (name: string) => {
    const u = await api.createUser(tripId, name.trim());
    // Refresh before setUser so the self-heal guard in TripLayout sees the new
    // user in the list and doesn't immediately clear the freshly-set id.
    await refresh();
    setUser(u.id);
    setUserId(u.id);
    setPhase("questions");
  };

  // Returning visitor adopted an existing person (pick-yourself or the
  // "that's me" confirm). Claim the slot server-side so other devices see it
  // as taken, then proceed — skipping the questionnaire if they're already set
  // up.
  const pickExisting = async (id: number) => {
    try {
      await api.claimUser(tripId, id);
    } catch {
      // best-effort; adopting still works locally even if the claim flips fail
    }
    await refresh();
    setUser(id);
    const u = users.find((x) => x.id === id);
    if (u?.signup_completed) {
      onDone(id); // already set up — straight back to what they were doing
    } else {
      setUserId(id);
      setPhase("questions");
    }
  };

  // Finished or skipped the questionnaire. The polls-only nudge deck isn't the
  // signup flow, so it leaves signup_completed alone and just refreshes.
  const finishQuestions = async () => {
    if (userId != null) {
      if (!pollsOnly) {
        try {
          await api.completeSignup(tripId, userId);
        } catch {
          // best-effort; the user still exists and is signed in
        }
      }
      await refresh();
    }
    onDone(userId);
  };

  // Swiped "no" on "Are you joining?" — undo the just-created user and abort.
  const notJoining = async () => {
    if (userId != null) {
      try {
        await api.deleteUser(tripId, userId);
      } catch {
        // ignore
      }
      setUser(null);
      await refresh();
    }
    onDone(null);
  };

  // The top-right close button: abort during identify, skip during questions.
  const dismiss = () => {
    if (phase === "identify") onDone(null);
    else finishQuestions();
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="identity-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div className="app-shell">
            <button
              type="button"
              className="identity-overlay__close"
              onClick={dismiss}
              aria-label="Close"
            >
              ✕
            </button>
            {phase === "identify" ? (
              <IdentifyPanel
                users={users}
                onCreate={createAndContinue}
                onPick={pickExisting}
                defaultName={profile?.username}
              />
            ) : (
              <Questionnaire
                tripId={tripId}
                userId={userId!}
                categories={categories}
                polls={polls}
                pollsOnly={pollsOnly}
                profile={profile}
                onComplete={finishQuestions}
                onNotJoining={notJoining}
              />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/* ------------------------------------------------------------------ */
/* Phase 1 — identify                                                  */
/* ------------------------------------------------------------------ */

function IdentifyPanel({
  users,
  onCreate,
  onPick,
  defaultName,
}: {
  users: User[];
  onCreate: (name: string) => Promise<void>;
  onPick: (id: number) => Promise<void>;
  defaultName?: string;
}) {
  const [name, setName] = useState(defaultName ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // When the typed name collides with existing people, hold them here so the
  // panel swaps to the "that's me vs. add new" confirm step.
  const [matches, setMatches] = useState<User[] | null>(null);
  // The collapsed "pick yourself" disclosure.
  const [pickOpen, setPickOpen] = useState(false);

  const guard = async (fn: () => Promise<void>) => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  // Submitting the name: a collision opens the confirm, otherwise create.
  const submitName = () => {
    if (!name.trim() || busy) return;
    const found = findNameMatches(users, name);
    if (found.length > 0) {
      setError(null);
      setMatches(found);
      return;
    }
    guard(() => onCreate(name));
  };

  const create = () => guard(() => onCreate(name));
  const pick = (id: number) => guard(() => onPick(id));

  // Tapping a person in the disclosure. Un-taken users adopt in one tap;
  // taken ones route through the confirm instead.
  const tapExisting = (u: User) => {
    if (busy) return;
    if (u.claimed) {
      setName(u.name);
      setError(null);
      setMatches([u]);
      return;
    }
    pick(u.id);
  };

  const typed = name.trim();

  // Confirm step: the typed name already belongs to someone.
  if (matches) {
    return (
      <div className="content identity-identify">
        <div className="identity-identify__inner">
          <div className="identity-identify__head">
            <h1 className="identity-identify__title">
              {matches.length > 1 ? "Which one are you?" : "That you?"}
            </h1>
            <p className="identity-identify__note">
              {matches.length > 1
                ? `There are already people named ${typed} on this trip.`
                : `There's already a ${typed} on this trip.`}
            </p>
            {error && <div className="error-banner">{error}</div>}
            <div className="col">
              {matches.map((u) => (
                <Button
                  key={u.id}
                  variant="secondary"
                  fullWidth
                  disabled={busy}
                  onClick={() => pick(u.id)}
                >
                  That's me — {u.name} {u.is_organizer && "👑"}
                </Button>
              ))}
            </div>
            <Button
              variant="primary"
              fullWidth
              disabled={busy}
              onClick={create}
            >
              {busy ? "One sec…" : `Add a new ${typed}`}
            </Button>
            <button
              type="button"
              className="identity-identify__toggle"
              disabled={busy}
              onClick={() => {
                setMatches(null);
                setError(null);
              }}
            >
              ← Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="content identity-identify">
      <div className="identity-identify__inner">
        <div className="identity-identify__head">
          <h1 className="identity-identify__title">Hop in 🧗</h1>
          <input
            className="identity-identify__input"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitName()}
            autoFocus
          />
          {error && <div className="error-banner">{error}</div>}
          <Button
            variant="primary"
            fullWidth
            disabled={!name.trim() || busy}
            onClick={submitName}
          >
            {busy ? "One sec…" : "Continue →"}
          </Button>
        </div>

        {users.length > 0 && (
          <div className="identity-identify__list">
            <button
              type="button"
              className="identity-identify__toggle"
              aria-expanded={pickOpen}
              disabled={busy}
              onClick={() => setPickOpen((v) => !v)}
            >
              Already added? Pick yourself {pickOpen ? "⌃" : "∨"}
            </button>
            {pickOpen && (
              <div className="col">
                {users.map((u) => (
                  <Button
                    key={u.id}
                    variant="secondary"
                    fullWidth
                    disabled={busy}
                    onClick={() => tapExisting(u)}
                  >
                    {u.name} {u.is_organizer && "👑"}
                    {u.claimed && (
                      <span className="identity-identify__lock">🔒 in use</span>
                    )}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Phase 2 — questionnaire (swipe deck)                                */
/* ------------------------------------------------------------------ */

interface Question {
  id: string;
  title: string;
  sub: string;
  kind?: "gear" | "driving" | "poll";
  category?: Category;
  poll?: Poll;
}

function buildQuestions(
  categories: Category[],
  polls: Poll[],
  pollsOnly = false,
  profile?: CragProfile | null
): Question[] {
  // The nudge deck skips the joining and driving cards (and never touches
  // signup state), but still includes polls and gear so a user can answer
  // "bringing one" / "not bringing one" straight from the dashboard nudge.
  const qs: Question[] = pollsOnly
    ? []
    : [
        {
          id: "joining",
          title: "Are you joining the trip?",
          sub: "Swipe right for yes, left for no.",
        },
      ];
  for (const p of polls) {
    qs.push({
      id: `poll:${p.id}`,
      title: p.question,
      sub: p.description ?? "Tap the option that fits you.",
      kind: "poll",
      poll: p,
    });
  }
  for (const c of categories) {
    // When the member's saved kit matches this category (by catalog slug), the
    // card greets their gear and the detail form arrives pre-filled.
    const mine = gearForCategory(profile, c);
    qs.push({
      id: `gear:${c.id}`,
      title: mine
        ? `Bring your ${c.name.toLowerCase()}?`
        : `Are you bringing a ${c.name.toLowerCase()}?`,
      sub: mine
        ? c.fields.length
          ? "From your kit. Confirm the details."
          : "From your kit. Swipe right to bring it."
        : c.fields.length
          ? "If yes, we'll ask for details."
          : "Swipe right if you'll bring one.",
      kind: "gear",
      category: c,
    });
  }
  if (pollsOnly) return qs;
  const car = firstCar(profile);
  qs.push({
    id: "driving",
    title: car ? "Bring your car?" : "Are you driving?",
    sub: car
      ? `You saved ${car.seats} seats. Swipe right if you're in.`
      : "If yes, we'll ask how many seats.",
    kind: "driving",
  });
  return qs;
}

function Questionnaire({
  tripId,
  userId,
  categories,
  polls,
  pollsOnly = false,
  profile = null,
  onComplete,
  onNotJoining,
}: {
  tripId: string;
  userId: number;
  categories: Category[];
  polls: Poll[];
  pollsOnly?: boolean;
  profile?: CragProfile | null;
  onComplete: () => void;
  onNotJoining: () => void;
}) {
  const questions = useMemo(
    () => buildQuestions(categories, polls, pollsOnly, profile),
    [categories, polls, pollsOnly, profile]
  );
  const [idx, setIdx] = useState(0);
  const [details, setDetails] = useState<DetailState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [exitDir, setExitDir] = useState<"left" | "right" | null>(null);

  const q = questions[idx];

  const persistAnswer = async (
    qq: Question,
    yes: boolean,
    extra: Record<string, string> | null
  ) => {
    setError(null);
    setSubmitting(true);
    try {
      if (qq.kind === "gear" && yes) {
        await api.addGear(tripId, {
          user_id: userId,
          category_id: qq.category!.id,
          details: extra || {},
        });
      }
      if (qq.kind === "gear" && !yes) {
        await api.addGearDecline(tripId, {
          user_id: userId,
          category_id: qq.category!.id,
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
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setSubmitting(false);
    }
  };

  const next = () => {
    if (idx + 1 >= questions.length) onComplete();
    else setIdx(idx + 1);
  };

  const handleAnswer = async (yes: boolean) => {
    if (yes && q.kind === "gear" && q.category!.fields.length) {
      // Pre-fill the detail form from the member's matching saved gear.
      const mine = gearForCategory(profile, q.category!);
      const values: Record<string, string> = {};
      if (mine?.values) {
        for (const f of q.category!.fields) {
          const v = mine.values[f.key];
          if (v != null) values[f.key] = String(v);
        }
      }
      setDetails({ kind: "gear", category: q.category!, values });
      return;
    }
    if (yes && q.kind === "driving") {
      const car = firstCar(profile);
      setDetails({
        kind: "driving",
        values: { seats: car ? String(car.seats) : "4" },
      });
      return;
    }
    if (q.id === "joining" && !yes) {
      onNotJoining();
      return;
    }
    setExitDir(yes ? "right" : "left");
    try {
      await persistAnswer(q, yes, null);
      next();
    } catch {
      /* error shown inline */
    }
  };

  const submitDetails = async () => {
    try {
      await persistAnswer(q, true, details!.values);
      setDetails(null);
      next();
    } catch {
      /* error shown inline */
    }
  };

  // Polls aren't yes/no, so they record the chosen option and advance.
  const answerPoll = async (optionId: number) => {
    setError(null);
    setSubmitting(true);
    try {
      await api.setPollAnswer(tripId, {
        user_id: userId,
        poll_id: q.poll!.id,
        option_ids: [optionId],
      });
      setExitDir("right");
      next();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (!q) return null;

  const isPoll = q.kind === "poll";

  return (
    <div className="content content--swipe">
      <div className="row between">
        <Tag variant="neutral" mono>
          {idx + 1} / {questions.length}
        </Tag>
        <Button variant="secondary" pill onClick={onComplete}>
          Skip
        </Button>
      </div>

      {error && (
        <div className="error-banner" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}

      {isPoll ? (
        <PollCard
          key={q.id}
          poll={q.poll!}
          disabled={submitting}
          onPick={answerPoll}
        />
      ) : (
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
      )}

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
  );
}

function PollCard({
  poll,
  disabled,
  onPick,
}: {
  poll: Poll;
  disabled: boolean;
  onPick: (optionId: number) => void;
}) {
  return (
    <motion.div
      className="poll-card"
      initial={{ scale: 0.96, opacity: 0, y: 8 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
    >
      <div className="poll-card__head">
        {poll.emoji && (
          <div className="poll-card__emoji" aria-hidden="true">
            {poll.emoji}
          </div>
        )}
        <div className="q-title">{poll.question}</div>
        {poll.description && (
          <div className="poll-card__desc">{poll.description}</div>
        )}
      </div>
      <div className="poll-card__options">
        {poll.options.map((o) => (
          <button
            key={o.id}
            type="button"
            className="poll-option"
            disabled={disabled}
            onClick={() => onPick(o.id)}
          >
            {o.emoji && <span aria-hidden="true">{o.emoji} </span>}
            {o.label}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

interface SwipeCardProps {
  question: Question;
  onAnswer: (yes: boolean) => void;
  exitDir: "left" | "right" | null;
  hint: boolean;
}

function SwipeCard({ question, onAnswer, exitDir, hint }: SwipeCardProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-14, 14]);
  const yesOp = useTransform(x, [20, 140], [0, 1]);
  const noOp = useTransform(x, [-140, -20], [1, 0]);
  const fillOp = useTransform(x, [-180, -20, 0, 20, 180], [0.78, 0, 0, 0, 0.78]);
  const fillBg = useTransform(x, (v) =>
    v < 0 ? "var(--danger)" : "var(--grass-500)"
  );

  useEffect(() => {
    if (!hint) return;
    const controls = animate(x, [0, -26, 22, -14, 12, 0], {
      duration: 1.4,
      delay: 0.55,
      ease: [0.45, 0, 0.55, 1],
    });
    return () => controls.stop();
  }, [hint, x]);

  const onDragEnd = (_: unknown, info: { offset: { x: number } }) => {
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
      exit={((dir: string) => {
        const current = x.get();
        const goingLeft =
          Math.abs(current) > 40 ? current < 0 : dir === "left";
        return {
          x: goingLeft ? -480 : 480,
          rotate: goingLeft ? -22 : 22,
          opacity: 0,
          transition: { duration: 0.32, ease: [0.4, 0, 0.2, 1] },
        };
      }) as never}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
      whileTap={{ cursor: "grabbing" }}
    >
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

function SwipeActions({
  disabled,
  onNo,
  onYes,
}: {
  disabled: boolean;
  onNo: () => void;
  onYes: () => void;
}) {
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
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6l-12 12" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function SwipeLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 6l-6 6 6 6" />
      <path d="M11 6l-6 6 6 6" />
    </svg>
  );
}

function SwipeRightIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 6l6 6-6 6" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}

type DetailState =
  | { kind: "gear"; category: Category; values: Record<string, string> }
  | { kind: "driving"; values: Record<string, string> };

interface DetailFormProps {
  details: DetailState;
  setDetails: (d: DetailState | null) => void;
  onCancel: () => void;
  onSubmit: () => void;
  submitting: boolean;
}

function DetailForm({
  details,
  setDetails,
  onCancel,
  onSubmit,
  submitting,
}: DetailFormProps) {
  if (details.kind === "gear") {
    return (
      <div className="card" style={{ marginTop: 16 }}>
        <div className="h2">
          Tell us about your {details.category.name.toLowerCase()}
        </div>
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
          <button className="th-btn th-btn--secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="th-btn th-btn--primary"
            onClick={onSubmit}
            disabled={submitting}
            style={{ flex: 1 }}
          >
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
          <button className="th-btn th-btn--secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="th-btn th-btn--primary"
            onClick={onSubmit}
            disabled={submitting}
            style={{ flex: 1 }}
          >
            {submitting ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    );
  }
  return null;
}
