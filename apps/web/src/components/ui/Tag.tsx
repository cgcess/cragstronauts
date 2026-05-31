import React from "react";
import "./Tag.css";

export type TagVariant =
  | "neutral"
  | "clay"
  | "moss"
  | "slate"
  | "ember"
  | "rust";
export type TagSize = "sm" | "md";

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Semantic colour from the Trailhead nature palette. */
  variant?: TagVariant;
  /** `md` (default) or `sm` for dense inline use. */
  size?: TagSize;
  /** Leading status dot. */
  dot?: boolean;
  /** Monospace — for grades, counts, coords (e.g. 5.11a, V4). */
  mono?: boolean;
}

const cx = (...parts: Array<string | false | undefined>) =>
  parts.filter(Boolean).join(" ");

/** Trailhead tag/label — one component replaces badge/pill/chip/step-tag. */
export default function Tag({
  variant = "neutral",
  size = "md",
  dot = false,
  mono = false,
  className,
  children,
  ...rest
}: TagProps) {
  return (
    <span
      className={cx(
        "th-tag",
        `th-tag--${variant}`,
        size === "sm" && "th-tag--sm",
        mono && "th-tag--mono",
        className
      )}
      {...rest}
    >
      {dot && <span className="th-tag__dot" aria-hidden="true" />}
      {children}
    </span>
  );
}
