import React from "react";
import { Outlet } from "react-router";
import AlpsBackground from "./components/AlpsBackground";
import GlassFilter from "./components/GlassFilter";

export default function App() {
  return (
    <>
      <GlassFilter />
      <AlpsBackground />
      <Outlet />
    </>
  );
}
