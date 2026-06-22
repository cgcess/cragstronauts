import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { SignInButton, useUser } from "@clerk/clerk-react";
import { useProfile, type CragProfile } from "../../lib/profile";
import { useConfirm } from "../ui";
import GeneralTab from "./GeneralTab";
import AccountTab from "./AccountTab";
import { XIcon } from "./controls";
import "./ProfileDialog.css";

type Tab = "general" | "account";

interface Props {
  open: boolean;
  onClose: () => void;
}

const serialize = (p: CragProfile) => JSON.stringify(p);

export default function ProfileDialog({ open, onClose }: Props) {
  const { user } = useUser();
  const { profile, save, saving, signedIn } = useProfile();
  const confirm = useConfirm();

  const [tab, setTab] = useState<Tab>("general");
  const [draft, setDraft] = useState<CragProfile>(profile);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Seed a fresh draft each time the dialog opens, and land on the tab that
  // makes sense (General when signed in, Account — i.e. sign in — when not).
  useEffect(() => {
    if (!open) return;
    setDraft(profile);
    setTab(signedIn ? "general" : "account");
    setError(null);
    setJustSaved(false);
    // Intentionally keyed on `open` only: re-seeding on every `profile` change
    // while open would clobber in-progress edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // If the user signs in while the dialog is open (e.g. from the General gate),
  // pull their saved profile in and reveal the form. Safe to reseed here because
  // the gate exposes no editable fields to clobber.
  const wasSignedIn = useRef(signedIn);
  useEffect(() => {
    if (open && signedIn && !wasSignedIn.current) {
      setDraft(profile);
      setTab("general");
    }
    wasSignedIn.current = signedIn;
  }, [open, signedIn, profile]);

  // Escape to close + lock body scroll while open (mirrors BottomSheet).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") attemptClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draft]);

  useEffect(() => {
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  const dirty = serialize(draft) !== serialize(profile);

  const attemptClose = async () => {
    if (dirty) {
      const ok = await confirm({
        title: "Discard changes?",
        message: "Your profile edits haven't been saved yet.",
        confirmLabel: "Discard",
        cancelLabel: "Keep editing",
        tone: "danger",
      });
      if (!ok) return;
    }
    onClose();
  };

  const onSave = async () => {
    setError(null);
    try {
      await save(draft);
      setJustSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setJustSaved(false), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Try again.");
    }
  };

  const showSave = tab === "general" && signedIn;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="pf-scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={attemptClose}
        >
          <motion.div
            className="pf-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Profile"
            initial={{ opacity: 0, y: 16, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.985 }}
            transition={{ type: "spring", damping: 32, stiffness: 360 }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="pf-head">
              <h2 className="pf-head__title">Profile</h2>
              <button
                type="button"
                className="pf-head__close"
                onClick={attemptClose}
                aria-label="Close"
              >
                <XIcon size={14} />
              </button>
            </header>

            <div className="pf-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={tab === "general"}
                className={`pf-tab${tab === "general" ? " is-active" : ""}`}
                onClick={() => setTab("general")}
              >
                General
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "account"}
                className={`pf-tab${tab === "account" ? " is-active" : ""}`}
                onClick={() => setTab("account")}
              >
                Account
              </button>
            </div>

            <div className="pf-body">
              {tab === "general" ? (
                signedIn ? (
                  <GeneralTab
                    value={draft}
                    onChange={setDraft}
                    placeholderName={user?.firstName ?? user?.fullName ?? undefined}
                  />
                ) : (
                  <GeneralGate />
                )
              ) : (
                <AccountTab />
              )}
            </div>

            {showSave && (
              <footer className="pf-foot">
                {error && <span className="pf-foot__error">{error}</span>}
                {!error && justSaved && (
                  <span className="pf-foot__saved">Saved ✓</span>
                )}
                <button
                  type="button"
                  className="pf-save"
                  disabled={!dirty || saving}
                  onClick={onSave}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </footer>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

function GeneralGate() {
  return (
    <div className="pf-gate">
      <div className="pf-gate__emoji" aria-hidden="true">
        🧗
      </div>
      <p className="pf-gate__lead">Build your climbing kit</p>
      <p className="pf-gate__sub">
        Sign in to save your gear, car, and preferences, then bring them to any
        trip in one tap.
      </p>
      <SignInButton mode="modal">
        <button type="button" className="pf-signin">
          Sign in
        </button>
      </SignInButton>
    </div>
  );
}
