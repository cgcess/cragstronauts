/**
 * Belayer badges — frontend-only prototype.
 *
 * Per friend feedback ("lead belayer / leads up to 6a / can clean an anchor /
 * brings coffee to the crag"), this attaches a small set of badges to each
 * climber. Sourced from a deterministic mock keyed by name so the demo shows
 * variety without backend changes. Swap `getBadgesForUser` for a real fetch
 * later — the call sites won't change.
 */

export type BadgeKey = "lead" | "grade" | "anchor" | "coffee";

export interface Badge {
  key: BadgeKey;
  label: string;
  icon: string;
}

const BADGE_DEFS: Record<BadgeKey, Omit<Badge, "key">> = {
  lead:   { label: "Lead belayer",     icon: "🧗" },
  grade:  { label: "Leads up to 6a",   icon: "📈" },
  anchor: { label: "Cleans anchors",   icon: "⚓" },
  coffee: { label: "Brings coffee",    icon: "☕" },
};

const ALL: BadgeKey[] = ["lead", "grade", "anchor", "coffee"];

function hashName(name: string): number {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function getBadgesForUser(user: { id: number; name: string; is_organizer?: boolean }): Badge[] {
  const seed = hashName(user.name.toLowerCase());

  // Organizers always carry the lead-belayer badge — they're running the trip.
  const keys: BadgeKey[] = [];
  if (user.is_organizer) keys.push("lead");

  for (const k of ALL) {
    if (k === "lead" && keys.includes("lead")) continue;
    // Deterministic include/exclude per badge.
    if ((seed >>> ALL.indexOf(k)) & 1) keys.push(k);
  }

  // Make sure everyone has at least one badge so the row never looks empty.
  if (keys.length === 0) keys.push(ALL[seed % ALL.length]);

  return keys.map((k) => ({ key: k, ...BADGE_DEFS[k] }));
}
