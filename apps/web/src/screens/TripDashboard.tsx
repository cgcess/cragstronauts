import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import { DayPicker, type DateRange } from "react-day-picker";
import type { z } from "zod";
import type { CarSchema, DogSchema, GearContributionSchema, ExpenseSchema, SettlementSchema, FeedbackSchema } from "@cragstronauts/contract";
import { api } from "../api";
import { tripPath, slugify } from "../lib/tripUrl";
import { cleanLinks } from "../lib/links";
import { unansweredPolls } from "../lib/remaining";
import { summarizeSplit } from "../lib/expense-summary";
import LinksEditor from "../components/LinksEditor";
import {
  useTripContext,
  type Category,
  type Poll,
  type PollAnswer,
} from "../context/TripContext";
import { formatDateRange } from "../dateUtils";
import Linkify from "../components/Linkify";
import Markdown from "../components/Markdown";
import DateRangePicker from "../components/DateRangePicker";
import BottomSheet from "../components/BottomSheet";
import { Button, Tag } from "../components/ui";

type Car = z.infer<typeof CarSchema>;
type Dog = z.infer<typeof DogSchema>;
type Contribution = z.infer<typeof GearContributionSchema>;
type Expense = z.infer<typeof ExpenseSchema>;
type Settlement = z.infer<typeof SettlementSchema>;

// Sub-views inside the Expenses drawer. The list is the root; add/edit/settle
// are pushed on top with a right-to-left slide.
type ExpView =
  | { kind: "list" }
  | { kind: "add" }
  | { kind: "edit"; expense: Expense }
  | { kind: "settle"; target: Settlement };

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/* ------------------------------------------------------------------ */
/* Share + add-to-calendar                                             */
/* ------------------------------------------------------------------ */

type ShareableTrip = {
  name: string;
  location: string;
  start_date: string | null;
  end_date: string | null;
  accommodation_details: string | null;
  notes: string | null;
  place_label: string | null;
  latitude: number | null;
  longitude: number | null;
};

