import React from "react";
import { motion, useReducedMotion } from "framer-motion";

function today() {
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

// Deterministic but pleasingly imperfect rotation per card.
function rotForIndex(i) {
  const seq = [-2.5, 2.0, -1.2, 1.6, -3.0, 1.0];
  return seq[i % seq.length];
}
function offsetForIndex(i) {
  return i * 10;
}
function scaleForIndex(i) {
  return Math.max(0.94, 1 - i * 0.025);
}

const EASE_OUT = [0.23, 1, 0.32, 1];

export default function TripListing({ trips, onCreate, onSelect }) {
  const reduceMotion = useReducedMotion();
  const t = today();
  const upcoming = trips
    .filter((trip) => !isPast(trip, t))
    .sort((a, b) => {
      const ad = a.start_date || a.end_date || "9999-12-31";
      const bd = b.start_date || b.end_date || "9999-12-31";
      return ad.localeCompare(bd);
    });
  const past = trips
    .filter((trip) => isPast(trip, t))
    .sort((a, b) => {
      const ad = a.end_date || a.start_date || "";
      const bd = b.end_date || b.start_date || "";
      return bd.localeCompare(ad);
    });

  const fade = reduceMotion
    ? { initial: false, animate: {}, transition: {} }
    : {
        initial: { opacity: 0, y: -10 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.36, ease: EASE_OUT },
      };

  return (
    <div className="app-shell">
      <div className="content">
        {/* Brand wordmark */}
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

        {/* Stacked card deck of upcoming trips */}
        {upcoming.length === 0 ? (
          <motion.button
            type="button"
            className="deck-empty"
            onClick={onCreate}
            aria-label="Create your first trip"
            initial={reduceMotion ? false : { opacity: 0, y: 24, rotate: -6 }}
            animate={{ opacity: 1, y: 0, rotate: -2 }}
            transition={{ duration: 0.5, delay: 0.18, ease: EASE_OUT }}
            whileHover={
              reduceMotion ? undefined : { rotate: -2, y: -4 }
            }
            whileTap={reduceMotion ? undefined : { scale: 0.98 }}
          >
            <div className="deck-empty__plus" aria-hidden="true">+</div>
            <div className="deck-empty__title">No trips on the wall</div>
            <div className="deck-empty__sub">
              Tap to plan your first cragstronaut mission.
            </div>
          </motion.button>
        ) : (
          <div
            className="deck-stack"
            style={{
              minHeight: 280 + offsetForIndex(Math.min(upcoming.length - 1, 5)),
            }}
          >
            {[...upcoming]
              .slice(0, 6)
              .reverse()
              .map((trip, revIdx, arr) => {
                const i = arr.length - 1 - revIdx;
                const rot = rotForIndex(i);
                const top = i === 0;
                const days = daysUntil(trip, t);
                const chipLabel =
                  days == null
                    ? "Soon"
                    : days <= 0
                    ? "On now"
                    : days === 1
                    ? "Tomorrow"
                    : days < 14
                    ? `In ${days} days`
                    : `In ${Math.round(days / 7)} wk`;
                const finalTransform = `translateY(${offsetForIndex(i)}px) rotate(${rot}deg) scale(${scaleForIndex(i)})`;
                return (
                  <motion.button
                    key={trip.id}
                    type="button"
                    className="deck-card"
                    onClick={() => onSelect(trip.id)}
                    style={{
                      transformOrigin: "50% 0%",
                      zIndex: 20 - i,
                      "--card-rot": `${rot}deg`,
                    }}
                    initial={
                      reduceMotion
                        ? { transform: finalTransform }
                        : {
                            opacity: 0,
                            // Cards swoop in from above the stack
                            transform: `translateY(${offsetForIndex(i) - 60}px) rotate(${rot * 0.3}deg) scale(${scaleForIndex(i)})`,
                          }
                    }
                    animate={{
                      opacity: 1,
                      transform: finalTransform,
                    }}
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : {
                            // Spring per card so they settle naturally,
                            // staggered so the deck assembles top-down.
                            type: "spring",
                            stiffness: 220,
                            damping: 24,
                            delay: 0.22 + (arr.length - 1 - i) * 0.07,
                          }
                    }
                  >
                    <div className="deck-card__topline">
                      <span className="deck-card__date">
                        {dateRangeShort(trip)}
                      </span>
                      {top && (
                        <span className="deck-card__chip deck-card__chip--soon">
                          {chipLabel}
                        </span>
                      )}
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
                      <span className="deck-card__cta">Open trip →</span>
                    </div>
                  </motion.button>
                );
              })}
          </div>
        )}

        {/* Past trips */}
        {past.length > 0 && (
          <motion.div
            className="past-trips-list"
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: 0.5, ease: EASE_OUT }}
          >
            <div className="h2">Past climbs</div>
            {past.map((trip) => (
              <button
                key={trip.id}
                className="secondary"
                onClick={() => onSelect(trip.id)}
                style={{
                  textAlign: "left",
                  display: "block",
                  width: "100%",
                  marginBottom: 8,
                }}
              >
                <div style={{ fontWeight: 600 }}>{trip.location}</div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {dateRangeShort(trip)}
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </div>

      {/* Floating thumb-zone CTA */}
      {upcoming.length > 0 && (
        <motion.div
          className="bottom-cta bottom-cta--center"
          initial={reduceMotion ? false : { opacity: 0, y: 48 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 300, damping: 28, delay: 0.55 }
          }
        >
          <motion.button
            className="btn-3d"
            onClick={onCreate}
            whileTap={reduceMotion ? undefined : { translateY: 5 }}
          >
            Plan new trip →
          </motion.button>
        </motion.div>
      )}
    </div>
  );
}
