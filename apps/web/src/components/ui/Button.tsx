import React from "react";
import "./Button.css";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "tertiary"
  | "text"
  | "danger";
export type ButtonSize = "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual hierarchy. Use exactly one `primary` per screen. */
  variant?: ButtonVariant;
  /** `md` = 52px (default, dirty-hands friendly), `lg` = 60px hero. */
  size?: ButtonSize;
  /** Square icon-only button. Pass an aria-label for accessibility. */
  iconOnly?: boolean;
  /** Fully rounded (nav / chip style). */
  pill?: boolean;
  /** Stretch to fill its container. */
  fullWidth?: boolean;
  /** Icon rendered before the label. */
  leadingIcon?: React.ReactNode;
  /** Icon rendered after the label. */
  trailingIcon?: React.ReactNode;
}

const cx = (...parts: Array<string | false | undefined>) =>
  parts.filter(Boolean).join(" ");

/**
 * Trailhead button — the one button in the app.
 * Tiers: primary · secondary · tertiary · danger (+ iconOnly variants).
 */
export default function Button({
  variant = "secondary",
  size = "md",
  iconOnly = false,
  pill = false,
  fullWidth = false,
  leadingIcon,
  trailingIcon,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        "th-btn",
        `th-btn--${variant}`,
        size === "lg" && "th-btn--lg",
        iconOnly && "th-btn--icon",
        pill && "th-btn--pill",
        fullWidth && "th-btn--full",
        className
      )}
      {...rest}
    >
      {leadingIcon && <span className="th-btn__ic">{leadingIcon}</span>}
      {!iconOnly && children}
      {iconOnly && children}
      {trailingIcon && <span className="th-btn__ic">{trailingIcon}</span>}
    </button>
  );
}
