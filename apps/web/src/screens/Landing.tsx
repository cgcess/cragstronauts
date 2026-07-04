import React, { Fragment, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useTripContext } from "../context/TripContext";
import { tripPath } from "../lib/tripUrl";
import { formatDateRange } from "../dateUtils";
import { Button, Tag } from "../components/ui";
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
  const { tripId, trip, users, currentUserId, ensureUser, joinPrivateTrip } =
    useTripContext();
  const navigate = useNavigate();
  const [signoffIndex, setSignoffIndex] = useState(0);

  const joined = currentUserId != null;

  // The CTA is a fixed overlay, so it never reserves scroll space on its own —
  // a page that fits the screen doesn't scroll. We only reserve bottom
  // clearance (so the last card can clear the button) when the cards actually
  // overflow the viewport. Without that guard, near-screen-height pages would
  // scroll a few pointless pixels just to reveal the reserved strip.
  const scrollRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  useEffect(() => {
    const scroll = scrollRef.current;
    const cards = cardsRef.current;
    if (!scroll || !cards) return;
    const measure = () =>
      setOverflowing(cards.offsetHeight > scroll.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(scroll);
    ro.observe(cards);
    return () => ro.disconnect();
  }, [trip, users]);

  // Public trips run the cooperative identity flow; private trips bind the
  // signed-in account as a member. Either way, land on the board once in.
  const joinTrip = async () => {
    if (trip.public) {
      const id = await ensureUser();
      if (id != null) navigate(tripPath(trip.name, tripId, "board"));
      return;
    }
    await joinPrivateTrip();
    navigate(tripPath(trip.name, tripId, "board"));
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
      <div className="content" ref={scrollRef}>
        <div className="column landing-column" ref={cardsRef}>
        <div className="landing-hero">
          <div className="h1"><img src="/logo-circle.png" alt="" className="fl-logo-icon" style={{ verticalAlign: "middle", marginRight: 8 }} />{trip.name}</div>
          <div className="landing-hero__glance">
            {countdownLabel && (
              <Tag variant="ember" dot>
                {countdownLabel}
              </Tag>
            )}
            <span className="landing-hero__roster muted">{rosterLabel}</span>
          </div>
        </div>

        <div className="landing-body">

        {trip.welcome_message && (
          <div
            className="card"
            style={{
              lineHeight: 1.6,
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
        <div className="card">
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
                        <Fragment key={i}>
                          {i > 0 && (
                            <span
                              className="landing-fact__links-sep"
                              aria-hidden="true"
                            >
                              ·
                            </span>
                          )}
                          <a
                            href={l.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {l.name}
                          </a>
                        </Fragment>
                      ))}
                    </span>
                  </div>
                </div>
              )}
              <div className="landing-fact">
                <span className="landing-fact__icon" aria-hidden="true">
                  <img src="/logo-circle.png" alt="" className="fl-logo-icon" style={{ width: 20, height: 20 }} />
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
        </div>
        </div>
        {/* Clearance so the last card can scroll clear of the fixed CTA —
            only present when the page actually overflows. */}
        {overflowing && (
          <div className="landing-cta-clearance" aria-hidden="true" />
        )}
      </div>

      <div className="bottom-cta landing-cta-bar">
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

      <div className="landing-cta-scrim" aria-hidden="true">
        <div className="landing-cta-scrim__blur landing-cta-scrim__blur--1" />
        <div className="landing-cta-scrim__blur landing-cta-scrim__blur--2" />
        <div className="landing-cta-scrim__blur landing-cta-scrim__blur--3" />
        <div className="landing-cta-scrim__blur landing-cta-scrim__blur--4" />
        <div className="landing-cta-scrim__tint" />
      </div>
    </div>
  );
}
