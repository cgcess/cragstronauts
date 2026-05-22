import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";

const EASE_OUT = [0.23, 1, 0.32, 1];
const SWIPE_THRESHOLD = 90; // px past which a swipe commits
const ROTATIONS = [0, 1.6, -2.0]; // slot 0 (top) is flat, peeks wobble

// Each slot in the visible stack has a resting transform. Opacity is
// always 1 so a peek card never bleeds the card above through it; depth
// reads from y-offset, scale, and box-shadow.
const SLOTS = [
  { y: 0, scale: 1, opacity: 1, rotate: ROTATIONS[0] },     // top
  { y: 12, scale: 0.96, opacity: 1, rotate: ROTATIONS[1] }, // peek 1
  { y: 24, scale: 0.92, opacity: 1, rotate: ROTATIONS[2] }, // peek 2
];

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

function TripCardFace({ trip, todayStr }) {
  const past = isPast(trip, todayStr);
  const chip = chipLabelFor(trip, todayStr);
  return (
    <div className={`deck-card__face ${past ? "deck-card__face--past" : ""}`}>
      <div className="deck-card__topline">
        <span className="deck-card__date">{dateRangeShort(trip)}</span>
        <span className={`deck-card__chip deck-card__chip--${chip.tone}`}>
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
 * One card layer. Rendered for each visible trip; its slot is whatever
 * its offset from the active index resolves to. When `active` changes,
 * cards that remain visible animate between slots (smooth rise/fall);
 * new cards enter via AnimatePresence; the swiped-off card exits to
 * the side it was thrown.
 */
const DeckLayer = React.forwardRef(function DeckLayer(
  {
    trip,
    slot,
    isTop,
    todayStr,
    onSelect,
    dragX,
    dragRotate,
    onDragEnd,
    reduceMotion,
    staggerDelay,
    dir,
  },
  ref
) {
  const target = SLOTS[slot];

  // Two distinct entrances:
  //   • First mount  — cards swoop up from below the screen (the
  //     "stack assembles" feel from the original design).
  //   • Mid-shuffle  — new card fades in BEHIND the stack at its
  //     target Y but smaller, so it doesn't traverse through the
  //     other cards and bleed text on the way up.
  const enterFromBelow = {
    y: target.y + 90,
    scale: target.scale * 0.94,
    opacity: 0,
    rotate: target.rotate,
  };
  const enterFromBehind = {
    y: target.y,
    scale: target.scale * 0.82,
    opacity: 0,
    rotate: target.rotate,
  };
  const initialState = staggerDelay > 0 ? enterFromBelow : enterFromBehind;

  return (
    <motion.button
      ref={ref}
      type="button"
      className={`deck-card ${isTop ? "deck-card--top" : "deck-card--peek"}`}
      style={{
        zIndex: 10 - slot,
        // Top card alone gets drag-controlled x + a rotation derived
        // from the drag distance. Peek cards stay still.
        ...(isTop && !reduceMotion ? { x: dragX, rotate: dragRotate } : {}),
      }}
      custom={dir}
      initial={reduceMotion ? false : initialState}
      animate={{
        // Top card's rotate is owned by style (dragRotate). Animating
        // rotate here would fight the motion value, so only set it for
        // peek cards.
        y: target.y,
        scale: target.scale,
        opacity: target.opacity,
        ...(isTop ? {} : { rotate: target.rotate }),
      }}
      exit={
        reduceMotion
          ? { opacity: 0 }
          : (custom) => ({
              x: custom > 0 ? -460 : 460,
              rotate: custom > 0 ? -22 : 22,
              opacity: 0,
              transition: { duration: 0.28, ease: EASE_OUT },
            })
      }
      transition={{
        type: "spring",
        stiffness: 240,
        damping: 26,
        // Stagger only on first mount, otherwise instant transition
        delay: staggerDelay,
      }}
      drag={isTop && !reduceMotion ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.65}
      onDragEnd={isTop ? onDragEnd : undefined}
      onClick={
        isTop
          ? () => {
              // Suppress click if a real drag just happened
              if (dragX && Math.abs(dragX.get()) > 4) return;
              onSelect(trip.id);
            }
          : undefined
      }
    >
      <TripCardFace trip={trip} todayStr={todayStr} />
    </motion.button>
  );
});

function TripDeck({ trips, todayStr, onSelect }) {
  const reduceMotion = useReducedMotion();

  const ordered = useMemo(() => {
    return [...trips].sort((a, b) => {
      const ad = a.start_date || a.end_date || "9999-12-31";
      const bd = b.start_date || b.end_date || "9999-12-31";
      return ad.localeCompare(bd);
    });
  }, [trips]);

  const initialActive = useMemo(() => {
    const i = ordered.findIndex((t) => !isPast(t, todayStr));
    return i >= 0 ? i : Math.max(ordered.length - 1, 0);
  }, [ordered, todayStr]);

  const [active, setActive] = useState(initialActive);
  const [dir, setDir] = useState(0);

  // Track whether this is the first paint so we only stagger on entry.
  const isFirstRender = useRef(true);
  useEffect(() => {
    // Defer the flip past the first commit so cards see the staggered initial.
    const id = requestAnimationFrame(() => {
      isFirstRender.current = false;
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const dragX = useMotionValue(0);
  const dragRotate = useTransform(dragX, [-220, 0, 220], [-14, 0, 14]);

  const canGoPrev = active > 0;
  const canGoNext = active < ordered.length - 1;

  const commit = (direction) => {
    if (direction > 0 && canGoNext) {
      setDir(1);
      setActive((i) => i + 1);
    } else if (direction < 0 && canGoPrev) {
      setDir(-1);
      setActive((i) => i - 1);
    }
    dragX.set(0);
  };

  const onDragEnd = (_e, info) => {
    if (info.offset.x < -SWIPE_THRESHOLD && canGoNext) commit(1);
    else if (info.offset.x > SWIPE_THRESHOLD && canGoPrev) commit(-1);
    else dragX.set(0);
  };

  // Visible window: top + up to 2 peek cards.
  const visible = ordered.slice(active, active + 3);

  return (
    <>
      <div className="deck-shell">
        <AnimatePresence custom={dir} initial={true} mode="popLayout">
          {visible.map((trip, slot) => (
            <DeckLayer
              key={trip.id}
              trip={trip}
              slot={slot}
              isTop={slot === 0}
              todayStr={todayStr}
              onSelect={onSelect}
              dragX={dragX}
              dragRotate={dragRotate}
              onDragEnd={onDragEnd}
              reduceMotion={reduceMotion}
              dir={dir}
              staggerDelay={
                isFirstRender.current && !reduceMotion
                  ? (2 - slot) * 0.09 + 0.15
                  : 0
              }
            />
          ))}
        </AnimatePresence>
      </div>

      <div className="deck-hint">
        <button
          type="button"
          className="deck-hint__nudge"
          onClick={() => commit(-1)}
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
          onClick={() => commit(1)}
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
    <div className="app-shell app-shell--landing">
      <div className="content content--landing">
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
