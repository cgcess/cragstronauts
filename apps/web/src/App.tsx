import React from "react";
import { Outlet } from "react-router";
import AlpsBackground from "./components/AlpsBackground";
import GlassFilter from "./components/GlassFilter";
import ThemeToggle from "./components/ThemeToggle";

export default function App() {
  return (
    <>
      <GlassFilter />
      <AlpsBackground />
      <Outlet />
      <ThemeToggle />
    </>
  );
}
