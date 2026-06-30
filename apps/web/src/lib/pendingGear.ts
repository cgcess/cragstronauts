import type {
  Category,
  GearContribution,
  GearDecline,
} from "../context/TripContext";

/**
 * Gear categories the given user still has to answer. A category counts as
 * answered once the user has either brought one (a `gear_contribution`) or
 * explicitly declined it (a `gear_decline`); bringing one supersedes a decline.
 * Mirrors `unansweredPolls` — it drives both the dashboard nudge and the Gear
 * tile's "action needed" flag. Order follows the incoming `categories` array.
 */
export function pendingGearCategories(args: {
  categories: Category[];
  gear: GearContribution[];
  declines: GearDecline[];
  userId: number;
}): Category[] {
  const { categories, gear, declines, userId } = args;
  const bringing = new Set(
    gear.filter((g) => g.user_id === userId).map((g) => g.category_id)
  );
  const declined = new Set(
    declines.filter((d) => d.user_id === userId).map((d) => d.category_id)
  );
  return categories.filter(
    (c) => !bringing.has(c.id) && !declined.has(c.id)
  );
}
