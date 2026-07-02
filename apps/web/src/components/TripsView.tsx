import React, { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { z } from "zod";
import type { TripIndexEntrySchema } from "@cragstronauts/contract";
import { Tag } from "./ui";

type TripEntry = z.infer<typeof TripIndexEntrySchema>;

const MS_PER_DAY = 86_400_000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

type Status = "upcoming" | "now" | "past" | "tbd";

interface TripModel {
  status: Status;
  daysUntil: number;
  dateLabel: string;
  dateMuted: boolean;
}

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseISODate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const part = iso.slice(0, 10);
  const [y, m, d] = part.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

function formatShortDate(d: Date): string {
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

function modelFor(trip: TripEntry, todayStr: string): TripModel {
  const today = parseISODate(todayStr) ?? new Date();
  const start = parseISODate(trip.start_date);
  const end = parseISODate(trip.end_date) ?? start;

  if (!start) {
    return { status: "tbd", daysUntil: 0, dateLabel: "Dates TBD", dateMuted: true };
  }

  const daysUntil = Math.round((start.getTime() - today.getTime()) / MS_PER_DAY);
  const endTime = (end ?? start).getTime();
  const inProgress = today.getTime() >= start.getTime() && today.getTime() <= endTime;

  const dateLabel =
    end && end.getTime() !== start.getTime()
      ? `${formatShortDate(start)} → ${formatShortDate(end)}`
      : formatShortDate(start);

  let status: Status;
  if (inProgress) status = "now";
  else if (daysUntil < 0) status = "past";
  else status = "upcoming";

  return { status, daysUntil, dateLabel, dateMuted: false };
}

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
        <span aria-hidden="true">🧗</span>
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
          <span className="fl-trip-card__icon" aria-hidden="true">🧗</span>
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

  const { hero, upcomingRest, pastTrips, current } = useMemo(() => {
    const withModel = trips.map((t) => ({ trip: t, model: modelFor(t, today) }));
    const current = withModel.find((x) => x.model.status === "now") ?? null;
    const upcoming = withModel
      .filter((x) => x.model.status === "upcoming" || x.model.status === "tbd")
      .sort((a, b) => {
        if (a.model.status === "tbd") return 1;
        if (b.model.status === "tbd") return -1;
        return a.model.daysUntil - b.model.daysUntil;
      });
    const past = withModel
      .filter((x) => x.model.status === "past")
      .sort((a, b) => a.model.daysUntil - b.model.daysUntil);

    const hero = current ?? upcoming[0] ?? past[0] ?? null;
    const upcomingRest = current ? upcoming : upcoming.slice(1);
    const pastTrips = hero && hero === past[0] ? past.slice(1) : past;
    return { hero, upcomingRest, pastTrips, current };
  }, [trips, today]);

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
          {/* Brand now lives in the global top bar (App.tsx) whenever the
              "My trips" button is hidden, so it's not repeated here. */}
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
