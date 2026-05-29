import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import { useNavigate } from "react-router";
import { api } from "../api";
import { formatDateRange } from "../dateUtils";
import type { z } from "zod";
import type { TripIndexEntrySchema } from "@cragstronauts/contract";

type TripEntry = z.infer<typeof TripIndexEntrySchema>;

const EASE_OUT = [0.23, 1, 0.32, 1];
const SWIPE_THRESHOLD = 90;

const SLOTS = [
  { x: 0, y: 0,  scale: 1,    opacity: 1, rotate: 0 },
  { x: 0, y: 12, scale: 0.96, opacity: 1, rotate: 1.6 },
  { x: 0, y: 24, scale: 0.92, opacity: 1, rotate: -2.0 },
];

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isPast(trip: TripEntry, today: string): boolean {
  const ref = trip.end_date || trip.start_date;
  return ref != null && ref < today;
}

function dateRangeShort(trip: TripEntry): string {
  return formatDateRange(trip.start_date, trip.end_date);
}

function daysUntil(trip: TripEntry, todayStr: string): number | null {
  const ref = trip.start_date || trip.end_date;
  if (!ref) return null;
  const a = new Date(todayStr + "T00:00:00").getTime();
  const b = new Date(ref + "T00:00:00").getTime();
  return Math.round((b - a) / 86400000);
}

function daysSince(trip: TripEntry, todayStr: string): number | null {
  const ref = trip.end_date || trip.start_date;
  if (!ref) return null;
  const a = new Date(todayStr + "T00:00:00").getTime();
  const b = new Date(ref + "T00:00:00").getTime();
  return Math.round((a - b) / 86400000);
}

function chipLabelFor(trip: TripEntry, todayStr: string): { label: string; tone: string } {
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

function TripCardFace({ trip, todayStr }: { trip: TripEntry; todayStr: string }) {
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
      </div>
      <div className="deck-card__footer">
        <span className="deck-card__cta">
          {past ? "Look back →" : "Open trip →"}
        </span>
      </div>
    </div>
  );
}

interface DeckLayerProps {
  trip: TripEntry;
  slot: number;
  isTop: boolean;
  todayStr: string;
  onSelect: (id: string) => void;
  onCommit: (dir: number) => void;
  canGoNext: boolean;
  canGoPrev: boolean;
  reduceMotion: boolean | null;
  staggerDelay: number;
  dir: number;
}

const DeckLayer = React.forwardRef<HTMLButtonElement, DeckLayerProps>(function DeckLayer(
  {
    trip,
    slot,
    isTop,
    todayStr,
    onSelect,
    onCommit,
    canGoNext,
    canGoPrev,
    reduceMotion,
    staggerDelay,
    dir,
  },
  ref
) {
  const target = SLOTS[slot];

  const x = useMotionValue(0);
  const dragRotate = useTransform(x, [-220, 0, 220], [-14, 0, 14]);

  const handleDragEnd = (_e: unknown, info: { offset: { x: number } }) => {
    if (info.offset.x < -SWIPE_THRESHOLD && canGoNext) {
      onCommit(1);
    } else if (info.offset.x > SWIPE_THRESHOLD && canGoPrev) {
      onCommit(-1);
    }
  };

  const animateState = isTop
    ? { x: target.x, y: target.y, scale: target.scale, opacity: target.opacity }
    : {
        x: target.x,
        y: target.y,
        scale: target.scale,
        opacity: target.opacity,
        rotate: target.rotate,
      };

  let initialState;
  if (staggerDelay > 0) {
    initialState = isTop
      ? { x: 0, y: target.y + 90, scale: target.scale * 0.94, opacity: 0 }
      : {
          x: 0,
          y: target.y + 90,
          scale: target.scale * 0.94,
          opacity: 0,
          rotate: target.rotate,
        };
  } else if (dir < 0 && slot === 0) {
    initialState = { x: 0, y: target.y - 70, scale: target.scale * 0.92, opacity: 0 };
  } else {
    initialState = isTop
      ? { x: 0, y: target.y, scale: target.scale * 0.85, opacity: 0 }
      : {
          x: 0,
          y: target.y,
          scale: target.scale * 0.85,
          opacity: 0,
          rotate: target.rotate,
        };
  }

  return (
    <motion.button
      ref={ref}
      type="button"
      className={`deck-card ${isTop ? "deck-card--top" : "deck-card--peek"}`}
      style={{
        zIndex: 10 - slot,
        ...(isTop && !reduceMotion ? { x, rotate: dragRotate } : {}),
      }}
      initial={false}
      animate={reduceMotion ? { opacity: 1 } : animateState}
      transition={{
        type: "spring",
        stiffness: 240,
        damping: 26,
        delay: staggerDelay,
      }}
      drag={isTop && !reduceMotion ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.65}
      onDragEnd={isTop ? handleDragEnd : undefined}
      onClick={
        isTop
          ? () => {
              if (Math.abs(x.get()) > 4) return;
              onSelect(trip.id);
            }
          : undefined
      }
    >
      <TripCardFace trip={trip} todayStr={todayStr} />
    </motion.button>
  );
});

function TripDeck({ trips, todayStr, onSelect }: { trips: TripEntry[]; todayStr: string; onSelect: (id: string) => void }) {
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

  const isFirstRender = useRef(true);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      isFirstRender.current = false;
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const canGoPrev = active > 0;
  const canGoNext = active < ordered.length - 1;

  const commit = (direction: number) => {
    setActive((i) => {
      if (direction > 0 && i < ordered.length - 1) return i + 1;
      if (direction < 0 && i > 0) return i - 1;
      return i;
    });
    setDir(direction);
  };

  const visible = ordered.slice(active, active + 3);

  return (
    <>
      <div className="deck-shell">
        {visible.map((trip, slot) => (
          <DeckLayer
            key={trip.id}
            trip={trip}
            slot={slot}
            isTop={slot === 0}
            todayStr={todayStr}
            onSelect={onSelect}
            onCommit={commit}
            canGoNext={canGoNext}
            canGoPrev={canGoPrev}
            reduceMotion={reduceMotion}
            dir={dir}
            staggerDelay={
              isFirstRender.current && !reduceMotion
                ? (2 - slot) * 0.09 + 0.15
                : 0
            }
          />
        ))}
      </div>

      <div className="deck-hint">
        <button
          type="button"
          className="glass-surface deck-hint__nudge"
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
          className="glass-surface deck-hint__nudge"
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

export default function TripListing() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState<TripEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.listTrips().then((t) => { setTrips(t); setLoaded(true); });
  }, []);

  const onCreate = () => navigate("/trips/new");
  const onSelect = (id: string) => navigate(`/trips/${id}/info`);

  const reduceMotion = useReducedMotion();
  const todayStr = useMemo(todayISO, []);

  const fade = reduceMotion
    ? { initial: false as const, animate: {}, transition: {} }
    : {
        initial: { opacity: 0, y: -10 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.36, ease: EASE_OUT },
      };

  if (!loaded) {
    return (
      <div className="app-shell">
        <div className="center-screen">
          <p className="muted">Loading…</p>
        </div>
      </div>
    );
  }

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
