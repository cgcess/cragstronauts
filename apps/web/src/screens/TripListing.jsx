import React, { useMemo, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";

const EASE_OUT = [0.23, 1, 0.32, 1];
const SWIPE_THRESHOLD = 90; // px past which the swipe "commits"

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isPast(trip, today) {
  const ref = trip.end_date || trip.start_date;
  return ref != null && ref < today;
}

function fmtMonth(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleString(undefined, { month: "short", day: "numeric" });
}

function dateRangeShort(trip) {
  const s = trip.start_date;
  const e = trip.end_date;
  if (!s && !e) return "Dates TBD";
  if (s && e && s !== e) return `${fmtMonth(s)} → ${fmtMonth(e)}`;
  return fmtMonth(s || e);
}

function daysUntil(trip, todayStr) {
  const ref = trip.start_date || trip.end_date;
  if (!ref) return null;
  const a = new Date(todayStr + "T00:00:00").getTime();
  const b = new Date(ref + "T00:00:00").getTime();
  return Math.round((b - a) / 86400000);
}

function daysSince(trip, todayStr) {
  const ref = trip.end_date || trip.start_date;
  if (!ref) return null;
  const a = new Date(todayStr + "T00:00:00").getTime();
  const b = new Date(ref + "T00:00:00").getTime();
  return Math.round((a - b) / 86400000);
}

function chipLabelFor(trip, todayStr) {
  if (isPast(trip, todayStr)) {
    const ago = daysSince(trip, todayStr);
    if (ago == null) return { label: "Past", tone: "past" };
    if (ago < 14) return { label: `${ago}d ago`, tone: "past" };
    if (ago < 60) return { label: `${Math.round(ago / 7)}wk ago`, tone: "past" };
    return { label: `${Math.round(ago / 30)}mo ago`, tone: "past" };
  }
  const days = daysUntil(trip, todayStr);
  if (days == null) return { label: "Soon", tone: "soon" };
  if (days <= 0) return { label: "On now", tone: "soon" };
  if (days === 1) return { label: "Tomorrow", tone: "soon" };
  if (days < 14) return { label: `In ${days} days`, tone: "soon" };
  return { label: `In ${Math.round(days / 7)} wk`, tone: "soon" };
}

// Hand-tuned wobble per peek-card position so the stack feels human.
const ROTATIONS = [-2.0, 1.6, -1.0, 2.4];

/**
 * TripCard — visual presentation of a single trip card.
 * Pure layout — drag/animation lives in the parent.
 */
function TripCardFace({ trip, todayStr }) {
  const past = isPast(trip, todayStr);
  const chip = chipLabelFor(trip, todayStr);
  return (
    <div className={`deck-card__face ${past ? "deck-card__face--past" : ""}`}>
      <div className="deck-card__topline">
        <span className="deck-card__date">{dateRangeShort(trip)}</span>
        <span
          className={`deck-card__chip deck-card__chip--${chip.tone}`}
        >
          {chip.label}
        </span>
      </div>
      <div>
        <div className="deck-card__title">{trip.location}</div>
        {trip.accommodation_type && (
          <div className="deck-card__meta">
            {trip.accommodation_type}
            {trip.accommodation_details
              ? ` · ${trip.accommodation_details}`
              : ""}
          </div>
        )}
      </div>
      <div className="deck-card__footer">
        <span className="deck-card__cta">
          {past ? "Look back →" : "Open trip →"}
        </span>
      </div>
    </div>
  );
}

/**
 * TripDeck — Apple-Wallet-ish stack of cards you can swipe through
 * left/right. Top card is draggable; release past SWIPE_THRESHOLD
 * commits the swipe.
 */
function TripDeck({ trips, todayStr, onSelect }) {
  const reduceMotion = useReducedMotion();

  // Sort chronologically (oldest first). Start at the first upcoming
  // trip so the deck opens with "what's next" facing you.
  const ordered = useMemo(() => {
    const sorted = [...trips].sort((a, b) => {
      const ad = a.start_date || a.end_date || "9999-12-31";
      const bd = b.start_date || b.end_date || "9999-12-31";
      return ad.localeCompare(bd);
    });
    return sorted;
  }, [trips]);

  const initialActive = useMemo(() => {
    const firstUpcoming = ordered.findIndex((t) => !isPast(t, todayStr));
    return firstUpcoming >= 0 ? firstUpcoming : Math.max(ordered.length - 1, 0);
  }, [ordered, todayStr]);

  const [active, setActive] = useState(initialActive);
  // Track direction of the last swipe so the entering card knows which
  // side to fly in from. +1 = swiped left (next), -1 = swiped right (prev).
  const [dir, setDir] = useState(0);

  // Drag motion values bound to the topmost card only.
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 0, 220], [-14, 0, 14]);
  const dragFade = useTransform(x, [-220, -120, 0, 120, 220], [0, 1, 1, 1, 0]);

  const canGoPrev = active > 0;
  const canGoNext = active < ordered.length - 1;

  const commitSwipe = (direction) => {
    if (direction > 0 && canGoNext) {
      setDir(1);
      setActive((i) => i + 1);
    } else if (direction < 0 && canGoPrev) {
      setDir(-1);
      setActive((i) => i - 1);
    }
    x.set(0);
  };

  const topTrip = ordered[active];
  const peek1 = ordered[active + 1] ?? ordered[active - 1] ?? null;
  const peek2 =
    ordered[active + 2] ?? ordered[active + 1] ?? ordered[active - 2] ?? null;

  if (!topTrip) return null;

  // We render top + up to two peek cards. Top card uses AnimatePresence
  // so the entering one slides in from the swipe direction.
  return (
    <>
    <div className="deck-shell">
      {/* Peek cards (purely decorative — they don't react to clicks while
          a card sits on top of them, but they peek out so the deck reads
          as a physical stack). */}
      {peek2 && (
        <motion.div
          key={`peek2-${peek2.id}`}
          className="deck-card deck-card--peek"
          aria-hidden="true"
          initial={false}
          animate={
            reduceMotion
              ? { opacity: 0.5 }
              : { y: 22, rotate: ROTATIONS[2], scale: 0.92, opacity: 0.55 }
          }
          transition={{
            type: "spring",
            stiffness: 220,
            damping: 26,
          }}
          style={{ zIndex: 1 }}
        >
          <TripCardFace trip={peek2} todayStr={todayStr} />
        </motion.div>
      )}
      {peek1 && peek1 !== peek2 && (
        <motion.div
          key={`peek1-${peek1.id}`}
          className="deck-card deck-card--peek"
          aria-hidden="true"
          initial={false}
          animate={
            reduceMotion
              ? { opacity: 0.75 }
              : { y: 12, rotate: ROTATIONS[1], scale: 0.96, opacity: 0.85 }
          }
          transition={{
            type: "spring",
            stiffness: 240,
            damping: 26,
          }}
          style={{ zIndex: 2 }}
        >
          <TripCardFace trip={peek1} todayStr={todayStr} />
        </motion.div>
      )}

      {/* Top card — draggable */}
      <AnimatePresence mode="popLayout" custom={dir} initial={false}>
        <motion.button
          key={topTrip.id}
          type="button"
          className="deck-card deck-card--top"
          onClick={() => {
            // Suppress click if a real drag just happened
            if (Math.abs(x.get()) > 4) return;
            onSelect(topTrip.id);
          }}
          drag={reduceMotion ? false : "x"}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.7}
          style={{
            zIndex: 3,
            x: reduceMotion ? 0 : x,
            rotate: reduceMotion ? 0 : rotate,
            opacity: reduceMotion ? 1 : dragFade,
            transformOrigin: "50% 100%",
            "--card-rot": "0deg",
          }}
          custom={dir}
          variants={
            reduceMotion
              ? undefined
              : {
                  enter: (d) => ({
                    x: d >= 0 ? 420 : -420,
                    rotate: d >= 0 ? 14 : -14,
                    opacity: 0,
                  }),
                  center: {
                    x: 0,
                    rotate: ROTATIONS[0],
                    opacity: 1,
                    transition: {
                      type: "spring",
                      stiffness: 260,
                      damping: 28,
                    },
                  },
                  exit: (d) => ({
                    x: d >= 0 ? -460 : 460,
                    rotate: d >= 0 ? -22 : 22,
                    opacity: 0,
                    transition: { duration: 0.28, ease: EASE_OUT },
                  }),
                }
          }
          initial="enter"
          animate="center"
          exit="exit"
          onDragEnd={(_e, info) => {
            if (info.offset.x < -SWIPE_THRESHOLD && canGoNext) {
              commitSwipe(1);
            } else if (info.offset.x > SWIPE_THRESHOLD && canGoPrev) {
              commitSwipe(-1);
            } else {
              // Snap back
              x.set(0);
            }
          }}
        >
          <TripCardFace trip={topTrip} todayStr={todayStr} />
        </motion.button>
      </AnimatePresence>
    </div>

    {/* Bottom hint row: position + swipe affordances. Sits BELOW the
        deck-shell in normal flow so it doesn't get sandwiched between
        absolutely-positioned cards. */}
    <div className="deck-hint">
      <button
        type="button"
        className="deck-hint__nudge"
        onClick={() => commitSwipe(-1)}
        disabled={!canGoPrev}
        aria-label="Previous trip"
      >
        ←
      </button>
      <div className="deck-hint__dots" aria-hidden="true">
        {ordered.map((t, i) => (
          <span
            key={t.id}
            className={`deck-hint__dot ${
              i === active ? "deck-hint__dot--on" : ""
            } ${isPast(t, todayStr) ? "deck-hint__dot--past" : ""}`}
          />
        ))}
      </div>
      <button
        type="button"
        className="deck-hint__nudge"
        onClick={() => commitSwipe(1)}
        disabled={!canGoNext}
        aria-label="Next trip"
      >
        →
      </button>
    </div>
    </>
  );
}

