import React from "react";
import "./Avatar.css";

// Palette for the initials fallback. A name hashes to a stable slot so the same
// person keeps the same tint across the feed.
const TINTS = [
  "#e8590c",
  "#d6336c",
  "#7048e8",
  "#1c7ed6",
  "#0ca678",
  "#f08c00",
  "#c2255c",
  "#5f3dc4",
];

function hashTint(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return TINTS[Math.abs(h) % TINTS.length];
}

/** First letter of the first two words, uppercased (e.g. "Nicolas Donati" → "ND"). */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const second = parts.length > 1 ? parts[1][0] ?? "" : "";
  return (first + second).toUpperCase();
}

/**
 * A member avatar: the Clerk profile photo when we have a URL, otherwise the
 * member's initials on a name-derived tint. Used across the announcements feed.
 */
export default function Avatar({
  name,
  src,
  size = 40,
}: {
  name: string;
  src?: string | null;
  size?: number;
}) {
  const style: React.CSSProperties = { width: size, height: size };
  if (src) {
    return (
      <img className="avatar" src={src} alt="" style={style} />
    );
  }
  return (
    <span
      className="avatar avatar--fallback"
      style={{
        ...style,
        background: hashTint(name),
        fontSize: Math.round(size * 0.4),
      }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
