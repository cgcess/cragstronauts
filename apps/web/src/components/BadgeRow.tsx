import React from "react";
import { getBadgesForUser } from "../lib/badges";

interface BadgeRowProps {
  user: { id: number; name: string; is_organizer?: boolean };
}

export default function BadgeRow({ user }: BadgeRowProps) {
  const badges = getBadgesForUser(user);
  return (
    <div className="fl-badges">
      {badges.map((b) => (
        <span key={b.key} className={`fl-badge fl-badge--${b.key}`} title={b.label}>
          <span aria-hidden="true">{b.icon}</span>
          {b.label}
        </span>
      ))}
    </div>
  );
}
