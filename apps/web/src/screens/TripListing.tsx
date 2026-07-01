import React, { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router";
import { SignInButton, useUser } from "@clerk/clerk-react";
import { clerkEnabled } from "../lib/clerk";
import { api } from "../api";
import { tripPath } from "../lib/tripUrl";
import type { z } from "zod";
import type { TripIndexEntrySchema } from "@cragstronauts/contract";

type TripEntry = z.infer<typeof TripIndexEntrySchema>;

const MS_PER_DAY = 86_400_000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

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

function dateLabel(trip: TripEntry): string {
  const start = parseISODate(trip.start_date);
  const end = parseISODate(trip.end_date) ?? start;
  if (!start) return "Dates TBD";
  if (end && end.getTime() !== start.getTime())
    return `${formatShortDate(start)} → ${formatShortDate(end)}`;
  return formatShortDate(start);
}

function daysUntil(trip: TripEntry): number | null {
  const start = parseISODate(trip.start_date);
  if (!start) return null;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return Math.round((start.getTime() - today.getTime()) / MS_PER_DAY);
}

function Brand({ reduceMotion }: { reduceMotion: boolean | null }) {
  return (
    <>
      <motion.div
        className="fl-brand"
        initial={reduceMotion ? false : { opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32 }}
      >
        <span className="fl-brand__glyph">🧗</span>
        Cragstronauts
      </motion.div>
      <div className="fl-brand__sub">Plan the climb. Pack the car.</div>
    </>
  );
}

function SignedInHome() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [trips, setTrips] = useState<TripEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.myTrips()
      .then((t) => { setTrips(t); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  const sorted = useMemo(() => {
    return [...trips].sort((a, b) => {
      const da = daysUntil(a);
      const db = daysUntil(b);
      if (da === null && db === null) return 0;
      if (da === null) return 1;
      if (db === null) return -1;
      // Upcoming first (positive, ascending), then past (negative, descending)
      if (da >= 0 && db >= 0) return da - db;
      if (da < 0 && db < 0) return db - da;
      return da >= 0 ? -1 : 1;
    });
  }, [trips]);

  const onCreate = () => navigate("/trips/new");
  const onSelect = (trip: TripEntry) => navigate(tripPath(trip.name, trip.id));

  return (
    <div className="app-shell">
      <div className="fade-overlay fade-overlay--top" aria-hidden="true" />
      <div className="content">
        <div className="column">
          <Brand reduceMotion={reduceMotion} />

          {!loaded ? (
            <p className="muted">Loading…</p>
          ) : sorted.length === 0 ? (
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
              <div className="fl-empty__title">No trips yet</div>
              <div className="fl-empty__sub">Tap to plan your first cragstronaut mission.</div>
            </motion.button>
          ) : (
            <div className="fl-page">
              {sorted.map((trip, i) => {
                const d = daysUntil(trip);
                const label = dateLabel(trip);
                const isPast = d !== null && d < 0;
                return (
                  <motion.button
                    key={trip.id}
                    type="button"
                    className={"fl-trip-card" + (isPast ? " fl-trip-card--past" : "")}
                    onClick={() => onSelect(trip)}
                    initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.32, delay: 0.06 + i * 0.04 }}
                    whileHover={{ scale: 1.005 }}
                    whileTap={{ scale: 0.985 }}
                  >
                    <div className="fl-trip-card__count-col">
                      {d === null ? (
                        <>
                          <span className="fl-trip-card__count">—</span>
                          <span className="fl-trip-card__label">TBD</span>
                        </>
                      ) : d === 0 ? (
                        <span className="fl-trip-card__label">Today</span>
                      ) : d > 0 ? (
                        <>
                          <span className="fl-trip-card__count">{d}</span>
                          <span className="fl-trip-card__label">{d === 1 ? "Day" : "Days"}</span>
                        </>
                      ) : (
                        <>
                          <span className="fl-trip-card__count">{Math.abs(d)}</span>
                          <span className="fl-trip-card__label">Days Ago</span>
                        </>
                      )}
                    </div>
                    <div className="fl-trip-card__details">
                      <div className="fl-trip-card__meta">
                        <span className="fl-trip-card__icon" aria-hidden="true">🧗</span>
                        <h3 className="fl-trip-card__title">{trip.name || "Untitled trip"}</h3>
                      </div>
                      <div className={"fl-trip-card__dates" + (d === null ? " fl-trip-card__dates--muted" : "")}>
                        {label}
                      </div>
                    </div>
                    <span className="fl-trip-card__accent" aria-hidden="true" />
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {sorted.length > 0 && (
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

function SignedOutHome() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="app-shell">
      <div className="fade-overlay fade-overlay--top" aria-hidden="true" />
      <div className="content">
        <div className="column">
          <Brand reduceMotion={reduceMotion} />

          <motion.div
            className="card"
            style={{ textAlign: "center", padding: "32px 24px" }}
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.36, delay: 0.1 }}
          >
            <p style={{ marginBottom: 16 }}>
              Sign in to create trips and see the ones you're part of.
            </p>
            <SignInButton mode="modal">
              <button type="button" className="th-btn th-btn--primary th-btn--full">
                Sign in
              </button>
            </SignInButton>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function AnonymousHome() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  return (
    <div className="app-shell">
      <div className="fade-overlay fade-overlay--top" aria-hidden="true" />
      <div className="content">
        <div className="column">
          <Brand reduceMotion={reduceMotion} />

          <motion.button
            type="button"
            className="fl-empty"
            onClick={() => navigate("/trips/new")}
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.36, delay: 0.1 }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.99 }}
          >
            <div className="fl-empty__plus">+</div>
            <div className="fl-empty__title">Plan a new trip</div>
            <div className="fl-empty__sub">Tap to start your next cragstronaut mission.</div>
          </motion.button>
        </div>
      </div>
    </div>
  );
}

export default function TripListing() {
  if (!clerkEnabled) return <AnonymousHome />;

  const { isSignedIn, isLoaded } = useUser();

  if (!isLoaded) {
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

  return isSignedIn ? <SignedInHome /> : <SignedOutHome />;
}
