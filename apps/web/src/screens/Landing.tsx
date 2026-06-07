import React, { useState } from "react";
import { useNavigate } from "react-router";
import { useTripContext } from "../context/TripContext";
import { tripPath } from "../lib/tripUrl";
import { formatDateRange } from "../dateUtils";
import { Button } from "../components/ui";
import Markdown from "../components/Markdown";
import Linkify from "../components/Linkify";

const SIGNOFF_WORDS = [
  "Send it",
  "Stay psyched",
  "Climb on",
  "Yours in chalk",
  "Belay on",
  "Stoked",
  "Crimps & dreams",
  "Keep sending",
];

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

/** Whole days from today until an ISO date (negative = in the past). */
function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const start = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((start.getTime() - today.getTime()) / 86_400_000);
}

export default function Landing() {
  const { tripId, trip, users, currentUserId, ensureUser } = useTripContext();
  const navigate = useNavigate();
  const [signoffIndex, setSignoffIndex] = useState(0);

  const joined = currentUserId != null;

  // "Join trip" runs the identity flow; once the visitor establishes who they
  // are, we drop them onto the board. Dismissing the flow keeps them here.
  const joinTrip = async () => {
    const id = await ensureUser();
    if (id != null) navigate(tripPath(trip.name, tripId, "board"));
  };

  const accom = accomMeta(trip.accommodation_type);
  const joiningNames = users
    .filter((u) => u.joining)
    .map((u) => u.name + (u.is_organizer ? " 👑" : ""));
  const rosterLabel =
    joiningNames.length === 0
      ? "Be the first to join"
      : joiningNames.join(", ");
  const dUntil = daysUntil(trip.start_date);
  const hasDates = Boolean(trip.start_date || trip.end_date);
  const countdownLabel =
    dUntil == null
      ? null
      : dUntil > 0
      ? `${dUntil} ${dUntil === 1 ? "day" : "days"} to go`
      : dUntil === 0
      ? "Happening today"
      : `${Math.abs(dUntil)} ${Math.abs(dUntil) === 1 ? "day" : "days"} ago`;

  return (
    <div className="app-shell">
      <div className="fade-overlay fade-overlay--top" aria-hidden="true" />
      <div className="content">
        <div className="h1">🧗 {trip.name}</div>

        {trip.welcome_message && (
          <div
            className="card"
            style={{
              marginTop: 20,
              lineHeight: 1.6,
              maxWidth: 560,
              whiteSpace: "pre-wrap",
            }}
          >
            <Markdown>{trip.welcome_message}</Markdown>
            {trip.signature && (
              <p style={{ marginTop: 16, marginBottom: 0 }}>
                <em
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    setSignoffIndex((i) => (i + 1) % SIGNOFF_WORDS.length)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSignoffIndex((i) => (i + 1) % SIGNOFF_WORDS.length);
                    }
                  }}
                  style={{ cursor: "pointer", userSelect: "none" }}
                  title="Tap me"
                >
                  {SIGNOFF_WORDS[signoffIndex]}
                </em>
                , {trip.signature}
              </p>
            )}
          </div>
        )}

        {/* At-a-glance details so visitors can decide before committing. */}
        <div className="card" style={{ marginTop: 16, maxWidth: 560 }}>
            <div className="col" style={{ gap: 14 }}>
              <div className="landing-fact">
                <span className="landing-fact__icon" aria-hidden="true">
                  📅
                </span>
                <div className="landing-fact__text">
                  <span className="landing-fact__label">When</span>
                  <span className="landing-fact__detail">
                    {hasDates
                      ? formatDateRange(trip.start_date, trip.end_date)
                      : "Dates TBD"}
                    {countdownLabel && (
                      <span className="muted"> · {countdownLabel}</span>
                    )}
                  </span>
                </div>
              </div>
              {trip.place_label && (
                <div className="landing-fact">
                  <span className="landing-fact__icon" aria-hidden="true">
                    📍
                  </span>
                  <div className="landing-fact__text">
                    <span className="landing-fact__label">Where</span>
                    <span className="landing-fact__detail">
                      {trip.place_label}
                    </span>
                  </div>
                </div>
              )}
              {trip.links?.length > 0 && (
                <div className="landing-fact">
                  <span className="landing-fact__icon" aria-hidden="true">
                    🔗
                  </span>
                  <div className="landing-fact__text">
                    <span className="landing-fact__label">Links</span>
                    <span className="landing-fact__detail landing-fact__links">
                      {trip.links.map((l, i) => (
                        <a
                          key={i}
                          href={l.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {l.name}
                        </a>
                      ))}
                    </span>
                  </div>
                </div>
              )}
              <div className="landing-fact">
                <span className="landing-fact__icon" aria-hidden="true">
                  🧗
                </span>
                <div className="landing-fact__text">
                  <span className="landing-fact__label">Who</span>
                  <span className="landing-fact__detail">{rosterLabel}</span>
                </div>
              </div>
              {trip.accommodation_details && (
                <div className="landing-fact">
                  <span className="landing-fact__icon" aria-hidden="true">
                    {accom?.icon ?? "🏠"}
                  </span>
                  <div className="landing-fact__text">
                    <span className="landing-fact__label">
                      {accom?.label ?? "Accommodation"}
                    </span>
                    <span className="landing-fact__detail">
                      <Linkify>{trip.accommodation_details}</Linkify>
                    </span>
                  </div>
                </div>
              )}
              {trip.notes && (
                <div className="landing-fact">
                  <span className="landing-fact__icon" aria-hidden="true">
                    📝
                  </span>
                  <div className="landing-fact__text">
                    <span className="landing-fact__label">Notes</span>
                    <span
                      className="landing-fact__detail"
                      style={{ whiteSpace: "pre-wrap" }}
                    >
                      <Linkify>{trip.notes}</Linkify>
                    </span>
                  </div>
                </div>
              )}
            </div>
        </div>

        <div className="col" style={{ marginTop: 20 }}>
          {joined ? (
            <Button
              variant="primary"
              fullWidth
              onClick={() => navigate(tripPath(trip.name, tripId, "board"))}
            >
              View trip →
            </Button>
          ) : (
            <Button variant="primary" fullWidth onClick={joinTrip}>
              Join trip
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
