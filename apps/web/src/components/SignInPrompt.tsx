import React from "react";
import { SignInButton } from "@clerk/clerk-react";

// Full-screen sign-in prompt for screens that require a signed-in account.
export default function SignInPrompt({
  lead = "Sign in to pitch your tent",
  sub = "Cragstronauts trips are private — sign in to see yours and plan new ones.",
}: {
  lead?: string;
  sub?: string;
}) {
  return (
    <div className="app-shell">
      <div className="fade-overlay fade-overlay--top" aria-hidden="true" />
      <div className="content">
        <div className="column">
          {/* Brand lives in the global top bar (App.tsx) on this screen. */}
          <div className="pf-account" style={{ marginTop: 24 }}>
            <div className="pf-account__empty">
              <div className="pf-account__emoji" aria-hidden="true">⛺</div>
              <p className="pf-account__lead">{lead}</p>
              <p className="pf-account__sub">{sub}</p>
              <SignInButton mode="modal">
                <button type="button" className="pf-signin">
                  Sign in
                </button>
              </SignInButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
