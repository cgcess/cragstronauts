import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import ConfirmDialog, { type ConfirmOptions } from "./ConfirmDialog";

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface DialogState extends ConfirmOptions {
  open: boolean;
}

/**
 * Hosts a single confirm dialog and exposes an imperative, promise-returning
 * `confirm(options)` via {@link useConfirm}. Mirrors the async shape of the
 * app's `ensureUser()` — open UI now, resolve once the user decides — so the
 * native `window.confirm()` call sites convert to `await confirm({ ... })`.
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DialogState>({ open: false, title: "" });
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const settle = useCallback((value: boolean) => {
    setState((s) => ({ ...s, open: false }));
    resolveRef.current?.(value);
    resolveRef.current = null;
  }, []);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setState({ ...options, open: true });
    });
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={state.open}
        title={state.title}
        message={state.message}
        confirmLabel={state.confirmLabel}
        cancelLabel={state.cancelLabel}
        tone={state.tone}
        onConfirm={() => settle(true)}
        onCancel={() => settle(false)}
      />
    </ConfirmContext.Provider>
  );
}

/** Returns `confirm(options) => Promise<boolean>`. Must be used within {@link ConfirmProvider}. */
export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return confirm;
}
