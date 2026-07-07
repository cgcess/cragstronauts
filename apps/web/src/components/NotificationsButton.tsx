import { useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { enablePush, pushPermission, pushSupported } from "../lib/push";

// Device-local flag: once this device enables or dismisses the soft-ask, we
// don't nag again (browser permission is origin-wide, so re-asking adds
// nothing). The permanent control lives in Profile → Account.
const DISMISS_KEY = "crag.push.dismissed";

function dismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // ignore storage failures
  }
}

/**
 * Web Push opt-in: a one-time soft-ask card. Shown only when the visitor is
 * signed in (push is account-scoped), the browser can subscribe, permission
 * isn't already granted, and this device hasn't dismissed it. Permission must
 * be asked from a real click (iOS especially). Enabling or dismissing hides it
 * for good on this device; re-enable from Profile → Account.
 */
export default function NotificationsButton() {
  const { isSignedIn } = useUser();
  const [state, setState] = useState<"idle" | "working" | "done" | "denied">(
    () => (pushPermission() === "granted" ? "done" : "idle"),
  );
  const [hidden, setHidden] = useState(() => dismissed());

  if (!isSignedIn || !pushSupported() || hidden || state === "done") return null;

  const onEnable = async () => {
    setState("working");
    try {
      const ok = await enablePush();
      if (ok) {
        markDismissed();
        setState("done");
      } else {
        setState("denied");
      }
    } catch {
      setState("denied");
    }
  };

  const onDismiss = () => {
    markDismissed();
    setHidden(true);
  };

  return (
    <div className="dash-nudge" style={{ width: "100%" }}>
      <button
        type="button"
        onClick={onEnable}
        disabled={state === "working"}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "inherit",
          flex: 1,
          background: "none",
          border: "none",
          padding: 0,
          font: "inherit",
          color: "inherit",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span className="dash-nudge__icon" aria-hidden="true">
          🔔
        </span>
        <span className="dash-nudge__text">
          <span className="dash-nudge__title">
            {state === "working"
              ? "Turning on…"
              : state === "denied"
                ? "Notifications blocked"
                : "Enable notifications"}
          </span>
          <span className="dash-nudge__sub">
            {state === "denied"
              ? "Allow them in your browser settings"
              : "Get pinged about car joins and trip announcements"}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        style={{
          background: "none",
          border: "none",
          padding: "0 4px",
          font: "inherit",
          color: "inherit",
          opacity: 0.6,
          cursor: "pointer",
        }}
      >
        ✕
      </button>
    </div>
  );
}
