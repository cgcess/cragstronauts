import React, { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import type { DateRange } from "react-day-picker";
import type { z } from "zod";
import type { CarSchema, GearContributionSchema, ExpenseSchema, SettlementSchema } from "@cragstronauts/contract";
import { api } from "../api";
import { useTripContext, type Category } from "../context/TripContext";
import { formatDateRange } from "../dateUtils";
import Linkify from "../components/Linkify";
import DateRangePicker from "../components/DateRangePicker";
import BottomSheet from "../components/BottomSheet";
import { Button, Tag } from "../components/ui";

type Car = z.infer<typeof CarSchema>;
type Contribution = z.infer<typeof GearContributionSchema>;
type Expense = z.infer<typeof ExpenseSchema>;
type Settlement = z.infer<typeof SettlementSchema>;

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/* ------------------------------------------------------------------ */
/* Share + add-to-calendar                                             */
/* ------------------------------------------------------------------ */

type ShareableTrip = {
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
    `SUMMARY:${icsEscape("🧗 " + trip.location)}`,
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

/** Slugify a trip name into a safe download filename stem. */
function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "trip"
  );
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

function DashCard({
  icon,
  title,
  summary,
  badge,
  urgent,
  expanded,
  onToggle,
  children,
}: {
  icon: string;
  title: string;
  summary?: React.ReactNode;
  badge?: React.ReactNode;
  urgent?: boolean;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`dash-card${urgent ? " dash-card--urgent" : ""}${
        expanded ? " dash-card--open" : ""
      }`}
    >
      <button className="dash-card__head" onClick={onToggle}>
        <span className="dash-card__icon">{icon}</span>
        <span className="dash-card__titles">
          <span className="dash-card__title">
            {title}
            {urgent && <span className="dash-card__flag">action needed</span>}
          </span>
          {summary != null && <span className="dash-card__summary">{summary}</span>}
        </span>
        {badge != null && <Tag variant="neutral" size="sm" mono>{badge}</Tag>}
        <span className={`dash-chevron${expanded ? " open" : ""}`}>▾</span>
      </button>
      {/* Clean reveal — content fades in, the card grows instantly.
          No shared-layout morph (the animation the crew disliked). */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            className="dash-card__body"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: EASE_OUT }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
    currentUserId,
    switchUser,
    refresh,
    deleteTrip,
  } = useTripContext();
  const navigate = useNavigate();
  const me = users.find((u) => u.id === currentUserId);

  const [cars, setCars] = useState<Car[]>([]);
  const [gear, setGear] = useState<Contribution[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<Settlement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingHero, setEditingHero] = useState(false);
  const [weatherSheetOpen, setWeatherSheetOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const initExpanded = useRef(false);

  const shareTrip = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: trip.location,
          text: `Join the "${trip.location}" climbing trip`,
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
    const ics = buildTripIcs(trip, window.location.href);
    if (!ics) return;
    openCalendarFile(`${slugify(trip.location)}.ics`, ics);
  };

  const reload = async () => {
    setError(null);
    try {
      const [c, g, ex, bal] = await Promise.all([
        api.listCars(tripId),
        api.listGear(tripId),
        api.listExpenses(tripId),
        api.getBalances(tripId),
      ]);
      setCars(c);
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

  const weather = useWeather(
    trip.latitude,
    trip.longitude,
    trip.start_date,
    trip.end_date
  );

  // Guards (after hooks)
  if (!currentUserId || !me) {
    return <Navigate to={`/trips/${tripId}`} replace />;
  }
  if (!me.signup_completed) {
    return <Navigate to={`/trips/${tripId}/signup`} replace />;
  }

  // ---- Derived state for priority ----
  const joining = users.filter((u) => u.joining);
  const myCar = cars.find((c) => c.driver_user_id === currentUserId);
  const ridingIn = cars.find((c) =>
    c.passengers.some((p) => p.user_id === currentUserId)
  );
  const amInCar = Boolean(myCar || ridingIn);
  const seatsTotal = cars.reduce((n, c) => n + Math.max(0, c.total_seats), 0);
  const seatsFilled = cars.reduce((n, c) => n + 1 + c.passengers.length, 0);
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

  // Cars — prominent if you have no ride.
  cards.push({
    id: "cars",
    score: amInCar ? 35 : 110,
    icon: "🚗",
    title: "Rides",
    urgent: !amInCar,
    badge: cars.length ? `${seatsFilled}/${seatsTotal}` : undefined,
    summary: amInCar
      ? myCar
        ? "You're driving"
        : `Riding with ${ridingIn?.driver_name}`
      : "You don't have a ride yet",
    body: (
      <CarsBody
        tripId={tripId}
        cars={cars}
        currentUserId={currentUserId}
        onChanged={reload}
      />
    ),
  });

  // Gear — prominent if you haven't claimed anything.
  const gearUrgent = categories.length > 0 && myGear.length === 0;
  cards.push({
    id: "gear",
    score: gearUrgent ? 80 : 33,
    icon: "🎒",
    title: "Gear",
    urgent: gearUrgent,
    badge: categories.length ? `${coveredCats}/${categories.length}` : undefined,
    summary:
      categories.length === 0
        ? "No gear categories yet"
        : myGear.length > 0
        ? `You're bringing ${myGear.length}`
        : "You haven't added gear",
    body: (
      <GearBody
        tripId={tripId}
        categories={categories}
        gear={gear}
        currentUserId={currentUserId}
        isOrganizer={me.is_organizer}
        onChanged={reload}
      />
    ),
  });

  // Roster
  cards.push({
    id: "roster",
    score: 40,
    icon: "🧗",
    title: "Roster",
    badge: `${joining.length}`,
    summary: `${joining.length} going`,
    body: (
      <RosterBody
        tripId={tripId}
        users={users}
        currentUserId={currentUserId}
        isOrganizer={me.is_organizer}
        onChanged={reload}
      />
    ),
  });

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
    urgent: myBalance < 0,
    summary:
      expenses.length === 0
        ? "No expenses yet"
        : myBalance === 0
        ? "You're settled up"
        : myBalance > 0
        ? `You're owed ${formatCents(myBalance)}`
        : `You owe ${formatCents(-myBalance)}`,
    body: (
      <ExpensesBody
        tripId={tripId}
        expenses={expenses}
        balances={balances}
        users={users}
        currentUserId={currentUserId}
        onChanged={reload}
      />
    ),
  });

  cards.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  // Auto-expand the top card once data has loaded.
  if (!initExpanded.current && cards.length) {
    initExpanded.current = true;
    if (expandedId === null) setExpandedId(cards[0].id);
  }

  const toggle = (id: string) =>
    setExpandedId((cur) => (cur === id ? null : id));

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="row between">
          <Button variant="secondary" pill onClick={() => navigate("/")}>
            ← Trips
          </Button>
          <div className="glass-surface nav-cap">
            <strong>{me.name}</strong>
            {me.is_organizer && " 👑"}
          </div>
          <Button
            variant="secondary"
            pill
            onClick={() => {
              switchUser();
              navigate(`/trips/${tripId}`);
            }}
          >
            Switch
          </Button>
        </div>
      </div>

      <div className="content content--dash">
        {error && <div className="error-banner">{error}</div>}

        {/* Weather-app hero: date / trip name / countdown / weather.
            Organizers edit title, dates & logistics inline here. */}
        {editingHero && me.is_organizer ? (
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
          {me.is_organizer && (
            <button
              className="fl-detail-hero__edit"
              onClick={() => setEditingHero(true)}
              aria-label="Edit trip"
            >
              ✏️ Edit
            </button>
          )}
          <div className="fl-detail-hero__meta">
            <span aria-hidden="true">🧗</span>
            <span>
              {trip.start_date || trip.end_date
                ? formatDateRange(trip.start_date, trip.end_date)
                : "Dates TBD"}
            </span>
          </div>
          <h1 className="fl-detail-hero__title">{trip.location}</h1>
          <div className="fl-detail-hero__row">
            <div className="fl-detail-hero__count-col">
              {dUntil == null ? (
                <span className="fl-detail-hero__count-label">Dates TBD</span>
              ) : dUntil > 0 ? (
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
            </div>
            <HeroWeatherChip
              weather={weather}
              isOrganizer={me.is_organizer}
              onOpen={() => setWeatherSheetOpen(true)}
            />
          </div>
          {(trip.accommodation_details ||
            trip.start_date ||
            trip.end_date ||
            trip.notes) && (
            <div className="fl-detail-hero__logistics">
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
                me.is_organizer ? (
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
                    <span className="fl-detail-hero__logistics-detail fl-detail-hero__notes">
                      <Linkify>{trip.notes}</Linkify>
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="fl-detail-hero__actions">
            <button
              type="button"
              className={"fl-hero-action" + (copied ? " is-copied" : "")}
              onClick={shareTrip}
            >
              {copied ? (
                "Link copied!"
              ) : (
                <>
                  <span className="fl-hero-action__icon" aria-hidden="true">
                    📲
                  </span>
                  Share trip
                </>
              )}
            </button>
            {(trip.start_date || trip.end_date) && (
              <button
                type="button"
                className="fl-hero-action"
                onClick={addToCalendar}
              >
                <span className="fl-hero-action__icon" aria-hidden="true">
                  📅
                </span>
                Add to calendar
              </button>
            )}
          </div>
        </div>
        )}

        <div className="dash-stack">
          {cards.map((c) => (
            <DashCard
              key={c.id}
              icon={c.icon}
              title={c.title}
              summary={c.summary}
              badge={c.badge}
              urgent={c.urgent}
              expanded={expandedId === c.id}
              onToggle={() => toggle(c.id)}
            >
              {c.body}
            </DashCard>
          ))}
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
          isOrganizer={me.is_organizer}
          onChanged={reload}
        />
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
      <span className="fl-weather__icon" aria-hidden="true">
        {icon}
      </span>
      {temps}
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      await api.updateTrip(tripId, {
        location: location.trim(),
        start_date: dateToIso(range?.from),
        end_date: dateToIso(range?.to ?? range?.from),
        accommodation_type: accomType,
        accommodation_details: accomDetails.trim() || null,
        notes: notes.trim() || null,
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
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder="Trip name"
        aria-label="Trip name"
      />
      <div className="fl-detail-hero__dates-edit">
        <DateRangePicker value={range} onChange={setRange} placeholder="Add dates" />
      </div>

      <div className="col" style={{ gap: 12 }}>
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

        {error && <div className="error-banner">{error}</div>}

        <div className="row" style={{ gap: 8 }}>
          <button className="th-btn th-btn--secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button
            className="th-btn th-btn--primary"
            onClick={save}
            disabled={!location.trim() || saving}
            style={{ flex: 1 }}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
        <DangerZone tripLocation={trip.location} onDelete={deleteTrip} />
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
  currentUserId: number;
  isOrganizer: boolean;
  onChanged: () => Promise<void>;
}) {
  const joining = users.filter((u) => u.joining);
  const out = users.filter((u) => !u.joining);
  const [error, setError] = useState<string | null>(null);

  const remove = async (userId: number, name: string) => {
    if (
      !confirm(
        `Remove ${name} from the trip? Their car and gear contributions will also be removed.`
      )
    )
      return;
    setError(null);
    try {
      await api.deleteUser(tripId, userId);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const renderRow = (u: typeof users[number], pill: React.ReactNode) => (
    <div className="list-item" key={u.id}>
      <span>
        {u.name} {u.is_organizer && "👑"}
        {u.id === currentUserId && <span className="muted"> (you)</span>}
      </span>
      <div className="row" style={{ gap: 6, alignItems: "center" }}>
        {pill}
        {isOrganizer && !u.is_organizer && u.id !== currentUserId && (
          <button
            className="th-btn th-btn--tertiary th-btn--icon th-btn--sm"
            style={{ color: "var(--danger)" }}
            onClick={() => remove(u.id, u.name)}
            aria-label={`Remove ${u.name}`}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {error && <div className="error-banner">{error}</div>}
      {joining.map((u) => renderRow(u, <Tag variant="moss">Going</Tag>))}
      {out.length > 0 && (
        <>
          <div className="muted" style={{ marginTop: 8 }}>
            Not joining
          </div>
          {out.map((u) => renderRow(u, <Tag variant="neutral">Out</Tag>))}
        </>
      )}
    </>
  );
}

function CarsBody({
  tripId,
  cars,
  currentUserId,
  onChanged,
}: {
  tripId: string;
  cars: Car[];
  currentUserId: number;
  onChanged: () => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [seats, setSeats] = useState("4");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const myCar = cars.find((c) => c.driver_user_id === currentUserId);

  const submitCar = async () => {
    setError(null);
    try {
      await api.createCar(tripId, {
        driver_user_id: currentUserId,
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
    <div>
      {error && <div className="error-banner">{error}</div>}
      {cars.length === 0 && (
        <p className="muted">No cars yet. Be the first to offer a ride!</p>
      )}

      {cars.map((c) => {
        const passengerCount = c.passengers.length;
        const passengerCapacity = Math.max(0, c.total_seats - 1);
        const empty = passengerCapacity - passengerCount;
        const iAmIn =
          c.driver_user_id === currentUserId ||
          c.passengers.some((p) => p.user_id === currentUserId);
        return (
          <div className="card" key={c.id}>
            <div className="row between">
              <div>
                <div style={{ fontWeight: 600 }}>{c.driver_name}&apos;s car</div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {c.total_seats} seats · {passengerCount}/{passengerCapacity} passengers
                </div>
              </div>
              {c.driver_user_id === currentUserId && (
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
                        await api.carSignoff(tripId, c.id, currentUserId);
                        onChanged();
                      }}
                    >
                      ✕
                    </button>
                  )}
                </span>
              ))}
              {Array.from({ length: empty }).map((_, i) => (
                <button
                  key={`empty-${i}`}
                  className="seat empty"
                  disabled={iAmIn}
                  onClick={async () => {
                    setError(null);
                    try {
                      await api.carSignup(tripId, c.id, currentUserId);
                      onChanged();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : String(e));
                    }
                  }}
                  style={{ border: "1px dashed var(--border)", background: "transparent" }}
                >
                  + open seat
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {!myCar && !adding && (
        <button className="th-btn th-btn--secondary" onClick={() => setAdding(true)} style={{ marginTop: 12 }}>
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

function GearBody({
  tripId,
  categories,
  gear,
  currentUserId,
  isOrganizer,
  onChanged,
}: {
  tripId: string;
  categories: Category[];
  gear: Contribution[];
  currentUserId: number;
  isOrganizer: boolean;
  onChanged: () => Promise<void>;
}) {
  const [addingFor, setAddingFor] = useState<number | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const addCategory = async () => {
    setError(null);
    try {
      await api.addCategory(tripId, {
        name: newCategoryName.trim(),
        fields: [],
      });
      setNewCategoryName("");
      setAddingCategory(false);
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
      await api.addGear(tripId, {
        user_id: currentUserId,
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
    <div>
      {error && <div className="error-banner">{error}</div>}
      {categories.length === 0 && (
        <p className="muted">
          {isOrganizer
            ? "No gear categories yet. Add one below to start collecting contributions."
            : "No gear categories yet. The organizer can add some."}
        </p>
      )}

      {categories.map((cat) => (
        <div className="card" key={cat.id}>
          <div className="row between">
            <div style={{ fontWeight: 600 }}>{cat.name}</div>
            <div className="row" style={{ gap: 6, alignItems: "center" }}>
              <Tag variant="neutral" size="sm" mono>{byCat[cat.id].length}</Tag>
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
              className="th-btn th-btn--secondary"
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
      ))}

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
            <div className="row" style={{ marginTop: 10 }}>
              <button
                className="th-btn th-btn--secondary"
                onClick={() => {
                  setAddingCategory(false);
                  setNewCategoryName("");
                }}
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
            className="th-btn th-btn--secondary"
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
  onCancel,
}: {
  users: ReturnType<typeof useTripContext>["users"];
  currentUserId: number;
  initial?: Expense;
  onSubmit: (data:
    | { payer_user_id: number; amount_cents: number; description: string; split_mode: "equal"; split_user_ids: number[] }
    | { payer_user_id: number; amount_cents: number; description: string; split_mode: "custom"; splits: { user_id: number; amount_cents: number }[] }
  ) => Promise<void>;
  onCancel: () => void;
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
    <div className="card" style={{ marginTop: 12 }}>
      <div className="h2" style={{ marginTop: 0 }}>{initial ? "Edit expense" : "New expense"}</div>
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
      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        <button
          type="button"
          className={`th-btn th-btn--sm ${splitMode === "equal" ? "th-btn--primary" : "th-btn--secondary"}`}
          onClick={() => setSplitMode("equal")}
        >
          Equal
        </button>
        <button
          type="button"
          className={`th-btn th-btn--sm ${splitMode === "custom" ? "th-btn--primary" : "th-btn--secondary"}`}
          onClick={() => setSplitMode("custom")}
        >
          Custom
        </button>
      </div>

      <label style={{ marginTop: 10 }}>Split among</label>
      {splitMode === "equal" ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
          {joining.map((u) => (
            <button
              key={u.id}
              type="button"
              className={`th-btn th-btn--sm ${
                splitIds.has(u.id) ? "th-btn--primary" : "th-btn--secondary"
              }`}
              onClick={() => toggleSplit(u.id)}
            >
              {u.name}
              {u.id === currentUserId ? " (you)" : ""}
            </button>
          ))}
        </div>
      ) : (
        <div style={{ marginTop: 4 }}>
          {joining.map((u) => {
            const included = splitIds.has(u.id);
            return (
              <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <button
                  type="button"
                  className={`th-btn th-btn--sm ${included ? "th-btn--primary" : "th-btn--secondary"}`}
                  onClick={() => toggleSplit(u.id)}
                  style={{ minWidth: 90, textAlign: "left" }}
                >
                  {u.name}{u.id === currentUserId ? " (you)" : ""}
                </button>
                {included && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
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
                )}
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
      <div className="row" style={{ marginTop: 12 }}>
        <button
          className="th-btn th-btn--secondary"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          className="th-btn th-btn--primary"
          onClick={submit}
          style={{ flex: 1 }}
        >
          {initial ? "Save changes" : "Add expense"}
        </button>
      </div>
    </div>
  );
}

function ExpensesBody({
  tripId,
  expenses,
  balances,
  users,
  currentUserId,
  onChanged,
}: {
  tripId: string;
  expenses: Expense[];
  balances: Settlement[];
  users: ReturnType<typeof useTripContext>["users"];
  currentUserId: number;
  onChanged: () => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [settling, setSettling] = useState(false);
  const [settleFrom, setSettleFrom] = useState<number | "">(currentUserId);
  const [settleTo, setSettleTo] = useState<number | "">("");
  const [settleAmount, setSettleAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const realExpenses = expenses.filter((e) => !e.is_settlement);
  const settlementExpenses = expenses.filter((e) => e.is_settlement);

  const joining = users.filter((u) => u.joining);

  return (
    <div>
      {error && <div className="error-banner">{error}</div>}

      {/* Balances summary */}
      {balances.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Balances</div>
          {balances.map((b, i) => (
            <div className="list-item" key={i}>
              <span>
                {b.from_name}
                {b.from_user_id === currentUserId && (
                  <span className="muted"> (you)</span>
                )}
              </span>
              <span>
                → {formatCents(b.amount_cents)} →{" "}
              </span>
              <span>
                {b.to_name}
                {b.to_user_id === currentUserId && (
                  <span className="muted"> (you)</span>
                )}
              </span>
            </div>
          ))}
          {!settling && (
            <button
              className="th-btn th-btn--secondary"
              onClick={() => setSettling(true)}
              style={{ marginTop: 8 }}
            >
              + Record a payment
            </button>
          )}
          {settling && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="row" style={{ gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label>From</label>
                  <select
                    value={settleFrom}
                    onChange={(e) => setSettleFrom(e.target.value ? Number(e.target.value) : "")}
                  >
                    <option value="">Select…</option>
                    {joining.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}{u.id === currentUserId ? " (you)" : ""}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label>To</label>
                  <select
                    value={settleTo}
                    onChange={(e) => setSettleTo(e.target.value ? Number(e.target.value) : "")}
                  >
                    <option value="">Select…</option>
                    {joining.filter((u) => u.id !== settleFrom).map((u) => (
                      <option key={u.id} value={u.id}>{u.name}{u.id === currentUserId ? " (you)" : ""}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label>Amount (€)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  placeholder="0.00"
                  inputMode="decimal"
                />
              </div>
              <div className="row" style={{ gap: 8 }}>
                <button
                  className="th-btn th-btn--secondary"
                  onClick={() => {
                    setSettling(false);
                    setSettleAmount("");
                  }}
                >
                  Cancel
                </button>
                <button
                  className="th-btn th-btn--primary"
                  style={{ flex: 1 }}
                  disabled={!settleFrom || !settleTo || !settleAmount}
                  onClick={async () => {
                    setError(null);
                    const cents = Math.round(parseFloat(settleAmount) * 100);
                    if (!cents || cents < 1) {
                      setError("Enter a valid amount");
                      return;
                    }
                    try {
                      const fromId = settleFrom as number;
                      const toId = settleTo as number;
                      const fromUser = joining.find((u) => u.id === fromId);
                      const toUser = joining.find((u) => u.id === toId);
                      await api.createExpense(tripId, {
                        payer_user_id: fromId,
                        amount_cents: cents,
                        description: `${fromUser?.name ?? "?"} → ${toUser?.name ?? "?"}`,
                        split_mode: "custom",
                        splits: [{ user_id: toId, amount_cents: cents }],
                        is_settlement: true,
                      });
                      setSettling(false);
                      setSettleAmount("");
                      await onChanged();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : String(e));
                    }
                  }}
                >
                  Record payment
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Settlement records */}
      {settlementExpenses.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Payments</div>
          {settlementExpenses.map((s) => (
            <div className="list-item" key={s.id}>
              <div>
                <div style={{ fontSize: 14 }}>
                  {s.payer_name} paid {formatCents(s.amount_cents)} to {s.splits[0]?.name ?? "?"}
                </div>
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
      )}

      {/* Expense list */}
      {realExpenses.length === 0 && !adding && !editingId && (
        <p className="muted">No expenses yet. Add one to start splitting costs.</p>
      )}
      {realExpenses.map((exp) => {
        if (editingId === exp.id) {
          return (
            <ExpenseForm
              key={exp.id}
              users={users}
              currentUserId={currentUserId}
              initial={exp}
              onSubmit={async (data) => {
                await api.updateExpense(tripId, exp.id, data);
                setEditingId(null);
                await onChanged();
              }}
              onCancel={() => setEditingId(null)}
            />
          );
        }
        const isCustom = exp.splits.some((s) => s.amount_cents != null);
        return (
          <div className="list-item" key={exp.id} style={{ flexDirection: "column", alignItems: "stretch", gap: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 500 }}>{exp.description}</div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {exp.payer_name} paid {formatCents(exp.amount_cents)} ·{" "}
                  {isCustom ? "custom split" : `split ${exp.splits.length} way${exp.splits.length !== 1 ? "s" : ""}`}
                </div>
              </div>
              {exp.payer_user_id === currentUserId && (
                <div className="row" style={{ gap: 4 }}>
                  <button
                    className="th-btn th-btn--tertiary th-btn--icon th-btn--sm"
                    onClick={() => {
                      setEditingId(exp.id);
                      setAdding(false);
                    }}
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
            {isCustom && (
              <div className="muted" style={{ fontSize: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {exp.splits.map((s) => (
                  <span key={s.user_id}>
                    {s.name}: {formatCents(s.amount_cents ?? 0)}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Add expense form */}
      {adding ? (
        <ExpenseForm
          users={users}
          currentUserId={currentUserId}
          onSubmit={async (data) => {
            await api.createExpense(tripId, data);
            setAdding(false);
            await onChanged();
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          className="th-btn th-btn--secondary"
          onClick={() => {
            setAdding(true);
            setEditingId(null);
          }}
          style={{ marginTop: 12 }}
        >
          + Add expense
        </button>
      )}
    </div>
  );
}
