import React from "react";
import { getBadgesForUser } from "../lib/badges";
import type { BadgeKey } from "../lib/badges";
import { Tag } from "./ui";
import type { TagVariant } from "./ui";

interface BadgeRowProps {
  user: { id: number; name: string; is_organizer?: boolean };
}

// Map each belayer badge to a Trailhead tag colour so the row reads as a set
// of nature-toned chips: lead stands out (ember), the rest spread across the
// earthy palette.
const BADGE_VARIANT: Record<BadgeKey, TagVariant> = {
  lead: "ember",
  grade: "moss",
  anchor: "slate",
  coffee: "clay",
};

export default function BadgeRow({ user }: BadgeRowProps) {
  const badges = getBadgesForUser(user);
  return (
    <div className="fl-badges">
      {badges.map((b) => (
        <Tag key={b.key} variant={BADGE_VARIANT[b.key]} size="sm" title={b.label}>
          <span aria-hidden="true">{b.icon}</span>
          {b.label}
        </Tag>
      ))}
    </div>
  );
}