/** Escape a value for an iCalendar TEXT field (RFC 5545 §3.3.11). */
function icsEscape(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** ISO date ("2026-05-28") → iCalendar DATE value ("20260528"). */
function icsDate(isoDate: string): string {
  return isoDate.replace(/-/g, "");
}

/** Add whole days to an ISO date string, returning a new ISO date. */
function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Build an all-day VEVENT .ics document for a trip. Opening the file triggers
 * the native "add to calendar" flow on both iOS (Apple Calendar) and Android
 * (Google Calendar). Returns null when the trip has no dates to anchor to.
 */
function buildTripIcs(trip: ShareableTrip, url: string): string | null {
  const start = trip.start_date || trip.end_date;
  if (!start) return null;
  // DTEND is exclusive for all-day events → the day after the last day.
  const end = addDaysIso(trip.end_date || start, 1);
  const stamp =
    new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const uid = `${icsDate(start)}-${Math.random().toString(36).slice(2)}@cragstronauts`;

  const place = [trip.place_label || trip.location, trip.accommodation_details]
    .filter(Boolean)
    .join(" · ");
  const description = [trip.notes, `Trip details: ${url}`]
    .filter(Boolean)
    .join("\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cragstronauts//Trip//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `SUMMARY:${icsEscape("🧗 " + trip.name)}`,
    `DTSTART;VALUE=DATE:${icsDate(start)}`,
    `DTEND;VALUE=DATE:${icsDate(end)}`,
    `LOCATION:${icsEscape(place)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    `URL:${icsEscape(url)}`,
  ];
  if (trip.latitude != null && trip.longitude != null) {
    lines.push(`GEO:${trip.latitude};${trip.longitude}`);
  }
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

/** Hand the .ics off to the OS so the native calendar app can import it. */
function openCalendarFile(filename: string, ics: string) {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Weather                                                             */
/* ------------------------------------------------------------------ */

interface WeatherDay {
  date: string;
  code: number;
  hi: number | null;
  lo: number | null;
  precip: number | null;
}
type WeatherState =
  | { status: "no-pin" }
  | { status: "no-dates" }
  | { status: "past" }
  | { status: "too-far"; daysUntil: number }
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; days: WeatherDay[] };

function wmo(code: number): { icon: string; label: string } {
  if (code === 0) return { icon: "☀️", label: "Clear" };
  if (code === 1 || code === 2) return { icon: "⛅", label: "Partly cloudy" };
  if (code === 3) return { icon: "☁️", label: "Overcast" };
  if (code === 45 || code === 48) return { icon: "🌫️", label: "Fog" };
  if (code >= 51 && code <= 57) return { icon: "🌦️", label: "Drizzle" };
  if (code >= 61 && code <= 67) return { icon: "🌧️", label: "Rain" };
  if (code >= 71 && code <= 77) return { icon: "🌨️", label: "Snow" };
  if (code >= 80 && code <= 82) return { icon: "🌧️", label: "Showers" };
  if (code >= 85 && code <= 86) return { icon: "🌨️", label: "Snow showers" };
  if (code >= 95) return { icon: "⛈️", label: "Thunderstorm" };
  return { icon: "🌡️", label: "—" };
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}
const DAY_MS = 86400000;
const FORECAST_HORIZON = 15;

function daysUntil(startStr: string | null): number | null {
  if (!startStr) return null;
  const start = new Date(startStr + "T00:00:00");
  return Math.round((start.getTime() - startOfToday().getTime()) / DAY_MS);
}

function useWeather(
  lat: number | null,
  lon: number | null,
  startStr: string | null,
  endStr: string | null
): WeatherState {
  const [state, setState] = useState<WeatherState>({ status: "loading" });

  useEffect(() => {
    if (lat == null || lon == null) {
      setState({ status: "no-pin" });
      return;
    }
    if (!startStr) {
      setState({ status: "no-dates" });
      return;
    }
    const today = startOfToday();
    const start = new Date(startStr + "T00:00:00");
    const end = endStr ? new Date(endStr + "T00:00:00") : start;
    const dUntil = Math.round((start.getTime() - today.getTime()) / DAY_MS);

    if (end.getTime() < today.getTime()) {
      setState({ status: "past" });
      return;
    }
    if (dUntil > FORECAST_HORIZON) {
      setState({ status: "too-far", daysUntil: dUntil });
      return;
    }

    const fStart = start.getTime() < today.getTime() ? today : start;
    const horizon = new Date(today.getTime() + FORECAST_HORIZON * DAY_MS);
    const fEnd = end.getTime() > horizon.getTime() ? horizon : end;

    setState({ status: "loading" });
    let cancelled = false;
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
      `&temperature_unit=celsius&timezone=auto&start_date=${iso(fStart)}&end_date=${iso(fEnd)}`;
    fetch(url)
      .then((r) => r.json())
      .then((d: any) => {
        if (cancelled) return;
        const dl = d?.daily;
        if (!dl?.time) {
          setState({ status: "error" });
          return;
        }
        const days: WeatherDay[] = dl.time.map((t: string, i: number) => ({
          date: t,
          code: dl.weather_code[i],
          hi: dl.temperature_2m_max?.[i] ?? null,
          lo: dl.temperature_2m_min?.[i] ?? null,
          precip: dl.precipitation_probability_max?.[i] ?? null,
        }));
        setState({ status: "ready", days });
      })
      .catch(() => !cancelled && setState({ status: "error" }));
    return () => {
      cancelled = true;
    };
  }, [lat, lon, startStr, endStr]);

  return state;
}

/* ------------------------------------------------------------------ */
/* Card shell                                                          */
/* ------------------------------------------------------------------ */

/**
 * Compact dashboard tile — sized to sit in a 2-column grid (iOS Weather
 * detail-tile pattern). The full body is rendered separately in a
 * bottom sheet, so the tile itself is just the at-a-glance summary +
 * a tap target.
 */
function DashTile({
  icon,
  title,
  summary,
  badge,
  urgent,
  onClick,
}: {
  icon: string;
  title: string;
  summary?: React.ReactNode;
  badge?: React.ReactNode;
  urgent?: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      className={`dash-tile${urgent ? " dash-tile--urgent" : ""}`}
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
    >
      <span className="dash-tile__top">
        <span className="dash-tile__icon" aria-hidden="true">{icon}</span>
        {badge != null && (
          <span className="dash-tile__badge">
            <Tag variant="neutral" size="sm" mono>{badge}</Tag>
          </span>
        )}
      </span>
      <span className="dash-tile__title">{title}</span>
      {urgent && <span className="dash-tile__flag">Action needed</span>}
      {summary != null && (
        <span className="dash-tile__summary">{summary}</span>
      )}
    </motion.button>
  );
}

/**
 * Horizontal nudge between the hero and the mosaic: tells the current user how
 * many polls they still owe an answer and reopens the deck (filtered to just
 * those) on tap. Self-clears once they're caught up, so the dashboard only
 * shows it when there's something outstanding.
 */
function NudgeCard({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      className="dash-nudge"
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
    >
      <span className="dash-nudge__icon" aria-hidden="true">🗳️</span>
      <span className="dash-nudge__text">
        <span className="dash-nudge__title">
          {count} {count === 1 ? "question needs" : "questions need"} your answer
        </span>
        <span className="dash-nudge__sub">Tap to finish</span>
      </span>
      <span className="dash-nudge__chevron" aria-hidden="true">→</span>
    </motion.button>
  );
}

/* ------------------------------------------------------------------ */
/* Feedback                                                            */
/* ------------------------------------------------------------------ */

type Feedback = z.infer<typeof FeedbackSchema>;

/**
 * Bottom-of-board feedback: anyone can leave a note; the organizer also sees
 * everyone's feedback. Stored server-side (per-trip Durable Object).
 */
function FeedbackSection({
  tripId,
  userId,
  isOrganizer,
}: {
  tripId: string;
  userId: number;
  isOrganizer: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [anon, setAnon] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [list, setList] = useState<Feedback[] | null>(null);

  const loadList = async () => {
    if (!isOrganizer) return;
    try {
      setList(await api.listFeedback(tripId, userId));
    } catch {
      /* organizer-only; ignore transient errors */
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadList();
  }, [isOrganizer, tripId]);

  const submit = async () => {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    setErr(null);
    try {
      await api.createFeedback(tripId, { user_id: userId, body, anonymous: anon });
      setText("");
      setAnon(false);
      setOpen(false);
      setSent(true);
      loadList();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div
        className="muted"
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          marginBottom: 12,
        }}
      >
        Feedback
      </div>

      {!open && (
        <div className="row" style={{ alignItems: "center", gap: 10 }}>
          <Button variant="secondary" onClick={() => { setSent(false); setOpen(true); }}>
            {sent ? "Add more feedback" : "Give feedback"}
          </Button>
          {sent && (
            <span className="muted" style={{ fontSize: 13 }}>
              Thanks for the feedback! 🙌
            </span>
          )}
        </div>
      )}

      {open && (
        <div className="col" style={{ gap: 10 }}>
          <textarea
            rows={4}
            placeholder="What worked, what didn't, ideas for next time…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
          />
          {err && <div className="error-banner">{err}</div>}
          <button
            type="button"
            role="switch"
            aria-checked={anon}
            className={"switch" + (anon ? " is-on" : "")}
            onClick={() => setAnon((v) => !v)}
          >
            <span className="switch__track" aria-hidden="true">
              <span className="switch__thumb" />
            </span>
            Submit anonymously
          </button>
          <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
            <Button
              variant="text"
              onClick={() => {
                setOpen(false);
                setText("");
                setAnon(false);
                setErr(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!text.trim() || busy}
              onClick={submit}
            >
              {busy ? "Sending…" : "Submit feedback"}
            </Button>
          </div>
        </div>
      )}

      {isOrganizer && (
        <div style={{ marginTop: 16 }}>
          <div
            className="muted"
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            All feedback{list ? ` (${list.length})` : ""}
          </div>
          {list == null ? (
            <p className="muted" style={{ fontSize: 13 }}>Loading…</p>
          ) : list.length === 0 ? (
            <p className="muted" style={{ fontSize: 13 }}>
              No feedback yet — you'll see everyone's notes here.
            </p>
          ) : (
            <div className="col" style={{ gap: 10 }}>
              {list.map((f) => (
                <div
                  key={f.id}
                  className="card"
                  style={{ padding: "10px 12px" }}
                >
                  <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                    {f.body}
                  </div>
                  <div
                    className="muted"
                    style={{ fontSize: 12, marginTop: 6 }}
                  >
                    — {f.author_name} ·{" "}
                    {new Date(f.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

export default function TripDashboard() {
  const {
    tripId,
    trip,
    users,
    categories,
    polls,
    pollAnswers,
    currentUserId,
    switchUser,
    ensureUser,
    openQuestions,
    refresh,
    deleteTrip,
  } = useTripContext();
  const navigate = useNavigate();
  const me = users.find((u) => u.id === currentUserId) ?? null;
  const isOrganizer = me?.is_organizer ?? false;

  const [cars, setCars] = useState<Car[]>([]);
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [gear, setGear] = useState<Contribution[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<Settlement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingHero, setEditingHero] = useState(false);
  const [weatherSheetOpen, setWeatherSheetOpen] = useState(false);
  const [calendarSheetOpen, setCalendarSheetOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Expenses drawer navigation (list ⇄ add/edit/settle). Direction drives the
  // slide animation: +1 pushes a sub-view in from the right, −1 pops back.
  const [expView, setExpView] = useState<ExpView>({ kind: "list" });
  const expDir = useRef(1);
  const navExp = (v: ExpView) => {
    expDir.current = v.kind === "list" ? -1 : 1;
    setExpView(v);
  };

  const shareTrip = async () => {
    const url = `${window.location.origin}${tripPath(trip.name, tripId)}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: trip.name,
          text: `Join the "${trip.name}" climbing trip`,
          url,
        });
        return;
      } catch (e) {
        // User dismissed the native share sheet — don't fall back to copy.
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      window.prompt("Copy this trip link:", url);
    }
  };

  const addToCalendar = () => {
    const url = `${window.location.origin}${tripPath(trip.name, tripId)}`;
    const ics = buildTripIcs(trip, url);
    if (!ics) return;
    openCalendarFile(`${slugify(trip.name) || "trip"}.ics`, ics);
  };

  const reload = async () => {
    setError(null);
    try {
      const [c, g, ex, bal, dg] = await Promise.all([
        api.listCars(tripId),
        api.listGear(tripId),
        api.listExpenses(tripId),
        api.getBalances(tripId),
        api.listDogs(tripId),
      ]);
      setCars(c);
      setDogs(dg);
      setGear(g);
      setExpenses(ex);
      setBalances(bal);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    reload();
  }, [tripId]);

  // The board is members-only. Anyone who hasn't joined (no established
  // identity for this trip) is bounced back to the landing page, where the
  // "Join trip" flow lives. Logging out also lands you here.
  useEffect(() => {
    if (currentUserId == null) {
      navigate(tripPath(trip.name, tripId), { replace: true });
    }
  }, [currentUserId, tripId, trip.location, navigate]);

  // Leave the trip from the topbar: removes you (+ your car/gear) after a
  // confirm, then exits to the trips list. Organizers can't leave outright —
  // they transfer ownership first (in the People list), so the button is
  // disabled for them. Mirrors the per-row "Leave" action in the roster.
  const leaveTrip = async () => {
    if (!me || me.is_organizer) return;
    if (
      !confirm(
        "Leave this trip? Your car and gear contributions will also be removed."
      )
    )
      return;
    setError(null);
    try {
      await api.deleteUser(tripId, me.id);
      navigate("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const weather = useWeather(
    trip.latitude,
    trip.longitude,
    trip.start_date,
    trip.end_date
  );


  // ---- Derived state for priority ----
  const joining = users.filter((u) => u.joining);
  const myCar = cars.find((c) => c.driver_user_id === currentUserId);
  const ridingIn = cars.find((c) =>
    c.passengers.some((p) => p.user_id === currentUserId)
  );
  const amInCar = Boolean(myCar || ridingIn);
  const seatsTotal = cars.reduce((n, c) => n + Math.max(0, c.total_seats), 0);
  const seatsFilled = cars.reduce((n, c) => n + 1 + c.passengers.length + c.dogs.length + c.reserved_seats, 0);
  const myGear = gear.filter((g) => g.user_id === currentUserId);
  const coveredCats = new Set(gear.map((g) => g.category_id)).size;
  const dUntil = daysUntil(trip.start_date);
  const tripUpcoming = dUntil == null || dUntil >= 0;

  // ---- Card definitions with priority scores ----
  type CardDef = {
    id: string;
    score: number;
    icon: string;
    title: string;
    summary: React.ReactNode;
    badge?: React.ReactNode;
    urgent?: boolean;
    body: React.ReactNode;
  };

  const cards: CardDef[] = [];

  // Cars — prominent if you (once identified) have no ride.
  const carsStatus = !me
    ? cars.length === 0
      ? "No rides yet"
      : `${cars.length} ${cars.length === 1 ? "car" : "cars"} offered`
    : amInCar
    ? myCar
      ? "You're driving"
      : `Riding with ${ridingIn?.driver_name}`
    : cars.length === 0
    ? "No rides yet"
    : "You don't have a ride yet";
  const carsUrgent = Boolean(me) && !amInCar;
  cards.push({
    id: "cars",
    score: carsUrgent ? 110 : 35,
    icon: "🚗",
    title: "Rides",
    urgent: carsUrgent,
    badge: cars.length ? `${seatsFilled}/${seatsTotal}` : undefined,
    summary: (
      <>
        <span>{carsStatus}</span>
        {cars.length > 0 && (
          <span className="dash-tile__chips">
            {cars.slice(0, 4).map((c) => {
              const filled = c.passengers.length + c.dogs.length + 1;
              return (
                <span key={c.id} className="dash-tile__chip">
                  🚗 <span className="dash-tile__chip-trunc">{c.driver_name}</span>{" "}
                  {filled}/{c.total_seats}
                </span>
              );
            })}
            {cars.length > 4 && (
              <span className="dash-tile__chip">+{cars.length - 4}</span>
            )}
          </span>
        )}
      </>
    ),
    body: (
      <CarsBody
        tripId={tripId}
        cars={cars}
        dogs={dogs}
        currentUserId={currentUserId}
        ensureUser={ensureUser}
        onChanged={reload}
      />
    ),
  });

  // Dogs — trip-level pets. The home for bringing/removing a dog.
  cards.push({
    id: "dogs",
    score: 30,
    icon: "🐕",
    title: "Dogs",
    badge: dogs.length ? `${dogs.length}` : undefined,
    summary: (
      <>
        <span>
          {dogs.length === 0
            ? "No dogs yet"
            : `${dogs.length} ${dogs.length === 1 ? "dog" : "dogs"} coming`}
        </span>
        {dogs.length > 0 && (
          <span className="dash-tile__chips">
            {dogs.slice(0, 4).map((d) => (
              <span key={d.id} className="dash-tile__chip">
                🐕 <span className="dash-tile__chip-trunc">{d.name}</span>
              </span>
            ))}
            {dogs.length > 4 && (
              <span className="dash-tile__chip">+{dogs.length - 4}</span>
            )}
          </span>
        )}
      </>
    ),
    body: (
      <DogsBody
        tripId={tripId}
        dogs={dogs}
        cars={cars}
        currentUserId={currentUserId}
        ensureUser={ensureUser}
        onChanged={reload}
      />
    ),
  });

  // Gear — prominent if you (once identified) haven't claimed anything.
  const gearUrgent = Boolean(me) && categories.length > 0 && myGear.length === 0;
  cards.push({
    id: "gear",
    score: gearUrgent ? 80 : 33,
    icon: "🎒",
    title: "Gear",
    urgent: gearUrgent,
    badge: categories.length ? `${coveredCats}/${categories.length}` : undefined,
    summary: (() => {
      if (categories.length === 0) return "No gear set up";
      const peopleByCat: Record<number, Set<number>> = {};
      const totalByCat: Record<number, number> = {};
      const numFieldByCategory: Record<number, string | undefined> = {};
      for (const cat of categories) {
        const numField = cat.fields.find((f) => f.type === "number");
        numFieldByCategory[cat.id] = numField?.key;
      }
      for (const g of gear) {
        if (!peopleByCat[g.category_id]) peopleByCat[g.category_id] = new Set();
        peopleByCat[g.category_id].add(g.user_id);
        if (!totalByCat[g.category_id]) totalByCat[g.category_id] = 0;
        const numKey = numFieldByCategory[g.category_id];
        const val = numKey ? Number(g.details[numKey]) : NaN;
        totalByCat[g.category_id] += Number.isFinite(val) && val > 0 ? val : 1;
      }
      return (
        <span className="dash-tile__chips">
          {categories.slice(0, 6).map((cat) => {
            const people = peopleByCat[cat.id]?.size ?? 0;
            const covered = people > 0;
            const n = cat.summary_mode === "total"
              ? (totalByCat[cat.id] ?? 0)
              : people;
            return (
              <span
                key={cat.id}
                className={
                  "dash-tile__chip" + (covered ? " is-on" : "")
                }
              >
                <span className="dash-tile__dot" aria-hidden="true">
                  {covered ? "●" : "○"}
                </span>
                {cat.name}
                {covered ? ` · ${n}` : ""}
              </span>
            );
          })}
          {categories.length > 6 && (
            <span className="dash-tile__chip">+{categories.length - 6}</span>
          )}
        </span>
      );
    })(),
    body: (
      <GearBody
        tripId={tripId}
        categories={categories}
        gear={gear}
        currentUserId={currentUserId}
        ensureUser={ensureUser}
        isOrganizer={isOrganizer}
        onChanged={reload}
      />
    ),
  });

  // Roster management (transfer / remove) — only relevant for organizers.
  // The climber list itself is shown in the hero card; this tile is only
  // surfaced when the organizer needs admin actions.
  if (isOrganizer) {
    cards.push({
      id: "roster",
      score: 40,
      icon: "🧗",
      title: "Manage members",
      badge: `${joining.length}`,
      summary: (
        <span className="dash-tile__sub">Transfer ownership · remove members</span>
      ),
      body: (
        <RosterBody
          tripId={tripId}
          users={users}
          currentUserId={currentUserId}
          isOrganizer={isOrganizer}
          onChanged={reload}
        />
      ),
    });
  }

  // Polls — organizer-defined questions (lead belay, BBQ headcount, …).
  {
    const joiningIds = new Set(joining.map((u) => u.id));
    const answeredCount = (pollId: number) =>
      new Set(
        pollAnswers
          .filter((a) => a.poll_id === pollId && joiningIds.has(a.user_id))
          .map((a) => a.user_id)
      ).size;
    cards.push({
      id: "polls",
      score: 35,
      icon: "🗳️",
      title: "Polls",
      badge: polls.length ? `${polls.length}` : undefined,
      summary:
        polls.length === 0 ? (
          "No polls yet"
        ) : (
          <span className="dash-tile__chips">
            {polls.slice(0, 4).map((p) => (
              <span key={p.id} className="dash-tile__chip">
                {p.emoji ? `${p.emoji} ` : ""}
                <span className="dash-tile__chip-trunc">{p.question}</span> ·{" "}
                {answeredCount(p.id)}/{joining.length}
              </span>
            ))}
            {polls.length > 4 && (
              <span className="dash-tile__chip">+{polls.length - 4}</span>
            )}
          </span>
        ),
      body: (
        <PollsBody
          tripId={tripId}
          polls={polls}
          pollAnswers={pollAnswers}
          joining={joining}
          currentUserId={currentUserId}
          ensureUser={ensureUser}
          isOrganizer={isOrganizer}
          onChanged={reload}
        />
      ),
    });
  }

  // Expenses
  const myExpenses = expenses.filter((e) => e.payer_user_id === currentUserId);
  const myBalance = balances.reduce((sum, b) => {
    if (b.from_user_id === currentUserId) return sum - b.amount_cents;
    if (b.to_user_id === currentUserId) return sum + b.amount_cents;
    return sum;
  }, 0);
  const hasBalance = balances.some(
    (b) => b.from_user_id === currentUserId || b.to_user_id === currentUserId
  );
  cards.push({
    id: "expenses",
    score: hasBalance ? 70 : 30,
    icon: "💸",
    title: "Expenses",
    badge: expenses.length ? `${expenses.length}` : undefined,
    urgent: Boolean(me) && myBalance < 0,
    summary: (() => {
      if (expenses.length === 0) return "No expenses yet";
      const totalSpent = expenses.reduce(
        (sum, e) => sum + e.amount_cents,
        0
      );
      const statusLine = !me
        ? `${formatCents(totalSpent)} total`
        : myBalance === 0
        ? "You're settled up"
        : myBalance > 0
        ? `You're owed ${formatCents(myBalance)}`
        : `You owe ${formatCents(-myBalance)}`;
      return (
        <>
          <span>{statusLine}</span>
          <span className="dash-tile__sub">
            {expenses.length}{" "}
            {expenses.length === 1 ? "expense" : "expenses"} ·{" "}
            {formatCents(totalSpent)} total
          </span>
        </>
      );
    })(),
    body: (
      <ExpensesBody
        tripId={tripId}
        expenses={expenses}
        balances={balances}
        users={users}
        currentUserId={currentUserId}
        ensureUser={ensureUser}
        view={expView}
        dir={expDir.current}
        onNav={navExp}
        onChanged={reload}
      />
    ),
  });

  // Equal-tile grid. Urgent cards bubble to the top; otherwise stable
  // [cars, gear, roster, expenses] order.
  const CARD_ORDER = ["cars", "gear", "roster", "expenses"];
  cards.sort((a, b) => {
    const aUrg = a.urgent ? 1 : 0;
    const bUrg = b.urgent ? 1 : 0;
    if (aUrg !== bUrg) return bUrg - aUrg;
    return CARD_ORDER.indexOf(a.id) - CARD_ORDER.indexOf(b.id);
  });

  // Tiles open into a bottom sheet; no auto-open on mount.
  const selectedCard = cards.find((c) => c.id === expandedId) ?? null;

  // Polls this identified user still owes an answer — drives the nudge card.
  const myUnansweredPolls =
    me != null
      ? unansweredPolls({ polls, pollAnswers, userId: currentUserId! })
      : [];

  // Guard fires the redirect above; render nothing while it takes effect so
  // the members-only board never flashes for a non-member.
  if (currentUserId == null) return null;

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="row between">
          <Button
            variant="text"
            onClick={leaveTrip}
            disabled={isOrganizer}
            title={
              isOrganizer
                ? "Transfer ownership in the People list before you can leave"
                : "Leave this trip"
            }
            style={{ marginLeft: -4 }}
          >
            🚪 Leave trip
          </Button>
          {me ? (
            <>
              <div className="glass-surface nav-cap">
                <strong>{me.name}</strong>
                {me.is_organizer && " 👑"}
              </div>
              <Button
                variant="text"
                onClick={() => {
                  switchUser();
                  navigate(tripPath(trip.name, tripId));
                }}
              >
                Logout
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div className="content content--dash">
        <div className="column column--dash">
        {error && <div className="error-banner">{error}</div>}

        {/* Weather-app hero: date / trip name / countdown / weather.
            Organizers edit title, dates & logistics inline here. */}
        {editingHero && isOrganizer ? (
          <HeroEdit
            trip={trip}
            tripId={tripId}
            tripUpcoming={tripUpcoming}
            onCancel={() => setEditingHero(false)}
            onSaved={async () => {
              setEditingHero(false);
              await reload();
            }}
            deleteTrip={deleteTrip}
          />
        ) : (
        <div className={"fl-detail-hero" + (tripUpcoming ? "" : " fl-detail-hero--past")}>
          {isOrganizer && (
            <button
              className="fl-detail-hero__edit"
              onClick={() => setEditingHero(true)}
              aria-label="Edit trip"
            >
              <PencilIcon />
            </button>
          )}
          {trip.start_date || trip.end_date ? (
            <button
              type="button"
              className="fl-detail-hero__meta fl-detail-hero__meta--btn"
              onClick={() => setCalendarSheetOpen(true)}
              aria-label="Open trip calendar"
            >
              <span aria-hidden="true">🧗</span>
              <span>{formatDateRange(trip.start_date, trip.end_date)}</span>
            </button>
          ) : (
            <div className="fl-detail-hero__meta">
              <span aria-hidden="true">🧗</span>
              <span>Dates TBD</span>
            </div>
          )}
          <h1 className="fl-detail-hero__title">{trip.name}</h1>
          <div className="fl-detail-hero__row">
            {dUntil == null ? (
              <div className="fl-detail-hero__count-col">
                <span className="fl-detail-hero__count-label">Dates TBD</span>
              </div>
            ) : (
              <button
                type="button"
                className="fl-detail-hero__count-col fl-detail-hero__count-col--btn"
                onClick={() => setCalendarSheetOpen(true)}
                aria-label="Open trip calendar"
              >
                {dUntil > 0 ? (
                  <>
                    <span className="fl-detail-hero__count">{dUntil}</span>
                    <span className="fl-detail-hero__count-label">
                      {dUntil === 1 ? "Day to go" : "Days to go"}
                    </span>
                  </>
                ) : dUntil === 0 ? (
                  <Tag variant="ember" dot>On Now</Tag>
                ) : (
                  <>
                    <span className="fl-detail-hero__count">{Math.abs(dUntil)}</span>
                    <span className="fl-detail-hero__count-label">Days ago</span>
                  </>
                )}
              </button>
            )}
            <HeroWeatherChip
              weather={weather}
              isOrganizer={isOrganizer}
              onOpen={() => setWeatherSheetOpen(true)}
            />
          </div>
          {(trip.links?.length ||
            trip.accommodation_details ||
            trip.start_date ||
            trip.end_date ||
            trip.notes ||
            joining.length > 0) && (
            <div className="fl-detail-hero__logistics">
              {trip.links?.length ? (
                <div className="fl-detail-hero__logistics-item">
                  <span
                    className="fl-detail-hero__logistics-icon"
                    aria-hidden="true"
                  >
                    📍
                  </span>
                  <div className="fl-detail-hero__logistics-text">
                    <span className="fl-detail-hero__logistics-label">
                      Links
                    </span>
                    <span className="fl-detail-hero__logistics-detail fl-detail-hero__links">
                      {trip.links.map((l, i) => (
                        <a
                          key={i}
                          href={l.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="fl-detail-hero__link"
                        >
                          {l.name}
                        </a>
                      ))}
                    </span>
                  </div>
                </div>
              ) : null}
              {trip.accommodation_details ? (
                <div className="fl-detail-hero__logistics-item">
                  <span
                    className="fl-detail-hero__logistics-icon"
                    aria-hidden="true"
                  >
                    {accomMeta(trip.accommodation_type)?.icon ?? "🏠"}
                  </span>
                  <div className="fl-detail-hero__logistics-text">
                    <span className="fl-detail-hero__logistics-label">
                      {accomMeta(trip.accommodation_type)?.label ??
                        "Accommodation"}
                    </span>
                    <span className="fl-detail-hero__logistics-detail">
                      <Linkify>{trip.accommodation_details}</Linkify>
                    </span>
                  </div>
                </div>
              ) : trip.start_date || trip.end_date ? (
                isOrganizer ? (
                  <button
                    type="button"
                    className="fl-detail-hero__logistics-item fl-detail-hero__logistics-item--action"
                    onClick={() => setEditingHero(true)}
                  >
                    <span
                      className="fl-detail-hero__logistics-icon"
                      aria-hidden="true"
                    >
                      🏠
                    </span>
                    <div className="fl-detail-hero__logistics-text">
                      <span className="fl-detail-hero__logistics-label">
                        Accommodation
                        <span className="fl-detail-hero__flag">
                          action needed
                        </span>
                      </span>
                      <span className="fl-detail-hero__logistics-detail">
                        Add where you're staying
                      </span>
                    </div>
                  </button>
                ) : (
                  <div className="fl-detail-hero__logistics-item">
                    <span
                      className="fl-detail-hero__logistics-icon"
                      aria-hidden="true"
                    >
                      🏠
                    </span>
                    <div className="fl-detail-hero__logistics-text">
                      <span className="fl-detail-hero__logistics-label">
                        Accommodation
                        <span className="fl-detail-hero__flag">
                          action needed
                        </span>
                      </span>
                      <span className="fl-detail-hero__logistics-detail">
                        Not set yet
                      </span>
                    </div>
                  </div>
                )
              ) : null}
              {trip.notes && (
                <div className="fl-detail-hero__logistics-item">
                  <span
                    className="fl-detail-hero__logistics-icon"
                    aria-hidden="true"
                  >
                    📝
                  </span>
                  <div className="fl-detail-hero__logistics-text">
                    <span className="fl-detail-hero__logistics-label">
                      Notes
                    </span>
                    <div className="fl-detail-hero__logistics-detail fl-detail-hero__notes">
                      <Markdown>{trip.notes}</Markdown>
                    </div>
                  </div>
                </div>
              )}
              {joining.length > 0 && (
                <div className="fl-detail-hero__logistics-item">
                  <span
                    className="fl-detail-hero__logistics-icon"
                    aria-hidden="true"
                  >
                    🧗
                  </span>
                  <div className="fl-detail-hero__logistics-text">
                    <span className="fl-detail-hero__logistics-label">
                      Climbers · {joining.length}
                    </span>
                    <span className="fl-detail-hero__logistics-detail fl-detail-hero__climbers">
                      {joining.map((u, i) => (
                        <span key={u.id}>
                          {u.name}{u.is_organizer ? " 👑" : ""}
                          {i < joining.length - 1 ? ", " : ""}
                        </span>
                      ))}
                    </span>
                  </div>
                </div>
              )}
              {dogs.length > 0 && (
                <div className="fl-detail-hero__logistics-item">
                  <span
                    className="fl-detail-hero__logistics-icon"
                    aria-hidden="true"
                  >
                    🐕
                  </span>
                  <div className="fl-detail-hero__logistics-text">
                    <span className="fl-detail-hero__logistics-label">
                      Dogs · {dogs.length}
                    </span>
                    <span className="fl-detail-hero__logistics-detail fl-detail-hero__climbers">
                      {dogs.map((d, i) => (
                        <span key={d.id}>
                          {d.name}
                          {i < dogs.length - 1 ? ", " : ""}
                        </span>
                      ))}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="fl-detail-hero__actions">
            <Button
              variant="text"
              onClick={shareTrip}
              leadingIcon={copied ? undefined : <ShareIcon />}
              style={copied ? { color: "var(--min-accent)" } : undefined}
            >
              {copied ? "Link copied!" : "Share trip"}
            </Button>
          </div>
        </div>
        )}

        {myUnansweredPolls.length > 0 && (
          <NudgeCard
            count={myUnansweredPolls.length}
            onClick={() => openQuestions(myUnansweredPolls)}
          />
        )}

        <div className="dash-grid">
          {cards.map((c) => (
            <DashTile
              key={c.id}
              icon={c.icon}
              title={c.title}
              summary={c.summary}
              badge={c.badge}
              urgent={c.urgent}
              onClick={() => setExpandedId(c.id)}
            />
          ))}
        </div>

        <FeedbackSection
          tripId={tripId}
          userId={currentUserId}
          isOrganizer={isOrganizer}
        />
        </div>
      </div>

      <BottomSheet
        open={weatherSheetOpen}
        onClose={() => setWeatherSheetOpen(false)}
        title="Weather"
        subtitle={trip.place_label || undefined}
      >
        <WeatherBody
          weather={weather}
          trip={trip}
          tripId={tripId}
          isOrganizer={isOrganizer}
          onChanged={reload}
        />
      </BottomSheet>

      <BottomSheet
        open={calendarSheetOpen}
        onClose={() => setCalendarSheetOpen(false)}
        title="Calendar"
        subtitle={formatDateRange(trip.start_date, trip.end_date)}
      >
        <CalendarBody
          trip={trip}
          dUntil={dUntil}
          onAddToCalendar={addToCalendar}
        />
      </BottomSheet>

      <BottomSheet
        open={selectedCard !== null}
        onClose={() => {
          setExpandedId(null);
          setExpView({ kind: "list" });
        }}
        title={
          selectedCard?.id === "expenses" && expView.kind !== "list"
            ? expView.kind === "add"
              ? "Add expense"
              : expView.kind === "edit"
              ? "Edit expense"
              : "Settle up"
            : selectedCard?.title
        }
        onBack={
          selectedCard?.id === "expenses" && expView.kind !== "list"
            ? () => navExp({ kind: "list" })
            : undefined
        }
      >
        {selectedCard?.body}
      </BottomSheet>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Weather: glanceable hero chip + day-by-day body                     */
/* ------------------------------------------------------------------ */

function HeroWeatherChip({
  weather,
  isOrganizer,
  onOpen,
}: {
  weather: WeatherState;
  isOrganizer: boolean;
  onOpen: () => void;
}) {
  let icon = "🌦️";
  let temps: React.ReactNode = null;
  let label = "";
  let tone: "ready" | "mute" | "action" = "mute";

  switch (weather.status) {
    case "ready":
      if (weather.days.length) {
        const d = weather.days[0];
        icon = wmo(d.code).icon;
        temps = (
          <span className="fl-weather__temps">
            <span className="fl-weather__high">{fmtTemp(d.hi)}</span>
            <span className="fl-weather__sep">/</span>
            <span className="fl-weather__low">{fmtTemp(d.lo)}</span>
          </span>
        );
        label = wmo(d.code).label;
        tone = "ready";
      } else {
        label = "No forecast";
      }
      break;
    case "loading":
      icon = "🌡️";
      label = "Loading";
      break;
    case "too-far":
      icon = "🗓️";
      label = `Forecast in ${weather.daysUntil - FORECAST_HORIZON}d`;
      break;
    case "no-pin":
      icon = "📍";
      label = isOrganizer ? "Set location" : "No location";
      tone = isOrganizer ? "action" : "mute";
      break;
    case "no-dates":
      icon = "🗓️";
      label = isOrganizer ? "Add dates" : "Dates TBD";
      tone = isOrganizer ? "action" : "mute";
      break;
    case "past":
      return null;
    case "error":
      icon = "🌡️";
      label = "No forecast";
      break;
  }

  return (
    <button
      type="button"
      className={`fl-weather fl-weather--btn fl-weather--${tone}`}
      onClick={onOpen}
      aria-label={`Weather: ${label}. Tap for the full forecast.`}
    >
      <span className="fl-weather__main">
        <span className="fl-weather__icon" aria-hidden="true">
          {icon}
        </span>
        {temps}
      </span>
      <span className="fl-weather__sub">{label}</span>
    </button>
  );
}

function fmtTemp(t: number | null): string {
  return t == null ? "—" : `${Math.round(t)}°`;
}
function fmtDayLabel(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function WeatherBody({
  weather,
  trip,
  tripId,
  isOrganizer,
  onChanged,
}: {
  weather: WeatherState;
  trip: ReturnType<typeof useTripContext>["trip"];
  tripId: string;
  isOrganizer: boolean;
  onChanged: () => Promise<void>;
}) {
  const [editingPin, setEditingPin] = useState(false);

  // No pin: organizers see the inline form; everyone else gets a hint.
  if (weather.status === "no-pin") {
    if (isOrganizer) return <PinLocationForm trip={trip} tripId={tripId} onSaved={onChanged} />;
    return (
      <p className="muted">
        No location pinned yet, so we can&apos;t show a forecast.
      </p>
    );
  }

  // Re-pin sub-view (organizers can toggle this from any state).
  if (editingPin && isOrganizer) {
    return (
      <PinLocationForm
        trip={trip}
        tripId={tripId}
        onSaved={async () => {
          setEditingPin(false);
          await onChanged();
        }}
        onCancel={() => setEditingPin(false)}
      />
    );
  }

  let content: React.ReactNode;
  if (weather.status === "no-dates")
    content = <p className="muted">Add trip dates to see the forecast.</p>;
  else if (weather.status === "past")
    content = <p className="muted">This trip has already happened.</p>;
  else if (weather.status === "too-far")
    content = (
      <p className="muted">
        The trip is {weather.daysUntil} days away. Forecasts become available
        about {FORECAST_HORIZON} days out — check back closer.
      </p>
    );
  else if (weather.status === "loading")
    content = <p className="muted">Loading forecast…</p>;
  else if (weather.status === "error")
    content = <p className="muted">Couldn&apos;t load the forecast right now.</p>;
  else
    content = (
      <div className="wx-row">
        {weather.days.map((d) => {
          const w = wmo(d.code);
          return (
            <div className="wx-day" key={d.date}>
              <div className="wx-day__date">{fmtDayLabel(d.date)}</div>
              <div className="wx-day__icon" title={w.label}>
                {w.icon}
              </div>
              <div className="wx-day__temp">
                {fmtTemp(d.hi)}
                <span className="muted"> / {fmtTemp(d.lo)}</span>
              </div>
              {d.precip != null && d.precip > 0 && (
                <div className="wx-day__precip">💧{d.precip}%</div>
              )}
            </div>
          );
        })}
      </div>
    );

  return (
    <div className="col">
      {content}
      {isOrganizer && (
        <button
          className="th-btn th-btn--tertiary"
          style={{ alignSelf: "flex-start", padding: "4px 0" }}
          onClick={() => setEditingPin(true)}
        >
          ✎ Edit location
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Calendar drawer                                                     */
/* ------------------------------------------------------------------ */

/** Human-friendly countdown phrase from a signed day delta. */
function countdownPhrase(dUntil: number | null): string {
  if (dUntil == null) return "Dates TBD";
  if (dUntil > 0) return dUntil === 1 ? "1 day to go" : `${dUntil} days to go`;
  if (dUntil === 0) return "On now";
  const ago = Math.abs(dUntil);
  return ago === 1 ? "1 day ago" : `${ago} days ago`;
}

/** Trip span as "3 days · 2 nights", or null when there are no dates. */
function tripLength(
  startStr: string | null,
  endStr: string | null
): string | null {
  const start = startStr || endStr;
  if (!start) return null;
  const end = endStr || start;
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const days = Math.round((e.getTime() - s.getTime()) / DAY_MS) + 1;
  const nights = Math.max(0, days - 1);
  const dayLabel = `${days} ${days === 1 ? "day" : "days"}`;
  const nightLabel = `${nights} ${nights === 1 ? "night" : "nights"}`;
  return `${dayLabel} \u00b7 ${nightLabel}`;
}

function CalendarBody({
  trip,
  dUntil,
  onAddToCalendar,
}: {
  trip: ShareableTrip;
  dUntil: number | null;
  onAddToCalendar: () => void;
}) {
  const from = isoToDate(trip.start_date);
  const to = isoToDate(trip.end_date);
  const selected: DateRange | undefined = from
    ? { from, to: to ?? from }
    : undefined;
  const length = tripLength(trip.start_date, trip.end_date);

  return (
    <div className="cal-body">
      <div className="cal-body__stats">
        <div className="cal-body__stat">
          <span className="cal-body__stat-value">{countdownPhrase(dUntil)}</span>
          <span className="cal-body__stat-label">Countdown</span>
        </div>
        {length && (
          <div className="cal-body__stat">
            <span className="cal-body__stat-value">{length}</span>
            <span className="cal-body__stat-label">Duration</span>
          </div>
        )}
      </div>
      {selected && (
        <div className="cal-body__picker">
          <DayPicker
            mode="range"
            selected={selected}
            defaultMonth={selected.from}
            showOutsideDays
            weekStartsOn={1}
          />
        </div>
      )}
      <Button
        variant="text"
        onClick={onAddToCalendar}
        leadingIcon={<CalendarIcon />}
      >
        Add to calendar
      </Button>
    </div>
  );
}

interface GeoResult {
  name: string;
  admin1?: string;
  country_code?: string;
  latitude: number;
  longitude: number;
}

function PinLocationForm({
  trip,
  tripId,
  onSaved,
  onCancel,
}: {
  trip: ReturnType<typeof useTripContext>["trip"];
  tripId: string;
  onSaved: () => Promise<void>;
  onCancel?: () => void;
}) {
  const [query, setQuery] = useState(trip.place_label || trip.location || "");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lat, setLat] = useState(
    trip.latitude != null ? String(trip.latitude) : ""
  );
  const [lon, setLon] = useState(
    trip.longitude != null ? String(trip.longitude) : ""
  );
  const [saving, setSaving] = useState(false);

  const labelFor = (r: GeoResult) =>
    [r.name, r.admin1, r.country_code].filter(Boolean).join(", ");

  const search = async () => {
    setError(null);
    setSearching(true);
    setSearched(false);
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        query.trim()
      )}&count=6&language=en&format=json`;
      const r = await fetch(url);
      const d = (await r.json()) as { results?: GeoResult[] };
      setResults(d.results || []);
      setSearched(true);
    } catch {
      setError("Search failed. Try entering coordinates manually.");
    } finally {
      setSearching(false);
    }
  };

  const savePin = async (
    latitude: number,
    longitude: number,
    place_label: string
  ) => {
    setError(null);
    setSaving(true);
    try {
      await api.updateTrip(tripId, { latitude, longitude, place_label });
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const saveManual = () => {
    const la = parseFloat(lat);
    const lo = parseFloat(lon);
    if (
      Number.isNaN(la) ||
      Number.isNaN(lo) ||
      la < -90 ||
      la > 90 ||
      lo < -180 ||
      lo > 180
    ) {
      setError("Enter a valid latitude (−90…90) and longitude (−180…180).");
      return;
    }
    savePin(la, lo, query.trim() || trip.location);
  };

  const clearPin = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.updateTrip(tripId, {
        latitude: null,
        longitude: null,
        place_label: null,
      });
      setLat("");
      setLon("");
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const pinned = trip.latitude != null && trip.longitude != null;

  return (
    <div className="col">
      <p className="muted" style={{ margin: 0 }}>
        Search for the nearest town, or drop exact coordinates.
      </p>
      {error && <div className="error-banner">{error}</div>}

      <div>
        <label>Search a place</label>
        <div className="row" style={{ gap: 6 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Bishop, California"
            onKeyDown={(e) => e.key === "Enter" && search()}
            style={{ flex: 1 }}
          />
          <button
            className="th-btn th-btn--secondary"
            onClick={search}
            disabled={searching || !query.trim()}
          >
            {searching ? "…" : "Search"}
          </button>
        </div>
      </div>

      {results.length > 0 && (
        <div>
          {results.map((r, i) => (
            <div className="list-item" key={i}>
              <span>{labelFor(r)}</span>
              <button
                className="th-btn th-btn--tertiary"
                disabled={saving}
                onClick={() => savePin(r.latitude, r.longitude, labelFor(r))}
              >
                Pin
              </button>
            </div>
          ))}
        </div>
      )}
      {searched && results.length === 0 && (
        <p className="muted" style={{ fontSize: 13 }}>
          No matches — many crags aren&apos;t in the place index. Enter
          coordinates below instead.
        </p>
      )}

      <div className="row" style={{ gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label>Latitude</label>
          <input
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            placeholder="37.7807"
            inputMode="decimal"
          />
        </div>
        <div style={{ flex: 1 }}>
          <label>Longitude</label>
          <input
            value={lon}
            onChange={(e) => setLon(e.target.value)}
            placeholder="-83.6829"
            inputMode="decimal"
          />
        </div>
      </div>

      <div className="row" style={{ gap: 8 }}>
        {onCancel && (
          <button
            className="th-btn th-btn--secondary"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
        )}
        {pinned && (
          <button
            className="th-btn th-btn--secondary"
            style={{ color: "var(--danger)" }}
            onClick={clearPin}
            disabled={saving}
          >
            Clear pin
          </button>
        )}
        <button
          className="th-btn th-btn--primary"
          onClick={saveManual}
          disabled={saving || !lat || !lon}
          style={{ flex: 1 }}
        >
          {saving ? "Saving…" : "Save coordinates"}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Section bodies (ported from the old tabs)                           */
/* ------------------------------------------------------------------ */

function isoToDate(s: string | null): Date | undefined {
  if (!s) return undefined;
  return new Date(s + "T00:00:00");
}
function dateToIso(d: Date | undefined): string | null {
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const ACCOM_META: Record<string, { icon: string; label: string }> = {
  campsite: { icon: "⛺", label: "Campsite" },
  airbnb: { icon: "🏠", label: "Airbnb" },
  hotel: { icon: "🏨", label: "Hotel" },
  hut: { icon: "🛖", label: "Hut / Refuge" },
  other: { icon: "📍", label: "Other" },
};
function accomMeta(type: string | null | undefined) {
  if (!type) return null;
  return ACCOM_META[type] ?? { icon: "🏠", label: type };
}

function HeroEdit({
  trip,
  tripId,
  tripUpcoming,
  onCancel,
  onSaved,
  deleteTrip,
}: {
  trip: ReturnType<typeof useTripContext>["trip"];
  tripId: string;
  tripUpcoming: boolean;
  onCancel: () => void;
  onSaved: () => Promise<void>;
  deleteTrip: () => Promise<void>;
}) {
  const [name, setName] = useState(trip.name);
  const [location, setLocation] = useState(trip.location);
  const [range, setRange] = useState<DateRange | undefined>(
    trip.start_date || trip.end_date
      ? { from: isoToDate(trip.start_date), to: isoToDate(trip.end_date) }
      : undefined
  );
  const [accomType, setAccomType] = useState(
    trip.accommodation_type || "campsite"
  );
  const [accomDetails, setAccomDetails] = useState(
    trip.accommodation_details || ""
  );
  const [notes, setNotes] = useState(trip.notes || "");
  const [welcomeMessage, setWelcomeMessage] = useState(
    trip.welcome_message || ""
  );
  const [signature, setSignature] = useState(trip.signature || "");
  const [links, setLinks] = useState<{ name: string; url: string }[]>(
    trip.links ?? []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      await api.updateTrip(tripId, {
        name: name.trim(),
        location: location.trim(),
        start_date: dateToIso(range?.from),
        end_date: dateToIso(range?.to ?? range?.from),
        accommodation_type: accomType,
        accommodation_details: accomDetails.trim() || null,
        notes: notes.trim() || null,
        links: cleanLinks(links),
        ...(welcomeMessage.trim()
          ? { welcome_message: welcomeMessage.trim() }
          : {}),
        ...(signature.trim() ? { signature: signature.trim() } : {}),
      });
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={"fl-detail-hero" + (tripUpcoming ? "" : " fl-detail-hero--past")}>
      <div className="fl-detail-hero__meta">
        <span aria-hidden="true">✏️</span>
        <span>Editing trip</span>
      </div>
      <input
        className="fl-detail-hero__title-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Trip name"
        aria-label="Trip name"
      />
      <div className="fl-detail-hero__dates-edit">
        <DateRangePicker value={range} onChange={setRange} placeholder="Add dates" />
      </div>

      <div className="col" style={{ gap: 12 }}>
        <div>
          <label>Location</label>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Yosemite Valley"
          />
        </div>
        <div>
          <label>Useful links</label>
          <LinksEditor links={links} onChange={setLinks} />
        </div>
        <div>
          <label>Accommodation</label>
          <select value={accomType} onChange={(e) => setAccomType(e.target.value)}>
            <option value="campsite">Campsite</option>
            <option value="airbnb">Airbnb</option>
            <option value="hotel">Hotel</option>
            <option value="hut">Hut / Refuge</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label>Accommodation details</label>
          <input
            value={accomDetails}
            onChange={(e) => setAccomDetails(e.target.value)}
            placeholder="Name, address, link…"
          />
        </div>
        <div>
          <label>Notes</label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <div>
          <label>Welcome message</label>
          <textarea
            rows={4}
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            placeholder="The first thing people see when they open the link…"
          />
        </div>
        <div>
          <label>Sign off as</label>
          <input
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            placeholder="e.g. Juan & Lovely Girl"
          />
        </div>

        {error && <div className="error-banner">{error}</div>}

        <div className="row" style={{ gap: 8 }}>
          <button className="th-btn th-btn--secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button
            className="th-btn th-btn--primary"
            onClick={save}
            disabled={!name.trim() || !location.trim() || saving}
            style={{ flex: 1 }}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
        <DangerZone tripLocation={trip.name} onDelete={deleteTrip} />
      </div>
    </div>
  );
}

function DangerZone({
  tripLocation,
  onDelete,
}: {
  tripLocation: string;
  onDelete: () => Promise<void>;
}) {
  return (
    <div className="dash-danger">
      <div className="dash-danger__title">Danger zone</div>
      <p className="muted" style={{ fontSize: 13, margin: "4px 0 8px" }}>
        Deleting the trip removes it for everyone, along with all cars and gear.
      </p>
      <button
        className="th-btn th-btn--secondary"
        style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
        onClick={() => {
          if (
            confirm(`Delete the "${tripLocation}" trip? This can't be undone.`)
          ) {
            onDelete();
          }
        }}
      >
        Delete trip
      </button>
    </div>
  );
}

function RosterBody({
  tripId,
  users,
  currentUserId,
  isOrganizer,
  onChanged,
}: {
  tripId: string;
  users: ReturnType<typeof useTripContext>["users"];
  currentUserId: number | null;
  isOrganizer: boolean;
  onChanged: () => Promise<void>;
}) {
  const joining = users.filter((u) => u.joining);
  const out = users.filter((u) => !u.joining);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  // Members the organizer can hand off to: anyone joining who isn't already organizer.
  const transferTargets = joining.filter((u) => !u.is_organizer);

  const addMember = async () => {
    const name = newName.trim();
    if (!name || adding) return;
    setError(null);
    setAdding(true);
    try {
      await api.addMember(tripId, name);
      setNewName("");
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAdding(false);
    }
  };

  const transfer = async (toUserId: number, name: string) => {
    if (
      !confirm(
        `Transfer ownership to ${name}? They become the organizer and you become a regular member.`
      )
    )
      return;
    setError(null);
    try {
      await api.makeOrganizer(tripId, toUserId);
      setPicking(false);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const remove = async (userId: number, isSelf: boolean, name: string) => {
    const message = isSelf
      ? "Leave this trip? Your car and gear contributions will also be removed."
      : `Remove ${name} from the trip? Their car and gear contributions will also be removed.`;
    if (!confirm(message)) return;
    setError(null);
    try {
      await api.deleteUser(tripId, userId);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const renderRow = (u: typeof users[number]) => {
    const isSelf = u.id === currentUserId;
    // One button per row: the organizer removes others; everyone else can
    // leave their own row. On the organizer's own row they instead hand off
    // ownership, since they can't remove themselves while still organizer.
    const canRemove = isOrganizer && !u.is_organizer && !isSelf;
    const canLeave = isSelf && !u.is_organizer;
    const canTransfer = isOrganizer && isSelf && u.is_organizer;
    return (
      <div className="list-item" key={u.id}>
        <span>
          {u.name} {u.is_organizer && "👑"}
          {isSelf && <span className="muted"> (you)</span>}
        </span>
        <div className="row" style={{ gap: 6, alignItems: "center" }}>
          {canRemove && (
            <button
              className="th-btn th-btn--danger th-btn--sm"
              onClick={() => remove(u.id, false, u.name)}
              aria-label={`Remove ${u.name} from the trip`}
            >
              ⊖ Remove
            </button>
          )}
          {canLeave && (
            <button
              className="th-btn th-btn--secondary th-btn--sm"
              onClick={() => remove(u.id, true, u.name)}
              aria-label="Leave this trip"
            >
              ↦ Leave
            </button>
          )}
          {canTransfer &&
            (picking ? (
              <>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    const target = transferTargets.find((t) => t.id === id);
                    if (target) transfer(target.id, target.name);
                  }}
                  aria-label="Choose a member to transfer ownership to"
                >
                  <option value="" disabled>
                    Hand off to…
                  </option>
                  {transferTargets.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <button
                  className="th-btn th-btn--tertiary th-btn--sm"
                  onClick={() => setPicking(false)}
                  aria-label="Cancel transfer"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                className="th-btn th-btn--secondary th-btn--sm"
                onClick={() => setPicking(true)}
                disabled={transferTargets.length === 0}
                title={
                  transferTargets.length === 0
                    ? "No other joining members to transfer to"
                    : undefined
                }
                aria-label="Transfer ownership to another member"
              >
                ⇄ Transfer ownership
              </button>
            ))}
        </div>
      </div>
    );
  };

  return (
    <>
      {error && <div className="error-banner">{error}</div>}
      <div className="row" style={{ gap: 6, marginBottom: 8 }}>
        <input
          placeholder="Add a member by name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addMember()}
          style={{ flex: 1 }}
          aria-label="New member name"
        />
        <button
          className="th-btn th-btn--primary th-btn--sm"
          onClick={addMember}
          disabled={!newName.trim() || adding}
        >
          {adding ? "Adding…" : "Add"}
        </button>
      </div>
      {joining.map((u) => renderRow(u))}
      {out.length > 0 && (
        <>
          <div className="muted" style={{ marginTop: 8 }}>
            Not joining
          </div>
          {out.map((u) => renderRow(u))}
        </>
      )}
    </>
  );
}

function CarsBody({
  tripId,
  cars,
  dogs,
  currentUserId,
  ensureUser,
  onChanged,
}: {
  tripId: string;
  cars: Car[];
  dogs: Dog[];
  currentUserId: number | null;
  ensureUser: () => Promise<number | null>;
  onChanged: () => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [seats, setSeats] = useState("4");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Which car's empty seat is showing the chooser / dog picker.
  const [chooserCar, setChooserCar] = useState<number | null>(null);
  const [newDogName, setNewDogName] = useState("");



  const myDogs = dogs.filter((d) => d.owner_user_id === currentUserId);
  const dogCarName = (carId: number | null) => {
    if (carId == null) return "no car";
    const car = cars.find((c) => c.id === carId);
    return car ? `in ${car.driver_name}'s car` : "in a car";
  };

  const closeChooser = () => {
    setChooserCar(null);
    setNewDogName("");
  };

  const placeDog = async (carId: number, dog: Dog) => {
    setError(null);
    try {
      const uid = await ensureUser();
      if (uid == null) return;
      await api.assignDog(tripId, carId, dog.id);
      closeChooser();

      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const pickDog = (carId: number, dog: Dog) => {
    // Moving a dog from another car asks for confirmation first.
    if (dog.car_id != null && dog.car_id !== carId) {
      const target = cars.find((c) => c.id === carId);
      if (
        !confirm(
          `Move ${dog.name} from ${dogCarName(dog.car_id)} to ${
            target ? `${target.driver_name}'s car` : "this car"
          }?`
        )
      )
        return;
    }
    placeDog(carId, dog);
  };

  const addAndPlaceDog = async (carId: number) => {
    const name = newDogName.trim();
    if (!name) return;
    setError(null);
    try {
      const uid = await ensureUser();
      if (uid == null) return;
      const dog = await api.createDog(tripId, uid, name);
      await api.assignDog(tripId, carId, dog.id);
      closeChooser();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const myCar = cars.find((c) => c.driver_user_id === currentUserId);

  const submitCar = async () => {
    setError(null);
    try {
      const uid = await ensureUser();
      if (uid == null) return;
      await api.createCar(tripId, {
        driver_user_id: uid,
        total_seats: Number(seats),
        notes: notes.trim() || null,
      });
      setAdding(false);
      setNotes("");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="sheet-flat">
      {error && <div className="error-banner">{error}</div>}
      {cars.length === 0 && (
        <p className="muted">No cars yet. Be the first to offer a ride!</p>
      )}

      <div className="sheet-sections">
        {cars.map((c) => {
        const passengerCount = c.passengers.length;
        const dogCount = c.dogs.length;
        const passengerCapacity = Math.max(0, c.total_seats - 1);
        const empty = Math.max(0, passengerCapacity - passengerCount - dogCount - c.reserved_seats);

        const isDriver = c.driver_user_id === currentUserId;
        const iAmIn =
          isDriver ||
          c.passengers.some((p) => p.user_id === currentUserId);
        const updateCar = async (patch: { total_seats?: number; reserved_seats?: number }) => {
          setError(null);
          try {
            await api.createCar(tripId, {
              driver_user_id: c.driver_user_id,
              total_seats: patch.total_seats ?? c.total_seats,
              reserved_seats: patch.reserved_seats ?? c.reserved_seats,
              notes: c.notes,
            });
            onChanged();
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          }
        };
        return (
          <div className="card" key={c.id}>
            <div className="row between">
              <div className="ride-card__head">
                <div style={{ fontWeight: 600 }} className="ride-card__title">
                  {c.driver_name}&apos;s car
                </div>
                <div className="muted" style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                  {isDriver ? (
                    <>
                      <button
                        type="button"
                        className="seat-adj"
                        disabled={c.total_seats <= 1 + passengerCount + c.reserved_seats}
                        onClick={() => updateCar({ total_seats: c.total_seats - 1 })}
                        aria-label="Remove a seat"
                      >−</button>
                      <span>{c.total_seats} seats</span>
                      <button
                        type="button"
                        className="seat-adj"
                        onClick={() => updateCar({ total_seats: c.total_seats + 1 })}
                        aria-label="Add a seat"
                      >+</button>
                    </>
                  ) : (
                    <span>{c.total_seats} seats</span>
                  )}
                  <span>· {passengerCount}/{passengerCapacity} passengers</span>
                  {c.reserved_seats > 0 && <span>· {c.reserved_seats} reserved</span>}
                  {dogCount > 0 && <span>· {dogCount} {dogCount === 1 ? "dog" : "dogs"}</span>}
                </div>
              </div>
              {isDriver && (
                <button
                  className="th-btn th-btn--tertiary"
                  onClick={async () => {
                    if (confirm("Remove your car from the trip?")) {
                      await api.deleteCar(tripId, c.id);
                      onChanged();
                    }
                  }}
                >
                  Remove
                </button>
              )}
            </div>
            {c.notes && (
              <p style={{ marginTop: 8 }}>
                <Linkify>{c.notes}</Linkify>
              </p>
            )}
            <div className="seat-row">
              <span className="seat driver">🚗 {c.driver_name}</span>
              {c.passengers.map((p) => (
                <span className="seat" key={p.user_id}>
                  {p.name}
                  {p.user_id === currentUserId && (
                    <button
                      type="button"
                      className="chip-x"
                      aria-label="Leave this car"
                      onClick={async () => {
                        const uid = await ensureUser();
                        if (uid == null) return;
                        await api.carSignoff(tripId, c.id, uid);
                        onChanged();
                      }}
                    >
                      ✕
                    </button>
                  )}
                </span>
              ))}
              {c.dogs.map((d) => {
                const canRemove =
                  d.owner_user_id === currentUserId || isDriver;
                return (
                  <span className="seat" key={`dog-${d.dog_id}`}>
                    🐕 {d.name}
                    {canRemove && (
                      <button
                        type="button"
                        className="chip-x"
                        aria-label={`Remove ${d.name} from this car`}
                        onClick={async () => {
                          await api.unassignDog(tripId, c.id, d.dog_id);
                          onChanged();
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </span>
                );
              })}
              {Array.from({ length: c.reserved_seats }).map((_, i) => (
                <button
                  key={`reserved-${i}`}
                  className="seat empty"
                  disabled={iAmIn && !isDriver}
                  aria-label={isDriver ? "Release reserved seat" : undefined}
                  onClick={async () => {
                    if (isDriver) {
                      updateCar({ reserved_seats: c.reserved_seats - 1 });
                      return;
                    }
                    if (iAmIn) return;
                    if (
                      !confirm(
                        "This seat is reserved by the driver for someone else. Only take it if you've already cleared it with the driver. Take this seat?"
                      )
                    )
                      return;
                    setError(null);
                    try {
                      const uid = await ensureUser();
                      if (uid == null) return;
                      await api.carSignup(tripId, c.id, uid, true);
                      onChanged();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : String(e));
                    }
                  }}
                  style={{ border: "1px dashed var(--accent, #c90)", background: "transparent", fontStyle: "italic" }}
                >
                  Reserved
                </button>
              ))}
              {Array.from({ length: empty }).map((_, i) => (
                <button
                  key={`empty-${i}`}
                  className="seat empty"
                  aria-label="Choose what goes in this seat"
                  onClick={async () => {
                    const uid = await ensureUser();
                    if (uid == null) return;
                    setError(null);
                    setNewDogName("");
                    setChooserCar(c.id);
                  }}
                  style={{ border: "1px dashed var(--border)", background: "transparent" }}
                >
                  + open seat
                </button>
              ))}
            </div>
            {chooserCar === c.id && (
              <div className="seat-chooser" style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="row between">
                  <strong>This seat…</strong>
                  <button type="button" className="th-btn th-btn--tertiary" onClick={closeChooser}>Cancel</button>
                </div>
                {isDriver && (
                  <button
                    type="button"
                    className="th-btn th-btn--secondary"
                    onClick={() => { updateCar({ reserved_seats: c.reserved_seats + 1 }); closeChooser(); }}
                  >
                    Reserve this seat
                  </button>
                )}
                {!isDriver && !iAmIn && (
                  <button
                    type="button"
                    className="th-btn th-btn--secondary"
                    onClick={async () => {
                      setError(null);
                      try {
                        const uid = await ensureUser();
                        if (uid == null) return;
                        await api.carSignup(tripId, c.id, uid);
                        closeChooser();
                        onChanged();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : String(e));
                      }
                    }}
                  >
                    Sit here myself
                  </button>
                )}
                {myDogs.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    className="th-btn th-btn--secondary"
                    onClick={() => pickDog(c.id, d)}
                  >
                    🐕 {d.name} — {dogCarName(d.car_id)}
                  </button>
                ))}
                <div className="row" style={{ gap: 8 }}>
                  <input
                    className="th-input"
                    placeholder="New dog's name"
                    value={newDogName}
                    onChange={(e) => setNewDogName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") addAndPlaceDog(c.id); }}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="th-btn th-btn--primary"
                    disabled={!newDogName.trim()}
                    onClick={() => addAndPlaceDog(c.id)}
                  >
                    + new dog
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      </div>

      {!myCar && !adding && (
        <button
          className="th-btn th-btn--secondary"
          onClick={async () => {
            const uid = await ensureUser();
            if (uid == null) return;
            setAdding(true);
          }}
          style={{ marginTop: 12 }}
        >
          + Offer a ride
        </button>
      )}

      {adding && (
        <div className="card">
          <div className="h2" style={{ marginTop: 0 }}>Your car</div>
          <label>Total seats (including driver)</label>
          <input
            type="number"
            min={1}
            value={seats}
            onChange={(e) => setSeats(e.target.value)}
          />
          <label style={{ marginTop: 10 }}>Notes (optional)</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. leaving Friday 5pm"
          />
          <div className="row" style={{ marginTop: 12 }}>
            <button className="th-btn th-btn--secondary" onClick={() => setAdding(false)}>
              Cancel
            </button>
            <button className="th-btn th-btn--primary" onClick={submitCar} style={{ flex: 1 }}>
              Save car
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DogsBody({
  tripId,
  dogs,
  cars,
  currentUserId,
  ensureUser,
  onChanged,
}: {
  tripId: string;
  dogs: Dog[];
  cars: Car[];
  currentUserId: number | null;
  ensureUser: () => Promise<number | null>;
  onChanged: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const carName = (carId: number | null) => {
    if (carId == null) return "no car";
    const car = cars.find((c) => c.id === carId);
    return car ? `in ${car.driver_name}'s car` : "in a car";
  };

  // Group dogs by owner, preserving first-seen order.
  const byOwner: { ownerId: number; ownerName: string; dogs: Dog[] }[] = [];
  for (const d of dogs) {
    let group = byOwner.find((g) => g.ownerId === d.owner_user_id);
    if (!group) {
      group = { ownerId: d.owner_user_id, ownerName: d.owner_name, dogs: [] };
      byOwner.push(group);
    }
    group.dogs.push(d);
  }

  const addDog = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    try {
      const uid = await ensureUser();
      if (uid == null) return;
      await api.createDog(tripId, uid, trimmed);
      setName("");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="sheet-flat">
      {error && <div className="error-banner">{error}</div>}
      {dogs.length === 0 && (
        <p className="muted">No dogs yet. Bringing a furry friend? Add it below.</p>
      )}

      <div className="sheet-sections">
        {byOwner.map((g) => (
          <div className="card" key={g.ownerId}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{g.ownerName}</div>
            <div className="seat-row">
              {g.dogs.map((d) => {
                const mine = d.owner_user_id === currentUserId;
                return (
                  <span className="seat" key={d.id}>
                    🐕 {d.name}{" "}
                    <span className="muted" style={{ fontSize: 12 }}>
                      — {carName(d.car_id)}
                    </span>
                    {mine && (
                      <button
                        type="button"
                        className="chip-x"
                        aria-label={`Delete ${d.name}`}
                        onClick={async () => {
                          if (!confirm(`Delete ${d.name}? This removes the dog from the trip.`)) return;
                          await api.deleteDog(tripId, d.id);
                          onChanged();
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="row" style={{ gap: 8, marginTop: 12 }}>
        <input
          className="th-input"
          placeholder="Your dog's name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addDog(); }}
          style={{ flex: 1 }}
        />
        <button
          className="th-btn th-btn--primary"
          disabled={!name.trim()}
          onClick={addDog}
        >
          Add a dog
        </button>
      </div>
    </div>
  );
}

type DraftField = { key: string; label: string; type: string };

/**
 * Field-builder rows shared by the add- and edit-category forms. Mirrors the
 * pattern used in OrganizerWizard so the two flows stay consistent. The key is
 * derived from the label on first entry and then kept stable (`f.key ||`), so
 * editing an existing category never orphans already-submitted contribution
 * details keyed by the original key.
 */
function FieldRows({
  fields,
  onChange,
}: {
  fields: DraftField[];
  onChange: (fields: DraftField[]) => void;
}) {
  return (
    <div style={{ marginTop: 10 }}>
      <label>Fields to ask</label>
      {fields.map((f, fi) => (
        <div className="field-builder-row" key={fi}>
          <input
            placeholder="Label (e.g. Length)"
            value={f.label}
            onChange={(e) => {
              const next = [...fields];
              next[fi] = {
                ...f,
                label: e.target.value,
                key: f.key || e.target.value.toLowerCase().replace(/\s+/g, "_"),
              };
              onChange(next);
            }}
          />
          <select
            value={f.type}
            onChange={(e) => {
              const next = [...fields];
              next[fi] = { ...f, type: e.target.value };
              onChange(next);
            }}
          >
            <option value="text">Text</option>
            <option value="number">Number</option>
          </select>
          <button
            className="th-btn th-btn--tertiary th-btn--icon th-btn--sm"
            aria-label="Remove field"
            onClick={() => onChange(fields.filter((_, i) => i !== fi))}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        className="th-btn th-btn--secondary"
        onClick={() => onChange([...fields, { key: "", label: "", type: "text" }])}
      >
        + Add field
      </button>
    </div>
  );
}

function GearBody({
  tripId,
  categories,
  gear,
  currentUserId,
  ensureUser,
  isOrganizer,
  onChanged,
}: {
  tripId: string;
  categories: Category[];
  gear: Contribution[];
  currentUserId: number | null;
  ensureUser: () => Promise<number | null>;
  isOrganizer: boolean;
  onChanged: () => Promise<void>;
}) {
  const [addingFor, setAddingFor] = useState<number | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newFields, setNewFields] = useState<DraftField[]>([]);
  const [newSummaryMode, setNewSummaryMode] = useState<"people" | "total">("people");
  const [editingCategory, setEditingCategory] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editFields, setEditFields] = useState<DraftField[]>([]);
  const [editSummaryMode, setEditSummaryMode] = useState<"people" | "total">("people");

  const resetAdd = () => {
    setAddingCategory(false);
    setNewCategoryName("");
    setNewFields([]);
    setNewSummaryMode("people");
  };

  const addCategory = async () => {
    setError(null);
    try {
      await api.addCategory(tripId, {
        name: newCategoryName.trim(),
        fields: newFields.filter((f) => f.key.trim() && f.label.trim()),
        summary_mode: newSummaryMode,
      });
      resetAdd();
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const startEdit = (cat: Category) => {
    setEditingCategory(cat.id);
    setEditName(cat.name);
    setEditFields(cat.fields.map((f) => ({ ...f })));
    setEditSummaryMode(cat.summary_mode ?? "people");
  };

  const saveEdit = async () => {
    if (editingCategory == null) return;
    setError(null);
    try {
      await api.updateCategory(tripId, editingCategory, {
        name: editName.trim(),
        fields: editFields.filter((f) => f.key.trim() && f.label.trim()),
        summary_mode: editSummaryMode,
      });
      setEditingCategory(null);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const removeCategory = async (catId: number, name: string) => {
    if (!confirm(`Remove the "${name}" category? Anyone bringing one will lose their entry.`)) return;
    setError(null);
    try {
      await api.deleteCategory(tripId, catId);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const byCat: Record<number, Contribution[]> = {};
  for (const c of categories) byCat[c.id] = [];
  for (const g of gear) {
    if (byCat[g.category_id]) byCat[g.category_id].push(g);
  }

  const labelFor = (cat: Category, key: string) => {
    const f = cat.fields.find((f) => f.key === key);
    return f ? f.label : key;
  };

  const addContribution = async (cat: Category) => {
    setError(null);
    try {
      const uid = await ensureUser();
      if (uid == null) return;
      await api.addGear(tripId, {
        user_id: uid,
        category_id: cat.id,
        details: values,
      });
      setAddingFor(null);
      setValues({});
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="sheet-flat">
      {error && <div className="error-banner">{error}</div>}
      {categories.length === 0 && (
        <p className="muted">
          {isOrganizer
            ? "No gear categories yet. Add one below to start collecting contributions."
            : "No gear categories yet. The organizer can add some."}
        </p>
      )}

      <div className="sheet-sections">
        {categories.map((cat) => (
        editingCategory === cat.id ? (
        <div className="card" key={cat.id}>
          <label>Category name</label>
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="e.g. Helmets"
            autoFocus
          />
          <FieldRows fields={editFields} onChange={setEditFields} />
          <label style={{ marginTop: 10 }}>Summary shows</label>
          <select
            value={editSummaryMode}
            onChange={(e) => setEditSummaryMode(e.target.value as "people" | "total")}
          >
            <option value="people">Number of people</option>
            <option value="total">Total items</option>
          </select>
          <div className="row" style={{ marginTop: 10 }}>
            <button
              className="th-btn th-btn--secondary"
              onClick={() => setEditingCategory(null)}
            >
              Cancel
            </button>
            <button
              className="th-btn th-btn--primary"
              style={{ flex: 1 }}
              disabled={!editName.trim()}
              onClick={saveEdit}
            >
              Save changes
            </button>
          </div>
        </div>
        ) : (
        <div className="card" key={cat.id}>
          <div className="row between">
            <div style={{ fontWeight: 600 }}>{cat.name}</div>
            <div className="row" style={{ gap: 6, alignItems: "center" }}>
              <Tag variant="neutral" size="sm" mono>
                {cat.summary_mode === "total"
                  ? (() => {
                      const numField = cat.fields.find((f) => f.type === "number");
                      return byCat[cat.id].reduce((sum, g) => {
                        const val = numField ? Number(g.details[numField.key]) : NaN;
                        return sum + (Number.isFinite(val) && val > 0 ? val : 1);
                      }, 0);
                    })()
                  : new Set(byCat[cat.id].map((g) => g.user_id)).size}
              </Tag>
              {isOrganizer && (
                <button
                  className="th-btn th-btn--tertiary th-btn--icon th-btn--sm"
                  onClick={() => startEdit(cat)}
                  aria-label={`Edit ${cat.name} category`}
                >
                  ✎
                </button>
              )}
              {isOrganizer && (
                <button
                  className="th-btn th-btn--tertiary th-btn--icon th-btn--sm"
                  style={{ color: "var(--danger)" }}
                  onClick={() => removeCategory(cat.id, cat.name)}
                  aria-label={`Remove ${cat.name} category`}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {byCat[cat.id].length === 0 && (
            <p className="muted" style={{ fontSize: 14 }}>Nobody&apos;s bringing one yet.</p>
          )}
          {byCat[cat.id].map((g) => (
            <div className="list-item" key={g.id}>
              <div>
                <div>{g.user_name}</div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {Object.entries(g.details)
                    .map(([k, v]) => `${labelFor(cat, k)}: ${v}`)
                    .join(" · ") || "—"}
                </div>
              </div>
              {g.user_id === currentUserId && (
                <button
                  className="th-btn th-btn--tertiary th-btn--icon th-btn--sm"
                  style={{ color: "var(--danger)" }}
                  onClick={async () => {
                    await api.deleteGear(tripId, g.id);
                    onChanged();
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}

          {addingFor === cat.id ? (
            <div style={{ marginTop: 10 }}>
              {cat.fields.length === 0 && (
                <p className="muted" style={{ fontSize: 13 }}>
                  No fields to fill — just tap save.
                </p>
              )}
              {cat.fields.map((f) => (
                <div key={f.key} style={{ marginBottom: 8 }}>
                  <label>{f.label}</label>
                  <input
                    type={f.type === "number" ? "number" : "text"}
                    value={values[f.key] ?? ""}
                    onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  />
                </div>
              ))}
              <div className="row">
                <button
                  className="th-btn th-btn--secondary"
                  onClick={() => {
                    setAddingFor(null);
                    setValues({});
                  }}
                >
                  Cancel
                </button>
                <button className="th-btn th-btn--primary" onClick={() => addContribution(cat)} style={{ flex: 1 }}>
                  Save
                </button>
              </div>
            </div>
          ) : (
            <button
              className="th-btn th-btn--fill"
              onClick={() => {
                setAddingFor(cat.id);
                setValues({});
              }}
              style={{ marginTop: 10 }}
            >
              + I&apos;m bringing one
            </button>
          )}
        </div>
        )
        ))}
      </div>

      {isOrganizer && (
        addingCategory ? (
          <div className="card">
            <label>Category name</label>
            <input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="e.g. Helmets"
              autoFocus
            />
            <FieldRows fields={newFields} onChange={setNewFields} />
            <label style={{ marginTop: 10 }}>Summary shows</label>
            <select
              value={newSummaryMode}
              onChange={(e) => setNewSummaryMode(e.target.value as "people" | "total")}
            >
              <option value="people">Number of people</option>
              <option value="total">Total items</option>
            </select>
            <div className="row" style={{ marginTop: 10 }}>
              <button
                className="th-btn th-btn--secondary"
                onClick={resetAdd}
              >
                Cancel
              </button>
              <button
                className="th-btn th-btn--primary"
                style={{ flex: 1 }}
                disabled={!newCategoryName.trim()}
                onClick={addCategory}
              >
                Add category
              </button>
            </div>
          </div>
        ) : (
          <button
            className="th-btn th-btn--primary th-btn--full"
            onClick={() => setAddingCategory(true)}
            style={{ marginTop: 10 }}
          >
            + Add gear category
          </button>
        )
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Polls                                                              */
/* ------------------------------------------------------------------ */

type PollOptionDraft = { id?: number; label: string; emoji: string };
type PollDraft = {
  question: string;
  description: string;
  emoji: string;
  options: PollOptionDraft[];
};

const emptyPollDraft = (): PollDraft => ({
  question: "",
  description: "",
  emoji: "",
  options: [
    { label: "", emoji: "" },
    { label: "", emoji: "" },
  ],
});

function draftToInput(d: PollDraft) {
  return {
    question: d.question.trim(),
    description: d.description.trim() || null,
    emoji: d.emoji.trim() || null,
    options: d.options
      .filter((o) => o.label.trim())
      .map((o) => ({
        id: o.id,
        label: o.label.trim(),
        emoji: o.emoji.trim() || null,
      })),
  };
}

function PollsBody({
  tripId,
  polls,
  pollAnswers,
  joining,
  currentUserId,
  ensureUser,
  isOrganizer,
  onChanged,
}: {
  tripId: string;
  polls: Poll[];
  pollAnswers: PollAnswer[];
  joining: { id: number }[];
  currentUserId: number | null;
  ensureUser: () => Promise<number | null>;
  isOrganizer: boolean;
  onChanged: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<PollDraft>(emptyPollDraft);

  const joiningIds = new Set(joining.map((u) => u.id));

  const pick = async (poll: Poll, optionId: number) => {
    setError(null);
    try {
      const uid = await ensureUser();
      if (uid == null) return;
      await api.setPollAnswer(tripId, {
        user_id: uid,
        poll_id: poll.id,
        option_ids: [optionId],
      });
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const submitAdd = async () => {
    setError(null);
    try {
      await api.addPoll(tripId, draftToInput(draft));
      setAdding(false);
      setDraft(emptyPollDraft());
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const startEdit = (p: Poll) => {
    setAdding(false);
    setEditing(p.id);
    setDraft({
      question: p.question,
      description: p.description ?? "",
      emoji: p.emoji ?? "",
      options: p.options.map((o) => ({
        id: o.id,
        label: o.label,
        emoji: o.emoji ?? "",
      })),
    });
  };

  const submitEdit = async () => {
    if (editing == null) return;
    setError(null);
    try {
      await api.updatePoll(tripId, editing, draftToInput(draft));
      setEditing(null);
      setDraft(emptyPollDraft());
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const remove = async (p: Poll) => {
    if (!confirm(`Delete the poll “${p.question}”? All answers will be lost.`))
      return;
    setError(null);
    try {
      await api.deletePoll(tripId, p.id);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="sheet-flat">
      {error && <div className="error-banner">{error}</div>}
      {polls.length === 0 && (
        <p className="muted">
          {isOrganizer
            ? "No polls yet. Add one below — e.g. who's in for the BBQ."
            : "No polls yet. The organizer can add some."}
        </p>
      )}

      <div className="sheet-sections">
        {polls.map((poll) =>
          editing === poll.id ? (
            <div className="card" key={poll.id}>
              <PollForm draft={draft} setDraft={setDraft} />
              <div className="row" style={{ marginTop: 10 }}>
                <button
                  className="th-btn th-btn--secondary"
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </button>
                <button
                  className="th-btn th-btn--primary"
                  style={{ flex: 1 }}
                  disabled={
                    !draft.question.trim() ||
                    draft.options.filter((o) => o.label.trim()).length < 2
                  }
                  onClick={submitEdit}
                >
                  Save changes
                </button>
              </div>
            </div>
          ) : (
            <div className="card" key={poll.id}>
              <div className="row between">
                <div style={{ fontWeight: 600 }}>
                  {poll.emoji ? `${poll.emoji} ` : ""}
                  {poll.question}
                </div>
                {isOrganizer && (
                  <div className="row" style={{ gap: 6, alignItems: "center" }}>
                    <button
                      className="th-btn th-btn--tertiary th-btn--icon th-btn--sm"
                      onClick={() => startEdit(poll)}
                      aria-label={`Edit poll`}
                    >
                      ✎
                    </button>
                    <button
                      className="th-btn th-btn--tertiary th-btn--icon th-btn--sm"
                      style={{ color: "var(--danger)" }}
                      onClick={() => remove(poll)}
                      aria-label={`Delete poll`}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
              {poll.description && (
                <p
                  className="muted"
                  style={{ fontSize: 14, whiteSpace: "pre-wrap", marginTop: 4 }}
                >
                  {poll.description}
                </p>
              )}

              <div className="poll-tallies">
                {poll.options.map((o) => {
                  const voters = pollAnswers.filter(
                    (a) =>
                      a.poll_id === poll.id &&
                      a.option_id === o.id &&
                      joiningIds.has(a.user_id)
                  );
                  const mine = pollAnswers.some(
                    (a) =>
                      a.poll_id === poll.id &&
                      a.option_id === o.id &&
                      a.user_id === currentUserId
                  );
                  return (
                    <button
                      key={o.id}
                      type="button"
                      className={`poll-tally${mine ? " is-mine" : ""}`}
                      onClick={() => pick(poll, o.id)}
                      title="Tap to choose this option"
                    >
                      <span className="poll-tally__label">
                        {o.emoji ? `${o.emoji} ` : ""}
                        {o.label}
                      </span>
                      <span className="poll-tally__count">{voters.length}</span>
                      {voters.length > 0 && (
                        <span className="poll-tally__who">
                          {voters.map((v) => v.user_name).join(", ")}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {(() => {
                const answered = new Set(
                  pollAnswers
                    .filter(
                      (a) => a.poll_id === poll.id && joiningIds.has(a.user_id)
                    )
                    .map((a) => a.user_id)
                ).size;
                const unanswered = Math.max(0, joining.length - answered);
                return (
                  <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                    {answered}/{joining.length} answered
                    {unanswered > 0 ? ` · ${unanswered} to go` : ""}
                  </p>
                );
              })()}
            </div>
          )
        )}
      </div>

      {isOrganizer &&
        (adding ? (
          <div className="card">
            <PollForm draft={draft} setDraft={setDraft} />
            <div className="row" style={{ marginTop: 10 }}>
              <button
                className="th-btn th-btn--secondary"
                onClick={() => {
                  setAdding(false);
                  setDraft(emptyPollDraft());
                }}
              >
                Cancel
              </button>
              <button
                className="th-btn th-btn--primary"
                style={{ flex: 1 }}
                disabled={
                  !draft.question.trim() ||
                  draft.options.filter((o) => o.label.trim()).length < 2
                }
                onClick={submitAdd}
              >
                Add poll
              </button>
            </div>
          </div>
        ) : (
          <button
            className="th-btn th-btn--primary th-btn--full"
            onClick={() => {
              setEditing(null);
              setDraft(emptyPollDraft());
              setAdding(true);
            }}
            style={{ marginTop: 10 }}
          >
            + Add poll
          </button>
        ))}
    </div>
  );
}

function PollForm({
  draft,
  setDraft,
}: {
  draft: PollDraft;
  setDraft: (d: PollDraft) => void;
}) {
  const setOption = (i: number, patch: Partial<PollOptionDraft>) => {
    const options = draft.options.map((o, idx) =>
      idx === i ? { ...o, ...patch } : o
    );
    setDraft({ ...draft, options });
  };
  return (
    <div className="col">
      <div className="row" style={{ gap: 6 }}>
        <input
          style={{ width: 64 }}
          placeholder="🍖"
          value={draft.emoji}
          onChange={(e) => setDraft({ ...draft, emoji: e.target.value })}
          aria-label="Poll emoji (optional)"
        />
        <input
          style={{ flex: 1 }}
          placeholder="Question (e.g. Do you eat meat?)"
          value={draft.question}
          onChange={(e) => setDraft({ ...draft, question: e.target.value })}
          autoFocus
        />
      </div>
      <textarea
        rows={3}
        placeholder="Add context — e.g. We're firing up the BBQ Saturday night, let us know what you eat so we can shop."
        value={draft.description}
        onChange={(e) => setDraft({ ...draft, description: e.target.value })}
      />
      <label>Options</label>
      {draft.options.map((o, i) => (
        <div className="row" style={{ gap: 6 }} key={i}>
          <input
            style={{ width: 64 }}
            placeholder="🥩"
            value={o.emoji}
            onChange={(e) => setOption(i, { emoji: e.target.value })}
            aria-label="Option emoji (optional)"
          />
          <input
            style={{ flex: 1 }}
            placeholder={`Option ${i + 1}`}
            value={o.label}
            onChange={(e) => setOption(i, { label: e.target.value })}
          />
          <button
            className="th-btn th-btn--tertiary th-btn--icon th-btn--sm"
            aria-label="Remove option"
            disabled={draft.options.length <= 2}
            onClick={() =>
              setDraft({
                ...draft,
                options: draft.options.filter((_, idx) => idx !== i),
              })
            }
          >
            ✕
          </button>
        </div>
      ))}
      <button
        className="th-btn th-btn--secondary"
        onClick={() =>
          setDraft({
            ...draft,
            options: [...draft.options, { label: "", emoji: "" }],
          })
        }
      >
        + Add option
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Expenses                                                            */
/* ------------------------------------------------------------------ */

function formatCents(cents: number): string {
  const abs = Math.abs(cents);
  return `€${(abs / 100).toFixed(2)}`;
}

type SplitMode = "equal" | "custom";

function ExpenseForm({
  users,
  currentUserId,
  initial,
  onSubmit,
}: {
  users: ReturnType<typeof useTripContext>["users"];
  currentUserId: number;
  initial?: Expense;
  onSubmit: (data:
    | { payer_user_id: number; amount_cents: number; description: string; split_mode: "equal"; split_user_ids: number[] }
    | { payer_user_id: number; amount_cents: number; description: string; split_mode: "custom"; splits: { user_id: number; amount_cents: number }[] }
  ) => Promise<void>;
}) {
  const joining = users.filter((u) => u.joining);

  // Determine initial split mode from existing expense
  const initialIsCustom = initial?.splits.some((s) => s.amount_cents != null) ?? false;

  const [payerId, setPayerId] = useState<number>(initial?.payer_user_id ?? currentUserId);
  const [amount, setAmount] = useState(initial ? (initial.amount_cents / 100).toFixed(2) : "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [splitMode, setSplitMode] = useState<SplitMode>(initialIsCustom ? "custom" : "equal");
  const [splitIds, setSplitIds] = useState<Set<number>>(
    initial
      ? new Set(initial.splits.map((s) => s.user_id))
      : new Set(joining.map((u) => u.id))
  );
  const [customAmounts, setCustomAmounts] = useState<Record<number, string>>(
    initial && initialIsCustom
      ? Object.fromEntries(initial.splits.filter((s) => s.amount_cents != null).map((s) => [s.user_id, (s.amount_cents! / 100).toFixed(2)]))
      : {}
  );
  const [error, setError] = useState<string | null>(null);

  const toggleSplit = (uid: number) => {
    setSplitIds((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const totalCents = Math.round(parseFloat(amount) * 100) || 0;
  const customTotal = [...splitIds].reduce(
    (sum, uid) => sum + Math.round(parseFloat(customAmounts[uid] || "0") * 100),
    0
  );
  const customRemaining = totalCents - customTotal;

  const submit = async () => {
    setError(null);
    const cents = Math.round(parseFloat(amount) * 100);
    if (!cents || cents < 1) {
      setError("Enter a valid amount");
      return;
    }
    if (!description.trim()) {
      setError("Enter a description");
      return;
    }
    if (splitIds.size === 0) {
      setError("Select at least one person to split with");
      return;
    }
    try {
      if (splitMode === "custom") {
        const splits = [...splitIds].map((uid) => ({
          user_id: uid,
          amount_cents: Math.round(parseFloat(customAmounts[uid] || "0") * 100),
        }));
        const splitTotal = splits.reduce((s, r) => s + r.amount_cents, 0);
        if (splitTotal !== cents) {
          setError(`Split amounts (€${(splitTotal / 100).toFixed(2)}) must equal the total (€${(cents / 100).toFixed(2)})`);
          return;
        }
        await onSubmit({
          payer_user_id: payerId,
          amount_cents: cents,
          description: description.trim(),
          split_mode: "custom",
          splits,
        });
      } else {
        await onSubmit({
          payer_user_id: payerId,
          amount_cents: cents,
          description: description.trim(),
          split_mode: "equal",
          split_user_ids: [...splitIds],
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="card" style={{ marginTop: 0 }}>
      {error && <div className="error-banner">{error}</div>}
      {initial && (
        <>
          <label>Paid by</label>
          <select
            value={payerId}
            onChange={(e) => setPayerId(Number(e.target.value))}
          >
            {joining.map((u) => (
              <option key={u.id} value={u.id}>{u.name}{u.id === currentUserId ? " (you)" : ""}</option>
            ))}
          </select>
        </>
      )}
      <label style={initial ? { marginTop: 10 } : undefined}>Amount (€)</label>
      <input
        type="number"
        min="0.01"
        step="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="0.00"
        inputMode="decimal"
      />
      <label style={{ marginTop: 10 }}>Description</label>
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="e.g. Groceries, Gas, Campsite fee"
      />
      <label style={{ marginTop: 10 }}>Split mode</label>
      <div className="seg" data-active={splitMode} role="tablist" aria-label="Split mode">
        <span className="seg__thumb" aria-hidden="true" />
        {(["equal", "custom"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={splitMode === m}
            className={`seg__opt ${splitMode === m ? "is-active" : ""}`}
            onClick={() => setSplitMode(m)}
          >
            {m === "equal" ? "Equal" : "Custom"}
          </button>
        ))}
      </div>

      <label style={{ marginTop: 10 }}>Split among</label>
      {splitMode === "equal" ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
          {joining.map((u) => {
            const on = splitIds.has(u.id);
            return (
              <button
                key={u.id}
                type="button"
                role="switch"
                aria-checked={on}
                className={`split-chip ${on ? "is-on" : ""}`}
                onClick={() => toggleSplit(u.id)}
              >
                <span className="split-chip__box" aria-hidden="true">✓</span>
                {u.name}{u.id === currentUserId ? " (you)" : ""}
              </button>
            );
          })}
        </div>
      ) : (
        <div style={{ marginTop: 6 }}>
          {joining.map((u) => {
            const on = splitIds.has(u.id);
            return (
              <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  className={`split-chip ${on ? "is-on" : ""}`}
                  onClick={() => toggleSplit(u.id)}
                  style={{ flex: 1, justifyContent: "flex-start" }}
                >
                  <span className="split-chip__box" aria-hidden="true">✓</span>
                  {u.name}{u.id === currentUserId ? " (you)" : ""}
                </button>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    flex: 1,
                    visibility: on ? "visible" : "hidden",
                  }}
                >
                  <span style={{ fontSize: 14 }}>€</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={customAmounts[u.id] ?? ""}
                    onChange={(e) =>
                      setCustomAmounts((prev) => ({ ...prev, [u.id]: e.target.value }))
                    }
                    style={{ flex: 1 }}
                  />
                </div>
              </div>
            );
          })}
          {totalCents > 0 && (
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              {customRemaining === 0
                ? "✓ Amounts match the total"
                : customRemaining > 0
                ? `€${(customRemaining / 100).toFixed(2)} remaining to assign`
                : `€${(Math.abs(customRemaining) / 100).toFixed(2)} over the total`}
            </div>
          )}
        </div>
      )}
      <button
        className="th-btn th-btn--primary th-btn--full"
        onClick={submit}
        style={{ marginTop: 14 }}
      >
        {initial ? "Save changes" : "Add expense"}
      </button>
    </div>
  );
}

function SimplifyArrow({ from, to, amount, highlight }: { from: string; to: string; amount: string; highlight?: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "6px 10px", borderRadius: 8,
      background: highlight ? "rgba(var(--min-accent-rgb, 180,140,60), 0.1)" : "rgba(255,255,255,0.04)",
    }}>
      <span style={{ fontWeight: 600, minWidth: 36 }}>{from}</span>
      <span style={{ flex: 1, display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ flex: 1, height: 1, background: highlight ? "var(--min-accent)" : "rgba(255,255,255,0.15)" }} />
        <span style={{ fontSize: 12 }}>{amount}</span>
        <span style={{ fontSize: 12 }}>→</span>
      </span>
      <span style={{ fontWeight: 600, minWidth: 36, textAlign: "right" }}>{to}</span>
    </div>
  );
}

// Slide + fade for the drawer's push/pop navigation. dir > 0 pushes a sub-view
// in from the right; dir < 0 pops back toward the left.
const expPanelVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 34 : -34, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -34 : 34, opacity: 0 }),
};

function ExpensesBody({
  tripId,
  expenses,
  balances,
  users,
  currentUserId,
  ensureUser,
  view,
  dir,
  onNav,
  onChanged,
}: {
  tripId: string;
  expenses: Expense[];
  balances: Settlement[];
  users: ReturnType<typeof useTripContext>["users"];
  currentUserId: number | null;
  ensureUser: () => Promise<number | null>;
  view: ExpView;
  dir: number;
  onNav: (v: ExpView) => void;
  onChanged: () => Promise<void>;
}) {
  const [settleAmount, setSettleAmount] = useState("");
  const [settleBusy, setSettleBusy] = useState(false);
  const [simplifyInfoOpen, setSimplifyInfoOpen] = useState(false);
  const [expandedExpenses, setExpandedExpenses] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const settleTarget = view.kind === "settle" ? view.target : null;

  // Seed the settle amount with the full outstanding debt when entering.
  useEffect(() => {
    if (view.kind === "settle") {
      setSettleAmount((view.target.amount_cents / 100).toFixed(2));
      setError(null);
    }
  }, [view]);

  const realExpenses = expenses.filter((e) => !e.is_settlement);
  const settlementExpenses = expenses.filter((e) => e.is_settlement);

  // Only the balances that involve me — what I owe or am owed.
  const myBalances = balances.filter(
    (b) => b.from_user_id === currentUserId || b.to_user_id === currentUserId
  );
  // Net position across those balances. + = owed to me, − = I owe.
  const net = myBalances.reduce(
    (sum, b) => (b.to_user_id === currentUserId ? sum + b.amount_cents : sum - b.amount_cents),
    0
  );

  // Neutral copy for anonymous visitors (no "you owe / you're owed").
  const totalSpent = realExpenses.reduce((s, e) => s + e.amount_cents, 0);
  const heroLabel =
    expenses.length === 0
      ? "No expenses yet"
      : currentUserId == null
      ? "Total spent"
      : net > 0
      ? "You're owed"
      : net < 0
      ? "You owe"
      : "You're all settled up";
  const heroAmount =
    expenses.length === 0
      ? null
      : currentUserId == null
      ? formatCents(totalSpent)
      : net === 0
      ? null
      : formatCents(net);
  const heroColor = net > 0 ? "var(--min-accent)" : net < 0 ? "var(--danger)" : "var(--min-ink)";

  const confirmSettle = async () => {
    if (!settleTarget) return;
    setError(null);
    const cents = Math.round(parseFloat(settleAmount) * 100);
    if (!cents || cents < 1) {
      setError("Enter a valid amount");
      return;
    }
    if (cents > settleTarget.amount_cents) {
      setError(`You only owe ${formatCents(settleTarget.amount_cents)}`);
      return;
    }
    setSettleBusy(true);
    try {
      await api.createExpense(tripId, {
        payer_user_id: settleTarget.from_user_id,
        amount_cents: cents,
        description: `${settleTarget.from_name} → ${settleTarget.to_name}`,
        split_mode: "custom",
        splits: [{ user_id: settleTarget.to_user_id, amount_cents: cents }],
        is_settlement: true,
      });
      onNav({ kind: "list" });
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSettleBusy(false);
    }
  };

  // ---- Root list view ----
  const listPanel = (
    <div className="sheet-flat">
      {error && <div className="error-banner">{error}</div>}

      {/* Net balance hero */}
      <div className="exp-hero">
        <div className="exp-hero__label">{heroLabel}</div>
        {heroAmount && (
          <div className="exp-hero__amount" style={{ color: heroColor }}>
            {heroAmount}
          </div>
        )}
      </div>

      {/* Add expense — primary action right under the balance, hug-width */}
      <div className="exp-addbtn">
        <button
          className="th-btn th-btn--secondary th-btn--pill"
          onClick={async () => {
            const uid = await ensureUser();
            if (uid == null) return;
            onNav({ kind: "add" });
          }}
        >
          + Add expense
        </button>
      </div>

      {/* My balances — only what I owe or am owed */}
      {myBalances.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          {myBalances.map((b, i) => {
            const owedToMe = b.to_user_id === currentUserId;
            const other = owedToMe ? b.from_name : b.to_name;
            return (
              <div className="exp-bal-row" key={i}>
                <span className="exp-bal-row__amt">{formatCents(b.amount_cents)}</span>
                <span className={`exp-tag ${owedToMe ? "exp-tag--owed" : "exp-tag--owe"}`}>
                  {owedToMe ? "you're owed" : "you owe"}
                </span>
                <span className="exp-bal-row__name">{other}</span>
                {!owedToMe && (
                  <button
                    className="th-btn th-btn--primary th-btn--sm"
                    onClick={() => onNav({ kind: "settle", target: b })}
                  >
                    Settle
                  </button>
                )}
              </div>
            );
          })}
          <button
            type="button"
            className="muted"
            style={{ fontSize: 12, marginTop: 6, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}
            onClick={() => setSimplifyInfoOpen(true)}
          >
            Simplified to minimize payments
          </button>
        </div>
      )}

      {/* Expense ledger */}
      {realExpenses.length === 0 && (
        <p className="muted" style={{ marginTop: 12 }}>
          No expenses yet. Add one to start splitting costs.
        </p>
      )}
      {realExpenses.length > 0 && (
        <div className="muted" style={{ fontWeight: 600, fontSize: 13, margin: "16px 0 6px" }}>
          Expenses
        </div>
      )}
      {realExpenses.map((exp) => {
        const summary = summarizeSplit(exp, currentUserId);
        const isExpanded = expandedExpenses.has(exp.id);
        const splitLabel =
          summary.kind === "equal"
            ? `Split equally · ${summary.count} ${summary.count === 1 ? "person" : "people"}`
            : `Custom split · ${summary.count} ${summary.count === 1 ? "person" : "people"}`;
        const equalShare = Math.round(exp.amount_cents / Math.max(exp.splits.length, 1));
        return (
          <div className="exp-item" key={exp.id}>
            <div className="exp-item__head">
              <div className="exp-item__title">
                <div className="exp-item__name">{exp.description}</div>
                <div className="exp-item__total">{formatCents(exp.amount_cents)}</div>
              </div>
              {exp.payer_user_id === currentUserId && (
                <div className="row" style={{ gap: 4, flexShrink: 0 }}>
                  <button
                    className="th-btn th-btn--tertiary th-btn--icon th-btn--sm"
                    onClick={() => onNav({ kind: "edit", expense: exp })}
                    aria-label="Edit expense"
                  >
                    ✏️
                  </button>
                  <button
                    className="th-btn th-btn--tertiary th-btn--icon th-btn--sm"
                    style={{ color: "var(--danger)" }}
                    onClick={async () => {
                      await api.deleteExpense(tripId, exp.id);
                      await onChanged();
                    }}
                    aria-label="Delete expense"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
            <div className="exp-item__meta">
              Paid by {exp.payer_name} · {splitLabel}
            </div>
            {summary.yourShareCents != null && (
              <div className="exp-item__share">
                Your share <strong>{formatCents(summary.yourShareCents)}</strong>
              </div>
            )}
            <button
              type="button"
              className="exp-item__toggle"
              aria-expanded={isExpanded}
              onClick={() =>
                setExpandedExpenses((prev) => {
                  const next = new Set(prev);
                  if (next.has(exp.id)) next.delete(exp.id);
                  else next.add(exp.id);
                  return next;
                })
              }
            >
              {isExpanded ? "Hide breakdown" : "Show breakdown"}
            </button>
            {isExpanded && (
              <div className="exp-breakdown">
                {exp.splits.map((s) => (
                  <div
                    className={`exp-breakdown__row${s.user_id === currentUserId ? " exp-breakdown__row--me" : ""}`}
                    key={s.user_id}
                  >
                    <span className="exp-breakdown__name">{s.name}</span>
                    <span className="exp-breakdown__amt">
                      {formatCents(s.amount_cents ?? equalShare)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Payments log */}
      {settlementExpenses.length > 0 && (
        <>
          <div className="muted" style={{ fontWeight: 600, fontSize: 13, margin: "16px 0 6px" }}>
            Payments
          </div>
          <div className="card">
            {settlementExpenses.map((s) => (
              <div className="list-item" key={s.id}>
                <div style={{ fontSize: 14 }}>
                  {s.payer_name} paid {formatCents(s.amount_cents)} to {s.splits[0]?.name ?? "?"}
                </div>
                <button
                  className="th-btn th-btn--tertiary th-btn--icon th-btn--sm"
                  style={{ color: "var(--danger)" }}
                  onClick={async () => {
                    await api.deleteExpense(tripId, s.id);
                    await onChanged();
                  }}
                  aria-label="Delete payment"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  // ---- Add / edit form view ----
  const formPanel = (view.kind === "add" || view.kind === "edit") &&
    currentUserId != null && (
    <ExpenseForm
      users={users}
      currentUserId={currentUserId}
      initial={view.kind === "edit" ? view.expense : undefined}
      onSubmit={async (data) => {
        if (view.kind === "edit") {
          await api.updateExpense(tripId, view.expense.id, data);
        } else {
          await api.createExpense(tripId, data);
        }
        onNav({ kind: "list" });
        await onChanged();
      }}
    />
  );

  // ---- Settle view ----
  const settlePanel = settleTarget && (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {error && <div className="error-banner">{error}</div>}
      <div
        style={{
          display: "flex",
          gap: 10,
          padding: "10px 12px",
          borderRadius: 8,
          background: "rgba(255, 180, 50, 0.1)",
          border: "1px solid rgba(255, 180, 50, 0.25)",
          fontSize: 13,
          lineHeight: 1.45,
          color: "var(--min-ink)",
        }}
      >
        <span style={{ flexShrink: 0, fontSize: 16 }} aria-hidden="true">
          ⚠️
        </span>
        <span>
          This doesn&apos;t send money — it just records that you&apos;ve already
          paid. Make sure you&apos;ve transferred the money (Revolut, bank, cash,
          etc.) before confirming.
        </span>
      </div>
      <p className="muted" style={{ margin: 0 }}>
        Record a payment from you to{" "}
        <strong style={{ color: "var(--min-ink)" }}>{settleTarget.to_name}</strong>.
      </p>
      <div>
        <label>Amount (€)</label>
        <input
          type="number"
          min="0.01"
          step="0.01"
          max={(settleTarget.amount_cents / 100).toFixed(2)}
          value={settleAmount}
          onChange={(e) => setSettleAmount(e.target.value)}
          placeholder="0.00"
          inputMode="decimal"
        />
      </div>
      <button
        className="th-btn th-btn--primary th-btn--full"
        disabled={settleBusy || !settleAmount}
        onClick={confirmSettle}
      >
        {settleBusy
          ? "Settling…"
          : `I've paid ${settleTarget.to_name} ${formatCents(
              Math.round((parseFloat(settleAmount) || 0) * 100)
            )}`}
      </button>
    </div>
  );

  return (
    <>
      <div style={{ position: "relative", overflowX: "hidden" }}>
        <AnimatePresence mode="popLayout" custom={dir} initial={false}>
          <motion.div
            key={view.kind}
            custom={dir}
            variants={expPanelVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.17, ease: [0.22, 1, 0.36, 1] }}
          >
            {view.kind === "list"
              ? listPanel
              : view.kind === "settle"
              ? settlePanel
              : formPanel}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Simplification explainer */}
      <BottomSheet
        open={simplifyInfoOpen}
        onClose={() => setSimplifyInfoOpen(false)}
        title="How it works"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
            Say Colin paid €100 for himself and Juan, and Juan paid €100 for himself and Nico.
            Each person&apos;s net works out to:
          </p>

          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <div style={{ textAlign: "center", padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)" }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Colin</div>
              <div className="muted" style={{ fontSize: 12 }}>gets €50</div>
            </div>
            <div style={{ textAlign: "center", padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)" }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Juan</div>
              <div className="muted" style={{ fontSize: 12 }}>settled</div>
            </div>
            <div style={{ textAlign: "center", padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)" }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Nico</div>
              <div className="muted" style={{ fontSize: 12 }}>owes €50</div>
            </div>
          </div>

          {/* Diagram */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Before */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, opacity: 0.5 }}>WITHOUT SIMPLIFICATION</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <SimplifyArrow from="Juan" to="Colin" amount="€50" />
                <SimplifyArrow from="Nico" to="Juan" amount="€50" />
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                2 payments — Juan is in the middle for no reason
              </div>
            </div>

            {/* Arrow */}
            <div style={{ textAlign: "center", fontSize: 20, opacity: 0.4 }}>↓</div>

            {/* After */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: "var(--min-accent)" }}>WITH SIMPLIFICATION</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <SimplifyArrow from="Nico" to="Colin" amount="€50" highlight />
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                1 payment — Nico pays Colin directly, Juan doesn&apos;t need to do anything
              </div>
            </div>
          </div>

          <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
            Everyone ends up with the same amount — just fewer transfers.
          </p>
        </div>
      </BottomSheet>
    </>
  );
}
