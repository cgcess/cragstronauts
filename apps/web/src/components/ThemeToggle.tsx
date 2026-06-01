import React, { useEffect, useState } from "react";

type Theme = "default" | "party";
const STORAGE_KEY = "cragstronauts.theme";

function readInitialTheme(): Theme {
  if (typeof window === "undefined") return "default";
  return localStorage.getItem(STORAGE_KEY) === "party" ? "party" : "default";
}

function applyTheme(theme: Theme) {
  const cls = document.documentElement.classList;
  if (theme === "party") cls.add("theme-party");
  else cls.remove("theme-party");
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readInitialTheme);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggle = () =>
    setTheme((t) => (t === "default" ? "party" : "default"));

  const inParty = theme === "party";
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-pressed={inParty}
      aria-label={inParty ? "Exit party mode" : "Enter party mode"}
      title={inParty ? "Exit party mode" : "Enter party mode"}
    >
      {inParty ? "🌙" : "🪩"}
    </button>
  );
}
