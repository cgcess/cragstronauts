import React, { useEffect, useState } from "react";

type Theme = "dark" | "light" | "party";
const THEMES: Theme[] = ["dark", "light", "party"];
const STORAGE_KEY = "cragstronauts.theme";

const ICON: Record<Theme, string> = {
  dark: "🌙",
  light: "☀️",
  party: "🪩",
};
const LABEL: Record<Theme, string> = {
  dark: "Dark mode",
  light: "Light mode",
  party: "Party mode",
};

function readInitial(): Theme {
  if (typeof window === "undefined") return "dark";
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "party" || v === "dark" ? v : "dark";
}

function apply(theme: Theme) {
  const cls = document.documentElement.classList;
  cls.toggle("theme-light", theme === "light");
  cls.toggle("theme-party", theme === "party");
  // "dark" = no class (it's the :root default).
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readInitial);

  useEffect(() => {
    apply(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const cycle = () => {
    setTheme((cur) => THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length]);
  };
  const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];

  return (
    <button
      type="button"
      className={`theme-toggle theme-toggle--${theme}`}
      onClick={cycle}
      aria-label={`Switch to ${LABEL[next].toLowerCase()}`}
      title={`Switch to ${LABEL[next]}`}
    >
      {ICON[theme]}
    </button>
  );
}
