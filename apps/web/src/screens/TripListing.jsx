import React from "react";

function today() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isPast(trip, today) {
  const ref = trip.end_date || trip.start_date;
  return ref != null && ref < today;
}

function fmtMonth(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleString(undefined, { month: "short", day: "numeric" });
}

function dateRangeShort(trip) {
  const s = trip.start_date;
  const e = trip.end_date;
  if (!s && !e) return "Dates TBD";
  if (s && e && s !== e) return `${fmtMonth(s)} → ${fmtMonth(e)}`;
  return fmtMonth(s || e);
}

function daysUntil(trip, todayStr) {
  const ref = trip.start_date || trip.end_date;
  if (!ref) return null;
  const a = new Date(todayStr + "T00:00:00").getTime();
  const b = new Date(ref + "T00:00:00").getTime();
  const d = Math.round((b - a) / 86400000);
  return d;
}

// Deterministic but pleasingly imperfect rotation per card.
// Returns degrees in [-4, +4] range, weighted toward smaller deltas.
function rotForIndex(i) {
  // Hand-tuned for the first few cards in the stack
  const seq = [-2.5, 2.0, -1.2, 1.6, -3.0, 1.0];
  return seq[i % seq.length];
}
function offsetForIndex(i) {
  // Each successive card peeks out beneath the previous one
  return i * 10; // px down
}
function scaleForIndex(i) {
  return Math.max(0.94, 1 - i * 0.025);
}

export default function TripListing({ trips, onCreate, onSelect }) {
  const t = today();
  const upcoming = trips
    .filter((trip) => !isPast(trip, t))
    .sort((a, b) => {
      const ad = a.start_date || a.end_date || "9999-12-31";
      const bd = b.start_date || b.end_date || "9999-12-31";
      return ad.localeCompare(bd);
    });
  const past = trips
    .filter((trip) => isPast(trip, t))
    .sort((a, b) => {
      const ad = a.end_date || a.start_date || "";
      const bd = b.end_date || b.start_date || "";
      return bd.localeCompare(ad);
    });

  return (
    <div className="app-shell">
      <div className="content">
        {/* Brand wordmark */}
        <div>
          <div className="brand-mark">
            <span className="mark-glyph" aria-hidden="true">🧗</span>
            Cragstronauts
          </div>
          <div className="brand-sub">Plan the climb. Pack the car.</div>
        </div>

        {/* Stacked card deck of upcoming trips */}
        {upcoming.length === 0 ? (
          <button
            type="button"
            className="deck-empty"
            onClick={onCreate}
            aria-label="Create your first trip"
          >
            <div className="deck-empty__plus" aria-hidden="true">+</div>
            <div className="deck-empty__title">No trips on the wall</div>
            <div className="deck-empty__sub">
              Tap to plan your first cragstronaut mission.
            </div>
          </button>
        ) : (
          <div
            className="deck-stack"
            style={{
              // Reserve enough height for the deepest card in the stack
              minHeight: 280 + offsetForIndex(Math.min(upcoming.length - 1, 5)),
            }}
          >
            {/* Render bottom-to-top so the soonest trip sits visually on top */}
            {[...upcoming]
              .slice(0, 6) // cap stack height — past 6 doesn't read
              .reverse()
              .map((trip, revIdx, arr) => {
                const i = arr.length - 1 - revIdx; // original sorted index
                const rot = rotForIndex(i);
                const top = i === 0;
                const days = daysUntil(trip, t);
                const chipLabel =
                  days == null
                    ? "Soon"
                    : days <= 0
                    ? "On now"
                    : days === 1
                    ? "Tomorrow"
                    : days < 14
                    ? `In ${days} days`
                    : `In ${Math.round(days / 7)} wk`;
                return (
                  <button
                    key={trip.id}
                    type="button"
                    className="deck-card"
                    onClick={() => onSelect(trip.id)}
                    style={{
                      transform: `translateY(${offsetForIndex(i)}px) rotate(${rot}deg) scale(${scaleForIndex(i)})`,
                      transformOrigin: "50% 0%",
                      zIndex: 20 - i,
                      "--card-rot": `${rot}deg`,
                    }}
                  >
                    <div className="deck-card__topline">
                      <span className="deck-card__date">
                        {dateRangeShort(trip)}
                      </span>
                      {top && (
                        <span className="deck-card__chip deck-card__chip--soon">
                          {chipLabel}
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="deck-card__title">{trip.location}</div>
                      {trip.accommodation_type && (
                        <div className="deck-card__meta">
                          {trip.accommodation_type}
                          {trip.accommodation_details
                            ? ` · ${trip.accommodation_details}`
                            : ""}
                        </div>
                      )}
                    </div>
                    <div className="deck-card__footer">
                      <span className="deck-card__cta">Open trip →</span>
                    </div>
                  </button>
                );
              })}
          </div>
        )}

        {/* Past trips — quieter list below the stack */}
        {past.length > 0 && (
          <div className="past-trips-list">
            <div className="h2">Past climbs</div>
            {past.map((trip) => (
              <button
                key={trip.id}
                className="secondary"
                onClick={() => onSelect(trip.id)}
                style={{
                  textAlign: "left",
                  display: "block",
                  width: "100%",
                  marginBottom: 8,
                }}
              >
                <div style={{ fontWeight: 600 }}>{trip.location}</div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {dateRangeShort(trip)}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Floating thumb-zone CTA (only when there's already a stack — empty
          state has its own giant tap target). */}
      {upcoming.length > 0 && (
        <div className="bottom-cta bottom-cta--center">
          <button className="btn-3d" onClick={onCreate}>
            Plan new trip →
          </button>
        </div>
      )}
    </div>
  );
}
