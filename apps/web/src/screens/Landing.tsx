import React, { useState } from "react";
import { useNavigate } from "react-router";
import { useTripContext } from "../context/TripContext";
import { formatDateRange } from "../dateUtils";
import { Button } from "../components/ui";
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

export default function Landing() {
  const { tripId, trip } = useTripContext();
  const navigate = useNavigate();
  const [signoffIndex, setSignoffIndex] = useState(0);

  return (
    <div className="app-shell">
      <div className="fade-overlay fade-overlay--top" aria-hidden="true" />
      <div className="content">
        <Button
          variant="secondary"
          pill
          onClick={() => navigate("/", { replace: true })}
          style={{ marginBottom: 8, position: "relative", zIndex: 6 }}
        >
          ← Trips
        </Button>
        <div className="h1">🧗 {trip.location}</div>
        {(trip.start_date || trip.end_date) && (
          <p className="muted">
            {formatDateRange(trip.start_date, trip.end_date)}
          </p>
        )}

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
            <Linkify>{trip.welcome_message}</Linkify>
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

        <div className="col" style={{ marginTop: 20 }}>
          <Button
            variant="primary"
            fullWidth
            onClick={() => navigate(`/trips/${tripId}/board`)}
          >
            View trip →
          </Button>
        </div>
      </div>
    </div>
  );
}
