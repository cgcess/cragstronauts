import React from "react";
import { Outlet } from "react-router";
import AlpsBackground from "./components/AlpsBackground";
import GlassFilter from "./components/GlassFilter";
import ThemeToggle from "./components/ThemeToggle";
import { ConfirmProvider } from "./components/ui";

export default function App() {
  return (
    <ConfirmProvider>
      <GlassFilter />
      <AlpsBackground />
      <Outlet />
      <ThemeToggle />
    </ConfirmProvider>
  );
}
