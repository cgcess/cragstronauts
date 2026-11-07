import React, { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { buildTripBoard, todayISO, type TripEntry, type TripModel } from "../lib/tripBoard";
import { Tag } from "./ui";

function HeroTripCard({
  trip,
  model,
  onClick,
  isOrganizer,
}: {
  trip: TripEntry;
  model: TripModel;
  onClick: () => void;
  isOrganizer?: boolean;
}) {
  const isPast = model.status === "past";
  const isNow = model.status === "now";

  let countNode: React.ReactNode;
  if (model.status === "now") {
    countNode = <Tag variant="ember" dot>On Now</Tag>;
  } else if (model.status === "tbd") {
    countNode = (
      <>
        <span className="fl-hero__countdown-num">—</span>
        <span className="fl-hero__countdown-label">TBD</span>
      </>
    );
  } else if (isPast) {
    countNode = (
      <>
        <span className="fl-hero__countdown-num">{Math.abs(model.daysUntil)}</span>
        <span className="fl-hero__countdown-label">Days ago</span>
      </>
    );
  } else {
    countNode = (
      <>
        <span className="fl-hero__countdown-num">{model.daysUntil}</span>
        <span className="fl-hero__countdown-label">
          {model.daysUntil === 1 ? "Day to go" : "Days to go"}
        </span>
      </>
    );
  }

  const className = [
    "fl-hero",
    isPast ? "fl-hero--past" : "",
    isNow ? "fl-hero--now" : "",
    isOrganizer ? "fl-hero--organizer" : "",
  ].filter(Boolean).join(" ");

  return (
    <motion.button
      type="button"
      className={className}
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
    >
      {isOrganizer && <span className="fl-organizer-badge">Organizer</span>}
      <span className="fl-hero__accent-glow" aria-hidden="true" />
      <div className="fl-hero__top">
        <span style={{ color: "var(--fl-fg-3)", letterSpacing: "0.14em" }}>
          {isPast ? "Last trip" : isNow ? "Happening now" : "Next trip"}
        </span>
      </div>
      <div className="fl-hero__countdown">{countNode}</div>
      <h2 className="fl-hero__title">{trip.name || "Untitled trip"}</h2>
      <div className={"fl-hero__dates" + (model.dateMuted ? " fl-trip-card__dates--muted" : "")}>
        {model.dateLabel}
      </div>
      <span className="fl-hero__cta">
        {isPast ? "Look back" : "Open trip"} →
      </span>
    </motion.button>
  );
}

function TripCard({
  trip,
  model,
  onClick,
  isOrganizer,
}: {
  trip: TripEntry;
  model: TripModel;
  onClick: () => void;
  isOrganizer?: boolean;
}) {
  const isPast = model.status === "past";
  const isNow = model.status === "now";

  let countNode: React.ReactNode;
  let labelNode: React.ReactNode;
  if (model.status === "now") {
    countNode = null;
    labelNode = <Tag variant="ember" dot>On Now</Tag>;
  } else if (model.status === "tbd") {
    countNode = <span className="fl-trip-card__count">—</span>;
    labelNode = <span className="fl-trip-card__label">TBD</span>;
  } else if (isPast) {
    countNode = <span className="fl-trip-card__count">{Math.abs(model.daysUntil)}</span>;
    labelNode = <span className="fl-trip-card__label">Days Ago</span>;
  } else {
    countNode = <span className="fl-trip-card__count">{model.daysUntil}</span>;
    labelNode = <span className="fl-trip-card__label">{model.daysUntil === 1 ? "Day" : "Days"}</span>;
  }

  const className = [
    "fl-trip-card",
    isPast ? "fl-trip-card--past" : "",
    isNow ? "fl-trip-card--now" : "",
    isOrganizer ? "fl-trip-card--organizer" : "",
  ].filter(Boolean).join(" ");

  return (
    <motion.button
      type="button"
      className={className}
      onClick={onClick}
      whileHover={{ scale: 1.005 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
    >
      {isOrganizer && <span className="fl-organizer-badge">Organizer</span>}
      <div className="fl-trip-card__count-col">
        {countNode}
        {labelNode}
      </div>
      <div className="fl-trip-card__details">
        <div className="fl-trip-card__meta">
          <h3 className="fl-trip-card__title">{trip.name || "Untitled trip"}</h3>
        </div>
        <div className={"fl-trip-card__dates" + (model.dateMuted ? " fl-trip-card__dates--muted" : "")}>
          {model.dateLabel}
        </div>
      </div>
      <span className="fl-trip-card__accent" aria-hidden="true" />
    </motion.button>
  );
}

// The hero/card trip board, shared by TripListing and the legacy finder.
export default function TripsView({
  trips,
  loaded,
  onSelect,
  onCreate,
  tabs,
  emptyTitle = "No trips on the wall yet",
  emptySub = "Tap to plan your first cragstronaut mission.",
}: {
  trips: TripEntry[];
  loaded: boolean;
  onSelect: (trip: TripEntry) => void;
  onCreate: () => void;
  /** Optional scope switcher rendered under the brand header (e.g. My/All). */
  tabs?: React.ReactNode;
  emptyTitle?: string;
  emptySub?: string;
}) {
  const reduceMotion = useReducedMotion();
  const today = useMemo(todayISO, []);

  const { hero, upcomingRest, pastTrips, current } = useMemo(
    () => buildTripBoard(trips, today),
    [trips, today]
  );

  if (!loaded) {
    return (
      <div className="app-shell">
        <div className="content">
          <div className="column">
            <p className="muted">Loading…</p>
          </div>
        </div>
      </div>
    );
  }

  const hasAnyTrip = trips.length > 0;

  return (
    <div className="app-shell">
      <div className="fade-overlay fade-overlay--top" aria-hidden="true" />
      <div className="content">
        <div className="column">
          {tabs}

          {!hasAnyTrip ? (
            <motion.button
              type="button"
              className="fl-empty"
              onClick={onCreate}
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.36, delay: 0.1 }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.99 }}
            >
              <div className="fl-empty__plus">+</div>
              <div className="fl-empty__title">{emptyTitle}</div>
              <div className="fl-empty__sub">{emptySub}</div>
            </motion.button>
          ) : (
            <div className="fl-page">
              {hero && (
                <motion.div
                  initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                >
                  <HeroTripCard
                    trip={hero.trip}
                    model={hero.model}
                    onClick={() => onSelect(hero.trip)}
                    isOrganizer={hero.trip.role === "owner"}
                  />
                </motion.div>
              )}

              {upcomingRest.length > 0 && (
                <>
                  <div className="fl-section-label">
                    {current ? "Upcoming" : "Coming up next"}
                  </div>
                  {upcomingRest.map(({ trip, model }, i) => (
                    <motion.div
                      key={trip.id}
                      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.32, delay: 0.08 + i * 0.04 }}
                    >
                      <TripCard trip={trip} model={model} onClick={() => onSelect(trip)} isOrganizer={trip.role === "owner"} />
                    </motion.div>
                  ))}
                </>
              )}

              {pastTrips.length > 0 && (
                <>
                  <div className="fl-section-label">Past</div>
                  {pastTrips.map(({ trip, model }, i) => (
                    <motion.div
                      key={trip.id}
                      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.32, delay: 0.04 + i * 0.03 }}
                    >
                      <TripCard trip={trip} model={model} onClick={() => onSelect(trip)} isOrganizer={trip.role === "owner"} />
                    </motion.div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {hasAnyTrip && (
        <motion.button
          type="button"
          className="fab"
          onClick={onCreate}
          aria-label="Plan new trip"
          initial={reduceMotion ? false : { opacity: 0, scale: 0.85, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 26, delay: 0.25 }}
          whileTap={reduceMotion ? undefined : { scale: 0.94 }}
        >
          +
        </motion.button>
      )}
    </div>
  );
}
