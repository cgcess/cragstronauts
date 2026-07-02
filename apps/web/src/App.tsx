import React from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import AlpsBackground from "./components/AlpsBackground";
import GlassFilter from "./components/GlassFilter";
import ThemeToggle from "./components/ThemeToggle";
import { Button, ConfirmProvider } from "./components/ui";
import ClerkTokenBridge from "./components/ClerkTokenBridge";
import ProfileButton from "./components/profile/ProfileButton";

// A trip detail page is /trips/:tripId (and its /board child) — but NOT the
// /trips/new creation page.
function isTripDetail(pathname: string): boolean {
  const seg = pathname.match(/^\/trips\/([^/]+)/)?.[1];
  return !!seg && seg !== "new";
}

export default function App() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const onTripDetail = isTripDetail(pathname);

  return (
    <ConfirmProvider>
      <GlassFilter />
      <AlpsBackground />
      <ClerkTokenBridge />
      <div className="app-topbar">
        <ThemeToggle />
        {/* Center: the "My trips" button only on a trip detail page; on every
            other screen the brand takes its place. */}
        {onTripDetail ? (
          <Button variant="secondary" onClick={() => navigate("/")}>
            My trips
          </Button>
        ) : (
          <div className="app-topbar__brand">
            <span className="fl-brand">
              <span className="fl-brand__glyph">🧗</span>
              Cragstronauts
            </span>
            <span className="fl-brand__sub">Plan the climb. Pack the car.</span>
          </div>
        )}
        <ProfileButton />
      </div>
      <Outlet />
    </ConfirmProvider>
  );
}