export default function TripListing({ trips, onCreate, onSelect }) {
  const reduceMotion = useReducedMotion();
  const todayStr = useMemo(todayISO, []);

  const fade = reduceMotion
    ? { initial: false, animate: {}, transition: {} }
    : {
        initial: { opacity: 0, y: -10 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.36, ease: EASE_OUT },
      };

  const hasAnyTrip = trips.length > 0;

  return (
    <div className="app-shell">
      <div className="content">
        <motion.div {...fade}>
          <div className="brand-mark">
            <span className="mark-glyph" aria-hidden="true">🧗</span>
            Cragstronauts
          </div>
          <motion.div
            className="brand-sub"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.32, delay: 0.1, ease: EASE_OUT }}
          >
            Plan the climb. Pack the car.
          </motion.div>
        </motion.div>

        {!hasAnyTrip ? (
          <motion.button
            type="button"
            className="deck-empty"
            onClick={onCreate}
            aria-label="Create your first trip"
            initial={reduceMotion ? false : { opacity: 0, y: 24, rotate: -6 }}
            animate={{ opacity: 1, y: 0, rotate: -2 }}
            transition={{ duration: 0.5, delay: 0.18, ease: EASE_OUT }}
            whileHover={reduceMotion ? undefined : { rotate: -2, y: -4 }}
            whileTap={reduceMotion ? undefined : { scale: 0.98 }}
          >
            <div className="deck-empty__plus" aria-hidden="true">+</div>
            <div className="deck-empty__title">No trips on the wall</div>
            <div className="deck-empty__sub">
              Tap to plan your first cragstronaut mission.
            </div>
          </motion.button>
        ) : (
          <TripDeck
            trips={trips}
            todayStr={todayStr}
            onSelect={onSelect}
          />
        )}
      </div>

      {hasAnyTrip && (
        <motion.div
          className="bottom-cta bottom-cta--center"
          initial={reduceMotion ? false : { opacity: 0, y: 48 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 300, damping: 28, delay: 0.45 }
          }
        >
          <motion.button
            className="btn-3d"
            onClick={onCreate}
            whileTap={reduceMotion ? undefined : { y: 5 }}
          >
            Plan new trip →
          </motion.button>
        </motion.div>
      )}
    </div>
  );
}
