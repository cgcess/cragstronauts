// Small form primitives used only inside the Profile dialog. Kept local (rather
// than promoted to components/ui) until something else needs them.

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
}

/** Labelled on/off switch. The whole row is the hit target. */
export function ToggleRow({ checked, onChange, label, hint }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`pf-toggle-row${checked ? " is-on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="pf-toggle-row__text">
        <span className="pf-toggle-row__label">{label}</span>
        {hint && <span className="pf-toggle-row__hint">{hint}</span>}
      </span>
      <span className="pf-switch" aria-hidden="true">
        <span className="pf-switch__thumb" />
      </span>
    </button>
  );
}

interface SegmentedProps<T extends string> {
  value: T | undefined;
  onChange: (next: T) => void;
  options: { value: T; label: string }[];
}

/** Single-select pill group (radio semantics). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: SegmentedProps<T>) {
  return (
    <div className="pf-seg" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={`pf-seg__opt${value === o.value ? " is-active" : ""}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Crisp, perfectly centered ✕ (the text glyph sits off-center in most fonts). */
export function XIcon({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden="true">
      <path
        d="M6 6 18 18M18 6 6 18"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
