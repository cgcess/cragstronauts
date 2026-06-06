import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router";

import App from "./App";
import TripListing from "./screens/TripListing";
import OrganizerWizard from "./screens/OrganizerWizard";
import TripLayout from "./screens/TripLayout";
import Landing from "./screens/Landing";
import TripDashboard from "./screens/TripDashboard";
import NotFound from "./screens/NotFound";

import "./styles.css";
import "./styles/v2-theme.css";
import "./styles/minimalist.css";
// Trailhead design tokens — imported LAST so its semantic + legacy-bridge
// variables win the cascade and re-skin the whole app to the new palette.
import "./styles/tokens.css";
// Party mode override — scopes everything under html.theme-party so the
// normal theme is untouched until the user flips the toggle.
import "./styles/party-theme.css";

// SVG-backdrop-filter capability probe.
//
// Safari (macOS + iOS) reports `@supports (backdrop-filter: url(#x))`
// as TRUE but then silently no-ops the SVG filter at paint time —
// the rule applies, overrides the frosted-glass base rule, and renders
// as nothing. Net effect: no glass on iPhone at all instead of falling
// back to plain frosted glass.
//
// We add a `.has-svg-glass` class on <html> for browsers we trust to
// actually render `url()` in backdrop-filter (Chromium + Firefox + their
// derivatives), and the styles.css @supports block requires this class
// to take effect. Safari therefore falls through to the base frosted-
// glass rule.
//
// UA sniffing is gross but the alternative — a runtime probe that
// reads back rendered pixels — is heavy and slower than just shipping.
// Revisit if WebKit ships proper support.
const ua = navigator.userAgent;
const isSafari = /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(ua);
if (!isSafari) {
  document.documentElement.classList.add("has-svg-glass");
}

// Restore the user's theme choice before the first paint so we don't
// flash the default palette on every load. If they haven't chosen yet,
// follow the OS's prefers-color-scheme. ThemeToggle then takes over.
{
  const t = localStorage.getItem("cragstronauts.theme");
  if (t === "light") {
    document.documentElement.classList.add("theme-light");
  } else if (t === "party") {
    document.documentElement.classList.add("theme-party");
  } else if (t !== "dark") {
    // No explicit choice — mirror the OS. Dark = no class (default).
    if (window.matchMedia?.("(prefers-color-scheme: light)").matches) {
      document.documentElement.classList.add("theme-light");
    }
  }
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <TripListing /> },
      { path: "trips/new", element: <OrganizerWizard /> },
      {
        path: "trips/:tripId",
        element: <TripLayout />,
        children: [
          { index: true, element: <Landing /> },
          { path: "board", element: <TripDashboard /> },
        ],
      },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

// NOTE: StrictMode was deadlocking framer-motion's AnimatePresence
// (cards stuck at opacity 0 on first mount). Disabled until we move to
// a more StrictMode-tolerant animation pattern.
ReactDOM.createRoot(document.getElementById("root")!).render(
  <RouterProvider router={router} />
);
