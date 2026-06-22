import { useState } from "react";
import { useUser } from "@clerk/clerk-react";
import ProfileDialog from "./ProfileDialog";

// Top-right entry point (replaces the old standalone Clerk control). Shows the
// signed-in avatar, or a neutral person glyph when signed out. Either way it
// opens the Profile dialog — Clerk's own controls now live on its Account tab.
// Rendered only when Clerk is enabled (so it sits inside ClerkProvider).
export default function ProfileButton() {
  const { user } = useUser();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="pf-trigger"
        onClick={() => setOpen(true)}
        aria-label="Profile"
      >
        {user?.imageUrl ? (
          <img className="pf-trigger__avatar" src={user.imageUrl} alt="" />
        ) : (
          <span className="pf-trigger__glyph" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
              <circle cx="12" cy="8" r="3.4" fill="currentColor" />
              <path
                d="M5 19.2c0-3.3 3.1-5.2 7-5.2s7 1.9 7 5.2"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </span>
        )}
      </button>
      <ProfileDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
