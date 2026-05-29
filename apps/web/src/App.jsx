import React from "react";
import { Outlet } from "react-router";
import AlpsBackground from "./components/AlpsBackground.jsx";
import GlassFilter from "./components/GlassFilter.jsx";

export default function App() {
  return (
    <>
      <GlassFilter />
      <AlpsBackground />
      <Outlet />
    </>
  );
}
