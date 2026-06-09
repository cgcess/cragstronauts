import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import Button from "./Button";
import "./ConfirmDialog.css";

export type ConfirmTone = "default" | "danger";

export interface ConfirmOptions {
  /** Bold heading — the decision being made. */
  title: string;
  /** Optional supporting line(s) under the title. */
  message?: React.ReactNode;
  /** Affirmative button label. Defaults to "Confirm". */
  confirmLabel?: string;
  /** Dismiss button label. Defaults to "Cancel". */
  cancelLabel?: string;
  /** `danger` paints the confirm button red. Defaults to "default". */
  tone?: ConfirmTone;
}

interface ConfirmDialogProps extends ConfirmOptions {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus the safe (cancel) action so Enter doesn't fire the destructive one.
    actionsRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onCancel]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="confirm-scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onCancel}
        >
          <motion.div
            className="confirm-card"
            role="alertdialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", damping: 30, stiffness: 360 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="confirm-card__title">{title}</h2>
            {message != null && (
              <p className="confirm-card__message">{message}</p>
            )}
            <div className="confirm-card__actions" ref={actionsRef}>
              <Button
                variant="tertiary"
                onClick={onCancel}
              >
                {cancelLabel}
              </Button>
              <Button
                variant={tone === "danger" ? "danger" : "primary"}
                onClick={onConfirm}
              >
                {confirmLabel}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
