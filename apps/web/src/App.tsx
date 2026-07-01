import React from "react";
import { Outlet } from "react-router";
import AlpsBackground from "./components/AlpsBackground";
import GlassFilter from "./components/GlassFilter";
import ThemeToggle from "./components/ThemeToggle";
import { ConfirmProvider } from "./components/ui";
import ClerkTokenBridge from "./components/ClerkTokenBridge";
import ProfileButton from "./components/profile/ProfileButton";

export default function App() {
  return (
    <ConfirmProvider>
      <GlassFilter />
      <AlpsBackground />
      <ClerkTokenBridge />
      <div className="app-topbar">
        <ThemeToggle />
        <ProfileButton />
      </div>
      <Outlet />
    </ConfirmProvider>
  );
}
