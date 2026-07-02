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
        {onTripDetail ? (
          <Button variant="secondary" onClick={() => navigate("/")}>
            <img src="/logo.jpeg" alt="" className="fl-logo-icon" />
            My trips
          </Button>
        ) : (
          <div className="app-topbar__brand">
            <span className="fl-brand">
              <img src="/logo.jpeg" alt="" className="fl-logo-icon" />
              Cragstronauts
            </span>
          </div>
        )}
        <ProfileButton />
      </div>
      <Outlet />
    </ConfirmProvider>
  );
}
