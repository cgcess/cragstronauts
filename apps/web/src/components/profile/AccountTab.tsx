import { SignInButton, useClerk, useUser } from "@clerk/clerk-react";

// The "Account" tab — Clerk lives here now (it used to be the standalone top-right
// control). Signed in: identity + manage/sign-out. Signed out: a friendly sign-in
// prompt. The heavy account management UI stays Clerk's own modal.
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
          onClick={() => clerk.signOut({ redirectUrl: "/" })}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
