/**
 * Shared date formatting utilities.
 *
 * All helpers accept ISO date strings ("2026-05-28") and guard against
 * null / undefined / empty-string inputs so callers don't need to.
 */

/** Parse an ISO date string into a local-midnight Date. */
function parse(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr + "T00:00:00");
}

const SHORT_MONTH = { month: "short", day: "numeric" };
const SHORT_MONTH_YEAR = { month: "short", day: "numeric", year: "numeric" };

/**
 * Format a single date.
 *   "May 28, 2026"
 */
export function formatDate(dateStr) {
  const d = parse(dateStr);
  if (!d) return "";
  return d.toLocaleDateString(undefined, SHORT_MONTH_YEAR);
}

/**
 * Format a date range in the most compact human-friendly form:
 *
 *   Same day          → "May 28, 2026"
 *   Same month+year   → "May 28 – 30, 2026"
 *   Same year         → "May 28 – Jun 2, 2026"
 *   Different years   → "Dec 30, 2026 – Jan 2, 2027"
 *   Only start        → "May 28, 2026"
 *   Only end          → "May 28, 2026"
 *   Neither           → "Dates TBD"
 */
export function formatDateRange(startStr, endStr) {
  const s = parse(startStr);
  const e = parse(endStr);

  if (!s && !e) return "Dates TBD";
  if (!s || !e) return formatDate(startStr || endStr);
  if (startStr === endStr) return formatDate(startStr);

  const sameYear = s.getFullYear() === e.getFullYear();
  const sameMonth = sameYear && s.getMonth() === e.getMonth();

  if (sameMonth) {
    // "May 28 – 30, 2026"
    const monthDay = s.toLocaleDateString(undefined, SHORT_MONTH);
    const endDay = e.getDate();
    const year = e.getFullYear();
    return `${monthDay} – ${endDay}, ${year}`;
  }

  if (sameYear) {
    // "May 28 – Jun 2, 2026"
    const start = s.toLocaleDateString(undefined, SHORT_MONTH);
    const end = e.toLocaleDateString(undefined, SHORT_MONTH);
    const year = e.getFullYear();
    return `${start} – ${end}, ${year}`;
  }

  // "Dec 30, 2026 – Jan 2, 2027"
  return `${formatDate(startStr)} – ${formatDate(endStr)}`;
}
