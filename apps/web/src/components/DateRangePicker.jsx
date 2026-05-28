import React, { useEffect, useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import "./DateRangePicker.css";

const EASE_OUT = [0.23, 1, 0.32, 1];

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatRange(range) {
  if (!range?.from) return null;
  const opts = { month: "short", day: "numeric" };
  const from = range.from.toLocaleDateString(undefined, opts);
  if (!range.to || sameDay(range.from, range.to)) return from;
  // Tight form when same month: "May 8 – 12"
  if (
    range.from.getMonth() === range.to.getMonth() &&
    range.from.getFullYear() === range.to.getFullYear()
  ) {
    return `${from} – ${range.to.getDate()}`;
  }
  return `${from} – ${range.to.toLocaleDateString(undefined, opts)}`;
}

export default function DateRangePicker({
  value,
  onChange,
  minDate,
  placeholder = "Add dates",
  heading = "When are you climbing?",
}) {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const display = formatRange(value);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const handleSelect = (range) => {
    onChange(range);
    if (range?.from && range?.to && !sameDay(range.from, range.to)) {
      // Auto-confirm once a full range is selected
      setOpen(false);
    }
  };

  const defaultMonth = useMemo(
    () => value?.from || minDate || new Date(),
    [value?.from, minDate],
  );

  return (
    <>
      <button
        type="button"
        className={`date-range-input ${display ? "is-filled" : ""}`}
        onClick={() => setOpen(true)}
      >
        {display ? (
          <span className="date-range-input__value">{display}</span>
        ) : (
          <span className="date-range-input__placeholder">{placeholder}</span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="date-range-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label={heading}
          >
            <motion.div
              className="date-range-sheet"
              onClick={(e) => e.stopPropagation()}
              initial={reduceMotion ? { opacity: 0 } : { y: 24, opacity: 0 }}
              animate={reduceMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { y: 24, opacity: 0 }}
              transition={{ duration: 0.24, ease: EASE_OUT }}
            >
              <div className="date-range-sheet__head">
                <span>{heading}</span>
                <button
                  type="button"
                  className="date-range-close"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              <DayPicker
                mode="range"
                selected={value}
                onSelect={handleSelect}
                disabled={minDate ? { before: minDate } : undefined}
                defaultMonth={defaultMonth}
                showOutsideDays
                weekStartsOn={1}
              />
              <div className="date-range-sheet__foot">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => onChange(undefined)}
                  disabled={!value?.from}
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
