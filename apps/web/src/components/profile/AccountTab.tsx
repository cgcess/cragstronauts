import { useEffect, useState } from "react";
import { SignInButton, useClerk, useUser } from "@clerk/clerk-react";
import { RadioGroup, ToggleRow } from "./controls";
import {
  disablePush,
  enablePush,
  getNotificationScope,
  pushEnabled,
  pushPermission,
  pushSupported,
  setNotificationScope,
  type NotificationScope,
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

// The permanent notifications control. The toggle is per device (permission + a
// live browser subscription); the scope below it is account-wide (persisted
// server-side) and only shown once notifications are on. When the browser can't
// subscribe or permission is denied, the toggle is shown with a hint. This is
// also the re-enable path after a device dismissed the one-time dashboard prompt.
function NotificationsToggle() {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scope, setScope] = useState<NotificationScope>("always");

  useEffect(() => {
    let alive = true;
    pushEnabled().then((on) => {
      if (alive) setEnabled(on);
    });
    // Account-wide, so it's loaded regardless of this device's subscription.
    // Best-effort: on failure we keep the "always" default and let the user retry.
    getNotificationScope()
      .then((s) => {
        if (alive) setScope(s);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!pushSupported()) return null;

  const denied = pushPermission() === "denied";
  const hint = denied
    ? "Blocked — allow notifications in your browser settings"
    : "Get pinged about car joins and trip announcements";

  const onToggle = async (next: boolean) => {
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

  const onScope = async (next: NotificationScope) => {
    const prev = scope;
    setScope(next); // optimistic; revert if the write fails
    try {
      await setNotificationScope(next);
    } catch {
      setScope(prev);
    }
  };

  return (
    <div className="pf-account__notify">
      <ToggleRow
        checked={enabled}
        onChange={onToggle}
        label="Notifications"
        hint={hint}
      />
      {enabled && (
        <RadioGroup
          value={scope}
          onChange={onScope}
          options={[
            { value: "trip", label: "Only during a trip" },
            { value: "always", label: "Always" },
          ]}
        />
      )}
    </div>
  );
}
