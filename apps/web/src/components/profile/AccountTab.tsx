import { useEffect, useState } from "react";
import { SignInButton, useClerk, useUser } from "@clerk/clerk-react";
import { ToggleRow } from "./controls";
import {
  disablePush,
  enablePush,
  pushEnabled,
  pushPermission,
  pushSupported,
} from "../../lib/push";

// The "Account" tab — Clerk lives here now (it used to be the standalone top-right
// control). Signed in: identity + notifications + manage/sign-out. Signed out: a
// friendly sign-in prompt. The heavy account management UI stays Clerk's own modal.
export default function AccountTab() {
  const { user } = useUser();
  const clerk = useClerk();

  if (!user) {
    return (
      <div className="pf-account">
        <div className="pf-account__empty">
          <div className="pf-account__emoji" aria-hidden="true">
            ⛺
          </div>
          <p className="pf-account__lead">Sign in to pitch your tent</p>
          <p className="pf-account__sub">
            An account saves your kit across every trip, on any device.
          </p>
          <SignInButton mode="modal">
            <button type="button" className="pf-signin">
              Sign in
            </button>
          </SignInButton>
        </div>
      </div>
    );
  }

  const email = user.primaryEmailAddress?.emailAddress;
  const name = user.fullName || user.firstName || email || "Climber";

  return (
    <div className="pf-account">
      <div className="pf-account__id">
        {user.imageUrl ? (
          <img className="pf-account__avatar" src={user.imageUrl} alt="" />
        ) : (
          <div className="pf-account__avatar pf-account__avatar--fallback" aria-hidden="true">
            {name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="pf-account__meta">
          <span className="pf-account__name">{name}</span>
          {email && <span className="pf-account__email">{email}</span>}
        </div>
      </div>

      <NotificationsToggle />

      <div className="pf-account__actions">
        <button
          type="button"
          className="pf-account__btn"
          onClick={() => clerk.openUserProfile()}
        >
          Manage account
        </button>
        <button
          type="button"
          className="pf-account__btn pf-account__btn--danger"
          onClick={async () => {
            // Drop this device's subscription before we lose the token, so the
            // old account stops pushing here after a sign-out/sign-in swap.
            try {
              await disablePush();
            } catch {
              // best-effort; sign out regardless
            }
            clerk.signOut({ redirectUrl: "/" });
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

// The permanent notifications control (per device). Reflects live state
// (permission + a live browser subscription) and flips enable/disable. When the
// browser can't subscribe or permission is denied, it's shown disabled with a
// hint. This is also the re-enable path after a device dismissed the one-time
// dashboard prompt.
function NotificationsToggle() {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    pushEnabled().then((on) => {
      if (alive) setEnabled(on);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!pushSupported()) return null;

  const denied = pushPermission() === "denied";
  const hint = denied
    ? "Blocked — allow notifications in your browser settings"
    : "Get pinged when someone joins your car";

  const onChange = async (next: boolean) => {
    if (busy || denied) return;
    setBusy(true);
    try {
      if (next) {
        const ok = await enablePush();
        setEnabled(ok);
      } else {
        await disablePush();
        setEnabled(false);
      }
    } catch {
      setEnabled(await pushEnabled());
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pf-account__notify">
      <ToggleRow
        checked={enabled}
        onChange={onChange}
        label="Notifications"
        hint={hint}
      />
    </div>
  );
}
