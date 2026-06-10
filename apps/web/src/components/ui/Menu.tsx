import React, { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import "./Menu.css";

export type MenuTone = "default" | "danger";

export interface MenuItem {
  label: string;
  tone?: MenuTone;
  /** Optional leading glyph, rendered muted before the label. */
  icon?: React.ReactNode;
  onSelect: () => void;
}

interface MenuProps {
  open: boolean;
  onClose: () => void;
  items: MenuItem[];
  /** Optional alignment of the panel relative to the trigger wrapper. */
  align?: "left" | "right";
}

/**
 * A tiny dropdown menu anchored under its trigger. The caller renders the
 * trigger and wraps both in a `position: relative` container. Closes on
 * outside-click and Escape; selecting an item closes the menu, then runs its
 * handler.
 */
export default function Menu({ open, onClose, items, align = "right" }: MenuProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    // Defer so the click that opened the menu doesn't immediately close it.
    const id = window.setTimeout(() => {
      window.addEventListener("mousedown", onDown);
    }, 0);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          className={"ui-menu ui-menu--" + align}
          role="menu"
          initial={{ opacity: 0, y: -4, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.97 }}
          transition={{ duration: 0.14 }}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={
                "ui-menu__item" +
                (item.tone === "danger" ? " ui-menu__item--danger" : "")
              }
              onClick={() => {
                onClose();
                item.onSelect();
              }}
            >
              {item.icon && (
                <span className="ui-menu__icon" aria-hidden="true">
                  {item.icon}
                </span>
              )}
              {item.label}
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
