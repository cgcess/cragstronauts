import React from "react";
import { Outlet, useNavigate } from "react-router";
import AlpsBackground from "./components/AlpsBackground";
import GlassFilter from "./components/GlassFilter";
import ThemeToggle from "./components/ThemeToggle";
import { Button, ConfirmProvider } from "./components/ui";
import ClerkTokenBridge from "./components/ClerkTokenBridge";
import ProfileButton from "./components/profile/ProfileButton";

export default function App() {
  const navigate = useNavigate();
  return (
    <ConfirmProvider>
      <GlassFilter />
      <AlpsBackground />
      <ClerkTokenBridge />
      <div className="app-topbar">
        <ThemeToggle />
        {/* Center: link back to "My trips" (owned + joined) at `/`. */}
        <Button variant="secondary" onClick={() => navigate("/")}>
          My trips
        </Button>
        <ProfileButton />
      </div>
      <Outlet />
    </ConfirmProvider>
  );
}
