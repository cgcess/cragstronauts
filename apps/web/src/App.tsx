import React from "react";
import { Outlet } from "react-router";
import AlpsBackground from "./components/AlpsBackground";
import GlassFilter from "./components/GlassFilter";
import ThemeToggle from "./components/ThemeToggle";
import { ConfirmProvider } from "./components/ui";
import { clerkEnabled } from "./lib/clerk";
import ClerkTokenBridge from "./components/ClerkTokenBridge";
import ProfileButton from "./components/profile/ProfileButton";
import NicknamePrompt from "./components/NicknamePrompt";

export default function App() {
  return (
    <ConfirmProvider>
      <GlassFilter />
      <AlpsBackground />
      {clerkEnabled && <ClerkTokenBridge />}
      {clerkEnabled && <NicknamePrompt />}
      <div className="app-topbar">
        <ThemeToggle />
        {clerkEnabled && <ProfileButton />}
      </div>
      <Outlet />
    </ConfirmProvider>
  );
}
