import type { z } from "zod";
import type { TripIndexEntrySchema } from "@cragstronauts/contract";

export type TripEntry = z.infer<typeof TripIndexEntrySchema>;

const MS_PER_DAY = 86_400_000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export type Status = "upcoming" | "now" | "past" | "tbd";

export interface TripModel {
  status: Status;
  /** Negative once the trip has started, so past trips count down from 0. */
  daysUntil: number;
  dateLabel: string;
  dateMuted: boolean;
}

export interface ModelledTrip {
  trip: TripEntry;
  model: TripModel;
}

export function todayISO(): string {
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

export function modelFor(trip: TripEntry, todayStr: string): TripModel {
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

export interface TripBoard {
  /** The single featured trip: happening now, else soonest upcoming, else most recent past. */
  hero: ModelledTrip | null;
  /** Upcoming trips, soonest first, minus the hero when it came from this list. */
  upcomingRest: ModelledTrip[];
  /** Past trips, most recent first, minus the hero when it came from this list. */
  pastTrips: ModelledTrip[];
  current: ModelledTrip | null;
}

/** Split the account's trips into the hero + the two ordered sections. */
export function buildTripBoard(trips: TripEntry[], todayStr: string): TripBoard {
  const withModel = trips.map((t) => ({ trip: t, model: modelFor(t, todayStr) }));

  const current = withModel.find((x) => x.model.status === "now") ?? null;

  // Soonest first; dateless trips sink to the bottom.
  const upcoming = withModel
    .filter((x) => x.model.status === "upcoming" || x.model.status === "tbd")
    .sort((a, b) => {
      if (a.model.status === "tbd") return 1;
      if (b.model.status === "tbd") return -1;
      return a.model.daysUntil - b.model.daysUntil;
    });

  // Past trips have a negative daysUntil, so descending puts the most recent
  // (closest to 0) first — that's the one the "Last trip" hero should show.
  const past = withModel
    .filter((x) => x.model.status === "past")
    .sort((a, b) => b.model.daysUntil - a.model.daysUntil);

  const hero = current ?? upcoming[0] ?? past[0] ?? null;
  const upcomingRest = current ? upcoming : upcoming.slice(1);
  const pastTrips = hero && hero === past[0] ? past.slice(1) : past;

  return { hero, upcomingRest, pastTrips, current };
}
