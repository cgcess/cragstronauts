import React from "react";
import { Outlet } from "react-router";
import AlpsBackground from "./components/AlpsBackground";
import GlassFilter from "./components/GlassFilter";
import ThemeToggle from "./components/ThemeToggle";
import { ConfirmProvider } from "./components/ui";
import { clerkEnabled } from "./lib/clerk";
import ClerkTokenBridge from "./components/ClerkTokenBridge";
import AuthControl from "./components/AuthControl";

export default function App() {
  return (
    <ConfirmProvider>
      <GlassFilter />
      <AlpsBackground />
      {clerkEnabled && <ClerkTokenBridge />}
      <Outlet />
      <ThemeToggle />
      {clerkEnabled && <AuthControl />}
    </ConfirmProvider>
  );
}
