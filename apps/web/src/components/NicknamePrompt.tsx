import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "./ui";
import { useProfile } from "../lib/profile";

const SKIP_KEY = "cragstronauts.nicknamePromptSkipped";

// After signing in, a member who hasn't set a username gets one soft, skippable
// nudge to pick a nickname (prefilled with their account name). Saving sets the
// profile username so every join/create flow just shows it; "Skip for now"
// dismisses for the session and leaves the account name as the fallback. Not a
// gate — it sits over whatever's on screen and can always be skipped. Mounted
// only when Clerk is enabled (so it sits inside ClerkProvider).
export default function NicknamePrompt() {
  const { ready, signedIn, profile, accountName, save, saving } = useProfile();
  const [name, setName] = useState("");
  const [skipped, setSkipped] = useState(
    () => sessionStorage.getItem(SKIP_KEY) === "1"
  );
  const [error, setError] = useState<string | null>(null);

  const needsNickname =
    ready && signedIn && !profile.username?.trim() && !skipped;

  // Seed the field with the account name once we know it (leave typing alone).
  useEffect(() => {
    if (needsNickname) setName((cur) => cur || accountName?.trim() || "");
  }, [needsNickname, accountName]);

  const skip = () => {
    sessionStorage.setItem(SKIP_KEY, "1");
    setSkipped(true);
  };

  const submit = async () => {
    const n = name.trim();
    if (!n || saving) return;
    setError(null);
    try {
      await save({ ...profile, username: n });
      // Success flips profile.username, which closes the prompt on its own.
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Try again.");
    }
  };

  return createPortal(
    <AnimatePresence>
      {needsNickname && (
        <motion.div
          className="identity-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div className="app-shell">
            <div className="content identity-identify">
              <div className="identity-identify__inner">
                <div className="identity-identify__head">
                  <h1 className="identity-identify__title">
                    Pick a nickname 🧗
                  </h1>
                  <p className="identity-identify__note">
                    This is how you&apos;ll show up on trips. You can change it
                    anytime in your profile.
                  </p>
                  <input
                    className="identity-identify__input"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                    autoFocus
                  />
                  {error && <div className="error-banner">{error}</div>}
                  <Button
                    variant="primary"
                    fullWidth
                    disabled={!name.trim() || saving}
                    onClick={submit}
                  >
                    {saving ? "Saving…" : "Save"}
                  </Button>
                  <Button
                    variant="text"
                    fullWidth
                    disabled={saving}
                    onClick={skip}
                  >
                    Skip for now
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
