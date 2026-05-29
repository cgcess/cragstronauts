import React, { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { motion } from "framer-motion";
import type { z } from "zod";
import type { CarSchema, GearContributionSchema } from "@cragstronauts/contract";
import { api } from "../api";
import { useTripContext, type Category } from "../context/TripContext";
import { formatDateRange } from "../dateUtils";
import Linkify from "../components/Linkify";

type Car = z.infer<typeof CarSchema>;
type Contribution = z.infer<typeof GearContributionSchema>;

const SPRING = { type: "spring" as const, stiffness: 380, damping: 36, mass: 0.9 };

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
const FORECAST_HORIZON = 16;

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
      `&temperature_unit=fahrenheit&timezone=auto&start_date=${iso(fStart)}&end_date=${iso(fEnd)}`;
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
    <motion.div
      layout
      transition={SPRING}
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
        {badge != null && <span className="dash-badge">{badge}</span>}
        <span className={`dash-chevron${expanded ? " open" : ""}`}>▾</span>
      </button>
      {expanded && <div className="dash-card__body">{children}</div>}
    </motion.div>
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
  } = useTripContext();
  const navigate = useNavigate();
  const me = users.find((u) => u.id === currentUserId);

  const [cars, setCars] = useState<Car[]>([]);
  const [gear, setGear] = useState<Contribution[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const initExpanded = useRef(false);

  const reload = async () => {
    setError(null);
    try {
      const [c, g] = await Promise.all([api.listCars(tripId), api.listGear(tripId)]);
      setCars(c);
      setGear(g);
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

  // Weather — climbs as the trip nears.
  let weatherScore = 30;
  if (tripUpcoming && trip.latitude != null && dUntil != null) {
    if (dUntil <= 3) weatherScore = 130;
    else if (dUntil <= 7) weatherScore = 90;
    else if (dUntil <= 14) weatherScore = 60;
    else weatherScore = 40;
  } else if (!tripUpcoming) {
    weatherScore = 5;
  }
  cards.push({
    id: "weather",
    score: weatherScore,
    icon: weatherSummaryIcon(weather),
    title: "Weather",
    summary: weatherSummaryText(weather, me.is_organizer),
    body: (
      <WeatherBody
        weather={weather}
        isOrganizer={me.is_organizer}
        onSettings={() => navigate(`/trips/${tripId}/admin`)}
      />
    ),
  });

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
    body: <RosterBody users={users} currentUserId={currentUserId} />,
  });

  // Logistics (trip basics)
  cards.push({
    id: "logistics",
    score: 50,
    icon: "📍",
    title: trip.location,
    summary: `${formatDateRange(trip.start_date, trip.end_date)} · ${
      trip.accommodation_type || "—"
    }`,
    body: (
      <LogisticsBody
        trip={trip}
        tripId={tripId}
        isOrganizer={me.is_organizer}
        onSettings={() => navigate(`/trips/${tripId}/admin`)}
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
          <button className="glass-surface nav-pill" onClick={() => navigate("/")}>
            ← Trips
          </button>
          <div className="glass-surface nav-cap">
            <strong>{me.name}</strong>
            {me.is_organizer && " 👑"}
          </div>
          <button
            className="glass-surface nav-pill"
            onClick={() => {
              switchUser();
              navigate(`/trips/${tripId}`);
            }}
          >
            Switch
          </button>
        </div>
      </div>

      <div className="content content--dash">
        {error && <div className="error-banner">{error}</div>}
        <motion.div layout className="dash-stack">
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
        </motion.div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Weather summary helpers + body                                      */
/* ------------------------------------------------------------------ */

function weatherSummaryIcon(w: WeatherState): string {
  if (w.status === "ready" && w.days.length) return wmo(w.days[0].code).icon;
  return "🌦️";
}
function weatherSummaryText(w: WeatherState, isOrganizer: boolean): string {
  switch (w.status) {
    case "no-pin":
      return isOrganizer ? "Pin the location in Settings" : "Location not set";
    case "no-dates":
      return "Add trip dates to see the forecast";
    case "past":
      return "Trip has passed";
    case "too-far":
      return `Forecast opens ~${w.daysUntil - FORECAST_HORIZON}d before the trip`;
    case "loading":
      return "Loading forecast…";
    case "error":
      return "Forecast unavailable";
    case "ready": {
      if (!w.days.length) return "No forecast";
      const d = w.days[0];
      return `${wmo(d.code).label} · ${fmtTemp(d.hi)}/${fmtTemp(d.lo)}`;
    }
  }
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
  isOrganizer,
  onSettings,
}: {
  weather: WeatherState;
  isOrganizer: boolean;
  onSettings: () => void;
}) {
  if (weather.status === "no-pin") {
    return (
      <div>
        <p className="muted">
          No location pinned yet, so we can&apos;t show a forecast.
        </p>
        {isOrganizer && (
          <button className="secondary" onClick={onSettings}>
            ⚙ Pin location in Settings
          </button>
        )}
      </div>
    );
  }
  if (weather.status === "no-dates")
    return <p className="muted">Add trip dates to see the forecast.</p>;
  if (weather.status === "past")
    return <p className="muted">This trip has already happened.</p>;
  if (weather.status === "too-far")
    return (
      <p className="muted">
        The trip is {weather.daysUntil} days away. Forecasts become available
        about {FORECAST_HORIZON} days out — check back closer.
      </p>
    );
  if (weather.status === "loading")
    return <p className="muted">Loading forecast…</p>;
  if (weather.status === "error")
    return <p className="muted">Couldn&apos;t load the forecast right now.</p>;

  return (
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
}

/* ------------------------------------------------------------------ */
/* Section bodies (ported from the old tabs)                           */
/* ------------------------------------------------------------------ */

function LogisticsBody({
  trip,
  isOrganizer,
  onSettings,
}: {
  trip: ReturnType<typeof useTripContext>["trip"];
  tripId: string;
  isOrganizer: boolean;
  onSettings: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy this trip link:", url);
    }
  };
  return (
    <div className="col">
      <div>
        <span className="pill accent">{trip.accommodation_type || "—"}</span>
        {trip.accommodation_details && (
          <p style={{ marginTop: 8 }}>
            <Linkify>{trip.accommodation_details}</Linkify>
          </p>
        )}
      </div>
      {trip.notes && (
        <p style={{ margin: 0 }}>
          <Linkify>{trip.notes}</Linkify>
        </p>
      )}
      <div className="row" style={{ gap: 8 }}>
        <button className="secondary" onClick={share}>
          {copied ? "Link copied ✓" : "Share trip link"}
        </button>
        {isOrganizer && (
          <button className="secondary" onClick={onSettings}>
            ⚙ Settings
          </button>
        )}
      </div>
    </div>
  );
}

function RosterBody({
  users,
  currentUserId,
}: {
  users: ReturnType<typeof useTripContext>["users"];
  currentUserId: number;
}) {
  const joining = users.filter((u) => u.joining);
  const out = users.filter((u) => !u.joining);
  return (
    <>
      {joining.map((u) => (
        <div className="list-item" key={u.id}>
          <span>
            {u.name} {u.is_organizer && "👑"}
            {u.id === currentUserId && <span className="muted"> (you)</span>}
          </span>
          <span className="pill accent">Going</span>
        </div>
      ))}
      {out.length > 0 && (
        <>
          <div className="muted" style={{ marginTop: 8 }}>
            Not joining
          </div>
          {out.map((u) => (
            <div className="list-item" key={u.id}>
              <span>{u.name}</span>
              <span className="pill">Out</span>
            </div>
          ))}
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
                  className="ghost"
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
                      className="ghost"
                      style={{ padding: "0 4px", color: "var(--danger)" }}
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
        <button className="secondary" onClick={() => setAdding(true)} style={{ marginTop: 12 }}>
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
            <button className="secondary" onClick={() => setAdding(false)}>
              Cancel
            </button>
            <button onClick={submitCar} style={{ flex: 1 }}>
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
  onChanged,
}: {
  tripId: string;
  categories: Category[];
  gear: Contribution[];
  currentUserId: number;
  onChanged: () => Promise<void>;
}) {
  const [addingFor, setAddingFor] = useState<number | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

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
        <p className="muted">No gear categories yet. Organizer can add some in Settings.</p>
      )}

      {categories.map((cat) => (
        <div className="card" key={cat.id}>
          <div className="row between">
            <div style={{ fontWeight: 600 }}>{cat.name}</div>
            <span className="pill">{byCat[cat.id].length}</span>
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
                  className="ghost"
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
                  className="secondary"
                  onClick={() => {
                    setAddingFor(null);
                    setValues({});
                  }}
                >
                  Cancel
                </button>
                <button onClick={() => addContribution(cat)} style={{ flex: 1 }}>
                  Save
                </button>
              </div>
            </div>
          ) : (
            <button
              className="secondary"
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
    </div>
  );
}
