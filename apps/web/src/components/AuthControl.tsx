import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";
import "./AuthControl.css";

// Global, optional sign-in control. Signed out shows a "Sign in" pill (Clerk's
// modal, which offers Continue with Google); signed in shows the Clerk user
// button (avatar + manage account + sign out). Rendered only when Clerk is
// enabled.
export default function AuthControl() {
  return (
    <div className="auth-control">
      <SignedOut>
        <SignInButton mode="modal">
          <button type="button" className="auth-signin">
            Sign in
          </button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <UserButton afterSignOutUrl="/" />
      </SignedIn>
    </div>
  );
}
