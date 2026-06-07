// One-day "party mode is the default for everyone" surprise.
//
// On PARTY_DAY the app boots into party mode regardless of saved preference,
// but it's only a *default*: the toggle still works, a manual change opts the
// user out for the rest of that day, and no saved preference is overwritten —
// so normal theming resumes automatically the next day. Shared by the
// pre-paint bootstrap in main.tsx and by ThemeToggle so the two never diverge.

// Month is 0-indexed (5 = June).
export const PARTY_DAY = { month: 5, date: 26 };

// Records the year a user manually changed theme on the party day, so a reload
// the same day won't re-force party over their choice. Year-scoped so a future
// PARTY_DAY can surprise again without a stale opt-out blocking it.
export const PARTY_OPT_OUT_KEY = "cragstronauts.theme.partyDayOptOut";

/** True on the party day, unless the user already changed theme that day. */
export function partyDayActive(): boolean {
  if (typeof window === "undefined") return false;
  const now = new Date();
  if (now.getMonth() !== PARTY_DAY.month || now.getDate() !== PARTY_DAY.date)
    return false;
  return localStorage.getItem(PARTY_OPT_OUT_KEY) !== String(now.getFullYear());
}
